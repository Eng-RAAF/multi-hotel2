export function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return formatISO(new Date());
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatISO(date);
}

export function nightsBetween(checkIn, checkOut) {
  const [ay, am, ad] = checkIn.split("-").map(Number);
  const [by, bm, bd] = checkOut.split("-").map(Number);
  const ms = new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad);
  return Math.max(1, Math.round(ms / 86400000));
}

export function monthStart(iso = todayISO()) {
  return `${iso.slice(0, 7)}-01`;
}

export function shiftMonth(iso, delta) {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return formatISO(date);
}

export function lastMonthKeys(count) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function daysBetween(from, to) {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const ms = new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}
