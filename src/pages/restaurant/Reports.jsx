import { useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { Empty, Loading, PageHeader, Panel, Stat } from "../../components/ui";

export default function RestaurantReports() {
  const { t, token, money, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const report = useQuery(api.restaurant.report, token && active ? { token, hotelId: active } : "skip");
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!report) return <Loading label={t("loading")} />;
  return (
    <div>
      <PageHeader title={t("restaurantReports")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's orders" value={report.todayOrders} />
        <Stat label="Daily revenue" value={money(report.daily)} />
        <Stat label="Weekly revenue" value={money(report.weekly)} />
        <Stat label="Monthly revenue" value={money(report.monthly)} />
        <Stat label={t("expenses")} value={money(report.monthExpenses)} />
        <Stat label={t("profit")} value={money(report.profit)} />
        <Stat label={t("purchases")} value={money(report.purchaseTotal)} hint={`${report.purchases} records`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Best-selling food</h2>
          {report.best.map((row) => (
            <div key={row.name} className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <span>{row.name}</span>
              <span>{row.quantity} · {money(row.amount)}</span>
            </div>
          ))}
        </Panel>
        <Panel>
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("inventory")}</h2>
          {report.inventory.map((row) => (
            <div key={row._id} className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <span>{row.name}</span>
              <span className={row.low ? "font-semibold text-danger" : ""}>{row.quantity} {row.unit}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
