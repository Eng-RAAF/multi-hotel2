import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";
import { roundMoney } from "./lib/accounting";
import { cancelInvoice, createInvoice, recordPayment } from "./lib/billing";
import { daysBetween, todayISO } from "./lib/dates";

const FINANCE = ["super_admin", "hotel_manager", "receptionist", "accountant"];

async function names(ctx) {
  const [hotels, guests, customers] = await Promise.all([
    ctx.db.query("hotels").collect(),
    ctx.db.query("guests").collect(),
    ctx.db.query("customers").collect(),
  ]);
  return {
    hotels: new Map(hotels.map((hotel) => [hotel._id, hotel.name])),
    guests: new Map(guests.map((guest) => [guest._id, guest.fullName])),
    customers: new Map(customers.map((customer) => [customer._id, customer.name])),
  };
}

export const listInvoices = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const hotelId = resolveHotel(user, args.hotelId);
    const invoices = hotelId
      ? await ctx.db.query("invoices").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("invoices").collect();
    const lookup = await names(ctx);
    return invoices
      .map((invoice) => ({
        ...invoice,
        balance: roundMoney(invoice.total - invoice.paid),
        hotelName: lookup.hotels.get(invoice.hotelId) || "",
        party: invoice.billTo || lookup.guests.get(invoice.guestId) || lookup.customers.get(invoice.customerId) || "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  },
});

export const getInvoice = query({
  args: { token: v.string(), invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    requireHotel(user, invoice.hotelId);
    const [items, payments, hotel, guest] = await Promise.all([
      ctx.db.query("invoiceItems").withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id)).collect(),
      ctx.db.query("payments").withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id)).collect(),
      ctx.db.get(invoice.hotelId),
      invoice.guestId ? ctx.db.get(invoice.guestId) : null,
    ]);
    return { ...invoice, balance: roundMoney(invoice.total - invoice.paid), items, payments, hotel, guest };
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    guestId: v.optional(v.id("guests")),
    customerId: v.optional(v.id("customers")),
    date: v.string(),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    items: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      accountCode: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const hotelId = requireHotel(user, args.hotelId);
    const hotel = await ctx.db.get(hotelId);
    if (!hotel) throw new ConvexError("Hotel not found");
    let billTo = "";
    if (args.guestId) {
      const guest = await ctx.db.get(args.guestId);
      if (!guest || guest.hotelId !== hotelId) throw new ConvexError("Guest not found");
      billTo = guest.fullName;
    } else if (args.customerId) {
      const customer = await ctx.db.get(args.customerId);
      if (!customer || customer.hotelId !== hotelId) throw new ConvexError("Customer not found");
      billTo = customer.name;
    } else {
      throw new ConvexError("Choose a guest or customer");
    }
    const invoice = await createInvoice(ctx, {
      hotel,
      guestId: args.guestId,
      customerId: args.customerId,
      items: args.items,
      date: args.date || todayISO(),
      dueDate: args.dueDate,
      notes: args.notes,
      user,
      billTo,
    });
    await writeAudit(ctx, { user, action: "create", entity: "invoice", entityId: invoice._id, hotelId, details: invoice.number });
    return invoice._id;
  },
});

export const pay = mutation({
  args: {
    token: v.string(),
    invoiceId: v.id("invoices"),
    amount: v.number(),
    method: v.string(),
    date: v.string(),
    reference: v.optional(v.string()),
    type: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new ConvexError("Invoice not found");
    requireHotel(user, invoice.hotelId);
    const updated = await recordPayment(ctx, {
      invoice,
      amount: args.amount,
      method: args.method,
      date: args.date || todayISO(),
      reference: args.reference,
      user,
      type: args.type === "refund" ? "refund" : "payment",
      notes: args.notes,
    });
    await writeAudit(ctx, {
      user,
      action: args.type === "refund" ? "refund" : "payment",
      entity: "payment",
      entityId: invoice._id,
      hotelId: invoice.hotelId,
      details: `${invoice.number} · ${args.amount}`,
    });
    return updated._id;
  },
});

export const cancel = mutation({
  args: { token: v.string(), invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "accountant"]);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new ConvexError("Invoice not found");
    requireHotel(user, invoice.hotelId);
    await cancelInvoice(ctx, invoice, user);
    await writeAudit(ctx, { user, action: "cancel", entity: "invoice", entityId: invoice._id, hotelId: invoice.hotelId, details: invoice.number });
  },
});

export const listPayments = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const hotelId = resolveHotel(user, args.hotelId);
    const payments = hotelId
      ? await ctx.db.query("payments").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("payments").collect();
    const lookup = await names(ctx);
    const invoices = await ctx.db.query("invoices").collect();
    const numbers = new Map(invoices.map((invoice) => [invoice._id, invoice.number]));
    return payments
      .map((payment) => ({
        ...payment,
        hotelName: lookup.hotels.get(payment.hotelId) || "",
        party: lookup.guests.get(payment.guestId) || lookup.customers.get(payment.customerId) || "",
        invoiceNumber: numbers.get(payment.invoiceId) || "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const listCustomers = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const hotelId = resolveHotel(user, args.hotelId);
    const customers = hotelId
      ? await ctx.db.query("customers").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("customers").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const hotelNames = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return customers.map((customer) => {
      const rows = invoices.filter((invoice) => invoice.customerId === customer._id && invoice.status !== "cancelled");
      return {
        ...customer,
        hotelName: hotelNames.get(customer.hotelId) || "",
        balance: roundMoney(rows.reduce((sum, invoice) => sum + (invoice.total - invoice.paid), 0)),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveCustomer = mutation({
  args: {
    token: v.string(),
    customerId: v.optional(v.id("customers")),
    hotelId: v.id("hotels"),
    name: v.string(),
    kind: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FINANCE);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Customer name is required");
    const payload = {
      hotelId,
      name,
      kind: args.kind || "company",
      phone: args.phone.trim(),
      email: args.email.trim().toLowerCase(),
      address: args.address.trim(),
      notes: args.notes?.trim() || "",
    };
    if (args.customerId) {
      await ctx.db.patch(args.customerId, payload);
      return args.customerId;
    }
    const customerId = await ctx.db.insert("customers", { ...payload, createdAt: Date.now() });
    await writeAudit(ctx, { user, action: "create", entity: "customer", entityId: customerId, hotelId, details: name });
    return customerId;
  },
});

export const receivables = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "accountant"]);
    const hotelId = resolveHotel(user, args.hotelId);
    const today = todayISO();
    const invoices = (hotelId
      ? await ctx.db.query("invoices").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("invoices").collect()
    ).filter((invoice) => invoice.status === "unpaid" || invoice.status === "partial");
    const lookup = await names(ctx);
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    const rows = invoices.map((invoice) => {
      const age = Math.max(0, daysBetween(invoice.date, today));
      const balance = roundMoney(invoice.total - invoice.paid);
      if (age <= 30) buckets.current += balance;
      else if (age <= 60) buckets.d30 += balance;
      else if (age <= 90) buckets.d60 += balance;
      else buckets.older += balance;
      return {
        ...invoice,
        age,
        balance,
        hotelName: lookup.hotels.get(invoice.hotelId) || "",
        party: invoice.billTo,
      };
    });
    return {
      rows: rows.sort((a, b) => b.age - a.age),
      buckets: {
        current: roundMoney(buckets.current),
        d30: roundMoney(buckets.d30),
        d60: roundMoney(buckets.d60),
        d90: roundMoney(buckets.d90),
        older: roundMoney(buckets.older),
      },
      total: roundMoney(rows.reduce((sum, row) => sum + row.balance, 0)),
    };
  },
});
