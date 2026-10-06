import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertRole, requireUser, resolveHotel } from "./lib/auth";
import { CASH_CODES, roundMoney } from "./lib/accounting";
import { daysBetween, todayISO } from "./lib/dates";

function signed(type, line) {
  if (type === "asset" || type === "expense") return line.debit - line.credit;
  return line.credit - line.debit;
}

export const get = query({
  args: {
    token: v.string(),
    hotelId: v.optional(v.id("hotels")),
    type: v.string(),
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "accountant"]);
    const hotelId = resolveHotel(user, args.hotelId);
    const [accounts, lines, hotels, payments, invoices, expenses, income] = await Promise.all([
      ctx.db.query("accounts").collect(),
      ctx.db.query("journalLines").collect(),
      ctx.db.query("hotels").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("expenses").collect(),
      ctx.db.query("incomeRecords").collect(),
    ]);
    const scoped = lines.filter((line) => (!hotelId || line.hotelId === hotelId) && line.date >= args.from && line.date <= args.to);
    const asOf = lines.filter((line) => (!hotelId || line.hotelId === hotelId) && line.date <= args.to);
    const byCode = new Map(accounts.map((account) => [account.code, { ...account, debit: 0, credit: 0, balance: 0 }]));
    for (const line of scoped) {
      const row = byCode.get(line.accountCode);
      if (!row) continue;
      row.debit = roundMoney(row.debit + line.debit);
      row.credit = roundMoney(row.credit + line.credit);
    }
    const totals = [...byCode.values()].map((row) => ({
      ...row,
      balance: roundMoney(signed(row.type, row)),
    }));
    const sumType = (type, source = totals) => roundMoney(source.filter((row) => row.type === type).reduce((sum, row) => sum + row.balance, 0));

    if (args.type === "profit-loss" || args.type === "income" || args.type === "expenses" || args.type === "monthly") {
      const incomeRows = totals.filter((row) => row.type === "income" && (row.debit || row.credit));
      const expenseRows = totals.filter((row) => row.type === "expense" && (row.debit || row.credit));
      const revenue = sumType("income");
      const expenseTotal = sumType("expense");
      return {
        type: args.type,
        from: args.from,
        to: args.to,
        incomeRows,
        expenseRows,
        revenue,
        expenses: expenseTotal,
        profit: roundMoney(revenue - expenseTotal),
      };
    }

    if (args.type === "trial-balance") {
      const rows = totals.filter((row) => row.debit || row.credit);
      return {
        type: args.type,
        from: args.from,
        to: args.to,
        rows,
        debit: roundMoney(rows.reduce((sum, row) => sum + row.debit, 0)),
        credit: roundMoney(rows.reduce((sum, row) => sum + row.credit, 0)),
      };
    }

    if (args.type === "balance-sheet") {
      const sheet = new Map(accounts.map((account) => [account.code, { ...account, debit: 0, credit: 0 }]));
      for (const line of asOf) {
        const row = sheet.get(line.accountCode);
        if (!row) continue;
        row.debit += line.debit;
        row.credit += line.credit;
      }
      const valued = [...sheet.values()].map((row) => ({ ...row, balance: roundMoney(signed(row.type, row)) })).filter((row) => row.balance);
      const assets = valued.filter((row) => row.type === "asset");
      const liabilities = valued.filter((row) => row.type === "liability");
      const equity = valued.filter((row) => row.type === "equity");
      const netIncome = roundMoney(
        valued.filter((row) => row.type === "income").reduce((sum, row) => sum + row.balance, 0)
        - valued.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.balance, 0),
      );
      return {
        type: args.type,
        from: args.from,
        to: args.to,
        assets,
        liabilities,
        equity,
        netIncome,
        assetTotal: roundMoney(assets.reduce((sum, row) => sum + row.balance, 0)),
        liabilityTotal: roundMoney(liabilities.reduce((sum, row) => sum + row.balance, 0)),
        equityTotal: roundMoney(equity.reduce((sum, row) => sum + row.balance, 0) + netIncome),
      };
    }

    if (args.type === "cash-flow") {
      const cashLines = scoped.filter((line) => CASH_CODES.includes(line.accountCode));
      const inflow = roundMoney(cashLines.reduce((sum, line) => sum + line.debit, 0));
      const outflow = roundMoney(cashLines.reduce((sum, line) => sum + line.credit, 0));
      return {
        type: args.type,
        from: args.from,
        to: args.to,
        inflow,
        outflow,
        net: roundMoney(inflow - outflow),
        rows: cashLines.sort((a, b) => a.date.localeCompare(b.date)),
      };
    }

    if (args.type === "hotel-performance") {
      const rows = hotels.filter((hotel) => !hotelId || hotel._id === hotelId).map((hotel) => {
        let revenue = 0;
        let expenseTotal = 0;
        for (const line of scoped) {
          if (line.hotelId !== hotel._id) continue;
          const account = byCode.get(line.accountCode);
          if (!account) continue;
          if (account.type === "income") revenue += line.credit - line.debit;
          if (account.type === "expense") expenseTotal += line.debit - line.credit;
        }
        return {
          name: hotel.name,
          city: hotel.city,
          revenue: roundMoney(revenue),
          expenses: roundMoney(expenseTotal),
          profit: roundMoney(revenue - expenseTotal),
        };
      });
      return { type: args.type, from: args.from, to: args.to, rows };
    }

    if (args.type === "daily-sales") {
      const rows = payments
        .filter((payment) => (!hotelId || payment.hotelId === hotelId) && payment.date >= args.from && payment.date <= args.to)
        .reduce((map, payment) => {
          const current = map.get(payment.date) || { date: payment.date, cash: 0, bank: 0, card: 0, mobile_money: 0, total: 0 };
          const signedAmount = payment.type === "refund" ? -payment.amount : payment.amount;
          current[payment.method] = roundMoney((current[payment.method] || 0) + signedAmount);
          current.total = roundMoney(current.total + signedAmount);
          map.set(payment.date, current);
          return map;
        }, new Map());
      const list = [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));
      return {
        type: args.type,
        from: args.from,
        to: args.to,
        rows: list,
        total: roundMoney(list.reduce((sum, row) => sum + row.total, 0)),
      };
    }

    if (args.type === "receivables") {
      const today = todayISO();
      const rows = invoices
        .filter((invoice) => (!hotelId || invoice.hotelId === hotelId) && (invoice.status === "unpaid" || invoice.status === "partial"))
        .map((invoice) => ({ ...invoice, age: Math.max(0, daysBetween(invoice.date, today)), balance: roundMoney(invoice.total - invoice.paid) }));
      return { type: args.type, from: args.from, to: args.to, rows, total: roundMoney(rows.reduce((sum, row) => sum + row.balance, 0)) };
    }

    if (args.type === "payables") {
      const bills = await ctx.db.query("bills").collect();
      const suppliers = await ctx.db.query("suppliers").collect();
      const supplierNames = new Map(suppliers.map((supplier) => [supplier._id, supplier.name]));
      const rows = bills
        .filter((bill) => (!hotelId || bill.hotelId === hotelId) && (bill.status === "unpaid" || bill.status === "partial"))
        .map((bill) => ({ ...bill, supplierName: supplierNames.get(bill.supplierId) || "", balance: roundMoney(bill.amount - bill.paid) }));
      return { type: args.type, from: args.from, to: args.to, rows, total: roundMoney(rows.reduce((sum, row) => sum + row.balance, 0)) };
    }

    const incomeRows = income.filter((row) => (!hotelId || row.hotelId === hotelId) && row.date >= args.from && row.date <= args.to);
    const expenseRows = expenses.filter((row) => (!hotelId || row.hotelId === hotelId) && row.date >= args.from && row.date <= args.to);
    return {
      type: args.type,
      from: args.from,
      to: args.to,
      incomeRows,
      expenseRows,
      revenue: roundMoney(incomeRows.reduce((sum, row) => sum + row.amount, 0)),
      expenses: roundMoney(expenseRows.reduce((sum, row) => sum + row.amount, 0)),
    };
  },
});
