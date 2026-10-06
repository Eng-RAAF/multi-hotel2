import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage, todayISO } from "../lib/format";
import { Badge, Button, Empty, ErrorText, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table } from "../components/ui";

export default function Employees() {
  const { t, token, money, hotelId, hotels } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rows = useQuery(api.people.listEmployees, token ? args : "skip");
  const attendance = useQuery(api.people.listAttendance, token && hotelId && hotelId !== "all" ? { token, hotelId, date: todayISO() } : "skip");
  const save = useMutation(api.people.saveEmployee);
  const mark = useMutation(api.people.markAttendance);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank(hotelId, hotels));
  if (!rows) return <Loading label={t("loading")} />;
  const attendanceMap = new Map((attendance || []).map((row) => [row.employeeId, row.status]));

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await save({ token, ...form, salary: Number(form.salary || 0) });
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("employees")} subtitle={hotelId === "all" ? t("selectHotel") : `${t("attendance")} · ${todayISO()}`} action={<Button onClick={() => { setForm(blank(hotelId, hotels)); setOpen(true); }}>{t("create")}</Button>} />
      <Panel>
        {rows.length ? (
          <Table rowKey={(row) => row._id} rows={rows} columns={[
            { key: "name", header: t("name"), cell: (row) => <div><div className="font-medium">{row.name}</div><div className="text-xs text-muted">{row.position}</div></div> },
            { key: "hotel", header: t("hotel"), cell: (row) => row.hotelName },
            { key: "phone", header: t("phone"), cell: (row) => row.phone },
            { key: "salary", header: t("salary"), cell: (row) => money(row.salary) },
            { key: "status", header: t("status"), cell: (row) => <Badge value={row.status} /> },
            { key: "attendance", header: t("attendance"), cell: (row) => hotelId === "all" ? "—" : (
              <Select value={attendanceMap.get(row._id) || ""} onChange={(event) => mark({ token, employeeId: row._id, date: todayISO(), status: event.target.value })}>
                <option value="">—</option>
                <option value="present">{t("present")}</option>
                <option value="absent">{t("absent")}</option>
                <option value="leave">{t("leave")}</option>
              </Select>
            ) },
          ]} />
        ) : <Empty title={t("noResults")} />}
      </Panel>
      {open ? (
        <Modal title={t("employees")} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("hotel")}><Select value={form.hotelId} onChange={(event) => setForm({ ...form, hotelId: event.target.value })}>{hotels.map((hotel) => <option key={hotel._id} value={hotel._id}>{hotel.name}</option>)}</Select></Field>
            </div>
            <Field label={t("name")}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label={t("position")}><Input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></Field>
            <Field label={t("phone")}><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label={t("email")}><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label={t("salary")}><Input type="number" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} /></Field>
            <Field label={t("hireDate")}><Input type="date" value={form.hireDate} onChange={(event) => setForm({ ...form, hireDate: event.target.value })} /></Field>
            <Field label="National ID"><Input value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} /></Field>
            <div className="sm:col-span-2 space-y-3"><ErrorText>{error}</ErrorText><Button type="submit">{t("save")}</Button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function blank(hotelId, hotels) {
  return { hotelId: hotelId !== "all" ? hotelId : hotels[0]?._id || "", name: "", position: "", phone: "", email: "", salary: "", status: "active", hireDate: todayISO(), nationalId: "" };
}
