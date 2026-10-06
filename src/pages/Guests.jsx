import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, SearchBox, Select, Table, filterRows } from "../components/ui";

const blankGuest = { fullName: "", phone: "", email: "", address: "", idType: "passport", idNumber: "", nationality: "Somali", notes: "" };

export default function Guests() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.guests.list, token ? args : "skip");
  const save = useMutation(api.guests.save);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ ...blankGuest, hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "" });
  const [error, setError] = useState("");
  const history = useQuery(api.guests.history, selected ? { token, guestId: selected } : "skip");
  const filtered = useMemo(() => filterRows(rows, query, ["fullName", "phone", "email", "idNumber", "hotelName"]), [rows, query]);
  if (!rows) return <Loading label={t("loading")} />;
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({ token, ...form });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("guests")} action={<Button onClick={() => { setForm({ ...blankGuest, hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "" }); setOpen(true); }}>{t("addGuest")}</Button>} />
      <Panel>
        <div className="border-b border-slate-100 p-4"><SearchBox value={query} onChange={setQuery} placeholder={t("search")} /></div>
        {filtered.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={filtered}
            columns={[
              { key: "name", header: t("name"), cell: (row) => <div><div className="font-medium">{row.fullName}</div><div className="text-xs text-muted">{row.nationality}</div></div> },
              { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
              { key: "phone", header: t("phone"), cell: (row) => row.phone },
              { key: "id", header: t("idNumber"), cell: (row) => row.idNumber },
              { key: "stays", header: t("stays"), cell: (row) => row.stays },
              { key: "balance", header: t("outstanding"), cell: (row) => money(row.balance) },
              { key: "view", header: "", cell: (row) => <Button variant="ghost" onClick={() => setSelected(row._id)}>{t("view")}</Button> },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("addGuest")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("hotel")}>
                <Select value={form.hotelId} onChange={set("hotelId")}>
                  {hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label={t("name")}><Input value={form.fullName} onChange={set("fullName")} required /></Field>
            <Field label={t("phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
            <Field label={t("email")}><Input value={form.email} onChange={set("email")} /></Field>
            <Field label={t("nationality")}><Input value={form.nationality} onChange={set("nationality")} /></Field>
            <Field label="ID type">
              <Select value={form.idType} onChange={set("idType")}>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label={t("idNumber")}><Input value={form.idNumber} onChange={set("idNumber")} /></Field>
            <div className="sm:col-span-2"><Field label={t("address")}><Input value={form.address} onChange={set("address")} /></Field></div>
            <div className="sm:col-span-2 space-y-3">
              <ErrorText>{error}</ErrorText>
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {selected ? (
        <Modal title={history?.guest?.fullName || t("guest")} onClose={() => setSelected(null)} wide>
          {!history ? <Loading label={t("loading")} /> : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>{history.guest.phone}</div>
                <div>{history.guest.email}</div>
                <div>{history.guest.idType}: {history.guest.idNumber}</div>
                <div className="font-semibold">{t("outstanding")}: {money(history.balance)}</div>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t("reservations")}</h3>
                {history.reservations.map((row) => (
                  <div key={row._id} className="flex items-center justify-between border-t border-slate-100 py-2">
                    <span>Room {row.roomNumber} · {row.checkIn} → {row.checkOut}</span>
                    <Badge value={row.status} />
                  </div>
                ))}
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t("invoices")}</h3>
                {history.invoices.map((row) => (
                  <div key={row._id} className="flex items-center justify-between border-t border-slate-100 py-2">
                    <span>{row.number}</span>
                    <span>{money(row.total - row.paid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
