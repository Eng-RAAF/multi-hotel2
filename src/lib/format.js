export function todayISO() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthStart(iso = todayISO()) {
  return `${iso.slice(0, 7)}-01`;
}

export function formatDate(iso) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(month) - 1]} ${Number(day)}, ${year}`;
}

export function formatWhen(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
}

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ay, am, ad] = checkIn.split("-").map(Number);
  const [by, bm, bd] = checkOut.split("-").map(Number);
  const ms = new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad);
  return Math.max(0, Math.round(ms / 86400000));
}

export function money(amount, currency = "USD") {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function errorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error.data === "string") return error.data;
  const message = error.message || "Something went wrong";
  return message
    .replace(/^Uncaught ConvexError:\s*/i, "")
    .replace(/^Uncaught Error:\s*/i, "")
    .replace(/^\[Request ID:[^\]]+\]\s*/i, "");
}
