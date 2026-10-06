import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { INCOME_ACCOUNTS, METHODS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../components/ui";

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function billFor(stay, extras, hotel) {
  const extra = (extras || [])
    .filter((item) => item.description && Number(item.amount) > 0)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const subtotal = roundMoney(Number(stay?.total || 0) + extra);
  const tax = roundMoney(subtotal * Number(hotel?.taxRate || 0) / 100);
  const service = roundMoney(subtotal * Number(hotel?.serviceCharge || 0) / 100);
  return { subtotal, tax, service, total: roundMoney(subtotal + tax + service) };
}

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function FrontDesk() {
  const { t, token, hotelId, hotels, money } = useScope();
  const navigate = useNavigate();
  const location = useLocation();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const desk = useQuery(api.reservations.desk, token ? args : "skip");
  const checkIn = useMutation(api.reservations.checkIn);
  const checkOut = useMutation(api.reservations.checkOut);
  const saveReservation = useMutation(api.reservations.save);
  const [stay, setStay] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentEdited, setPaymentEdited] = useState(false);
  const [method, setMethod] = useState("cash");
  const [extras, setExtras] = useState([blankExtra()]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkForm, setWalkForm] = useState(blankWalk(hotelId, hotels));
  const walkArgs = walkOpen && walkForm.hotelId ? { token, hotelId: walkForm.hotelId } : "skip";
  const guests = useQuery(api.guests.list, walkArgs);
  const rooms = useQuery(api.rooms.list, walkArgs);
  const hotel = hotels.find((item) => item._id === stay?.hotelId);
  const bill = stay ? billFor(stay, extras, hotel) : null;

  useEffect(() => {
    if (!stay || paymentEdited) return;
    setPaymentAmount(String(billFor(stay, extras, hotel).total));
  }, [stay, extras, hotel, paymentEdited]);

  useEffect(() => {
    const checkoutId = location.state?.checkoutId;
    if (!desk || !checkoutId) return;
    const row = [...desk.inHouse, ...desk.departures].find((item) => item._id === checkoutId);
    if (row) openCheckout(row);
    navigate(location.pathname, { replace: true, state: null });
  }, [desk, location.state, location.pathname, navigate]);

  if (!desk) return <Loading label={t("loading")} />;

  function openCheckout(row) {
    setStay(row);
    setExtras([blankExtra()]);
    setPaymentEdited(false);
    setMethod("cash");
    setError("");
    const match = hotels.find((item) => item._id === row.hotelId);
    setPaymentAmount(String(billFor(row, [], match).total));
  }

  async function arrive(row) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await checkIn({ token, reservationId: row._id });
      setNotice(`${row.guestName} · Room ${row.roomNumber}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function depart(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  async function submitWalkIn(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const reservationId = await saveReservation({
        token,
        hotelId: walkForm.hotelId,
        guestId: walkForm.guestId,
        roomId: walkForm.roomId,
        checkIn: todayISO(),
        checkOut: walkForm.checkOut,
        status: "confirmed",
        adults: 1,
        children: 0,
        notes: "Walk-in",
      });
      await checkIn({ token, reservationId });
      const guest = (guests || []).find((item) => item._id === walkForm.guestId);
      setWalkOpen(false);
      setNotice(guest?.fullName || t("checkIn"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const availableRooms = (rooms || []).filter((room) => room.status === "available");

  return (
    <div>
      <PageHeader
        title={t("frontDesk")}
        subtitle={desk.today}
        action={<Button onClick={() => { setWalkForm(blankWalk(hotelId, hotels)); setError(""); setWalkOpen(true); }}>{t("walkIn")}</Button>}
      />
      <ErrorText>{!stay && !walkOpen ? error : ""}</ErrorText>
      {notice ? <p className="mb-3 text-sm font-medium text-brand-dark">{notice}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title={t("arrivals")} rows={desk.arrivals} empty={t("noResults")} actionLabel={t("checkIn")} onAction={arrive} disabled={busy} />
        <Column title={t("inHouse")} rows={desk.inHouse} empty={t("noResults")} actionLabel={t("checkOut")} onAction={openCheckout} disabled={busy} />
        <Column title={t("departures")} rows={desk.departures} empty={t("noResults")} actionLabel={t("checkOut")} onAction={openCheckout} disabled={busy} />
      </div>
      {stay && bill ? (
        <Modal title={`${t("checkOut")} · ${stay.guestName}`} onClose={() => setStay(null)} wide>
          <form onSubmit={depart} className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div>Room {stay.roomNumber} · {stay.checkIn} → {stay.checkOut}</div>
              <div className="mt-2 flex justify-between"><span>{t("subtotal")}</span><span>{money(bill.subtotal)}</span></div>
              <div className="flex justify-between"><span>{t("tax")} ({hotel?.taxRate || 0}%)</span><span>{money(bill.tax)}</span></div>
              <div className="flex justify-between"><span>{t("serviceCharge")} ({hotel?.serviceCharge || 0}%)</span><span>{money(bill.service)}</span></div>
              <div className="mt-1 flex justify-between font-semibold"><span>{t("total")}</span><span>{money(bill.total)}</span></div>
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
            <Button variant="secondary" onClick={() => setExtras([...extras, blankExtra()])}>{t("create")}</Button>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("paymentAmount")}><Input type="number" value={paymentAmount} onChange={(event) => { setPaymentEdited(true); setPaymentAmount(event.target.value); }} /></Field>
              <Field label={t("method")}>
                <Select value={method} onChange={(event) => setMethod(event.target.value)}>
                  {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-muted">Date {todayISO()}. Leave payment at 0 to keep the balance on account.</p>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy}>{busy ? t("working") : t("checkOut")}</Button>
          </form>
        </Modal>
      ) : null}
      {walkOpen ? (
        <Modal title={t("walkIn")} onClose={() => setWalkOpen(false)}>
          <form onSubmit={submitWalkIn} className="space-y-3">
            <Field label={t("hotel")}>
              <Select value={walkForm.hotelId} onChange={(event) => setWalkForm({ ...walkForm, hotelId: event.target.value, guestId: "", roomId: "" })} required>
                {hotels.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label={t("guest")}>
              <Select value={walkForm.guestId} onChange={(event) => setWalkForm({ ...walkForm, guestId: event.target.value })} required>
                <option value="">Select</option>
                {(guests || []).map((guest) => <option key={guest._id} value={guest._id}>{guest.fullName}</option>)}
              </Select>
            </Field>
            <Field label={t("room")}>
              <Select value={walkForm.roomId} onChange={(event) => setWalkForm({ ...walkForm, roomId: event.target.value })} required>
                <option value="">Select</option>
                {availableRooms.map((room) => <option key={room._id} value={room._id}>{room.number} · {room.typeName} · {money(room.price)}</option>)}
              </Select>
            </Field>
            <Field label={t("to")}><Input type="date" value={walkForm.checkOut} min={tomorrowISO()} onChange={(event) => setWalkForm({ ...walkForm, checkOut: event.target.value })} required /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy}>{busy ? t("working") : t("checkIn")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blankExtra() {
  return { description: "", amount: "", accountCode: "4200" };
}

function blankWalk(hotelId, hotels) {
  return {
    hotelId: hotelId && hotelId !== "all" ? hotelId : hotels[0]?._id || "",
    guestId: "",
    roomId: "",
    checkOut: tomorrowISO(),
  };
}

function updateExtra(extras, setExtras, index, key, value) {
  const next = extras.slice();
  next[index] = { ...next[index], [key]: value };
  setExtras(next);
}

function Column({ title, rows, empty, actionLabel, onAction, disabled }) {
  return (
    <Panel>
      <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{title}</h2>
      {rows.length ? rows.map((row) => (
        <div key={row._id} className="border-t border-slate-100 px-4 py-3 text-sm">
          <div className="font-medium">{row.guestName}</div>
          <div className="text-xs text-muted">{row.hotelName} · Room {row.roomNumber}</div>
          <div className="mt-1 text-xs text-muted">{row.checkIn} → {row.checkOut}</div>
          <div className="mt-2 flex items-center justify-between">
            <Badge value={row.status} />
            <Button variant="secondary" disabled={disabled} onClick={() => onAction(row)}>{actionLabel}</Button>
          </div>
        </div>
      )) : <Empty title={empty} />}
    </Panel>
  );
}
