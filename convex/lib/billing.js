import { ConvexError } from "convex/values";
import { accountByCode, invoiceStatus, paymentAccount, postJournal, roundMoney } from "./accounting";
import { addDays } from "./dates";

export async function nextNumber(ctx, table, prefix) {
  const rows = await ctx.db.query(table).collect();
  return `${prefix}-${1000 + rows.length + 1}`;
}

export async function createInvoice(ctx, args) {
  const items = (args.items || []).map((item) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = roundMoney(item.unitPrice);
    if (!item.description?.trim()) throw new ConvexError("Each invoice line needs a description");
    if (quantity <= 0 || unitPrice < 0) throw new ConvexError("Invoice quantities and prices must be valid");
    return {
      description: item.description.trim(),
      quantity,
      unitPrice,
      amount: roundMoney(quantity * unitPrice),
      accountCode: item.accountCode || "4000",
    };
  });
  if (!items.length) throw new ConvexError("Add at least one invoice line");
  for (const item of items) {
    const account = await accountByCode(ctx, item.accountCode);
    if (account.type !== "income") throw new ConvexError(`${item.accountCode} is not an income account`);
  }
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  const taxRate = Number(args.taxRate ?? args.hotel.taxRate ?? 0);
  const serviceRate = Number(args.serviceRate ?? args.hotel.serviceCharge ?? 0);
  const tax = roundMoney(subtotal * taxRate / 100);
  const serviceCharge = roundMoney(subtotal * serviceRate / 100);
  const total = roundMoney(subtotal + tax + serviceCharge);
  const number = await nextNumber(ctx, "invoices", "INV");
  const invoiceRow = {
    hotelId: args.hotel._id,
    number,
    date: args.date,
    dueDate: args.dueDate || addDays(args.date, 7),
    subtotal,
    taxRate,
    serviceRate,
    tax,
    serviceCharge,
    total,
    paid: 0,
    status: "unpaid",
    notes: args.notes || "",
    billTo: args.billTo,
    createdBy: args.user._id,
    createdAt: Date.now(),
  };
  if (args.guestId) invoiceRow.guestId = args.guestId;
  if (args.customerId) invoiceRow.customerId = args.customerId;
  if (args.reservationId) invoiceRow.reservationId = args.reservationId;
  const invoiceId = await ctx.db.insert("invoices", invoiceRow);
  for (const item of items) {
    await ctx.db.insert("invoiceItems", { invoiceId, ...item });
  }
  const lines = [{ accountCode: "1100", debit: total, credit: 0 }];
  const credits = new Map();
  for (const item of items) credits.set(item.accountCode, roundMoney((credits.get(item.accountCode) || 0) + item.amount));
  if (tax > 0) credits.set("2200", roundMoney((credits.get("2200") || 0) + tax));
  if (serviceCharge > 0) credits.set("4200", roundMoney((credits.get("4200") || 0) + serviceCharge));
  for (const [accountCode, amount] of credits) {
    lines.push({ accountCode, debit: 0, credit: amount });
  }
  await postJournal(ctx, {
    hotelId: args.hotel._id,
    date: args.date,
    description: `Invoice ${number} — ${args.billTo}`,
    reference: number,
    source: "invoice",
    sourceId: invoiceId,
    userId: args.user._id,
    lines,
  });
  let invoice = await ctx.db.get(invoiceId);
  if (args.paymentAmount > 0) {
    invoice = await recordPayment(ctx, {
      invoice,
      amount: args.paymentAmount,
      method: args.method || "cash",
      date: args.date,
      reference: args.reference || "",
      user: args.user,
      type: "payment",
    });
  }
  return invoice;
}

export async function recordPayment(ctx, args) {
  const invoice = args.invoice;
  if (!invoice || invoice.status === "cancelled") throw new ConvexError("Invoice is not open");
  const amount = roundMoney(args.amount);
  if (amount <= 0) throw new ConvexError("Enter a payment amount");
  const balance = roundMoney(invoice.total - invoice.paid);
  const isRefund = args.type === "refund";
  if (!isRefund && amount - balance > 0.001) throw new ConvexError("Payment is higher than the balance due");
  if (isRefund && amount - invoice.paid > 0.001) throw new ConvexError("Refund is higher than the amount paid");
  const cashCode = paymentAccount(args.method);
  const reference = args.reference?.trim() || `${isRefund ? "RF" : "RCT"}-${Date.now().toString(36).toUpperCase()}`;
  const paymentRow = {
    hotelId: invoice.hotelId,
    invoiceId: invoice._id,
    amount,
    method: args.method,
    date: args.date,
    reference,
    type: isRefund ? "refund" : "payment",
    notes: args.notes || "",
    userId: args.user._id,
    userName: args.user.name,
    createdAt: Date.now(),
  };
  if (invoice.guestId) paymentRow.guestId = invoice.guestId;
  if (invoice.customerId) paymentRow.customerId = invoice.customerId;
  await ctx.db.insert("payments", paymentRow);
  await postJournal(ctx, {
    hotelId: invoice.hotelId,
    date: args.date,
    description: `${isRefund ? "Refund" : "Payment"} ${reference} — ${invoice.number}`,
    reference,
    source: isRefund ? "refund" : "payment",
    sourceId: invoice._id,
    userId: args.user._id,
    lines: isRefund
      ? [
          { accountCode: "1100", debit: amount, credit: 0 },
          { accountCode: cashCode, debit: 0, credit: amount },
        ]
      : [
          { accountCode: cashCode, debit: amount, credit: 0 },
          { accountCode: "1100", debit: 0, credit: amount },
        ],
  });
  const paid = roundMoney(invoice.paid + (isRefund ? -amount : amount));
  const status = invoiceStatus(invoice.total, paid);
  await ctx.db.patch(invoice._id, { paid, status });
  return await ctx.db.get(invoice._id);
}

export async function cancelInvoice(ctx, invoice, user) {
  if (invoice.status === "cancelled") throw new ConvexError("Invoice is already cancelled");
  if (invoice.paid > 0) throw new ConvexError("Refund the payment before cancelling this invoice");
  const items = await ctx.db
    .query("invoiceItems")
    .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
    .collect();
  const lines = [{ accountCode: "1100", debit: 0, credit: invoice.total }];
  const debits = new Map();
  for (const item of items) debits.set(item.accountCode, roundMoney((debits.get(item.accountCode) || 0) + item.amount));
  if (invoice.tax > 0) debits.set("2200", roundMoney((debits.get("2200") || 0) + invoice.tax));
  if (invoice.serviceCharge > 0) debits.set("4200", roundMoney((debits.get("4200") || 0) + invoice.serviceCharge));
  for (const [accountCode, amount] of debits) lines.push({ accountCode, debit: amount, credit: 0 });
  await postJournal(ctx, {
    hotelId: invoice.hotelId,
    date: invoice.date,
    description: `Cancel invoice ${invoice.number}`,
    reference: invoice.number,
    source: "invoice_cancel",
    sourceId: invoice._id,
    userId: user._id,
    lines,
  });
  await ctx.db.patch(invoice._id, { status: "cancelled" });
}
