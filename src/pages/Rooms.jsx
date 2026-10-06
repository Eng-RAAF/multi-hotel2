import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, SearchBox, Select, Table, filterRows } from "../components/ui";

const blank = { number: "", typeName: "Double", price: 40, capacity: 2, floor: "1", status: "available", housekeepingStatus: "clean", notes: "" };

export default function Rooms() {
  const { t, token, money, hotels, hotelId, canSwitch, user } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.rooms.list, token ? args : "skip");
  const save = useMutation(api.rooms.save);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, hotelId: hotelId !== "all" ? hotelId : "" });
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const searched = filterRows(rows, query, ["number", "typeName", "hotelName", "status"]);
    return status === "all" ? searched : searched.filter((row) => row.status === status);
  }, [rows, query, status]);

  if (!rows) return <Loading label={t("loading")} />;
  const canEdit = ["super_admin", "hotel_manager", "receptionist"].includes(user?.role);
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
      <Panel>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchBox value={query} onChange={setQuery} placeholder={t("search")} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-48">
            {["all", "available", "occupied", "reserved", "cleaning", "maintenance", "out_of_service"].map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : item.replaceAll("_", " ")}</option>)}
          </Select>
        </div>
        {filtered.length ? (
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
              { key: "edit", header: "", cell: (row) => canEdit ? <Button variant="ghost" onClick={() => { setForm({ ...row, roomId: row._id }); setOpen(true); }}>{t("edit")}</Button> : null },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
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
