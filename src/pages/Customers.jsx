import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { CUSTOMER_KINDS } from "../lib/catalogs";
import { errorMessage } from "../lib/format";
import { Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Customers() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.billing.listCustomers, token ? args : "skip");
  const save = useMutation(api.billing.saveCustomer);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank(hotelId, hotels));
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
      <PageHeader title={t("customers")} action={<Button onClick={() => { setForm(blank(hotelId, hotels)); setOpen(true); }}>{t("create")}</Button>} />
      <Panel>
        {rows.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={rows}
            columns={[
              { key: "name", header: t("name"), cell: (row) => <div><div className="font-medium">{row.name}</div><div className="text-xs text-muted">{row.kind.replaceAll("_", " ")}</div></div> },
              { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
              { key: "phone", header: t("phone"), cell: (row) => row.phone },
              { key: "email", header: t("email"), cell: (row) => row.email },
              { key: "balance", header: t("balance"), cell: (row) => money(row.balance) },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("customer")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("hotel")}>
                <Select value={form.hotelId} onChange={set("hotelId")}>{hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}</Select>
              </Field>
            </div>
            <Field label={t("name")}><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label={t("kind")}>
              <Select value={form.kind} onChange={set("kind")}>{CUSTOMER_KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</Select>
            </Field>
            <Field label={t("phone")}><Input value={form.phone} onChange={set("phone")} /></Field>
            <Field label={t("email")}><Input value={form.email} onChange={set("email")} /></Field>
            <div className="sm:col-span-2"><Field label={t("address")}><Input value={form.address} onChange={set("address")} /></Field></div>
            <div className="sm:col-span-2 space-y-3"><ErrorText>{error}</ErrorText><Button type="submit">{t("save")}</Button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank(hotelId, hotels) {
  return { hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "", name: "", kind: "company", phone: "", email: "", address: "", notes: "" };
}
