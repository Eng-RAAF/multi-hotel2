import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";
import { accountByCode, invoiceStatus, paymentAccount, postJournal, roundMoney } from "./lib/accounting";
import { nextNumber } from "./lib/billing";
import { todayISO } from "./lib/dates";

const ACCOUNTING = ["super_admin", "hotel_manager", "accountant"];

export const listAccounts = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, [...ACCOUNTING, "receptionist"]);
    const accounts = await ctx.db.query("accounts").collect();
    return accounts.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const saveAccount = mutation({
  args: {
    token: v.string(),
    code: v.string(),
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "accountant"]);
    const code = args.code.trim();
    const name = args.name.trim();
    if (!/^\d{3,6}$/.test(code)) throw new ConvexError("Account code should be 3 to 6 digits");
    if (!name) throw new ConvexError("Account name is required");
    if (!["asset", "liability", "equity", "income", "expense"].includes(args.type)) {
      throw new ConvexError("Choose a valid account type");
    }
    const existing = await ctx.db.query("accounts").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (existing) throw new ConvexError("That account code already exists");
    const id = await ctx.db.insert("accounts", {
      code,
      name,
      type: args.type,
      active: true,
      description: args.description?.trim() || "",
    });
    await writeAudit(ctx, { user, action: "create", entity: "account", entityId: id, details: `${code} ${name}` });
    return id;
  },
});

export const listIncome = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const rows = hotelId
      ? await ctx.db.query("incomeRecords").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("incomeRecords").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return rows.map((row) => ({ ...row, hotelName: names.get(row.hotelId) || "" })).sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const recordIncome = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    date: v.string(),
    category: v.string(),
    accountCode: v.string(),
    amount: v.number(),
    method: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = requireHotel(user, args.hotelId);
    const amount = roundMoney(args.amount);
    if (amount <= 0) throw new ConvexError("Enter an income amount");
    const account = await accountByCode(ctx, args.accountCode);
    if (account.type !== "income") throw new ConvexError("Choose an income account");
    const id = await ctx.db.insert("incomeRecords", {
      hotelId,
      date: args.date || todayISO(),
      category: args.category.trim() || account.name,
      accountCode: account.code,
      amount,
      method: args.method,
      description: args.description.trim() || account.name,
      userId: user._id,
      createdAt: Date.now(),
    });
    await postJournal(ctx, {
      hotelId,
      date: args.date || todayISO(),
      description: args.description.trim() || account.name,
      reference: `INC-${String(id).slice(-6)}`,
      source: "income",
      sourceId: id,
      userId: user._id,
      lines: [
        { accountCode: paymentAccount(args.method), debit: amount, credit: 0 },
        { accountCode: account.code, debit: 0, credit: amount },
      ],
    });
    await writeAudit(ctx, { user, action: "create", entity: "income", entityId: id, hotelId, details: `${account.name} · ${amount}` });
    return id;
  },
});

export const listExpenses = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const rows = hotelId
      ? await ctx.db.query("expenses").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("expenses").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return rows.map((row) => ({ ...row, hotelName: names.get(row.hotelId) || "" })).sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const recordExpense = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    supplierId: v.optional(v.id("suppliers")),
    date: v.string(),
    category: v.string(),
    accountCode: v.string(),
    amount: v.number(),
    method: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = requireHotel(user, args.hotelId);
    const amount = roundMoney(args.amount);
    if (amount <= 0) throw new ConvexError("Enter an expense amount");
    const account = await accountByCode(ctx, args.accountCode);
    if (account.type !== "expense") throw new ConvexError("Choose an expense account");
    const expenseRow = {
      hotelId,
      date: args.date || todayISO(),
      category: args.category.trim() || account.name,
      accountCode: account.code,
      amount,
      method: args.method,
      description: args.description.trim() || account.name,
      userId: user._id,
      createdAt: Date.now(),
    };
    if (args.supplierId) expenseRow.supplierId = args.supplierId;
    const id = await ctx.db.insert("expenses", expenseRow);
    await postJournal(ctx, {
      hotelId,
      date: args.date || todayISO(),
      description: args.description.trim() || account.name,
      reference: `EXP-${String(id).slice(-6)}`,
      source: "expense",
      sourceId: id,
      userId: user._id,
      lines: [
        { accountCode: account.code, debit: amount, credit: 0 },
        { accountCode: paymentAccount(args.method), debit: 0, credit: amount },
      ],
    });
    await writeAudit(ctx, { user, action: "create", entity: "expense", entityId: id, hotelId, details: `${account.name} · ${amount}` });
    return id;
  },
});

