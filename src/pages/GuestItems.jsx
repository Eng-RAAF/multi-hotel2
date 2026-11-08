import { useEffect, useMemo, useState } from "react";
import { Camera, ImageUp } from "lucide-react";
import { useMutation, useQuery } from "../lib/offline";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage, formatWhen } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, SearchBox, Select, Stat, Table, Textarea, filterRows } from "../components/ui";

const CATEGORIES = ["luggage", "valuables", "documents", "electronics", "clothing", "other"];
const blank = { itemId: "", guestId: "", description: "", category: "luggage", categoryLabel: "", quantity: "1", location: "", notes: "", photoUrl: null };

// Phone photos are several MB; shrink to a reference-sized JPEG before uploading.
async function shrinkImage(file, maxSide = 1280) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return blob || file;
  } catch {
    return file;
  }
}

function PhotoPicker({ t, preview, onPick, onRemove }) {
  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="" className="h-40 w-auto max-w-full rounded-lg border border-slate-200 object-cover" />
          <button type="button" onClick={onRemove} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-sm font-bold shadow" aria-label={t("removePhoto")}>×</button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold hover:bg-slate-50">
          <Camera size={16} /> {t("takePhoto")}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold hover:bg-slate-50">
          <ImageUp size={16} /> {t("choosePhoto")}
          <input type="file" accept="image/*" className="hidden" onChange={onPick} />
        </label>
      </div>
    </div>
  );
}

