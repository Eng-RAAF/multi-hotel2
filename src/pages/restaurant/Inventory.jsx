import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { errorMessage } from "../../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../../components/ui";

export default function InventoryPage() {
  const { t, token, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const items = useQuery(api.restaurant.listInventory, token && active ? { token, hotelId: active } : "skip");
  const save = useMutation(api.restaurant.saveStockItem);
  const move = useMutation(api.restaurant.moveStock);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank());
  const [adjust, setAdjust] = useState(null);
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!items) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({ token, hotelId: active, itemId: form.itemId, name: form.name, unit: form.unit, quantity: Number(form.quantity), reorderLevel: Number(form.reorderLevel) });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function apply(event) {
    event.preventDefault();
    setError("");
    try {
      await move({ token, itemId: adjust.itemId, type: adjust.type, quantity: Number(adjust.quantity), notes: adjust.notes });
      setAdjust(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("inventory")} action={<Button onClick={() => { setForm(blank()); setOpen(true); }}>{t("create")}</Button>} />
      <ErrorText>{error}</ErrorText>
      <Panel>
        {items.map((item) => (
          <div key={item._id} className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0">
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-muted">{item.quantity} {item.unit} · reorder {item.reorderLevel}</div>
            </div>
            <div className="flex items-center gap-2">
              {item.low ? <Badge value="partial" /> : <Badge value="active" />}
              <Button variant="secondary" onClick={() => setAdjust({ itemId: item._id, type: "received", quantity: "", notes: "" })}>Stock</Button>
            </div>
          </div>
        ))}
      </Panel>
      {open ? (
        <Modal title={t("inventory")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("name")}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Unit"><Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></Field>
            <Field label={t("quantity")}><Input type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
            <Field label="Reorder level"><Input type="number" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} /></Field>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
      {adjust ? (
        <Modal title="Stock" onClose={() => setAdjust(null)}>
          <form onSubmit={apply} className="space-y-3">
            <Field label={t("type")}>
              <Select value={adjust.type} onChange={(event) => setAdjust({ ...adjust, type: event.target.value })}>
                <option value="received">Received</option>
                <option value="used">Used</option>
                <option value="wasted">Damaged / wasted</option>
              </Select>
            </Field>
            <Field label={t("quantity")}><Input type="number" value={adjust.quantity} onChange={(event) => setAdjust({ ...adjust, quantity: event.target.value })} required /></Field>
            <Field label={t("notes")}><Input value={adjust.notes} onChange={(event) => setAdjust({ ...adjust, notes: event.target.value })} /></Field>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank() {
  return { name: "", unit: "kg", quantity: "0", reorderLevel: "0" };
}
