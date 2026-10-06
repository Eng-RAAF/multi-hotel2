import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/api";
import { useScope } from "../context/AppContext";
import { errorMessage } from "../lib/format";
import { Badge, Button, ErrorText, Field, Loading, Modal, PageHeader, Select } from "../components/ui";

const tones = {
  available: "border-green-200 bg-green-50",
  occupied: "border-amber-200 bg-amber-50",
  reserved: "border-sky-200 bg-sky-50",
  cleaning: "border-violet-200 bg-violet-50",
  maintenance: "border-orange-200 bg-orange-50",
  out_of_service: "border-slate-200 bg-slate-50",
};

export default function Housekeeping() {
  const { t, token, hotelId } = useScope();
  const args = { token };
  if (hotelId && hotelId !== "all") args.hotelId = hotelId;
  const rooms = useQuery(api.rooms.list, token ? args : "skip");
  const update = useMutation(api.rooms.updateCondition);
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState("cleaning");
  const [housekeepingStatus, setHousekeepingStatus] = useState("dirty");
  const [error, setError] = useState("");

  if (!rooms) return <Loading label={t("loading")} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await update({ token, roomId: room._id, status, housekeepingStatus });
      setRoom(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("housekeeping")} subtitle="Clean, dirty, cleaning, inspected, maintenance" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rooms.map((item) => (
          <button
            key={item._id}
            onClick={() => {
              setRoom(item);
              setStatus(item.status);
              setHousekeepingStatus(item.housekeepingStatus);
              setError("");
            }}
            className={`rounded-2xl border p-4 text-left ${tones[item.status] || "bg-white"}`}
          >
            <div className="text-xs text-muted">{item.hotelName}</div>
            <div className="mt-1 text-2xl font-bold">{item.number}</div>
            <div className="text-sm">{item.typeName}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge value={item.status} />
              <Badge value={item.housekeepingStatus} />
            </div>
          </button>
        ))}
      </div>
      {room ? (
        <Modal title={`${t("room")} ${room.number}`} onClose={() => setRoom(null)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("status")}>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                {["available", "occupied", "reserved", "cleaning", "maintenance", "out_of_service"].map((item) => <option key={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label={t("housekeepingStatus")}>
              <Select value={housekeepingStatus} onChange={(event) => setHousekeepingStatus(event.target.value)}>
                {["clean", "dirty", "cleaning", "inspected"].map((item) => <option key={item}>{item}</option>)}
              </Select>
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit">{t("updateStatus")}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
