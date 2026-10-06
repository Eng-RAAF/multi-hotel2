import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { METHODS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Payments() {
  const { t, token, money, hotelId } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.billing.listPayments, token ? args : "skip");
  const invoices = useQuery(api.billing.listInvoices, token ? args : "skip");
  const pay = useMutation(api.billing.pay);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ invoiceId: "", amount: "", method: "cash", type: "payment", reference: "" });
  if (!rows || !invoices) return <Loading label={t("loading")} />;
  const openInvoices = invoices.filter((invoice) => invoice.status === "unpaid" || invoice.status === "partial");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await pay({ token, invoiceId: form.invoiceId, amount: Number(form.amount), method: form.method, date: todayISO(), type: form.type, reference: form.reference });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("payments")} action={<Button onClick={() => setOpen(true)}>{t("recordPayment")}</Button>} />
      <Panel>
        {rows.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={rows}
            columns={[
              { key: "date", header: t("date"), cell: (row) => row.date },
              { key: "party", header: t("guest"), cell: (row) => <div><div>{row.party}</div><div className="text-xs text-muted">{row.hotelName}</div></div> },
              { key: "invoice", header: t("invoices"), cell: (row) => row.invoiceId ? <Link className="text-brand-dark" to={`/invoices/${row.invoiceId}`}>{row.invoiceNumber}</Link> : "—" },
              { key: "method", header: t("method"), cell: (row) => row.method.replaceAll("_", " ") },
              { key: "reference", header: t("reference"), cell: (row) => row.reference },
              { key: "amount", header: t("amount"), cell: (row) => money(row.amount) },
              { key: "type", header: t("type"), cell: (row) => <Badge value={row.type} /> },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("recordPayment")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("invoices")}>
              <Select value={form.invoiceId} onChange={(event) => {
                const invoice = openInvoices.find((item) => item._id === event.target.value);
                setForm({ ...form, invoiceId: event.target.value, amount: invoice ? String(invoice.balance) : "" });
              }} required>
                <option value="">Select</option>
                {openInvoices.map((invoice) => <option key={invoice._id} value={invoice._id}>{invoice.number} · {invoice.party} · {money(invoice.balance)}</option>)}
              </Select>
            </Field>
            <Field label={t("amount")}><Input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></Field>
            <Field label={t("method")}>
              <Select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>
            </Field>
            <Field label={t("reference")}><Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
