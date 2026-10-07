import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/api";
import { useScope } from "../../context/AppContext";
import { errorMessage } from "../../lib/format";
import { Badge, Button, Empty, ErrorText, Loading, PageHeader, Panel } from "../../components/ui";

export default function KitchenPage() {
  const { t, token, hotelId, hotels } = useScope();
  const active = hotelId !== "all" ? hotelId : hotels[0]?._id;
  const orders = useQuery(api.restaurant.listOrders, token && active ? { token, hotelId: active, kitchen: true } : "skip");
  const setStatus = useMutation(api.restaurant.setOrderStatus);
  const [error, setError] = useState("");
  if (!active) return <Empty title={t("selectHotel")} />;
  if (!orders) return <Loading label={t("loading")} />;

  async function move(order, status) {
    setError("");
    try {
      await setStatus({ token, orderId: order._id, status });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title={t("kitchen")} subtitle="Pending → Preparing → Ready" />
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-3 lg:grid-cols-3">
        {["pending", "preparing", "ready"].map((status) => (
          <Panel key={status}>
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold capitalize">{status}</h2>
            {orders.filter((order) => order.status === status).map((order) => (
              <div key={order._id} className="border-t border-slate-100 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{order.number}</div>
                  <Badge value={order.type} />
                </div>
                <div className="text-xs text-muted">{order.tableNumber ? `Table ${order.tableNumber}` : order.roomNumber ? `Room ${order.roomNumber}` : "Takeaway"}</div>
                <ul className="mt-2 space-y-1">
                  {order.items.map((item) => <li key={item._id}>{item.quantity} × {item.name}{item.notes ? ` · ${item.notes}` : ""}</li>)}
                </ul>
                {status === "pending" ? <Button className="mt-3" onClick={() => move(order, "preparing")}>Accept</Button> : null}
                {status === "preparing" ? <Button className="mt-3" onClick={() => move(order, "ready")}>Ready</Button> : null}
              </div>
            ))}
          </Panel>
        ))}
      </div>
    </div>
  );
}
