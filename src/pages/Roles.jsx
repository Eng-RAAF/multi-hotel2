import { useApp } from "../context/AppContext";
import { PageHeader, Panel } from "../components/ui";

const MATRIX = [
  ["Super Administrator", "Whole company, hotels, users, settings, and every financial report"],
  ["Hotel Manager", "One hotel: rooms, reservations, revenue, expenses, and hotel reports"],
  ["Receptionist", "Guests, reservations, check-in, check-out, invoices, and payments"],
  ["Accountant", "Income, expenses, ledger, receivables, payables, and financial reports"],
  ["Housekeeping", "Room status, cleaning, and maintenance only"],
  ["HR / Admin", "Employees, attendance, and user accounts"],
  ["Restaurant Manager", "Menu, tables, orders, inventory, suppliers, expenses, and restaurant reports"],
  ["Waiter", "Tables, food orders, and sending orders to the kitchen"],
  ["Kitchen Staff", "Kitchen orders: pending, preparing, and ready"],
];

export default function Roles() {
  const { t } = useApp();
  return (
    <div>
      <PageHeader title={t("roles")} subtitle={t("systemRoles")} />
      <Panel>
        {MATRIX.map(([role, access]) => (
          <div key={role} className="border-t border-slate-100 px-4 py-4 first:border-t-0">
            <div className="font-semibold">{role}</div>
            <p className="mt-1 text-sm text-muted">{access}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}