export default function GuestItems() {
  const { t, token, args } = useScope();
  const rows = useQuery(api.guestItems.list, token ? args : "skip");
  const guests = useQuery(api.guestItems.guestOptions, token ? args : "skip");
  const store = useMutation(api.guestItems.store);
  const giveBack = useMutation(api.guestItems.giveBack);
  // Uploading needs a live connection, so this one is never queued offline.
  const photoUploadUrl = useMutation(api.guestItems.photoUploadUrl, { offline: false });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);

  useEffect(() => () => { if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("stored");
  const [form, setForm] = useState(null);
  const [returning, setReturning] = useState(null);
  const [returnedTo, setReturnedTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const byStatus = (rows || []).filter((row) => show === "all" || row.status === show);
    return filterRows(byStatus, query, ["tagNumber", "guestName", "guestPhone", "roomNumber", "description", "categoryLabel", "location", "hotelName"]);
  }, [rows, query, show]);

  if (!rows || !guests) return <Loading label={t("loading")} />;
  const stored = rows.filter((row) => row.status === "stored");
  const left = stored.filter((row) => row.guestLeft);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  function openForm(values) {
    setError("");
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoPreview(values.photoUrl || null);
    setForm(values);
  }

  function openNew() {
    openForm({ ...blank, guestId: guests.find((g) => g.inHouse)?._id || guests[0]?._id || "" });
  }

  function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(t("photoMustBeImage"));
    setPhotoFile(file);
    setRemovePhoto(false);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function dropPhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(Boolean(form.photoUrl));
  }

  async function uploadPhoto() {
    const blob = await shrinkImage(photoFile);
    const url = await photoUploadUrl({ token });
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type || "image/jpeg" }, body: blob });
    if (!response.ok) throw new Error(t("photoUploadFailed"));
    const { storageId } = await response.json();
    return storageId;
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { token, guestId: form.guestId, description: form.description, category: form.category, categoryLabel: form.category === "other" ? form.categoryLabel : "", quantity: Number(form.quantity), location: form.location, notes: form.notes };
      if (form.itemId) payload.itemId = form.itemId;
      if (photoFile) payload.photoId = await uploadPhoto();
      else if (removePhoto) payload.removePhoto = true;
      await store(payload);
      setForm(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReturn(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await giveBack({ token, itemId: returning._id, returnedTo });
      setReturning(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("guestItems")} subtitle={t("guestItemsHint")} action={<Button onClick={openNew} disabled={!guests.length}>{t("storeItem")}</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label={t("itemsInStorage")} value={stored.reduce((sum, row) => sum + row.quantity, 0)} hint={`${stored.length} ${t("tags")}`} />
        <Stat label={t("guestsWithItems")} value={new Set(stored.map((row) => row.guestId)).size} />
        <Stat label={t("guestLeftItems")} value={left.length} className={left.length ? "ring-1 ring-amber-300" : ""} />
      </div>
      <Panel>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="flex-1"><SearchBox value={query} onChange={setQuery} placeholder={t("search")} /></div>
          <div className="sm:w-44">
            <Select value={show} onChange={(event) => setShow(event.target.value)}>
              <option value="stored">{t("inStorage")}</option>
              <option value="returned">{t("returnedItems")}</option>
              <option value="all">{t("all")}</option>
            </Select>
          </div>
        </div>
        {visible.length ? (
          <Table
            rowKey={(row) => row._id}
            rows={visible}
            columns={[
              { key: "tag", header: t("tag"), cell: (row) => <span className="font-mono font-semibold">{row.tagNumber}</span> },
              {
                key: "guest",
                header: t("guest"),
                cell: (row) => (
                  <div>
                    <div className="font-medium">{row.guestName}</div>
                    <div className="text-xs text-muted">
                      {row.roomNumber ? `${t("room")} ${row.roomNumber}` : ""}{row.hotelName ? ` · ${row.hotelName}` : ""}
                    </div>
                    {row.guestLeft ? <div className="text-xs font-semibold text-amber-700">{t("guestCheckedOut")}</div> : null}
                  </div>
                ),
              },
              {
                key: "photo",
                header: t("photo"),
                cell: (row) => row.photoUrl ? (
                  <button type="button" onClick={() => setViewPhoto(row)} aria-label={t("viewPhoto")}>
                    <img src={row.photoUrl} alt="" loading="lazy" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                  </button>
                ) : <span className="text-xs text-muted">—</span>,
              },
              { key: "item", header: t("item"), cell: (row) => <div><div>{row.quantity} × {row.description}</div><div className="text-xs capitalize text-muted">{row.category === "other" && row.categoryLabel ? row.categoryLabel : t(row.category)}{row.notes ? ` · ${row.notes}` : ""}</div></div> },
              { key: "location", header: t("location"), cell: (row) => row.location || "—" },
              {
                key: "when",
                header: t("date"),
                cell: (row) => (
                  <div className="text-xs">
                    <div>{t("stored")}: {formatWhen(row.storedAt)} · {row.storedByName}</div>
                    {row.returnedAt ? <div className="text-muted">{t("returned")}: {formatWhen(row.returnedAt)} → {row.returnedTo}</div> : null}
                  </div>
                ),
              },
              { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
              {
                key: "actions",
                header: "",
                cell: (row) => row.status === "stored" ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => openForm({ itemId: row._id, guestId: row.guestId, description: row.description, category: row.category, categoryLabel: row.categoryLabel || "", quantity: String(row.quantity), location: row.location, notes: row.notes, photoUrl: row.photoUrl })}>{t("edit")}</Button>
                    <Button variant="secondary" onClick={() => { setError(""); setReturnedTo(row.guestName); setReturning(row); }}>{t("giveBack")}</Button>
                  </div>
                ) : null,
              },
            ]}
          />
        ) : <Empty title={t("noResults")} />}
      </Panel>

      {form ? (
        <Modal title={form.itemId ? t("edit") : t("storeItem")} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("guest")}>
                <Select value={form.guestId} onChange={set("guestId")} required disabled={Boolean(form.itemId)}>
                  {guests.map((guest) => (
                    <option key={guest._id} value={guest._id}>
                      {guest.fullName}{guest.inHouse ? ` — ${t("room")} ${guest.roomNumber}` : ` (${t("notInHouse")})`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="sm:col-span-2"><Field label={t("item")}><Input value={form.description} onChange={set("description")} placeholder={t("itemPlaceholder")} required /></Field></div>
            <Field label={t("category")}>
              <Select value={form.category} onChange={set("category")}>
                {CATEGORIES.map((key) => <option key={key} value={key}>{t(key)}</option>)}
              </Select>
            </Field>
            <Field label={t("quantity")}><Input type="number" min="1" step="1" value={form.quantity} onChange={set("quantity")} required /></Field>
            {form.category === "other" ? (
              <div className="sm:col-span-2">
                <Field label={t("otherType")}>
                  <Input value={form.categoryLabel} onChange={set("categoryLabel")} placeholder={t("otherTypePlaceholder")} required autoFocus />
                </Field>
              </div>
            ) : null}
            <div className="sm:col-span-2"><Field label={t("location")}><Input value={form.location} onChange={set("location")} placeholder={t("locationPlaceholder")} /></Field></div>
            <div className="sm:col-span-2">
              <Field label={t("photo")}>
                <PhotoPicker t={t} preview={photoPreview} onPick={pickPhoto} onRemove={dropPhoto} />
              </Field>
            </div>
            <div className="sm:col-span-2"><Field label={t("notes")}><Textarea rows={2} value={form.notes} onChange={set("notes")} /></Field></div>
            <div className="sm:col-span-2 space-y-3">
              <ErrorText>{error}</ErrorText>
              <Button type="submit" disabled={busy}>{t("save")}</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {viewPhoto ? (
        <Modal title={`${viewPhoto.tagNumber} · ${viewPhoto.guestName}`} onClose={() => setViewPhoto(null)} wide>
          <img src={viewPhoto.photoUrl} alt="" className="max-h-[70dvh] w-full rounded-lg object-contain" />
          <p className="mt-3 text-sm">{viewPhoto.quantity} × {viewPhoto.description}</p>
        </Modal>
      ) : null}

      {returning ? (
        <Modal title={`${t("giveBack")} · ${returning.tagNumber}`} onClose={() => setReturning(null)}>
          <form onSubmit={confirmReturn} className="space-y-3 text-sm">
            {returning.photoUrl ? (
              <div>
                <div className="mb-1 font-medium">{t("checkPhoto")}</div>
                <img src={returning.photoUrl} alt="" className="max-h-72 w-full rounded-lg border border-slate-200 object-contain" />
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t("noPhotoTaken")}</p>
            )}
            <p>{returning.quantity} × {returning.description} — {returning.guestName}{returning.location ? ` · ${returning.location}` : ""}</p>
            <Field label={t("collectedBy")}><Input value={returnedTo} onChange={(event) => setReturnedTo(event.target.value)} required /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy}>{t("confirmReturn")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
