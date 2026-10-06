import { useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { formatWhen } from "../lib/format";
import { Empty, Loading, PageHeader, Panel, Table } from "../components/ui";

export default function Audit() {
  const { t, token, hotelId } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.audit.list, token ? args : "skip");
  if (!rows) return <Loading label={t("loading")} />;

  return (
    <div>
      <PageHeader title={t("auditLogs")} />
      <Panel>
        {rows.length ? (
          <Table rowKey={(row) => row._id} rows={rows} columns={[
            { key: "when", header: t("date"), cell: (row) => formatWhen(row.createdAt) },
            { key: "user", header: t("user"), cell: (row) => row.userName },
            { key: "action", header: t("actions"), cell: (row) => row.action },
            { key: "entity", header: t("type"), cell: (row) => row.entity },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName || "—" },
            { key: "details", header: t("description"), cell: (row) => row.details },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
    </div>
  );
}
