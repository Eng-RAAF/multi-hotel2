import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { METHODS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, ErrorText, Field, Input, Loading, Select } from "../components/ui";

export default function InvoiceDetail({ printMode = false }) {
  const { invoiceId } = useParams();
  const { token, t, money } = useApp();
  const invoice = useQuery(api.billing.getInvoice, token && invoiceId ? { token, invoiceId } : "skip");
  const pay = useMutation(api.billing.pay);
  const cancel = useMutation(api.billing.cancel);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [type, setType] = useState("payment");
  const [error, setError] = useState("");

  if (!token) return <div className="p-8">Sign in to view this invoice.</div>;
  if (invoice === undefined) return <Loading label={t("loading")} />;
  if (!invoice) return <div className="p-8">Invoice not found.</div>;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await pay({ token, invoiceId: invoice._id, amount: Number(amount), method, date: todayISO(), type, reference: "" });
      setAmount("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className={printMode ? "mx-auto max-w-3xl bg-white p-8" : "mx-auto max-w-3xl"}>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Link to="/invoices" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">{t("invoices")}</Link>
        <Button variant="secondary" onClick={() => window.print()}>{t("print")}</Button>
        {!printMode && invoice.status !== "cancelled" && invoice.paid === 0 ? (
          <Button variant="danger" onClick={() => cancel({ token, invoiceId: invoice._id })}>{t("cancel")}</Button>
        ) : null}
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-brand">MHMAS</div>
            <h1 className="text-2xl font-bold">{invoice.hotel?.name}</h1>
            <p className="text-sm text-muted">{invoice.hotel?.address}<br />{invoice.hotel?.city} · {invoice.hotel?.phone}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{invoice.number}</div>
            <div className="text-sm text-muted">{invoice.date}</div>
            <div className="mt-2"><Badge value={invoice.status} /></div>
          </div>
        </div>
        <div className="mt-6 text-sm">
          <div className="text-muted">{t("billTo")}</div>
          <div className="font-semibold">{invoice.billTo}</div>
          {invoice.guest ? <div className="text-muted">{invoice.guest.phone} · {invoice.guest.email}</div> : null}
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted">
              <th className="py-2">{t("description")}</th>
              <th>{t("quantity")}</th>
              <th>{t("unitPrice")}</th>
              <th className="text-right">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item._id} className="border-b border-slate-100">
                <td className="py-2">{item.description}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unitPrice)}</td>
                <td className="text-right">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <Row label={t("subtotal")} value={money(invoice.subtotal)} />
          <Row label={`${t("tax")} (${invoice.taxRate}%)`} value={money(invoice.tax)} />
          <Row label={`${t("serviceCharge")} (${invoice.serviceRate}%)`} value={money(invoice.serviceCharge)} />
          <Row label={t("total")} value={money(invoice.total)} strong />
          <Row label={t("paid")} value={money(invoice.paid)} />
          <Row label={t("balance")} value={money(invoice.balance)} strong />
        </div>
        {invoice.payments?.length ? (
          <div className="mt-6">
            <h2 className="font-semibold">{t("payments")}</h2>
            {invoice.payments.map((payment) => (
              <div key={payment._id} className="flex justify-between border-t border-slate-100 py-2 text-sm">
                <span>{payment.date} · {payment.method} · {payment.reference}</span>
                <span>{payment.type === "refund" ? "-" : ""}{money(payment.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </article>
      {!printMode && invoice.status !== "cancelled" && invoice.status !== "paid" ? (
        <form onSubmit={submit} className="no-print mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
          <Field label={t("amount")}><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field>
          <Field label={t("method")}>
            <Select value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label={t("type")}>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="payment">{t("recordPayment")}</option>
              <option value="refund">{t("refund")}</option>
            </Select>
          </Field>
          <div className="flex items-end"><Button type="submit">{t("save")}</Button></div>
          <div className="sm:col-span-4"><ErrorText>{error}</ErrorText></div>
        </form>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
