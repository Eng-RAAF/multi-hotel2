import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { METHODS } from "../../lib/catalogs";
import { errorMessage, todayISO } from "../../lib/format";
import { Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../../components/ui";

const CATEGORIES = [
  ["Food purchases", "5200"],
  ["Gas", "5900"],
  ["Electricity", "5100"],
  ["Water", "5110"],
  ["Transportation", "5700"],
  ["Maintenance", "5400"],
  ["Other", "5900"],
];

export default function RestaurantExpenses() {
  const { t, token, money, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const rows = useQuery(api.restaurant.listExpenses, token && active ? { token, hotelId: active } : "skip");
  const save = useMutation(api.restaurant.saveExpense);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank());
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!rows) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const [category, accountCode] = form.category.split("|");
      await save({ token, hotelId: active, date: form.date, category, accountCode, amount: Number(form.amount), method: form.method, description: form.description });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("restaurantExpenses")} action={<Button onClick={() => { setForm(blank()); setOpen(true); }}>{t("create")}</Button>} />
      <Panel>
        {rows.map((row) => (
          <div key={row._id} className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm first:border-t-0">
            <div>
              <div className="font-medium">{row.category}</div>
              <div className="text-xs text-muted">{row.date} · {row.description}</div>
            </div>
            <div className="font-semibold">{money(row.amount)}</div>
          </div>
        ))}
      </Panel>
      {open ? (
        <Modal title={t("restaurantExpenses")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("category")}>
              <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map(([label, code]) => <option key={label} value={`${label}|${code}`}>{label}</option>)}
              </Select>
            </Field>
            <Field label={t("date")}><Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
            <Field label={t("amount")}><Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></Field>
            <Field label={t("method")}>
              <Select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>
            </Field>
            <Field label={t("description")}><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank() {
  return { category: "Food purchases|5200", date: todayISO(), amount: "", method: "cash", description: "" };
}
