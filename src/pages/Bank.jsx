import { useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { Empty, Loading, PageHeader, Panel, Stat, Table } from "../components/ui";

export default function Bank() {
  const { t, token, money, hotelId } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const data = useQuery(api.accounting.cashbook, token ? args : "skip");
  if (!data) return <Loading label={t("loading")} />;

  return (
    <div>
      <PageHeader title={t("bankCash")} subtitle={t("cashAccounts")} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        {data.balances.map((account) => <Stat key={account._id} label={`${account.code} · ${account.name}`} value={money(account.balance)} />)}
      </div>
      <Panel>
        {data.transactions.length ? (
          <Table rowKey={(row) => row._id} rows={data.transactions.slice(0, 80)} columns={[
            { key: "date", header: t("date"), cell: (row) => row.date },
            { key: "account", header: t("account"), cell: (row) => row.accountCode },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
            { key: "description", header: t("description"), cell: (row) => row.description },
            { key: "debit", header: t("debit"), cell: (row) => row.debit ? money(row.debit) : "" },
            { key: "credit", header: t("credit"), cell: (row) => row.credit ? money(row.credit) : "" },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
    </div>
  );
}
