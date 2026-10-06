import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useApp } from "../context/AppContext";
import { ROLES } from "../lib/catalogs";
import { errorMessage } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Users() {
  const { t, token, hotels } = useApp();
  const rows = useQuery(api.people.listUsers, token ? { token } : "skip");
  const save = useAction(api.authNode.saveUser);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank());
  if (!rows) return <Loading label={t("loading")} />;
  const needsHotel = !["super_admin", "accountant", "hr_admin"].includes(form.role);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        token,
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active === "true" || form.active === true,
      };
      if (form.userId) payload.userId = form.userId;
      if (form.password) payload.password = form.password;
      if (needsHotel && form.hotelId) payload.hotelId = form.hotelId;
      await save(payload);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("users")} action={<Button onClick={() => { setForm(blank()); setOpen(true); }}>{t("create")}</Button>} />
      <Panel>
        {rows.length ? (
          <Table rowKey={(row) => row._id} rows={rows} columns={[
            { key: "name", header: t("name"), cell: (row) => <div><div className="font-medium">{row.name}</div><div className="text-xs text-muted">{row.email}</div></div> },
            { key: "role", header: t("role"), cell: (row) => ROLES.find((role) => role.id === row.role)?.label || row.role },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName || t("allHotels") },
            { key: "status", header: t("status"), cell: (row) => <Badge value={row.active ? "active" : "inactive"} /> },
            { key: "edit", header: "", cell: (row) => <Button variant="ghost" onClick={() => { setForm({ ...blank(), userId: row._id, name: row.name, email: row.email, role: row.role, hotelId: row.hotelId || "", active: row.active ? "true" : "false" }); setOpen(true); }}>{t("edit")}</Button> },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("user")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("name")}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label={t("email")}><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
            <Field label={t("password")}><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={form.userId ? "Leave blank to keep" : ""} required={!form.userId} /></Field>
            <Field label={t("role")}>
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
              </Select>
            </Field>
            {needsHotel ? (
              <Field label={t("hotel")}>
                <Select value={form.hotelId} onChange={(event) => setForm({ ...form, hotelId: event.target.value })} required>
                  <option value="">Select</option>
                  {hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}
                </Select>
              </Field>
            ) : null}
            <Field label={t("status")}>
              <Select value={form.active} onChange={(event) => setForm({ ...form, active: event.target.value })}>
                <option value="true">{t("active")}</option>
                <option value="false">inactive</option>
              </Select>
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("save")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank() {
  return { name: "", email: "", password: "", role: "receptionist", hotelId: "", active: "true" };
}
