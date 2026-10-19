import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import hotelBackground from "../assets/hotel-night.jpg";

export default function Login() {
  const { t, lang, setLang, signIn } = useApp();
  const login = useAction(api.authNode.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await login({ email, password });
      await signIn(result.token);
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing" style={{ backgroundImage: `url(${hotelBackground})` }}>
      <button type="button" onClick={() => setLang(lang === "en" ? "so" : "en")} className="landing-lang">
        {lang === "en" ? "SO" : "EN"}
      </button>

      <div className="landing-card">
        <span className="landing-orb landing-orb-top" aria-hidden="true" />
        <span className="landing-orb landing-orb-bottom" aria-hidden="true" />
        <form onSubmit={submit} className="landing-panel">
          <h1 className="landing-title">HOTEL MANAGEMENT SYSTEM</h1>
          <input
            type="text"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("username")}
            aria-label={t("username")}
            autoComplete="username"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("password")}
            aria-label={t("password")}
            autoComplete="current-password"
            required
          />
          <button type="submit" className="landing-submit" disabled={busy}>{busy ? t("working") : t("login")}</button>
          {notice && <p className={`landing-notice ${notice.kind === "error" ? "is-error" : ""}`}>{notice.text}</p>}
          <p className="landing-links">
            <button type="button" onClick={() => setNotice({ kind: "info", text: t("forgotHint") })}>{t("forgotPassword")}</button>
            <span>{t("or")}</span>
            <button type="button" onClick={() => setNotice({ kind: "info", text: t("signupHint") })}>{t("createAccount")}</button>
          </p>
        </form>
      </div>
    </div>
  );
}
