import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { monthStart, todayISO } from "../lib/format";
import { Badge, Button, Empty, Loading, Modal, PageHeader, Panel, Stat } from "../components/ui";

const PAGE_ROLES = {
  "/hotels": ["super_admin", "hotel_manager"],
  "/rooms": ["super_admin", "hotel_manager", "receptionist", "housekeeping"],
  "/housekeeping": ["super_admin", "hotel_manager", "receptionist", "housekeeping"],
  "/front-desk": ["super_admin", "hotel_manager", "receptionist"],
  "/payments": ["super_admin", "hotel_manager", "receptionist", "accountant"],
  "/income": ["super_admin", "hotel_manager", "accountant"],
  "/expenses": ["super_admin", "hotel_manager", "accountant"],
  "/receivables": ["super_admin", "hotel_manager", "accountant"],
  "/payables": ["super_admin", "hotel_manager", "accountant"],
  "/reports/profit-loss": ["super_admin", "hotel_manager", "accountant"],
};

export default function Dashboard() {
  const { t, token, money, user, hotelId, setHotelId, canSwitch } = useScope();
  const [detail, setDetail] = useState(null);
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const data = useQuery(api.dashboard.summary, token ? args : "skip");

  if (!data) return <Loading label={t("loading")} />;
  const housekeeping = user?.role === "housekeeping";
  const keys = monthKeys();
  const chart = data.monthlyChart.map((row, index) => ({ ...row, key: keys[index] }));

  return (
    <div>
      <PageHeader title={t("dashboard")} subtitle={user?.hotelName || t("company")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClickStat label={t("allHotels")} value={data.hotels} onClick={() => setDetail({ kind: "hotels" })} />
        <ClickStat label={t("rooms")} value={data.rooms} onClick={() => setDetail({ kind: "rooms" })} />
        <ClickStat label={t("occupied")} value={data.occupied} onClick={() => setDetail({ kind: "occupied" })} />
        <ClickStat
          label={t("occupancy")}
          value={`${data.occupancy}%`}
          hint={`${data.available} ${t("available").toLowerCase()}`}
          onClick={() => setDetail({ kind: "occupancy" })}
        />
        {data.showFinancials ? (
          <>
            <ClickStat label={t("todayRevenue")} value={money(data.todayRevenue)} onClick={() => setDetail({ kind: "today" })} />
            <ClickStat label={t("monthlyRevenue")} value={money(data.monthlyRevenue)} onClick={() => setDetail({ kind: "month", monthKey: keys[keys.length - 1], to: todayISO() })} />
            <ClickStat label={t("expenses")} value={money(data.monthlyExpenses)} onClick={() => setDetail({ kind: "expenses", monthKey: keys[keys.length - 1], to: todayISO() })} />
            <ClickStat label={t("profit")} value={money(data.profit)} onClick={() => setDetail({ kind: "profit", monthKey: keys[keys.length - 1], to: todayISO() })} />
            <ClickStat label={t("receivables")} value={money(data.receivables)} onClick={() => setDetail({ kind: "receivables" })} />
            <ClickStat label={t("payables")} value={money(data.payables)} onClick={() => setDetail({ kind: "payables" })} />
          </>
        ) : (
          <>
            <ClickStat label={t("cleaning")} value={data.cleaning} onClick={() => setDetail({ kind: "cleaning" })} />
            <ClickStat label={t("maintenance")} value={data.maintenance} onClick={() => setDetail({ kind: "maintenance" })} />
          </>
        )}
      </div>

      {data.showFinancials ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-5">
          <Panel className="p-4 xl:col-span-3">
            <h2 className="mb-3 font-semibold">{t("monthlyRevenue")}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid stroke="#eef2f4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#2CA01C" radius={[6, 6, 0, 0]} className="cursor-pointer" onClick={(row) => setDetail(barDetail(row, "month"))} />
                  <Bar dataKey="expenses" fill="#D92D20" radius={[6, 6, 0, 0]} className="cursor-pointer" onClick={(row) => setDetail(barDetail(row, "expenses"))} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted">Click a bar to read that month.</p>
          </Panel>
          <Panel className="xl:col-span-2">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("performance")}</h2>
            <div className="divide-y divide-slate-100">
              {data.hotelPerformance.map((hotel) => (
                <button
                  key={hotel._id}
                  type="button"
                  onClick={() => {
                    if (canSwitch) setHotelId(hotel._id);
                    setDetail({ kind: "hotel", hotel });
                  }}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                >
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
                </button>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {!housekeeping ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel>
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("checkIns")}</h2>
            <StayList rows={data.todayCheckIns} empty={t("noResults")} onOpen={(stay) => setDetail({ kind: "stay", stay })} />
          </Panel>
          <Panel>
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("checkOuts")}</h2>
            <StayList rows={data.todayCheckOuts} empty={t("noResults")} onOpen={(stay) => setDetail({ kind: "stay", stay })} />
          </Panel>
        </div>
      ) : null}

      {detail ? <Detail detail={detail} onClose={() => setDetail(null)} args={args} /> : null}
    </div>
  );
}

function ClickStat({ onClick, ...props }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand/40">
      <Stat {...props} className="h-full" />
    </button>
  );
}