export const listSuppliers = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const suppliers = hotelId
      ? await ctx.db.query("suppliers").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("suppliers").collect();
    const bills = await ctx.db.query("bills").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return suppliers.map((supplier) => ({
      ...supplier,
      hotelName: names.get(supplier.hotelId) || "",
      balance: roundMoney(bills.filter((bill) => bill.supplierId === supplier._id && bill.status !== "paid" && bill.status !== "cancelled")
        .reduce((sum, bill) => sum + (bill.amount - bill.paid), 0)),
    })).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveSupplier = mutation({
  args: {
    token: v.string(),
    supplierId: v.optional(v.id("suppliers")),
    hotelId: v.id("hotels"),
    name: v.string(),
    category: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Supplier name is required");
    const payload = {
      hotelId,
      name,
      category: args.category.trim() || "Other",
      phone: args.phone.trim(),
      email: args.email.trim().toLowerCase(),
      address: args.address.trim(),
      notes: args.notes?.trim() || "",
    };
    if (args.supplierId) {
      await ctx.db.patch(args.supplierId, payload);
      return args.supplierId;
    }
    const id = await ctx.db.insert("suppliers", { ...payload, createdAt: Date.now() });
    await writeAudit(ctx, { user, action: "create", entity: "supplier", entityId: id, hotelId, details: name });
    return id;
  },
});

export const listBills = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const bills = hotelId
      ? await ctx.db.query("bills").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("bills").collect();
    const suppliers = await ctx.db.query("suppliers").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const supplierNames = new Map(suppliers.map((supplier) => [supplier._id, supplier.name]));
    const hotelNames = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return bills.map((bill) => ({
      ...bill,
      balance: roundMoney(bill.amount - bill.paid),
      supplierName: supplierNames.get(bill.supplierId) || "",
      hotelName: hotelNames.get(bill.hotelId) || "",
    })).sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const saveBill = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    supplierId: v.id("suppliers"),
    date: v.string(),
    dueDate: v.string(),
    description: v.string(),
    accountCode: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = requireHotel(user, args.hotelId);
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier || supplier.hotelId !== hotelId) throw new ConvexError("Supplier not found");
    const amount = roundMoney(args.amount);
    if (amount <= 0) throw new ConvexError("Enter a bill amount");
    const account = await accountByCode(ctx, args.accountCode);
    if (account.type !== "expense") throw new ConvexError("Choose an expense account");
    const number = await nextNumber(ctx, "bills", "BILL");
    const id = await ctx.db.insert("bills", {
      hotelId,
      supplierId: supplier._id,
      number,
      date: args.date || todayISO(),
      dueDate: args.dueDate || args.date || todayISO(),
      description: args.description.trim() || account.name,
      accountCode: account.code,
      amount,
      paid: 0,
      status: "unpaid",
      createdBy: user._id,
      createdAt: Date.now(),
    });
    await postJournal(ctx, {
      hotelId,
      date: args.date || todayISO(),
      description: `Bill ${number} — ${supplier.name}`,
      reference: number,
      source: "bill",
      sourceId: id,
      userId: user._id,
      lines: [
        { accountCode: account.code, debit: amount, credit: 0 },
        { accountCode: "2000", debit: 0, credit: amount },
      ],
    });
    await writeAudit(ctx, { user, action: "create", entity: "bill", entityId: id, hotelId, details: number });
    return id;
  },
});

