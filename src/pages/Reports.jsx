import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { monthStart, todayISO } from "../lib/format";
import { Button, Empty, Field, Input, Loading, PageHeader, Panel, Table } from "../components/ui";

const TITLES = {
  "profit-loss": "profitLoss",
  "balance-sheet": "balanceSheet",
  "cash-flow": "cashFlow",
  "trial-balance": "trialBalance",
  "hotel-performance": "hotelPerformance",
  financial: "financialReports",
  income: "incomeReport",
  expenses: "expenseReport",
  "daily-sales": "dailySales",
  monthly: "monthlyReport",
  receivables: "receivables",
  payables: "payables",
};

export default function Reports() {
  const { type = "profit-loss" } = useParams();
  const { t, token, money, hotelId } = useScope();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const reportType = type === "financial" ? "profit-loss" : type;
  const args = { token, type: reportType, from, to };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const report = useQuery(api.reports.get, token && type !== "financial" ? args : "skip");
  const pack = useQuery(api.reports.get, token && type === "financial" ? { ...args, type: "monthly" } : "skip");
  const sales = useQuery(api.reports.get, token && type === "financial" ? { ...args, type: "daily-sales" } : "skip");

  return (
    <div>
      <PageHeader
        title={t(TITLES[type] || "financialReports")}
        action={<Button variant="secondary" onClick={() => window.print()}>{t("print")}</Button>}
      />
      <div className="no-print mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={t("from")}><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label={t("to")}><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>
      {type === "financial" ? (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap gap-2">
            {Object.entries(TITLES).filter(([key]) => key !== "financial").map(([key, label]) => (
              <Link key={key} to={`/reports/${key}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium">{t(label)}</Link>
            ))}
          </div>
          {!pack || !sales ? <Loading label={t("loading")} /> : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Panel className="p-4"><div className="text-sm text-muted">{t("revenue")}</div><div className="text-2xl font-bold">{money(pack.revenue)}</div></Panel>
                <Panel className="p-4"><div className="text-sm text-muted">{t("expenses")}</div><div className="text-2xl font-bold">{money(pack.expenses)}</div></Panel>
                <Panel className="p-4"><div className="text-sm text-muted">{t("profit")}</div><div className="text-2xl font-bold">{money(pack.profit)}</div></Panel>
              </div>
              <ReportBody report={sales} money={money} t={t} />
            </>
          )}
        </div>
      ) : !report ? <Loading label={t("loading")} /> : <ReportBody report={report} money={money} t={t} />}
    </div>
  );
}

function ReportBody({ report, money, t }) {
  if (report.type === "profit-loss" || report.type === "income" || report.type === "expenses" || report.type === "monthly") {
    const showIncome = report.type !== "expenses";
    const showExpenses = report.type !== "income";
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {showIncome ? <AccountList title={t("income")} rows={report.incomeRows} money={money} total={report.revenue} /> : null}
        {showExpenses ? <AccountList title={t("expenses")} rows={report.expenseRows} money={money} total={report.expenses} /> : null}
        <Panel className="p-4 lg:col-span-2">
          <div className="text-sm text-muted">{t("profit")}</div>
          <div className="text-3xl font-bold text-brand-dark">{money(report.profit)}</div>
        </Panel>
      </div>
    );
  }
  if (report.type === "trial-balance") {
    return (
      <Panel>
        <Table rowKey={(row) => row.code} rows={report.rows} columns={[
          { key: "code", header: t("code"), cell: (row) => row.code },
          { key: "name", header: t("name"), cell: (row) => row.name },
          { key: "debit", header: t("debit"), cell: (row) => money(row.debit) },
          { key: "credit", header: t("credit"), cell: (row) => money(row.credit) },
        ]} />
        <div className="flex justify-end gap-8 border-t px-4 py-3 text-sm font-semibold">
          <span>{money(report.debit)}</span>
          <span>{money(report.credit)}</span>
        </div>
      </Panel>
    );
  }
  if (report.type === "balance-sheet") {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <AccountList title={t("assets")} rows={report.assets} money={money} total={report.assetTotal} balance />
        <AccountList title={t("liabilities")} rows={report.liabilities} money={money} total={report.liabilityTotal} balance />
        <Panel>
          <h2 className="border-b px-4 py-3 font-semibold">{t("equity")}</h2>
          {report.equity.map((row) => <Line key={row.code} name={`${row.code} ${row.name}`} amount={money(row.balance)} />)}
          <Line name={t("netIncome")} amount={money(report.netIncome)} />
          <div className="border-t px-4 py-3 font-bold">{money(report.equityTotal)}</div>
        </Panel>
      </div>
    );
  }
  if (report.type === "cash-flow") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel className="p-4"><div className="text-sm text-muted">{t("inflow")}</div><div className="text-2xl font-bold">{money(report.inflow)}</div></Panel>
          <Panel className="p-4"><div className="text-sm text-muted">{t("outflow")}</div><div className="text-2xl font-bold">{money(report.outflow)}</div></Panel>
          <Panel className="p-4"><div className="text-sm text-muted">{t("net")}</div><div className="text-2xl font-bold">{money(report.net)}</div></Panel>
        </div>
        <Panel>
          {report.rows.length ? (
            <Table rowKey={(row) => row._id} rows={report.rows} columns={[
              { key: "date", header: t("date"), cell: (row) => row.date },
              { key: "account", header: t("account"), cell: (row) => row.accountCode },
              { key: "description", header: t("description"), cell: (row) => row.description },
              { key: "in", header: t("inflow"), cell: (row) => row.debit ? money(row.debit) : "" },
              { key: "out", header: t("outflow"), cell: (row) => row.credit ? money(row.credit) : "" },
            ]} />
          ) : <Empty title={t("noResults")} />}
        </Panel>
      </div>
    );
  }
  if (report.type === "hotel-performance") {
    return (
      <Panel>
        <Table rowKey={(row) => row.name} rows={report.rows} columns={[
          { key: "name", header: t("hotel"), cell: (row) => row.name },
          { key: "city", header: t("city"), cell: (row) => row.city },
          { key: "revenue", header: t("revenue"), cell: (row) => money(row.revenue) },
          { key: "expenses", header: t("expenses"), cell: (row) => money(row.expenses) },
          { key: "profit", header: t("profit"), cell: (row) => money(row.profit) },
        ]} />
      </Panel>
    );
  }
  if (report.type === "daily-sales") {
    return (
      <Panel>
        <Table rowKey={(row) => row.date} rows={report.rows} columns={[
          { key: "date", header: t("date"), cell: (row) => row.date },
          { key: "cash", header: "Cash", cell: (row) => money(row.cash) },
          { key: "bank", header: "Bank", cell: (row) => money(row.bank) },
          { key: "card", header: "Card", cell: (row) => money(row.card) },
          { key: "mobile", header: "Mobile money", cell: (row) => money(row.mobile_money) },
          { key: "total", header: t("total"), cell: (row) => money(row.total) },
        ]} />
        <div className="px-4 py-3 text-right font-bold">{money(report.total)}</div>
      </Panel>
    );
  }
  if (report.type === "receivables" || report.type === "payables") {
    return (
      <Panel>
        {report.rows?.length ? (
          <Table rowKey={(row) => row._id} rows={report.rows} columns={[
            { key: "name", header: report.type === "payables" ? t("supplier") : t("billTo"), cell: (row) => row.party || row.supplierName || row.number },
            { key: "date", header: t("date"), cell: (row) => row.date },
            { key: "balance", header: t("balance"), cell: (row) => money(row.balance) },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
    );
  }
  return <Empty title={t("noResults")} />;
}

function AccountList({ title, rows, money, total, balance }) {
  return (
    <Panel>
      <h2 className="border-b px-4 py-3 font-semibold">{title}</h2>
      {(rows || []).filter((row) => balance ? row.balance : row.debit || row.credit).map((row) => (
        <Line key={row.code} name={`${row.code} ${row.name}`} amount={money(balance ? row.balance : row.balance)} />
      ))}
      <div className="border-t px-4 py-3 font-bold">{money(total)}</div>
    </Panel>
  );
}

function Line({ name, amount }) {
  return <div className="flex justify-between px-4 py-2 text-sm"><span>{name}</span><span>{amount}</span></div>;
}