function StayList({ rows, empty, onOpen }) {
  if (!rows.length) return <div className="px-4 py-8 text-sm text-muted">{empty}</div>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <button key={row._id} type="button" onClick={() => onOpen(row)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50">
          <div>
            <div className="font-medium">{row.guestName}</div>
            <div className="text-xs text-muted">{row.hotelName} · Room {row.roomNumber}</div>
          </div>
          <div className="text-xs text-muted">{row.checkIn} → {row.checkOut}</div>
        </button>
      ))}
    </div>
  );
}

function Detail({ detail, onClose, args }) {
  const { t, token, user } = useScope();
  const hotelArgs = detail.hotel ? { token, hotelId: detail.hotel._id } : args;
  const needsRooms = ["rooms", "occupied", "occupancy", "cleaning", "maintenance", "hotel"].includes(detail.kind);
  const needsBooks = ["month", "expenses", "profit", "hotel"].includes(detail.kind);
  const range = periodOf(detail);
  const hotels = useQuery(api.hotels.list, detail.kind === "hotels" ? args : "skip");
  const rooms = useQuery(api.rooms.list, needsRooms ? hotelArgs : "skip");
  const payments = useQuery(api.billing.listPayments, detail.kind === "today" ? args : "skip");
  const income = useQuery(api.accounting.listIncome, detail.kind === "month" || detail.kind === "profit" ? args : "skip");
  const expenses = useQuery(api.accounting.listExpenses, detail.kind === "expenses" || detail.kind === "profit" || detail.kind === "hotel" ? (detail.hotel ? hotelArgs : args) : "skip");
  const report = useQuery(
    api.reports.get,
    needsBooks ? { ...(detail.hotel ? hotelArgs : args), type: "profit-loss", from: range.from, to: range.to } : "skip",
  );
  const receivables = useQuery(api.billing.receivables, detail.kind === "receivables" ? args : "skip");
  const bills = useQuery(api.accounting.listBills, detail.kind === "payables" ? args : "skip");

  const title = {
    hotels: t("allHotels"),
    rooms: t("rooms"),
    occupied: t("occupied"),
    occupancy: t("occupancy"),
    today: t("todayRevenue"),
    month: detail.label ? `${t("monthlyRevenue")} · ${detail.label}` : t("monthlyRevenue"),
    expenses: detail.label ? `${t("expenses")} · ${detail.label}` : t("expenses"),
    profit: t("profit"),
    receivables: t("receivables"),
    payables: t("payables"),
    cleaning: t("cleaning"),
    maintenance: t("maintenance"),
    stay: detail.stay?.guestName || t("guest"),
    hotel: detail.hotel?.name || t("hotel"),
  }[detail.kind];

  const link = {
    hotels: "/hotels",
    rooms: "/rooms",
    occupied: "/rooms",
    occupancy: "/rooms",
    cleaning: "/housekeeping",
    maintenance: "/housekeeping",
    today: "/payments",
    month: "/income",
    expenses: "/expenses",
    profit: "/reports/profit-loss",
    receivables: "/receivables",
    payables: "/payables",
    stay: "/front-desk",
    hotel: "/hotels",
  }[detail.kind];

  return (
    <Modal title={title} onClose={onClose} wide>
      <DetailBody
        detail={detail}
        hotels={hotels}
        rooms={rooms}
        payments={payments}
        income={income}
        expenses={expenses}
        receivables={receivables}
        bills={bills}
        report={report}
      />
      {link && PAGE_ROLES[link]?.includes(user?.role) ? (
        <div className="mt-4">
          <Link to={link} onClick={onClose}><Button>{t("view")}</Button></Link>
        </div>
      ) : null}
    </Modal>
  );
}