export const payBill = mutation({
  args: {
    token: v.string(),
    billId: v.id("bills"),
    amount: v.number(),
    method: v.string(),
    date: v.string(),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const bill = await ctx.db.get(args.billId);
    if (!bill) throw new ConvexError("Bill not found");
    requireHotel(user, bill.hotelId);
    const amount = roundMoney(args.amount);
    const balance = roundMoney(bill.amount - bill.paid);
    if (amount <= 0 || amount - balance > 0.001) throw new ConvexError("Payment must be within the balance due");
    const paid = roundMoney(bill.paid + amount);
    await ctx.db.patch(bill._id, { paid, status: invoiceStatus(bill.amount, paid) });
    await postJournal(ctx, {
      hotelId: bill.hotelId,
      date: args.date || todayISO(),
      description: `Pay bill ${bill.number}`,
      reference: args.reference?.trim() || bill.number,
      source: "bill_payment",
      sourceId: bill._id,
      userId: user._id,
      lines: [
        { accountCode: "2000", debit: amount, credit: 0 },
        { accountCode: paymentAccount(args.method), debit: 0, credit: amount },
      ],
    });
    await writeAudit(ctx, { user, action: "payment", entity: "bill", entityId: bill._id, hotelId: bill.hotelId, details: bill.number });
  },
});

export const ledger = query({
  args: {
    token: v.string(),
    hotelId: v.optional(v.id("hotels")),
    accountId: v.optional(v.id("accounts")),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const accounts = await ctx.db.query("accounts").collect();
    let lines = hotelId
      ? await ctx.db.query("journalLines").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("journalLines").collect();
    if (args.from) lines = lines.filter((line) => line.date >= args.from);
    if (args.to) lines = lines.filter((line) => line.date <= args.to);
    if (args.accountId) lines = lines.filter((line) => line.accountId === args.accountId);
    const accountNames = new Map(accounts.map((account) => [account._id, account]));
    const hotels = await ctx.db.query("hotels").collect();
    const hotelNames = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    lines.sort((a, b) => a.date.localeCompare(b.date) || a.accountCode.localeCompare(b.accountCode));
    let running = 0;
    const account = args.accountId ? accountNames.get(args.accountId) : null;
    const normalCredit = account && ["liability", "equity", "income"].includes(account.type);
    const rows = lines.map((line) => {
      running = roundMoney(running + (normalCredit ? line.credit - line.debit : line.debit - line.credit));
      const info = accountNames.get(line.accountId);
      return {
        ...line,
        accountName: info?.name || line.accountCode,
        accountType: info?.type || "",
        hotelName: hotelNames.get(line.hotelId) || "",
        running: args.accountId ? running : null,
      };
    });
    return { rows, account };
  },
});

export const cashbook = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const accounts = (await ctx.db.query("accounts").collect()).filter((account) => ["1000", "1010", "1020"].includes(account.code));
    let lines = hotelId
      ? await ctx.db.query("journalLines").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("journalLines").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const hotelNames = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    const balances = accounts.map((account) => {
      const accountLines = lines.filter((line) => line.accountCode === account.code);
      const balance = roundMoney(accountLines.reduce((sum, line) => sum + line.debit - line.credit, 0));
      return { ...account, balance };
    });
    const transactions = lines
      .filter((line) => ["1000", "1010", "1020"].includes(line.accountCode))
      .map((line) => ({ ...line, hotelName: hotelNames.get(line.hotelId) || "" }))
      .sort((a, b) => b.date.localeCompare(a.date));
    return { balances, transactions };
  },
});

export const recentEntries = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ACCOUNTING);
    const hotelId = resolveHotel(user, args.hotelId);
    const entries = hotelId
      ? await ctx.db.query("journalEntries").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("journalEntries").collect();
    const lines = await ctx.db.query("journalLines").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const hotelNames = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return entries
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12)
      .map((entry) => {
        const entryLines = lines.filter((line) => line.entryId === entry._id);
        return {
          ...entry,
          hotelName: hotelNames.get(entry.hotelId) || "",
          amount: roundMoney(entryLines.reduce((sum, line) => sum + line.debit, 0)),
        };
      });
  },
});
