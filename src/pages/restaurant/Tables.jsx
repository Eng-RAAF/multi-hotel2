import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { errorMessage } from "../../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Select } from "../../components/ui";

const STATUSES = ["available", "occupied", "reserved", "cleaning"];

export default function TablesPage() {
  const { t, token, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const tables = useQuery(api.restaurant.listTables, token && active ? { token, hotelId: active } : "skip");
  const save = useMutation(api.restaurant.saveTable);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ number: "", seats: "4", status: "available" });
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!tables) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({ token, hotelId: active, tableId: form.tableId, number: form.number, seats: Number(form.seats), status: form.status });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("tables")} action={<Button onClick={() => { setForm({ number: "", seats: "4", status: "available" }); setOpen(true); }}>{t("create")}</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <button key={table._id} type="button" onClick={() => { setForm({ tableId: table._id, number: table.number, seats: String(table.seats), status: table.status }); setOpen(true); }} className="rounded-2xl border border-slate-200 bg-white p-4 text-left">
            <div className="text-lg font-bold">{t("tables")} {table.number}</div>
            <div className="text-sm text-muted">{table.seats} seats</div>
            <div className="mt-2"><Badge value={table.status} /></div>
          </button>
        ))}
      </div>
      {open ? (
        <Modal title={t("tables")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("number")}><Input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} required /></Field>
            <Field label={t("capacity")}><Input type="number" min="1" value={form.seats} onChange={(event) => setForm({ ...form, seats: event.target.value })} /></Field>
            <Field label={t("status")}>
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
