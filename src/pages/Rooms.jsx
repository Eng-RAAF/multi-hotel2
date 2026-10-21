import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, SearchBox, Select, Table, filterRows } from "../components/ui";

const blank = { number: "", typeName: "Double", price: 40, capacity: 2, floor: "1", status: "available", housekeepingStatus: "clean", notes: "" };
const STATUSES = ["available", "occupied", "reserved", "cleaning", "maintenance", "out_of_service"];

// Blue = available and ready, green = occupied, red = not ready (cleaning, maintenance, out of service or dirty).
const palette = {
  blue: { card: "border-blue-300 bg-blue-50", bar: "bg-blue-600", tile: "border-blue-200 bg-blue-50 text-blue-800", pill: "bg-blue-600 text-white" },
  green: { card: "border-green-300 bg-green-50", bar: "bg-green-600", tile: "border-green-200 bg-green-50 text-green-800", pill: "bg-green-600 text-white" },
  red: { card: "border-red-300 bg-red-50", bar: "bg-red-600", tile: "border-red-200 bg-red-50 text-red-800", pill: "bg-red-600 text-white" },
  amber: { card: "border-amber-300 bg-amber-50", bar: "bg-amber-500", tile: "border-amber-200 bg-amber-50 text-amber-800", pill: "bg-amber-500 text-white" },
};
const statusColor = { available: "blue", occupied: "green", reserved: "amber", cleaning: "red", maintenance: "red", out_of_service: "red" };
const tones = Object.fromEntries(STATUSES.map((item) => [item, palette[statusColor[item]]]));

function roomTone(room) {
  if (room.status === "available" && !["clean", "inspected"].includes(room.housekeepingStatus)) return palette.red;
  return palette[statusColor[room.status]] || palette.red;
}

