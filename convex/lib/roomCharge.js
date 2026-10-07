import { addDays, todayISO } from "./dates";
import { createInvoice } from "./billing";
import { roundMoney } from "./accounting";
import { writeAudit } from "./auth";

export const ROOM_POST_TIME = "11:59";

export function dueNights(checkIn, asOf, includeSameDay) {
  const nights = [];
  let cursor = checkIn;
  while (cursor && cursor < asOf) {
    nights.push(cursor);
    cursor = addDays(cursor, 1);
  }
  if (!nights.length && includeSameDay && checkIn) nights.push(checkIn);
  return nights;
}

async function postingUser(ctx, reservation) {
  const users = await ctx.db.query("users").collect();
  const admin = users.find((user) => user.role === "super_admin" && user.active);
  if (admin) return admin;
  if (reservation.createdBy) return await ctx.db.get(reservation.createdBy);
  return users.find((user) => user.active) || null;
}

export async function unchargedNights(ctx, reservation, asOf, includeSameDay) {
  const existing = await ctx.db
    .query("roomCharges")
    .withIndex("by_reservation", (q) => q.eq("reservationId", reservation._id))
    .collect();
  const posted = new Set(existing.map((charge) => charge.night));
  return dueNights(reservation.checkIn, asOf, includeSameDay).filter((night) => !posted.has(night));
}

export async function postRoomNight(ctx, reservation, night) {
  const already = await ctx.db
    .query("roomCharges")
    .withIndex("by_reservation_night", (q) => q.eq("reservationId", reservation._id).eq("night", night))
    .unique();
  if (already) return already.invoiceId;
  const user = await postingUser(ctx, reservation);
  const hotel = await ctx.db.get(reservation.hotelId);
  const guest = await ctx.db.get(reservation.guestId);
  const room = await ctx.db.get(reservation.roomId);
  if (!user || !hotel || !guest || !room) return null;
  const invoice = await createInvoice(ctx, {
    hotel,
    guestId: guest._id,
    reservationId: reservation._id,
    items: [{
      description: `Room ${room.number} · ${room.typeName} · night of ${night}`,
      quantity: 1,
      unitPrice: reservation.nightlyRate,
      accountCode: "4000",
    }],
    date: todayISO(),
    notes: `Automatic room charge at ${ROOM_POST_TIME} AM`,
    user,
    billTo: guest.fullName,
    paymentAmount: 0,
    method: "cash",
  });
  await ctx.db.insert("roomCharges", {
    reservationId: reservation._id,
    hotelId: reservation.hotelId,
    guestId: reservation.guestId,
    night,
    amount: roundMoney(reservation.nightlyRate),
    invoiceId: invoice._id,
    postedTime: ROOM_POST_TIME,
    createdAt: Date.now(),
  });
  await writeAudit(ctx, {
    user,
    action: "room_charge",
    entity: "reservation",
    entityId: reservation._id,
    hotelId: reservation.hotelId,
    details: `Room ${room.number} · ${night} · ${ROOM_POST_TIME} AM`,
  });
  return invoice._id;
}
