import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { Empty, Loading, PageHeader, Panel, Stat, Table } from "../components/ui";

export default function Receivables() {
  const { t, token, money, hotelId } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const data = useQuery(api.billing.receivables, token ? args : "skip");
  if (!data) return <Loading label={t("loading")} />;

  return (
    <div>
      <PageHeader title={t("receivables")} subtitle={`${t("total")} ${money(data.total)}`} />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="0–30" value={money(data.buckets.current)} />
        <Stat label="31–60" value={money(data.buckets.d30)} />
        <Stat label="61–90" value={money(data.buckets.d60)} />
        <Stat label="90+" value={money(data.buckets.older)} />
      </div>
      <Panel>
        {data.rows.length ? (
          <Table rowKey={(row) => row._id} rows={data.rows} columns={[
            { key: "number", header: "#", cell: (row) => <Link className="font-semibold text-brand-dark" to={`/invoices/${row._id}`}>{row.number}</Link> },
            { key: "party", header: t("customer"), cell: (row) => row.party },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
            { key: "date", header: t("date"), cell: (row) => row.date },
            { key: "age", header: t("aging"), cell: (row) => `${row.age}d` },
            { key: "balance", header: t("balance"), cell: (row) => money(row.balance) },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
    </div>
  );
}
