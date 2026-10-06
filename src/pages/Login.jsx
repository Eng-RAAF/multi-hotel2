import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Button, ErrorText, Input } from "../components/ui";

export default function Login() {
  const { t, lang, setLang, signIn } = useApp();
  const login = useAction(api.authNode.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login({ email, password });
      await signIn(result.token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand px-12 py-10 text-white lg:flex">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">MHMAS</div>
          <h1 className="mt-6 max-w-md text-4xl font-extrabold leading-tight">Multi-Hotel Management and Accounting for Somalia</h1>
          <p className="mt-4 max-w-md text-white/85">One system for hotels, rooms, reservations, guests, invoices, and double-entry books.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {["Mogadishu", "Garowe", "Bosaso", "Hargeisa", "Kismayo", "USD · Mobile money"].map((item) => (
            <div key={item} className="rounded-xl bg-white/10 px-4 py-3">{item}</div>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-brand">MHMAS</div>
              <h2 className="text-2xl font-bold">{t("welcome")}</h2>
              <p className="text-sm text-muted">{t("loginHint")}</p>
            </div>
            <button onClick={() => setLang(lang === "en" ? "so" : "en")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
              {lang === "en" ? "SO" : "EN"}
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block space-y-1.5 text-sm font-medium">
              {t("email")}
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              {t("password")}
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? t("working") : t("signIn")}</Button>
          </form>
        </div>
      </section>
    </div>
  );
}
