import { Component } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Layout, { Guard } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Hotels from "./pages/Hotels";
import Rooms from "./pages/Rooms";
import Housekeeping from "./pages/Housekeeping";
import Reservations from "./pages/Reservations";
import Guests from "./pages/Guests";
import FrontDesk from "./pages/FrontDesk";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Payments from "./pages/Payments";
import Customers from "./pages/Customers";
import AccountingHome from "./pages/AccountingHome";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import Accounts from "./pages/Accounts";
import Ledger from "./pages/Ledger";
import Receivables from "./pages/Receivables";
import Payables from "./pages/Payables";
import Bank from "./pages/Bank";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Employees from "./pages/Employees";
import Roles from "./pages/Roles";
import SettingsPage from "./pages/SettingsPage";
import Audit from "./pages/Audit";

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="max-w-lg rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">MHMAS could not reach Convex</h1>
          <p className="mt-2 text-sm text-muted">
            The app is configured for https://focused-wolf-383.convex.cloud. Deploy the functions from the frontend folder with <code>npx convex dev</code>, then reload.
          </p>
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-danger">{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      </div>
    );
  }
}

function Shell() {
  const { token, ready, t } = useApp();
  if (!token) return <Navigate to="/login" replace />;
  if (!ready) return <div className="grid min-h-screen place-items-center text-sm text-muted">{t("loading")}…</div>;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/hotels" element={<Guard roles={["super_admin", "hotel_manager"]}><Hotels /></Guard>} />
        <Route path="/rooms" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "housekeeping"]}><Rooms /></Guard>} />
        <Route path="/housekeeping" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "housekeeping"]}><Housekeeping /></Guard>} />
        <Route path="/reservations" element={<Guard roles={["super_admin", "hotel_manager", "receptionist"]}><Reservations /></Guard>} />
        <Route path="/guests" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "accountant"]}><Guests /></Guard>} />
        <Route path="/front-desk" element={<Guard roles={["super_admin", "hotel_manager", "receptionist"]}><FrontDesk /></Guard>} />
        <Route path="/invoices" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "accountant"]}><Invoices /></Guard>} />
        <Route path="/invoices/:invoiceId" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "accountant"]}><InvoiceDetail /></Guard>} />
        <Route path="/payments" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "accountant"]}><Payments /></Guard>} />
        <Route path="/customers" element={<Guard roles={["super_admin", "hotel_manager", "receptionist", "accountant"]}><Customers /></Guard>} />
        <Route path="/accounting" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><AccountingHome /></Guard>} />
        <Route path="/income" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Income /></Guard>} />
        <Route path="/expenses" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Expenses /></Guard>} />
        <Route path="/accounts" element={<Guard roles={["super_admin", "accountant"]}><Accounts /></Guard>} />
        <Route path="/ledger" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Ledger /></Guard>} />
        <Route path="/receivables" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Receivables /></Guard>} />
        <Route path="/payables" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Payables /></Guard>} />
        <Route path="/bank" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Bank /></Guard>} />
        <Route path="/reports/:type" element={<Guard roles={["super_admin", "hotel_manager", "accountant"]}><Reports /></Guard>} />
        <Route path="/users" element={<Guard roles={["super_admin", "hr_admin"]}><Users /></Guard>} />
        <Route path="/employees" element={<Guard roles={["super_admin", "hr_admin", "hotel_manager"]}><Employees /></Guard>} />
        <Route path="/roles" element={<Guard roles={["super_admin", "hr_admin"]}><Roles /></Guard>} />
        <Route path="/settings" element={<Guard roles={["super_admin"]}><SettingsPage /></Guard>} />
        <Route path="/audit" element={<Guard roles={["super_admin", "hotel_manager"]}><Audit /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function Gate() {
  const { token } = useApp();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/invoices/:invoiceId/print" element={<InvoiceDetail printMode />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Boundary>
        <AppProvider>
          <Gate />
        </AppProvider>
      </Boundary>
    </BrowserRouter>
  );
}
