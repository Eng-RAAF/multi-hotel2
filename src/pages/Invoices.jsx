import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { INCOME_ACCOUNTS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Invoices() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.billing.listInvoices, token ? args : "skip");
  const create = useMutation(api.billing.create);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank(hotelId, hotels));
  const partyArgs = form.hotelId ? { token, hotelId: form.hotelId } : "skip";
  const guests = useQuery(api.guests.list, open ? partyArgs : "skip");
  const customers = useQuery(api.billing.listCustomers, open ? partyArgs : "skip");

  if (!rows) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        token,
        hotelId: form.hotelId,
        date: form.date,
        notes: form.notes,
        items: form.items.filter((item) => item.description).map((item) => ({
          description: item.description,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          accountCode: item.accountCode,
        })),
      };
      if (form.party.startsWith("g:")) payload.guestId = form.party.slice(2);
      if (form.party.startsWith("c:")) payload.customerId = form.party.slice(2);
      await create(payload);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("invoices")} action={<Button onClick={() => { setForm(blank(hotelId, hotels)); setOpen(true); }}>{t("addInvoice")}</Button>} />
      <Panel>
        {rows.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={rows}
            columns={[
              { key: "number", header: "#", cell: (row) => <Link className="font-semibold text-brand-dark" to={`/invoices/${row._id}`}>{row.number}</Link> },
              { key: "date", header: t("date"), cell: (row) => row.date },
              { key: "party", header: t("billTo"), cell: (row) => <div><div>{row.party}</div><div className="text-xs text-muted">{row.hotelName}</div></div> },
              { key: "total", header: t("total"), cell: (row) => money(row.total) },
              { key: "balance", header: t("balance"), cell: (row) => money(row.balance) },
              { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("addInvoice")} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("hotel")}>
                <Select value={form.hotelId} onChange={(event) => setForm({ ...form, hotelId: event.target.value, party: "" })}>
                  {hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
                </Select>
              </Field>
              <Field label={t("date")}><Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
            </div>
            <Field label={t("billTo")}>
              <Select value={form.party} onChange={(event) => setForm({ ...form, party: event.target.value })} required>
                <option value="">Select</option>
                {(guests || []).map((guest) => <option key={guest._id} value={`g:${guest._id}`}>Guest · {guest.fullName}</option>)}
                {(customers || []).map((customer) => <option key={customer._id} value={`c:${customer._id}`}>Customer · {customer.name}</option>)}
              </Select>
            </Field>
            {form.items.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-4">
                <Input className="sm:col-span-2" placeholder={t("description")} value={item.description} onChange={(event) => setItem(form, setForm, index, "description", event.target.value)} />
                <Input type="number" placeholder={t("quantity")} value={item.quantity} onChange={(event) => setItem(form, setForm, index, "quantity", event.target.value)} />
                <Input type="number" placeholder={t("unitPrice")} value={item.unitPrice} onChange={(event) => setItem(form, setForm, index, "unitPrice", event.target.value)} />
                <Select value={item.accountCode} onChange={(event) => setItem(form, setForm, index, "accountCode", event.target.value)}>
                  {INCOME_ACCOUNTS.map((account) => <option key={account.code} value={account.code}>{account.label}</option>)}
                </Select>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, unitPrice: "", accountCode: "4200" }] })}>{t("create")}</Button>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function setItem(form, setForm, index, key, value) {
  const items = form.items.slice();
  items[index] = { ...items[index], [key]: value };
  setForm({ ...form, items });
}

function blank(hotelId, hotels) {
  return {
    hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "",
    party: "",
    date: todayISO(),
    notes: "",
    items: [{ description: "", quantity: 1, unitPrice: "", accountCode: "4000" }],
  };
}
