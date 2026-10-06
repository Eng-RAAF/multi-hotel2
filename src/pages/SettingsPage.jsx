import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Button, ErrorText, Field, Input, Loading, PageHeader, Panel } from "../components/ui";

export default function SettingsPage() {
  const { t, token } = useApp();
  const settings = useQuery(api.settings.get, token ? { token } : "skip");
  const update = useMutation(api.settings.update);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);
  if (!form) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      await update({ token, ...form, taxRate: Number(form.taxRate), serviceCharge: Number(form.serviceCharge) });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("settings")} subtitle="USD by default. Mobile money, bank, card, and cash are recorded in payments." />
      <Panel className="max-w-xl p-5">
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("companyName")}><Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></Field>
          <Field label={t("currency")}><Input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></Field>
          <Field label={t("taxRate")}><Input type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></Field>
          <Field label={t("serviceRate")}><Input type="number" value={form.serviceCharge} onChange={(event) => setForm({ ...form, serviceCharge: event.target.value })} /></Field>
          <ErrorText>{error}</ErrorText>
          {saved ? <p className="text-sm text-brand-dark">Saved</p> : null}
          <Button type="submit">{t("save")}</Button>
        </form>
      </Panel>
    </div>
  );
}
