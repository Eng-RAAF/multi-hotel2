import { ConvexError } from "convex/values";

export const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "asset" },
  { code: "1010", name: "Bank Account", type: "asset" },
  { code: "1020", name: "Mobile Money", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1500", name: "Hotel Equipment", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Loans", type: "liability" },
  { code: "2200", name: "Taxes Payable", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "4000", name: "Room Revenue", type: "income" },
  { code: "4100", name: "Restaurant Revenue", type: "income" },
  { code: "4200", name: "Service Revenue", type: "income" },
  { code: "4300", name: "Laundry Revenue", type: "income" },
  { code: "4400", name: "Conference Revenue", type: "income" },
  { code: "4500", name: "Transportation Revenue", type: "income" },
  { code: "4900", name: "Other Income", type: "income" },
  { code: "5000", name: "Salaries", type: "expense" },
  { code: "5100", name: "Electricity", type: "expense" },
  { code: "5110", name: "Water", type: "expense" },
  { code: "5120", name: "Internet", type: "expense" },
  { code: "5200", name: "Food and Beverage", type: "expense" },
  { code: "5300", name: "Hotel Supplies", type: "expense" },
  { code: "5400", name: "Maintenance", type: "expense" },
  { code: "5500", name: "Rent", type: "expense" },
  { code: "5600", name: "Marketing", type: "expense" },
  { code: "5700", name: "Transportation", type: "expense" },
  { code: "5900", name: "Other Expenses", type: "expense" },
];

export const PAYMENT_ACCOUNT = {
  cash: "1000",
  bank: "1010",
  card: "1010",
  mobile_money: "1020",
};

export const CASH_CODES = ["1000", "1010", "1020"];

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function invoiceStatus(total, paid) {
  const balance = roundMoney(total - paid);
  if (balance <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export async function accountByCode(ctx, code) {
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  if (!account || !account.active) throw new ConvexError(`Account ${code} is not available`);
  return account;
}

export async function postJournal(ctx, entry) {
  const lines = entry.lines.map((line) => ({
    accountCode: line.accountCode,
    debit: roundMoney(line.debit || 0),
    credit: roundMoney(line.credit || 0),
  }));
  const debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(debit - credit) > 0.001 || debit <= 0) {
    throw new ConvexError("Journal entry must be balanced and greater than zero");
  }
  const entryId = await ctx.db.insert("journalEntries", {
    hotelId: entry.hotelId,
    date: entry.date,
    description: entry.description,
    reference: entry.reference || "",
    source: entry.source,
    sourceId: entry.sourceId ? String(entry.sourceId) : "",
    userId: entry.userId,
    createdAt: Date.now(),
  });
  for (const line of lines) {
    const account = await accountByCode(ctx, line.accountCode);
    await ctx.db.insert("journalLines", {
      entryId,
      accountId: account._id,
      accountCode: line.accountCode,
      debit: line.debit,
      credit: line.credit,
      hotelId: entry.hotelId,
      date: entry.date,
      description: entry.description,
    });
  }
  return entryId;
}

export function paymentAccount(method) {
  const code = PAYMENT_ACCOUNT[method];
  if (!code) throw new ConvexError("Choose a valid payment method");
  return code;
}
