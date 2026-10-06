import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { monthStart, todayISO } from "../lib/format";
import { Empty, Field, Input, Loading, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Ledger() {
  const { t, token, money, hotelId } = useScope();
  const accounts = useQuery(api.accounting.listAccounts, token ? { token } : "skip");
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const args = { token, from, to };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  if (accountId) args.accountId = accountId;
  const ledger = useQuery(api.accounting.ledger, token ? args : "skip");
  if (!accounts || !ledger) return <Loading label={t("loading")} />;

  return (
    <div>
      <PageHeader title={t("generalLedger")} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label={t("account")}>
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">{t("allHotels")}</option>
            {accounts.map((account) => <option key={account._id} value={account._id}>{account.code} · {account.name}</option>)}
          </Select>
        </Field>
        <Field label={t("from")}><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label={t("to")}><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>
      <Panel>
        {ledger.rows.length ? (
          <Table rowKey={(row) => row._id} rows={ledger.rows} columns={[
            { key: "date", header: t("date"), cell: (row) => row.date },
            { key: "account", header: t("account"), cell: (row) => `${row.accountCode} ${row.accountName}` },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
            { key: "description", header: t("description"), cell: (row) => row.description },
            { key: "debit", header: t("debit"), cell: (row) => row.debit ? money(row.debit) : "" },
            { key: "credit", header: t("credit"), cell: (row) => row.credit ? money(row.credit) : "" },
            { key: "running", header: t("runningBalance"), cell: (row) => row.running === null || row.running === undefined ? "" : money(row.running) },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
    </div>
  );
}
