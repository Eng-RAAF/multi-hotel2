export function Button({ children, variant = "primary", className = "", type = "button", ...props }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "border border-slate-200 bg-white text-ink hover:bg-slate-50",
    danger: "bg-danger text-white hover:bg-red-700",
    ghost: "text-ink hover:bg-slate-100",
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const controlClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function Input(props) {
  return <input className={controlClass} {...props} />;
}

export function Select(props) {
  return <select className={controlClass} {...props} />;
}

export function Textarea(props) {
  return <textarea className={`${controlClass} min-h-20`} {...props} />;
}

export function Panel({ children, className = "" }) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({ value }) {
  const styles = {
    available: "bg-green-50 text-green-700",
    clean: "bg-green-50 text-green-700",
    inspected: "bg-teal-50 text-teal-700",
    paid: "bg-green-50 text-green-700",
    active: "bg-green-50 text-green-700",
    confirmed: "bg-sky-50 text-sky-700",
    checked_in: "bg-green-50 text-green-700",
    reserved: "bg-sky-50 text-sky-700",
    occupied: "bg-amber-50 text-amber-800",
    pending: "bg-amber-50 text-amber-800",
    partial: "bg-amber-50 text-amber-800",
    cleaning: "bg-violet-50 text-violet-700",
    dirty: "bg-rose-50 text-rose-700",
    unpaid: "bg-rose-50 text-rose-700",
    cancelled: "bg-rose-50 text-rose-700",
    maintenance: "bg-orange-50 text-orange-800",
    no_show: "bg-orange-50 text-orange-800",
    out_of_service: "bg-slate-100 text-slate-600",
    checked_out: "bg-slate-100 text-slate-600",
    inactive: "bg-slate-100 text-slate-600",
    present: "bg-green-50 text-green-700",
    absent: "bg-rose-50 text-rose-700",
    leave: "bg-amber-50 text-amber-800",
    refund: "bg-rose-50 text-rose-700",
    payment: "bg-green-50 text-green-700",
  };
  const label = String(value || "—").replaceAll("_", " ");
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[value] || "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close" />
      <div className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-muted hover:bg-slate-100" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function Empty({ title }) {
  return <div className="px-4 py-10 text-center text-sm text-muted">{title}</div>;
}

export function Loading({ label = "Loading" }) {
  return (
    <div className="flex items-center gap-3 p-8 text-sm text-muted">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-danger">{children}</p>;
}

export function Table({ columns, rows, rowKey }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-left text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium">{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-slate-100 hover:bg-slate-50/80">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 align-middle">{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`${controlClass} max-w-xs`}
    />
  );
}

export function filterRows(rows, query, keys) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows || [];
  return (rows || []).filter((row) => keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle)));
}
