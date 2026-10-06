import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Textarea } from "../components/ui";

const empty = { name: "", city: "", address: "", phone: "", email: "", currency: "USD", taxRate: 5, serviceCharge: 5, status: "active", notes: "" };

export default function Hotels() {
  const { t, token, user } = useScope();
  const args = { token };
  const rows = useQuery(api.hotels.list, token ? args : "skip");
  const save = useMutation(api.hotels.save);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  function edit(hotel) {
    setForm({
      hotelId: hotel._id,
      name: hotel.name,
      city: hotel.city,
      address: hotel.address,
      phone: hotel.phone,
      email: hotel.email,
      currency: hotel.currency,
      taxRate: hotel.taxRate,
      serviceCharge: hotel.serviceCharge,
      status: hotel.status,
      notes: hotel.notes || "",
    });
    setError("");
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({
        token,
        ...form,
        taxRate: Number(form.taxRate),
        serviceCharge: Number(form.serviceCharge),
      });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!rows) return <Loading label={t("loading")} />;
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return (
    <div>
      <PageHeader
        title={t("allHotels")}
        subtitle="Mogadishu, Garowe, Bosaso, Hargeisa, Kismayo"
        action={user?.role === "super_admin" ? <Button onClick={() => { setForm(empty); setOpen(true); }}>{t("addHotel")}</Button> : null}
      />
      <Panel>
        {rows.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={rows}
            columns={[
              { key: "name", header: t("hotel"), cell: (row) => <div><div className="font-semibold">{row.name}</div><div className="text-xs text-muted">{row.city}</div></div> },
              { key: "phone", header: t("phone"), cell: (row) => row.phone },
              { key: "rooms", header: t("rooms"), cell: (row) => row.rooms },
              { key: "occupancy", header: t("occupancy"), cell: (row) => `${row.occupancy}%` },
              { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
              { key: "edit", header: "", cell: (row) => <Button variant="secondary" onClick={() => edit(row)}>{t("edit")}</Button> },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={form.hotelId ? t("edit") : t("addHotel")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label={t("name")}><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label={t("city")}><Input value={form.city} onChange={set("city")} required /></Field>
            <Field label={t("phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
            <Field label={t("email")}><Input value={form.email} onChange={set("email")} /></Field>
            <div className="sm:col-span-2"><Field label={t("address")}><Input value={form.address} onChange={set("address")} /></Field></div>
            <Field label={t("currency")}><Input value={form.currency} onChange={set("currency")} /></Field>
            <Field label={t("status")}>
              <Select value={form.status} onChange={set("status")}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </Select>
            </Field>
            <Field label={t("taxRate")}><Input type="number" value={form.taxRate} onChange={set("taxRate")} /></Field>
            <Field label={t("serviceRate")}><Input type="number" value={form.serviceCharge} onChange={set("serviceCharge")} /></Field>
            <div className="sm:col-span-2"><Field label={t("notes")}><Textarea value={form.notes} onChange={set("notes")} /></Field></div>
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
