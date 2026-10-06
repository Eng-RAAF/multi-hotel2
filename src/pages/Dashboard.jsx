import { useQuery } from "convex/react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { Loading, PageHeader, Panel, Stat } from "../components/ui";

export default function Dashboard() {
  const { t, token, money, user } = useScope();
  const args = { token };
  const { hotelId } = useScope();
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const data = useQuery(api.dashboard.summary, token ? args : "skip");
  if (!data) return <Loading label={t("loading")} />;
  const housekeeping = user?.role === "housekeeping";

  return (
    <div>
      <PageHeader title={t("dashboard")} subtitle={user?.hotelName || t("company")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("allHotels")} value={data.hotels} />
        <Stat label={t("rooms")} value={data.rooms} />
        <Stat label={t("occupied")} value={data.occupied} />
        <Stat label={t("occupancy")} value={`${data.occupancy}%`} hint={`${data.available} ${t("available").toLowerCase()}`} />
        {data.showFinancials ? (
          <>
            <Stat label={t("todayRevenue")} value={money(data.todayRevenue)} />
            <Stat label={t("monthlyRevenue")} value={money(data.monthlyRevenue)} />
            <Stat label={t("expenses")} value={money(data.monthlyExpenses)} />
            <Stat label={t("profit")} value={money(data.profit)} />
            <Stat label={t("receivables")} value={money(data.receivables)} />
            <Stat label={t("payables")} value={money(data.payables)} />
          </>
        ) : (
          <>
            <Stat label={t("cleaning")} value={data.cleaning} />
            <Stat label={t("maintenance")} value={data.maintenance} />
          </>
        )}
      </div>

      {data.showFinancials ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-5">
          <Panel className="p-4 xl:col-span-3">
            <h2 className="mb-3 font-semibold">{t("monthlyRevenue")}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyChart}>
                  <CartesianGrid stroke="#eef2f4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#2CA01C" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="#D92D20" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="xl:col-span-2">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("performance")}</h2>
            <div className="divide-y divide-slate-100">
              {data.hotelPerformance.map((hotel) => (
                <div key={hotel._id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{hotel.name}</div>
                      <div className="text-xs text-muted">{hotel.city} · {hotel.occupancy}%</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-brand-dark">{money(hotel.profit)}</div>
                      <div className="text-xs text-muted">{money(hotel.revenue)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {!housekeeping ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel>
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("checkIns")}</h2>
            <StayList rows={data.todayCheckIns} empty={t("noResults")} />
          </Panel>
          <Panel>
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("checkOuts")}</h2>
            <StayList rows={data.todayCheckOuts} empty={t("noResults")} />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function StayList({ rows, empty }) {
  if (!rows.length) return <div className="px-4 py-8 text-sm text-muted">{empty}</div>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row._id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <div className="font-medium">{row.guestName}</div>
            <div className="text-xs text-muted">{row.hotelName} · {tRoom(row.roomNumber)}</div>
          </div>
          <div className="text-xs text-muted">{row.checkIn} → {row.checkOut}</div>
        </div>
      ))}
    </div>
  );
}

function tRoom(number) {
  return `Room ${number}`;
}
