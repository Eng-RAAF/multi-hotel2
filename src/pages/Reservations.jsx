import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage, nightsBetween, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, SearchBox, Select, Table, filterRows } from "../components/ui";

export default function Reservations() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.reservations.list, token ? args : "skip");
  const save = useMutation(api.reservations.save);
  const checkIn = useMutation(api.reservations.checkIn);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank(hotelId, hotels));
  const guestArgs = form.hotelId ? { token, hotelId: form.hotelId } : "skip";
  const guests = useQuery(api.guests.list, open ? guestArgs : "skip");
  const rooms = useQuery(api.rooms.list, open ? guestArgs : "skip");
  const filtered = useMemo(() => filterRows(rows, query, ["guestName", "roomNumber", "hotelName", "status"]), [rows, query]);

  if (!rows) return <Loading label={t("loading")} />;
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const room = (rooms || []).find((item) => item._id === form.roomId);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({
        token,
        reservationId: form.reservationId,
        hotelId: form.hotelId,
        guestId: form.guestId,
        roomId: form.roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        status: form.status,
        adults: Number(form.adults),
        children: Number(form.children),
        notes: form.notes,
      });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("reservations")} action={<Button onClick={() => { setForm(blank(hotelId, hotels)); setError(""); setOpen(true); }}>{t("addReservation")}</Button>} />
      <Panel>
        <div className="border-b border-slate-100 p-4"><SearchBox value={query} onChange={setQuery} placeholder={t("search")} /></div>
        {filtered.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={filtered}
            columns={[
              { key: "guest", header: t("guest"), cell: (row) => <div><div className="font-medium">{row.guestName}</div><div className="text-xs text-muted">{row.hotelName}</div></div> },
              { key: "room", header: t("room"), cell: (row) => `${row.roomNumber} · ${row.roomType}` },
              { key: "dates", header: t("date"), cell: (row) => `${row.checkIn} → ${row.checkOut}` },
              { key: "total", header: t("total"), cell: (row) => money(row.total) },
              { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
              { key: "actions", header: "", cell: (row) => ["pending", "confirmed"].includes(row.status) ? <Button variant="secondary" onClick={() => checkIn({ token, reservationId: row._id })}>{t("checkIn")}</Button> : null },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("addReservation")} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label={t("hotel")}>
              <Select value={form.hotelId} onChange={set("hotelId")} required>
                {hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
              </Select>
            </Field>
            <Field label={t("status")}>
              <Select value={form.status} onChange={set("status")}>
                {["pending", "confirmed", "cancelled", "no_show"].map((item) => <option key={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label={t("guest")}>
              <Select value={form.guestId} onChange={set("guestId")} required>
                <option value="">Select</option>
                {(guests || []).map((guest) => <option key={guest._id} value={guest._id}>{guest.fullName}</option>)}
              </Select>
            </Field>
            <Field label={t("room")}>
              <Select value={form.roomId} onChange={set("roomId")} required>
                <option value="">Select</option>
                {(rooms || []).map((item) => <option key={item._id} value={item._id}>{item.number} · {item.typeName} · {money(item.price)}</option>)}
              </Select>
            </Field>
            <Field label={t("from")}><Input type="date" value={form.checkIn} onChange={set("checkIn")} required /></Field>
            <Field label={t("to")}><Input type="date" value={form.checkOut} onChange={set("checkOut")} required /></Field>
            <Field label={t("adults")}><Input type="number" min="1" value={form.adults} onChange={set("adults")} /></Field>
            <Field label={t("children")}><Input type="number" min="0" value={form.children} onChange={set("children")} /></Field>
            <div className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              {nights} {t("nights")} · {money((room?.price || 0) * nights)}
            </div>
            <div className="sm:col-span-2 space-y-3">
              <ErrorText>{error}</ErrorText>
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank(hotelId, hotels) {
  return {
    hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "",
    guestId: "",
    roomId: "",
    checkIn: todayISO(),
    checkOut: todayISO(),
    status: "confirmed",
    adults: 1,
    children: 0,
    notes: "",
  };
}
