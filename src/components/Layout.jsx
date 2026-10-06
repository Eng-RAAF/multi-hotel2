import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  BookOpen,
  Building2,
  CalendarDays,
  FileBarChart,
  FileText,
  IdCard,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListTree,
  LogOut,
  Menu,
  PieChart,
  Scale,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { ROLES } from "../lib/catalogs";

const NAV = [
  { to: "/", label: "dashboard", icon: LayoutDashboard, roles: ["super_admin", "hotel_manager", "receptionist", "accountant", "housekeeping", "hr_admin"] },
  {
    group: "navHotels",
    items: [
      { to: "/hotels", label: "allHotels", icon: Building2, roles: ["super_admin", "hotel_manager"] },
      { to: "/rooms", label: "rooms", icon: BedDouble, roles: ["super_admin", "hotel_manager", "receptionist", "housekeeping"] },
      { to: "/housekeeping", label: "housekeeping", icon: Sparkles, roles: ["super_admin", "hotel_manager", "receptionist", "housekeeping"] },
    ],
  },
  {
    group: "navOperations",
    items: [
      { to: "/reservations", label: "reservations", icon: CalendarDays, roles: ["super_admin", "hotel_manager", "receptionist"] },
      { to: "/guests", label: "guests", icon: Users, roles: ["super_admin", "hotel_manager", "receptionist", "accountant"] },
      { to: "/front-desk", label: "frontDesk", icon: CalendarDays, roles: ["super_admin", "hotel_manager", "receptionist"] },
    ],
  },
  {
    group: "navSales",
    items: [
      { to: "/invoices", label: "invoices", icon: FileText, roles: ["super_admin", "hotel_manager", "receptionist", "accountant"] },
      { to: "/payments", label: "payments", icon: Wallet, roles: ["super_admin", "hotel_manager", "receptionist", "accountant"] },
      { to: "/customers", label: "customers", icon: Users, roles: ["super_admin", "hotel_manager", "receptionist", "accountant"] },
    ],
  },
  {
    group: "navAccounting",
    items: [
      { to: "/accounting", label: "overview", icon: PieChart, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/income", label: "income", icon: TrendingUp, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/expenses", label: "expenses", icon: TrendingDown, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/accounts", label: "chartOfAccounts", icon: ListTree, roles: ["super_admin", "accountant"] },
      { to: "/ledger", label: "generalLedger", icon: BookOpen, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/receivables", label: "receivables", icon: ArrowDownLeft, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/payables", label: "payables", icon: ArrowUpRight, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/bank", label: "bankCash", icon: Landmark, roles: ["super_admin", "hotel_manager", "accountant"] },
    ],
  },
  {
    group: "navReports",
    items: [
      { to: "/reports/profit-loss", label: "profitLoss", icon: LineChart, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/reports/balance-sheet", label: "balanceSheet", icon: Scale, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/reports/cash-flow", label: "cashFlow", icon: Landmark, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/reports/trial-balance", label: "trialBalance", icon: Scale, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/reports/hotel-performance", label: "hotelPerformance", icon: BarChart3, roles: ["super_admin", "hotel_manager", "accountant"] },
      { to: "/reports/financial", label: "financialReports", icon: FileBarChart, roles: ["super_admin", "hotel_manager", "accountant"] },
    ],
  },
  {
    group: "navAdmin",
    items: [
      { to: "/users", label: "users", icon: UserCog, roles: ["super_admin", "hr_admin"] },
      { to: "/employees", label: "employees", icon: IdCard, roles: ["super_admin", "hr_admin", "hotel_manager"] },
      { to: "/roles", label: "roles", icon: Shield, roles: ["super_admin", "hr_admin"] },
      { to: "/settings", label: "settings", icon: Settings, roles: ["super_admin"] },
      { to: "/audit", label: "auditLogs", icon: ScrollText, roles: ["super_admin", "hotel_manager"] },
    ],
  },
];

function Item({ item, onNavigate }) {
  const { t } = useApp();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand/10 text-brand-dark" : "text-slate-600 hover:bg-slate-50"}`
      }
    >
      <Icon size={16} />
      {t(item.label)}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { t, user, hotels, hotelId, setHotelId, canSwitch, lang, setLang, signOut, token, companyName } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const searchArgs = { token, q: debounced };
  if (hotelId && hotelId !== "all") searchArgs.hotelId = hotelId;
  const results = useQuery(api.search.run, token && debounced.trim().length >= 2 ? searchArgs : "skip");
  const role = ROLES.find((item) => item.id === user?.role)?.label || user?.role;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-white">M</div>
        <div>
          <div className="font-extrabold leading-tight">MHMAS</div>
          <div className="text-xs text-muted">{t("somalia")}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV.map((entry) => {
          if (entry.to) {
            return entry.roles.includes(user.role) ? <Item key={entry.to} item={entry} onNavigate={() => setOpen(false)} /> : null;
          }
          const items = entry.items.filter((item) => item.roles.includes(user.role));
          if (!items.length) return null;
          return (
            <div key={entry.group}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t(entry.group)}</div>
              <div className="space-y-1">
                {items.map((item) => (
                  <Item key={item.to} item={item} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-muted">{role}{user.hotelName ? ` · ${user.hotelName}` : ""}</div>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-ink">
            <LogOut size={15} /> {t("signOut")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-canvas text-ink">
      <aside className="no-print hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="relative h-full w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:bg-white"
            />
            {results?.length ? (
              <div className="absolute z-20 mt-1 w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.label}-${result.hint}`}
                    className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      navigate(result.to);
                      setQ("");
                      setDebounced("");
                    }}
                  >
                    <div className="text-sm font-medium">{result.label}</div>
                    <div className="text-xs capitalize text-muted">{result.type} · {result.hint}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {canSwitch ? (
            <select
              value={hotelId}
              onChange={(event) => setHotelId(event.target.value)}
              className="hidden max-w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm md:block"
            >
              <option value="all">{t("allHotels")}</option>
              {hotels.map((hotel) => (
                <option key={hotel._id} value={hotel._id}>{hotel.name}</option>
              ))}
            </select>
          ) : (
            <div className="hidden text-sm font-medium text-muted md:block">{companyName}</div>
          )}
          <button
            onClick={() => setLang(lang === "en" ? "so" : "en")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            {lang === "en" ? "SO" : "EN"}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function Guard({ roles, children }) {
  const { user, t, ready } = useApp();
  if (!ready || !user) return <div className="p-8 text-sm text-muted">{t("loading")}…</div>;
  if (roles && !roles.includes(user.role)) {
    return <div className="rounded-2xl bg-white p-8 text-sm text-muted shadow-sm">{t("noAccess")}</div>;
  }
  return children;
}
