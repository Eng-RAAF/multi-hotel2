import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { errorMessage } from "../../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../../components/ui";

const NEXT_LABEL = { pending: "Send to kitchen", preparing: "Preparing", ready: "Mark served", served: "Complete" };

export default function OrdersPage() {
  const { t, token, money, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const args = token && active ? { token, hotelId: active } : "skip";
  const orders = useQuery(api.restaurant.listOrders, args);
  const menu = useQuery(api.restaurant.listMenu, args);
  const tables = useQuery(api.restaurant.listTables, args);
  const stays = useQuery(api.restaurant.inHouse, token && active ? { token, hotelId: active } : "skip");
  const create = useMutation(api.restaurant.createOrder);
  const bootstrap = useMutation(api.restaurant.bootstrap);
  const setStatus = useMutation(api.restaurant.setOrderStatus);
  const seeded = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank());
  useEffect(() => {
    if (!token || !active || !menu || menu.categories.length || seeded.current) return;
    seeded.current = true;
    bootstrap({ token, hotelId: active }).catch((err) => setError(errorMessage(err)));
  }, [token, active, menu, bootstrap]);
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!orders || !menu) return <Loading label={t("loading")} />;

  function addDish(itemId) {
    const existing = form.items.find((line) => line.menuItemId === itemId);
    const items = existing
      ? form.items.map((line) => line.menuItemId === itemId ? { ...line, quantity: line.quantity + 1 } : line)
      : [...form.items, { menuItemId: itemId, quantity: 1, notes: "" }];
    setForm({ ...form, items });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = { token, hotelId: active, type: form.type, notes: form.notes, items: form.items };
      if (form.type === "dine_in") payload.tableId = form.tableId;
      if (form.type === "room") payload.reservationId = form.reservationId;
      await create(payload);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("orders")} action={<Button onClick={() => { setForm(blank()); setError(""); setOpen(true); }}>{t("create")}</Button>} />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-3">
        {orders.map((order) => {
          const next = order.status === "pending" ? "preparing" : order.status === "ready" ? "served" : order.status === "served" ? "completed" : "";
          return (
            <Panel key={order._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{order.number} · {order.type.replace("_", " ")}</div>
                  <div className="text-sm text-muted">
                    {order.tableNumber ? `Table ${order.tableNumber}` : ""}
                    {order.roomNumber ? `Room ${order.roomNumber} · ${order.guestName}` : ""}
                    {order.type === "takeaway" ? "Takeaway" : ""}
                  </div>
                </div>
                <Badge value={order.status} />
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {order.items.map((item) => (
                  <div key={item._id} className="flex justify-between">
                    <span>{item.quantity} × {item.name}</span>
                    <span>{money(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold"><span>{t("total")}</span><span>{money(order.subtotal)}</span></div>
              </div>
              {order.notes ? <p className="mt-2 text-xs text-muted">{order.notes}</p> : null}
              <div className="mt-3 flex gap-2">
                {next ? <Button onClick={() => setStatus({ token, orderId: order._id, status: next }).catch((err) => setError(errorMessage(err)))}>{NEXT_LABEL[order.status] || t("save")}</Button> : null}
                {["pending", "preparing"].includes(order.status) ? <Button variant="secondary" onClick={() => setStatus({ token, orderId: order._id, status: "cancelled" }).catch((err) => setError(errorMessage(err)))}>{t("cancel")}</Button> : null}
              </div>
            </Panel>
          );
        })}
      </div>
      {open ? (
        <Modal title={t("orders")} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("type")}>
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="dine_in">Dine-in</option>
                <option value="takeaway">Takeaway</option>
                <option value="room">Hotel room</option>
              </Select>
            </Field>
            {form.type === "dine_in" ? (
              <Field label={t("tables")}>
                <Select value={form.tableId} onChange={(event) => setForm({ ...form, tableId: event.target.value })} required>
                  <option value="">Select</option>
                  {(tables || []).filter((table) => table.status !== "occupied").map((table) => <option key={table._id} value={table._id}>{table.number} · {table.status}</option>)}
                </Select>
              </Field>
            ) : null}
            {form.type === "room" ? (
              <Field label={t("room")}>
                <Select value={form.reservationId} onChange={(event) => setForm({ ...form, reservationId: event.target.value })} required>
                  <option value="">Select</option>
                  {(stays || []).map((stay) => <option key={stay._id} value={stay._id}>Room {stay.roomNumber} · {stay.guestName}</option>)}
                </Select>
              </Field>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {menu.items.filter((item) => item.available).map((item) => (
                <button key={item._id} type="button" onClick={() => addDish(item._id)} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted">{money(item.price)}</div>
                </button>
              ))}
            </div>
            {form.items.map((line) => {
              const item = menu.items.find((dish) => dish._id === line.menuItemId);
              return <div key={line.menuItemId} className="text-sm">{line.quantity} × {item?.name} · {money((item?.price || 0) * line.quantity)}</div>;
            })}
            <Field label={t("notes")}><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank() {
  return { type: "dine_in", tableId: "", reservationId: "", notes: "", items: [] };
}
