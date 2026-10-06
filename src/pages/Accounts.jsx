import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../components/ui";

const types = ["asset", "liability", "equity", "income", "expense"];

export default function Accounts() {
  const { t, token } = useApp();
  const rows = useQuery(api.accounting.listAccounts, token ? { token } : "skip");
  const save = useMutation(api.accounting.saveAccount);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", name: "", type: "expense", description: "" });
  if (!rows) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({ token, ...form });
      setOpen(false);
      setForm({ code: "", name: "", type: "expense", description: "" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("chartOfAccounts")} action={<Button onClick={() => setOpen(true)}>{t("addAccount")}</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {types.map((type) => (
          <Panel key={type}>
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold capitalize">{type}</h2>
            {rows.filter((row) => row.type === type).length ? rows.filter((row) => row.type === type).map((row) => (
              <div key={row._id} className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm">
                <span><span className="font-semibold">{row.code}</span> · {row.name}</span>
              </div>
            )) : <Empty title={t("noResults")} />}
          </Panel>
        ))}
      </div>
      {open ? (
        <Modal title={t("addAccount")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("code")}><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></Field>
            <Field label={t("name")}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label={t("type")}>
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {types.map((type) => <option key={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label={t("description")}><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
