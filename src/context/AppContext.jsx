import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { money as formatMoney } from "../lib/format";
import { translate } from "../lib/i18n";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("mhmas_token") || "");
  const [lang, setLangState] = useState(() => localStorage.getItem("mhmas_lang") || "en");
  const [hotelId, setHotelId] = useState("all");
  const me = useQuery(api.auth.me, token ? { token } : "skip");
  const hotels = useQuery(api.hotels.options, token ? { token } : "skip");
  const settings = useQuery(api.settings.get, token ? { token } : "skip");
  const logout = useMutation(api.auth.logout);

  useEffect(() => {
    if (token && me === null) {
      localStorage.removeItem("mhmas_token");
      setToken("");
    }
  }, [token, me]);

  useEffect(() => {
    if (!me) return;
    if (me.hotelId) setHotelId(me.hotelId);
  }, [me]);

  const value = useMemo(() => {
    const canSwitch = Boolean(me && !me.hotelId && ["super_admin", "accountant", "hr_admin"].includes(me.role));
    const currency = settings?.currency || "USD";
    return {
      token,
      user: me || null,
      ready: !token || me !== undefined,
      hotels: hotels || [],
      hotelId: me?.hotelId || hotelId,
      setHotelId,
      canSwitch,
      lang,
      setLang: (next) => {
        localStorage.setItem("mhmas_lang", next);
        setLangState(next);
      },
      t: (key) => translate(lang, key),
      currency,
      companyName: settings?.companyName || "Somali Hotels Group",
      money: (amount) => formatMoney(amount, currency),
      async signIn(nextToken) {
        localStorage.setItem("mhmas_token", nextToken);
        setToken(nextToken);
      },
      async signOut() {
        if (token) {
          try {
            await logout({ token });
          } catch {
            /* session may already be gone */
          }
        }
        localStorage.removeItem("mhmas_token");
        setToken("");
        setHotelId("all");
      },
    };
  }, [token, me, hotels, hotelId, lang, settings, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

export function useScope() {
  const app = useApp();
  const args = { token: app.token };
  if (app.hotelId && app.hotelId !== "all") args.hotelId = app.hotelId;
  return { ...app, args };
}
