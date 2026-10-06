import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { Loading, PageHeader, Panel, Stat } from "../components/ui";

export default function AccountingHome() {
  const { t, token, money, hotelId } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const summary = useQuery(api.dashboard.summary, token ? args : "skip");
  const entries = useQuery(api.accounting.recentEntries, token ? args : "skip");
  if (!summary || !entries) return <Loading label={t("loading")} />;

  return (
    <div>
      <PageHeader title={t("overview")} subtitle="Double-entry books for every hotel" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("monthlyRevenue")} value={money(summary.monthlyRevenue)} />
        <Stat label={t("expenses")} value={money(summary.monthlyExpenses)} />
        <Stat label={t("profit")} value={money(summary.profit)} />
        <Stat label={t("receivables")} value={money(summary.receivables)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["/income", "income"],
          ["/expenses", "expenses"],
          ["/accounts", "chartOfAccounts"],
          ["/ledger", "generalLedger"],
          ["/receivables", "receivables"],
          ["/payables", "payables"],
          ["/bank", "bankCash"],
          ["/reports/profit-loss", "profitLoss"],
        ].map(([to, key]) => (
          <Link key={to} to={to} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-semibold shadow-sm hover:border-brand">{t(key)}</Link>
        ))}
      </div>
      <Panel className="mt-4">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("recentEntries")}</h2>
        {entries.map((entry) => (
          <div key={entry._id} className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{entry.description}</div>
              <div className="text-xs text-muted">{entry.date} · {entry.hotelName} · {entry.source}</div>
            </div>
            <div className="font-semibold">{money(entry.amount)}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
