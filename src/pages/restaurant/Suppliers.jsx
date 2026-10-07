import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { errorMessage, todayISO } from "../../lib/format";
import { Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../../components/ui";

export default function RestaurantSuppliers() {
  const { t, token, money, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const args = token && active ? { token, hotelId: active } : "skip";
  const suppliers = useQuery(api.restaurant.listSuppliers, args);
  const purchases = useQuery(api.restaurant.listPurchases, args);
  const stock = useQuery(api.restaurant.listInventory, args);
  const saveSupplier = useMutation(api.restaurant.saveSupplier);
  const savePurchase = useMutation(api.restaurant.savePurchase);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");
  const [supplier, setSupplier] = useState({ name: "", phone: "", address: "", products: "" });
  const [purchase, setPurchase] = useState({ supplierId: "", itemId: "", date: todayISO(), description: "", quantity: "", amount: "" });
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!suppliers || !purchases) return <Loading label={t("loading")} />;

  async function submitSupplier(event) {
    event.preventDefault();
    setError("");
    try {
      await saveSupplier({ token, hotelId: active, ...supplier });
      setMode("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitPurchase(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = { token, hotelId: active, supplierId: purchase.supplierId, date: purchase.date, description: purchase.description, quantity: Number(purchase.quantity || 0), amount: Number(purchase.amount) };
      if (purchase.itemId) payload.itemId = purchase.itemId;
      await savePurchase(payload);
      setMode("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("restaurantSuppliers")} action={<div className="flex gap-2"><Button variant="secondary" onClick={() => setMode("supplier")}>{t("create")}</Button><Button onClick={() => setMode("purchase")}>{t("purchases")}</Button></div>} />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("restaurantSuppliers")}</h2>
          {suppliers.map((row) => (
            <div key={row._id} className="border-t border-slate-100 px-4 py-3 text-sm">
              <div className="font-medium">{row.name}</div>
              <div className="text-xs text-muted">{row.phone} · {row.products}</div>
            </div>
          ))}
        </Panel>
        <Panel>
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{t("purchases")}</h2>
          {purchases.map((row) => (
            <div key={row._id} className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{row.supplierName}</div>
                <div className="text-xs text-muted">{row.date} · {row.description}</div>
              </div>
              <div className="font-semibold">{money(row.amount)}</div>
            </div>
          ))}
        </Panel>
      </div>
      {mode === "supplier" ? (
        <Modal title={t("restaurantSuppliers")} onClose={() => setMode("")}>
          <form onSubmit={submitSupplier} className="space-y-3">
            <Field label={t("name")}><Input value={supplier.name} onChange={(event) => setSupplier({ ...supplier, name: event.target.value })} required /></Field>
            <Field label={t("phone")}><Input value={supplier.phone} onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })} /></Field>
            <Field label={t("address")}><Input value={supplier.address} onChange={(event) => setSupplier({ ...supplier, address: event.target.value })} /></Field>
            <Field label="Products"><Input value={supplier.products} onChange={(event) => setSupplier({ ...supplier, products: event.target.value })} /></Field>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
      {mode === "purchase" ? (
        <Modal title={t("purchases")} onClose={() => setMode("")}>
          <form onSubmit={submitPurchase} className="space-y-3">
            <Field label={t("restaurantSuppliers")}>
              <Select value={purchase.supplierId} onChange={(event) => setPurchase({ ...purchase, supplierId: event.target.value })} required>
                <option value="">Select</option>
                {suppliers.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
              </Select>
            </Field>
            <Field label={t("inventory")}>
              <Select value={purchase.itemId} onChange={(event) => setPurchase({ ...purchase, itemId: event.target.value })}>
                <option value="">None</option>
                {(stock || []).map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
              </Select>
            </Field>
            <Field label={t("date")}><Input type="date" value={purchase.date} onChange={(event) => setPurchase({ ...purchase, date: event.target.value })} /></Field>
            <Field label={t("description")}><Input value={purchase.description} onChange={(event) => setPurchase({ ...purchase, description: event.target.value })} /></Field>
            <Field label={t("quantity")}><Input type="number" value={purchase.quantity} onChange={(event) => setPurchase({ ...purchase, quantity: event.target.value })} /></Field>
            <Field label={t("amount")}><Input type="number" step="0.01" value={purchase.amount} onChange={(event) => setPurchase({ ...purchase, amount: event.target.value })} required /></Field>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
