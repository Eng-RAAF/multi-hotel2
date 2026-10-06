import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { EXPENSE_ACCOUNTS, METHODS } from "../lib/catalogs";
import { errorMessage, todayISO } from "../lib/format";
import { Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Expenses() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.accounting.listExpenses, token ? args : "skip");
  const record = useMutation(api.accounting.recordExpense);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank(hotelId, hotels));
  if (!rows) return <Loading label={t("loading")} />;
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError("");
    const account = EXPENSE_ACCOUNTS.find((item) => item.code === form.accountCode);
    try {
      await record({
        token,
        hotelId: form.hotelId,
        date: form.date,
        category: account?.label || "Expense",
        accountCode: form.accountCode,
        amount: Number(form.amount),
        method: form.method,
        description: form.description || account?.label || "Expense",
      });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("expenses")} action={<Button onClick={() => { setForm(blank(hotelId, hotels)); setOpen(true); }}>{t("create")}</Button>} />
      <Panel>
        {rows.length ? (
          <Table rowKey={(row) => row._id} rows={rows} columns={[
            { key: "date", header: t("date"), cell: (row) => row.date },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
            { key: "category", header: t("category"), cell: (row) => row.category },
            { key: "description", header: t("description"), cell: (row) => row.description },
            { key: "method", header: t("method"), cell: (row) => row.method.replaceAll("_", " ") },
            { key: "amount", header: t("amount"), cell: (row) => money(row.amount) },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("expenses")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("hotel")}><Select value={form.hotelId} onChange={set("hotelId")}>{hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}</Select></Field>
            <Field label={t("category")}><Select value={form.accountCode} onChange={set("accountCode")}>{EXPENSE_ACCOUNTS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</Select></Field>
            <Field label={t("amount")}><Input type="number" value={form.amount} onChange={set("amount")} required /></Field>
            <Field label={t("date")}><Input type="date" value={form.date} onChange={set("date")} /></Field>
            <Field label={t("method")}><Select value={form.method} onChange={set("method")}>{METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></Field>
            <Field label={t("description")}><Input value={form.description} onChange={set("description")} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank(hotelId, hotels) {
  return { hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "", accountCode: "5100", amount: "", date: todayISO(), method: "cash", description: "" };
}