function DetailBody({ detail, hotels, rooms, payments, income, expenses, receivables, bills, report }) {
  const { t, money } = useScope();
  const monthKey = detail.monthKey || monthStart().slice(0, 7);

  if (detail.kind === "stay") {
    const stay = detail.stay;
    return (
      <div className="space-y-2 text-sm">
        <Row label={t("guest")} value={stay.guestName} />
        <Row label={t("hotel")} value={stay.hotelName} />
        <Row label={t("room")} value={stay.roomNumber} />
        <Row label={t("from")} value={stay.checkIn} />
        <Row label={t("to")} value={stay.checkOut} />
        <div className="pt-2"><Badge value={stay.status} /></div>
      </div>
    );
  }

  if (detail.kind === "hotel") {
    const hotel = detail.hotel;
    const hotelRooms = (rooms || []).filter((room) => room.hotelId === hotel._id);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t("revenue")} value={money(hotel.revenue)} />
          <Stat label={t("expenses")} value={money(hotel.expenses)} />
          <Stat label={t("profit")} value={money(hotel.profit)} />
        </div>
        <p className="text-sm text-muted">{hotel.city} · {t("occupancy")} {hotel.occupancy}%</p>
        {report ? <AccountLines rows={hotelAccounts(report)} empty={t("noResults")} /> : <Loading label={t("loading")} />}
        {rooms ? <RoomLines rooms={hotelRooms} empty={t("noResults")} /> : <Loading label={t("loading")} />}
      </div>
    );
  }

  if (detail.kind === "hotels") {
    if (!hotels) return <Loading label={t("loading")} />;
    if (!hotels.length) return <Empty title={t("noResults")} />;
    return (
      <div className="divide-y divide-slate-100">
        {hotels.map((hotel) => (
          <div key={hotel._id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <div className="font-semibold">{hotel.name}</div>
              <div className="text-xs text-muted">{hotel.city} · {hotel.phone}</div>
            </div>
            <div className="text-right">
              <div>{hotel.rooms} {t("rooms").toLowerCase()}</div>
              <div className="text-xs text-muted">{hotel.occupancy}% · {hotel.occupied} {t("occupied").toLowerCase()}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (["rooms", "occupied", "occupancy", "cleaning", "maintenance"].includes(detail.kind)) {
    if (!rooms) return <Loading label={t("loading")} />;
    if (detail.kind === "occupancy") {
      const counts = countRooms(rooms);
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(counts).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-slate-50 px-3 py-3">
                <div className="text-xs capitalize text-muted">{status.replaceAll("_", " ")}</div>
                <div className="text-xl font-bold">{count}</div>
              </div>
            ))}
          </div>
          <RoomLines rooms={rooms} empty={t("noResults")} />
        </div>
      );
    }
    const filtered = rooms.filter((room) => {
      if (detail.kind === "occupied") return room.status === "occupied";
      if (detail.kind === "cleaning") return room.status === "cleaning" || room.housekeepingStatus === "dirty";
      if (detail.kind === "maintenance") return room.status === "maintenance";
      return true;
    });
    return <RoomLines rooms={filtered} empty={t("noResults")} />;
  }

  if (detail.kind === "today") {
    if (!payments) return <Loading label={t("loading")} />;
    const rows = payments.filter((payment) => payment.date === todayISO());
    return <MoneyLines rows={rows} empty={t("noResults")} amount={(row) => (row.type === "refund" ? -row.amount : row.amount)} />;
  }

  if (detail.kind === "month" || detail.kind === "expenses" || detail.kind === "profit") {
    if (!report || (detail.kind !== "expenses" && !income) || (detail.kind !== "month" && !expenses)) return <Loading label={t("loading")} />;
    const incomeRows = (income || []).filter((row) => row.date.startsWith(monthKey));
    const expenseRows = (expenses || []).filter((row) => row.date.startsWith(monthKey));
    return (
      <div className="space-y-4">
        {detail.kind === "profit" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t("revenue")} value={money(report.revenue)} />
            <Stat label={t("expenses")} value={money(report.expenses)} />
            <Stat label={t("profit")} value={money(report.profit)} />
          </div>
        ) : null}
        {detail.kind !== "expenses" ? <AccountLines rows={report.incomeRows} empty={t("noResults")} /> : null}
        {detail.kind !== "month" ? <AccountLines rows={report.expenseRows} empty={t("noResults")} /> : null}
        {detail.kind !== "expenses" ? (
          <>
            <h3 className="font-semibold">{t("income")}</h3>
            <MoneyLines rows={incomeRows} empty={t("noResults")} amount={(row) => row.amount} />
          </>
        ) : null}
        {detail.kind !== "month" ? (
          <>
            <h3 className="font-semibold">{t("expenses")}</h3>
            <MoneyLines rows={expenseRows} empty={t("noResults")} amount={(row) => row.amount} />
          </>
        ) : null}
      </div>
    );
  }

  if (detail.kind === "receivables") {
    if (!receivables) return <Loading label={t("loading")} />;
    if (!receivables.rows.length) return <Empty title={t("noResults")} />;
    return (
      <div className="divide-y divide-slate-100">
        {receivables.rows.map((row) => (
          <Link key={row._id} to={`/invoices/${row._id}`} className="flex items-center justify-between py-3 text-sm hover:bg-slate-50">
            <div>
              <div className="font-medium">{row.number} · {row.party}</div>
              <div className="text-xs text-muted">{row.hotelName} · {row.age}d</div>
            </div>
            <div className="font-semibold">{money(row.balance)}</div>
          </Link>
        ))}
      </div>
    );
  }

  if (detail.kind === "payables") {
    if (!bills) return <Loading label={t("loading")} />;
    const open = bills.filter((bill) => bill.status === "unpaid" || bill.status === "partial");
    if (!open.length) return <Empty title={t("noResults")} />;
    return (
      <div className="divide-y divide-slate-100">
        {open.map((bill) => (
          <div key={bill._id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <div className="font-medium">{bill.number} · {bill.supplierName}</div>
              <div className="text-xs text-muted">{bill.hotelName} · {t("due")} {bill.dueDate}</div>
            </div>
            <div className="font-semibold">{money(bill.balance)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <Empty title={t("noResults")} />;
}

function RoomLines({ rooms, empty }) {
  const { t, money } = useScope();
  if (!rooms.length) return <Empty title={empty} />;
  return (
    <div className="divide-y divide-slate-100">
      {rooms.map((room) => (
        <div key={room._id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div>
            <div className="font-medium">Room {room.number} · {room.typeName}</div>
            <div className="text-xs text-muted">{room.hotelName} · {money(room.price)}</div>
          </div>
          <div className="flex gap-2">
            <Badge value={room.status} />
            <Badge value={room.housekeepingStatus} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoneyLines({ rows, empty, amount }) {
  const { money } = useScope();
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row._id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div>
            <div className="font-medium">{row.description || row.category || row.party || row.reference}</div>
            <div className="text-xs text-muted">{row.date} · {row.hotelName}{row.method ? ` · ${String(row.method).replaceAll("_", " ")}` : ""}</div>
          </div>
          <div className="font-semibold">{money(amount(row))}</div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

function hotelAccounts(report) {
  return [...(report.incomeRows || []), ...(report.expenseRows || [])];
}

function AccountLines({ rows, empty }) {
  const { money } = useScope();
  const visible = (rows || []).filter((row) => row.balance);
  if (!visible.length) return <Empty title={empty} />;
  return (
    <div className="divide-y divide-slate-100">
      {visible.map((row) => (
        <div key={row.code} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-xs text-muted">{row.code}</div>
          </div>
          <div className="font-semibold">{money(row.balance)}</div>
        </div>
      ))}
    </div>
  );
}

function barDetail(row, kind) {
  const item = row?.payload?.key ? row.payload : row;
  return { kind, monthKey: item?.key, label: item?.month, to: item?.key ? endOfMonth(item.key) : undefined };
}

function periodOf(detail) {
  const key = detail.monthKey || todayISO().slice(0, 7);
  const from = `${key}-01`;
  const to = detail.to || (key === todayISO().slice(0, 7) ? todayISO() : endOfMonth(key));
  return { key, from, to };
}

function endOfMonth(key) {
  const [year, month] = key.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${key}-${String(last).padStart(2, "0")}`;
}

function countRooms(rooms) {
  return rooms.reduce((counts, room) => {
    counts[room.status] = (counts[room.status] || 0) + 1;
    return counts;
  }, {});
}

function monthKeys(count = 6) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
