import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { errorMessage } from "../../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select } from "../../components/ui";

export default function MenuPage() {
  const { t, token, money, hotelId, hotels, canSwitch } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const menu = useQuery(api.restaurant.listMenu, token && active ? { token, hotelId: active } : "skip");
  const bootstrap = useMutation(api.restaurant.bootstrap);
  const saveCategory = useMutation(api.restaurant.saveCategory);
  const removeCategory = useMutation(api.restaurant.removeCategory);
  const saveItem = useMutation(api.restaurant.saveItem);
  const removeItem = useMutation(api.restaurant.removeItem);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const seeded = useRef(false);

  useEffect(() => {
    if (!token || !active || !menu || menu.categories.length || seeded.current) return;
    seeded.current = true;
    bootstrap({ token, hotelId: active }).catch((err) => setError(errorMessage(err)));
  }, [token, active, menu, bootstrap]);

  if (!active) return <Empty title={t("selectHotel")} />;
  if (!menu) return <Loading label={t("loading")} />;

  async function addCategory(event) {
    event.preventDefault();
    setError("");
    try {
      await saveCategory({ token, hotelId: active, name: category });
      setCategory("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      await saveItem({
        token,
        hotelId: active,
        itemId: form.itemId,
        categoryId: form.categoryId,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        available: form.available === "true",
        imageUrl: form.imageUrl,
      });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("menu")} action={<Button onClick={() => { setForm({ ...blank(), categoryId: menu.categories[0]?._id || "" }); setOpen(true); }}>{t("create")}</Button>} />
      <ErrorText>{error}</ErrorText>
      {canSwitch ? <p className="mb-3 text-sm text-muted">{hotels.find((hotel) => hotel._id === active)?.name}</p> : null}
      <form onSubmit={addCategory} className="mb-4 flex gap-2">
        <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder={t("category")} />
        <Button type="submit">{t("create")}</Button>
      </form>
      {menu.categories.map((group) => (
        <Panel key={group._id} className="mb-4">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">{group.name}</h2>
            <Button variant="ghost" onClick={() => removeCategory({ token, categoryId: group._id }).catch((err) => setError(errorMessage(err)))}>{t("cancel")}</Button>
          </div>
          {menu.items.filter((item) => item.categoryId === group._id).map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted">{item.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{money(item.price)}</span>
                <Badge value={item.available ? "active" : "inactive"} />
                <Button variant="secondary" onClick={() => { setForm({ ...item, itemId: item._id, price: String(item.price), available: item.available ? "true" : "false" }); setOpen(true); }}>{t("edit")}</Button>
                <Button variant="ghost" onClick={() => removeItem({ token, itemId: item._id }).catch((err) => setError(errorMessage(err)))}>{t("cancel")}</Button>
              </div>
            </div>
          ))}
        </Panel>
      ))}
      {open ? (
        <Modal title={t("menu")} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-3">
            <Field label={t("category")}>
              <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
                {menu.categories.map((group) => <option key={group._id} value={group._id}>{group.name}</option>)}
              </Select>
            </Field>
            <Field label={t("name")}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label={t("description")}><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <Field label={t("price")}><Input type="number" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></Field>
            <Field label={t("image")}><Input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://" /></Field>
            <Field label={t("status")}>
              <Select value={form.available} onChange={(event) => setForm({ ...form, available: event.target.value })}>
                <option value="true">{t("active")}</option>
                <option value="false">inactive</option>
              </Select>
            </Field>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank() {
  return { name: "", description: "", price: "", available: "true", imageUrl: "", categoryId: "" };
}
