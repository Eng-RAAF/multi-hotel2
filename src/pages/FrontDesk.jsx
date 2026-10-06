import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { INCOME_ACCOUNTS, METHODS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../components/ui";

export default function FrontDesk() {
  const { t, token, hotelId, money } = useScope();
  const navigate = useNavigate();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const desk = useQuery(api.reservations.desk, token ? args : "skip");
  const checkIn = useMutation(api.reservations.checkIn);
  const checkOut = useMutation(api.reservations.checkOut);
  const [stay, setStay] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [extras, setExtras] = useState([{ description: "", amount: "", accountCode: "4200" }]);
  const [error, setError] = useState("");

  if (!desk) return <Loading label={t("loading")} />;

  async function arrive(reservationId) {
    await checkIn({ token, reservationId });
  }

  async function depart(event) {
    event.preventDefault();
    setError("");
    try {
      const invoiceId = await checkOut({
        token,
        reservationId: stay._id,
        extraItems: extras.filter((item) => item.description && Number(item.amount) > 0).map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          accountCode: item.accountCode,
        })),
        paymentAmount: Number(paymentAmount || 0),
        method,
        reference: "",
      });
      setStay(null);
      navigate(`/invoices/${invoiceId}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("frontDesk")} subtitle={desk.today} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title={t("arrivals")} rows={desk.arrivals} empty={t("noResults")} actionLabel={t("checkIn")} onAction={(row) => arrive(row._id)} />
        <Column title={t("inHouse")} rows={desk.inHouse} empty={t("noResults")} actionLabel={t("checkOut")} onAction={(row) => { setStay(row); setPaymentAmount(String(row.total || "")); setError(""); }} />
        <Column title={t("departures")} rows={desk.departures} empty={t("noResults")} actionLabel={t("checkOut")} onAction={(row) => { setStay(row); setPaymentAmount(String(row.total || "")); setError(""); }} />
      </div>
      {stay ? (
        <Modal title={`${t("checkOut")} · ${stay.guestName}`} onClose={() => setStay(null)} wide>
          <form onSubmit={depart} className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              Room {stay.roomNumber} · {stay.checkIn} → {stay.checkOut} · {money(stay.total)} before tax
            </div>
            <div className="font-medium">{t("extraServices")}</div>
            {extras.map((extra, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-3">
                <Input placeholder={t("description")} value={extra.description} onChange={(event) => updateExtra(extras, setExtras, index, "description", event.target.value)} />
                <Input type="number" placeholder={t("amount")} value={extra.amount} onChange={(event) => updateExtra(extras, setExtras, index, "amount", event.target.value)} />
                <Select value={extra.accountCode} onChange={(event) => updateExtra(extras, setExtras, index, "accountCode", event.target.value)}>
                  {INCOME_ACCOUNTS.map((account) => <option key={account.code} value={account.code}>{account.label}</option>)}
                </Select>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setExtras([...extras, { description: "", amount: "", accountCode: "4200" }])}>{t("create")}</Button>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("paymentAmount")}><Input type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></Field>
              <Field label={t("method")}>
                <Select value={method} onChange={(event) => setMethod(event.target.value)}>
                  {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted">Date {todayISO()}. Leave payment at 0 to keep the balance on account.</p>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("checkOut")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function updateExtra(extras, setExtras, index, key, value) {
  const next = extras.slice();
  next[index] = { ...next[index], [key]: value };
  setExtras(next);
}

function Column({ title, rows, empty, actionLabel, onAction }) {
  return (
    <Panel>
      <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{title}</h2>
      {rows.length ? rows.map((row) => (
        <div key={row._id} className="border-t border-slate-100 px-4 py-3 text-sm">
          <div className="font-medium">{row.guestName}</div>
          <div className="text-xs text-muted">{row.hotelName} · Room {row.roomNumber}</div>
          <div className="mt-2 flex items-center justify-between">
            <Badge value={row.status} />
            <Button variant="secondary" onClick={() => onAction(row)}>{actionLabel}</Button>
          </div>
        </div>
      )) : <Empty title={empty} />}
    </Panel>
  );
}