function RoomCard({ room, t, money, showHotel, onEdit }) {
  const tone = roomTone(room);
  const guest = room.currentGuest;
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border shadow-sm ${tone.card}`}>
      <div className={`h-1.5 ${tone.bar}`} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight text-ink">{room.number}</div>
            <div className="truncate text-sm text-muted">{room.typeName}{showHotel && room.hotelName ? ` · ${room.hotelName}` : ""}</div>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone.pill}`}>{room.status.replaceAll("_", " ")}</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-muted">{t("floor")}</dt><dd className="font-semibold text-ink">{room.floor}</dd></div>
          <div><dt className="text-muted">{t("capacity")}</dt><dd className="font-semibold text-ink">{room.capacity}</dd></div>
          <div><dt className="text-muted">{t("price")}</dt><dd className="font-semibold text-ink">{money(room.price)}</dd></div>
        </dl>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">{t("housekeeping")}</span>
          <Badge value={room.housekeepingStatus} />
        </div>
        {guest ? (
          <div className="rounded-lg bg-white/70 px-3 py-2 text-xs">
            <div className="text-muted">{guest.status === "checked_in" ? t("guest") : t("bookedFor")}</div>
            <div className="truncate font-semibold text-ink">{guest.name || "—"}</div>
            <div className="text-muted">{guest.checkIn} → {guest.checkOut}</div>
          </div>
        ) : room.status === "available" && ["clean", "inspected"].includes(room.housekeepingStatus) ? (
          <div className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">{t("readyToSell")}</div>
        ) : null}
        {room.notes ? <p className="line-clamp-2 text-xs text-muted">{room.notes}</p> : null}
        {onEdit ? (
          <div className="mt-auto flex justify-end pt-1">
            <Button variant="secondary" onClick={onEdit}>{t("edit")}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Rooms() {
  const { t, token, money, hotels, hotelId, canSwitch, user } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.rooms.list, token ? args : "skip");
  const save = useMutation(api.rooms.save);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("cards");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, hotelId: hotelId !== "all" ? hotelId : "" });
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const searched = filterRows(rows, query, ["number", "typeName", "hotelName", "status"]);
    return status === "all" ? searched : searched.filter((row) => row.status === status);
  }, [rows, query, status]);
  const counts = useMemo(() => {
    const result = Object.fromEntries(STATUSES.map((item) => [item, 0]));
    for (const row of rows || []) result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, [rows]);

  if (!rows) return <Loading label={t("loading")} />;
  const canEdit = ["super_admin", "hotel_manager", "receptionist"].includes(user?.role);
  const showHotel = !hotelId || hotelId === "all";
  const editRoom = (row) => { setForm({ ...row, roomId: row._id }); setError(""); setOpen(true); };
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({
        token,
        roomId: form.roomId,
        hotelId: form.hotelId,
        number: form.number,
        typeName: form.typeName,
        price: Number(form.price),
        capacity: Number(form.capacity),
        floor: form.floor,
        status: form.status,
        housekeepingStatus: form.housekeepingStatus,
        notes: form.notes,
      });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("rooms")}
        action={canEdit ? <Button onClick={() => { setForm({ ...blank, hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "" }); setError(""); setOpen(true); }}>{t("addRoom")}</Button> : null}
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <button
          onClick={() => setStatus("all")}
          className={`rounded-xl border bg-white px-3 py-2.5 text-left transition hover:shadow-sm ${status === "all" ? "ring-2 ring-brand" : "border-slate-200"}`}
        >
          <div className="text-xs font-medium text-muted">{t("allRooms")}</div>
          <div className="text-xl font-bold text-ink">{rows.length}</div>
        </button>
        {STATUSES.map((item) => (
          <button
            key={item}
            onClick={() => setStatus(status === item ? "all" : item)}
            className={`rounded-xl border px-3 py-2.5 text-left transition hover:shadow-sm ${tones[item].tile} ${status === item ? "ring-2 ring-brand" : ""}`}
          >
            <div className="text-xs font-medium capitalize">{item.replaceAll("_", " ")}</div>
            <div className="text-xl font-bold">{counts[item]}</div>
          </button>
        ))}
      </div>
      <Panel>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <SearchBox value={query} onChange={setQuery} placeholder={t("search")} />
          <div className="flex gap-1 rounded-lg border border-slate-200 p-1 sm:ml-auto">
            {["cards", "table"].map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === item ? "bg-brand text-white" : "text-ink hover:bg-slate-100"}`}
              >
                {t(item === "cards" ? "roomCards" : "roomTable")}
              </button>
            ))}
          </div>
        </div>
        {!filtered.length ? <Empty title={t("noResults")} /> : view === "cards" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((row) => (
              <RoomCard key={row._id} room={row} t={t} money={money} showHotel={showHotel} onEdit={canEdit ? () => editRoom(row) : null} />
            ))}
          </div>
        ) : (
          <Table
            rowKey={(row) => row._id}
            rows={filtered}
            columns={[
              { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
              { key: "number", header: t("room"), cell: (row) => <span className="font-semibold">{row.number}</span> },
              { key: "type", header: t("type"), cell: (row) => row.typeName },
              { key: "price", header: t("price"), cell: (row) => money(row.price) },
              { key: "capacity", header: t("capacity"), cell: (row) => row.capacity },
              { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
              { key: "hk", header: t("housekeeping"), cell: (row) => <Badge value={row.housekeepingStatus} /> },
              { key: "edit", header: "", cell: (row) => canEdit ? <Button variant="ghost" onClick={() => editRoom(row)}>{t("edit")}</Button> : null },
            ]}
          />
        )}
      </Panel>
      {open ? (
        <Modal title={form.roomId ? t("edit") : t("addRoom")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            {canSwitch ? (
              <div className="sm:col-span-2">
                <Field label={t("hotel")}>
                  <Select value={form.hotelId} onChange={set("hotelId")} required>
                    {hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
                  </Select>
                </Field>
              </div>
            ) : null}
            <Field label={t("roomNumber")}><Input value={form.number} onChange={set("number")} required /></Field>
            <Field label={t("type")}><Input value={form.typeName} onChange={set("typeName")} required /></Field>
            <Field label={t("price")}><Input type="number" value={form.price} onChange={set("price")} required /></Field>
            <Field label={t("capacity")}><Input type="number" value={form.capacity} onChange={set("capacity")} required /></Field>
            <Field label={t("floor")}><Input value={form.floor} onChange={set("floor")} /></Field>
            <Field label={t("status")}>
              <Select value={form.status} onChange={set("status")}>
                {["available", "occupied", "reserved", "cleaning", "maintenance", "out_of_service"].map((item) => <option key={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label={t("housekeepingStatus")}>
              <Select value={form.housekeepingStatus} onChange={set("housekeepingStatus")}>
                {["clean", "dirty", "cleaning", "inspected"].map((item) => <option key={item}>{item}</option>)}
              </Select>
            </Field>
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
