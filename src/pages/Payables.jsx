import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { EXPENSE_ACCOUNTS, METHODS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Payables() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const bills = useQuery(api.accounting.listBills, token ? args : "skip");
  const suppliers = useQuery(api.accounting.listSuppliers, token ? args : "skip");
  const saveSupplier = useMutation(api.accounting.saveSupplier);
  const saveBill = useMutation(api.accounting.saveBill);
  const payBill = useMutation(api.accounting.payBill);
  const [tab, setTab] = useState("bills");
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");
  const [supplier, setSupplier] = useState(blankSupplier(hotelId, hotels));
  const [bill, setBill] = useState(blankBill(hotelId));
  const [payment, setPayment] = useState({ billId: "", amount: "", method: "cash" });
  if (!bills || !suppliers) return <Loading label={t("loading")} />;

  async function submitSupplier(event) {
    event.preventDefault();
    setError("");
    try {
      await saveSupplier({ token, ...supplier });
      setMode("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitBill(event) {
    event.preventDefault();
    setError("");
    try {
      await saveBill({ token, ...bill, amount: Number(bill.amount) });
      setMode("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitPay(event) {
    event.preventDefault();
    setError("");
    try {
      await payBill({ token, billId: payment.billId, amount: Number(payment.amount), method: payment.method, date: todayISO(), reference: "" });
      setMode("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("payables")}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setSupplier(blankSupplier(hotelId, hotels)); setMode("supplier"); }}>{t("suppliers")}</Button>
            <Button onClick={() => { setBill(blankBill(hotelId !== "all" ? hotelId : hotels[0]?._id)); setMode("bill"); }}>{t("bills")}</Button>
          </div>
        }
      />
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "bills" ? "primary" : "secondary"} onClick={() => setTab("bills")}>{t("bills")}</Button>
        <Button variant={tab === "suppliers" ? "primary" : "secondary"} onClick={() => setTab("suppliers")}>{t("suppliers")}</Button>
      </div>
      {tab === "bills" ? (
        <Panel>
          {bills.length ? (
            <Table rowKey={(row) => row._id} rows={bills} columns={[
              { key: "number", header: "#", cell: (row) => row.number },
              { key: "supplier", header: t("supplier"), cell: (row) => row.supplierName },
              { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
              { key: "due", header: t("dueDate"), cell: (row) => row.dueDate },
              { key: "balance", header: t("balance"), cell: (row) => money(row.balance) },
              { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
              { key: "pay", header: "", cell: (row) => row.balance > 0 ? <Button variant="secondary" onClick={() => { setPayment({ billId: row._id, amount: String(row.balance), method: "cash" }); setMode("pay"); }}>{t("payBill")}</Button> : null },
            ]} />
          ) : <Empty title={t("noResults")} />}
        </Panel>
      ) : (
        <Panel>
          {suppliers.length ? (
            <Table rowKey={(row) => row._id} rows={suppliers} columns={[
              { key: "name", header: t("name"), cell: (row) => row.name },
              { key: "category", header: t("category"), cell: (row) => row.category },
              { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
              { key: "phone", header: t("phone"), cell: (row) => row.phone },
              { key: "balance", header: t("balance"), cell: (row) => money(row.balance) },
            ]} />
          ) : <Empty title={t("noResults")} />}
        </Panel>
      )}
      {mode === "supplier" ? (
        <Modal title={t("supplier")} onClose={() => setMode("")}>
          <form onSubmit={submitSupplier} className="space-y-3">
            <Field label={t("hotel")}><Select value={supplier.hotelId} onChange={(event) => setSupplier({ ...supplier, hotelId: event.target.value })}>{hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}</Select></Field>
            <Field label={t("name")}><Input value={supplier.name} onChange={(event) => setSupplier({ ...supplier, name: event.target.value })} required /></Field>
            <Field label={t("category")}><Input value={supplier.category} onChange={(event) => setSupplier({ ...supplier, category: event.target.value })} /></Field>
            <Field label={t("phone")}><Input value={supplier.phone} onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })} /></Field>
            <Field label={t("email")}><Input value={supplier.email} onChange={(event) => setSupplier({ ...supplier, email: event.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
      {mode === "bill" ? (
        <Modal title={t("bills")} onClose={() => setMode("")}>
          <form onSubmit={submitBill} className="space-y-3">
            <Field label={t("supplier")}>
              <Select value={bill.supplierId} onChange={(event) => {
                const item = suppliers.find((supplier) => supplier._id === event.target.value);
                setBill({ ...bill, supplierId: event.target.value, hotelId: item?.hotelId || bill.hotelId });
              }} required>
                <option value="">Select</option>
                {suppliers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label={t("category")}>
              <Select value={bill.accountCode} onChange={(event) => setBill({ ...bill, accountCode: event.target.value })}>
                {EXPENSE_ACCOUNTS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </Select>
            </Field>
            <Field label={t("amount")}><Input type="number" value={bill.amount} onChange={(event) => setBill({ ...bill, amount: event.target.value })} required /></Field>
            <Field label={t("date")}><Input type="date" value={bill.date} onChange={(event) => setBill({ ...bill, date: event.target.value })} /></Field>
            <Field label={t("dueDate")}><Input type="date" value={bill.dueDate} onChange={(event) => setBill({ ...bill, dueDate: event.target.value })} /></Field>
            <Field label={t("description")}><Input value={bill.description} onChange={(event) => setBill({ ...bill, description: event.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
      {mode === "pay" ? (
        <Modal title={t("payBill")} onClose={() => setMode("")}>
          <form onSubmit={submitPay} className="space-y-3">
            <Field label={t("amount")}><Input type="number" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} required /></Field>
            <Field label={t("method")}><Select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>{METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blankSupplier(hotelId, hotels) {
  return { hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "", name: "", category: "Food supplier", phone: "", email: "", address: "", notes: "" };
}
function blankBill(hotelId) {
  return { hotelId, supplierId: "", date: todayISO(), dueDate: todayISO(), description: "", accountCode: "5200", amount: "" };
}
