import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";
import { createInvoice } from "./lib/billing";
import { nightsBetween, todayISO } from "./lib/dates";

const OPEN = ["pending", "confirmed", "checked_in"];

async function maps(ctx) {
  const [guests, rooms, hotels] = await Promise.all([
    ctx.db.query("guests").collect(),
    ctx.db.query("rooms").collect(),
    ctx.db.query("hotels").collect(),
  ]);
  return {
    guests: new Map(guests.map((guest) => [guest._id, guest])),
    rooms: new Map(rooms.map((room) => [room._id, room])),
    hotels: new Map(hotels.map((hotel) => [hotel._id, hotel])),
  };
}

function decorate(reservation, lookup) {
  const guest = lookup.guests.get(reservation.guestId);
  const room = lookup.rooms.get(reservation.roomId);
  const hotel = lookup.hotels.get(reservation.hotelId);
  return {
    ...reservation,
    guestName: guest?.fullName || "",
    guestPhone: guest?.phone || "",
    roomNumber: room?.number || "",
    roomType: room?.typeName || "",
    hotelName: hotel?.name || "",
  };
}

async function assertAvailable(ctx, roomId, checkIn, checkOut, ignoreId) {
  const rows = await ctx.db.query("reservations").withIndex("by_room", (q) => q.eq("roomId", roomId)).collect();
  const clash = rows.find((row) => {
    if (row._id === ignoreId) return false;
    if (!OPEN.includes(row.status)) return false;
    return row.checkIn < checkOut && row.checkOut > checkIn;
  });
  if (clash) throw new ConvexError("That room is already booked for the selected dates");
}

export const list = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, args.hotelId);
    const rows = hotelId
      ? await ctx.db.query("reservations").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("reservations").collect();
    const lookup = await maps(ctx);
    return rows.map((row) => decorate(row, lookup)).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  },
});

export const desk = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "receptionist"]);
    const hotelId = resolveHotel(user, args.hotelId);
    const today = todayISO();
    const rows = hotelId
      ? await ctx.db.query("reservations").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("reservations").collect();
    const lookup = await maps(ctx);
    const decorated = rows.map((row) => decorate(row, lookup));
    return {
      today,
      arrivals: decorated.filter((row) => row.checkIn <= today && ["pending", "confirmed"].includes(row.status)),
      inHouse: decorated.filter((row) => row.status === "checked_in"),
      departures: decorated.filter((row) => row.status === "checked_in" && row.checkOut <= today),
    };
  },
});

export const save = mutation({
  args: {
    token: v.string(),
    reservationId: v.optional(v.id("reservations")),
    hotelId: v.id("hotels"),
    guestId: v.id("guests"),
    roomId: v.id("rooms"),
    checkIn: v.string(),
    checkOut: v.string(),
    status: v.string(),
    adults: v.number(),
    children: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "receptionist"]);
    const hotelId = requireHotel(user, args.hotelId);
    if (!["pending", "confirmed", "cancelled", "no_show"].includes(args.status)) {
      throw new ConvexError("Choose a valid reservation status");
    }
    if (args.checkOut <= args.checkIn) throw new ConvexError("Check-out must be after check-in");
    const guest = await ctx.db.get(args.guestId);
    const room = await ctx.db.get(args.roomId);
    if (!guest || guest.hotelId !== hotelId) throw new ConvexError("Guest does not belong to this hotel");
    if (!room || room.hotelId !== hotelId) throw new ConvexError("Room does not belong to this hotel");
    if (room.status === "out_of_service" || room.status === "maintenance") {
      throw new ConvexError("This room cannot be booked");
    }
    const existing = args.reservationId ? await ctx.db.get(args.reservationId) : null;
    if (existing && ["checked_in", "checked_out"].includes(existing.status)) {
      throw new ConvexError("This stay can no longer be edited");
    }
    if (args.status !== "cancelled" && args.status !== "no_show") {
      await assertAvailable(ctx, room._id, args.checkIn, args.checkOut, args.reservationId);
    }
    const nights = nightsBetween(args.checkIn, args.checkOut);
    const payload = {
      hotelId,
      guestId: guest._id,
      roomId: room._id,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      status: args.status,
      adults: Number(args.adults || 1),
      children: Number(args.children || 0),
      nightlyRate: room.price,
      nights,
      total: Math.round(room.price * nights * 100) / 100,
      notes: args.notes?.trim() || "",
    };
    let reservationId = args.reservationId;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      if (existing.roomId !== room._id && ["pending", "confirmed"].includes(existing.status)) {
        const previous = await ctx.db.get(existing.roomId);
        if (previous && previous.status === "reserved") await ctx.db.patch(previous._id, { status: "available" });
      }
    } else {
      reservationId = await ctx.db.insert("reservations", {
        ...payload,
        createdBy: user._id,
        createdAt: Date.now(),
      });
    }
    if (["pending", "confirmed"].includes(args.status) && room.status === "available") {
      await ctx.db.patch(room._id, { status: "reserved" });
    }
    if (["cancelled", "no_show"].includes(args.status) && ["reserved"].includes(room.status)) {
      await ctx.db.patch(room._id, { status: "available", housekeepingStatus: room.housekeepingStatus });
    }
    await writeAudit(ctx, {
      user,
      action: existing ? "update" : "create",
      entity: "reservation",
      entityId: reservationId,
      hotelId,
      details: `${guest.fullName} · room ${room.number}`,
    });
    return reservationId;
  },
});

export const checkIn = mutation({
  args: { token: v.string(), reservationId: v.id("reservations"), roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "receptionist"]);
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw new ConvexError("Reservation not found");
    requireHotel(user, reservation.hotelId);
    if (!["pending", "confirmed"].includes(reservation.status)) throw new ConvexError("This reservation cannot be checked in");
    const roomId = args.roomId || reservation.roomId;
    const room = await ctx.db.get(roomId);
    if (!room || room.hotelId !== reservation.hotelId) throw new ConvexError("Room not found");
    if (room.status === "occupied") throw new ConvexError("That room is already occupied");
    if (roomId !== reservation.roomId) {
      await assertAvailable(ctx, roomId, reservation.checkIn, reservation.checkOut, reservation._id);
      const previous = await ctx.db.get(reservation.roomId);
      if (previous?.status === "reserved") await ctx.db.patch(previous._id, { status: "available" });
    }
    await ctx.db.patch(reservation._id, {
      roomId,
      status: "checked_in",
      nightlyRate: room.price,
      checkedInAt: Date.now(),
    });
    await ctx.db.patch(room._id, { status: "occupied", housekeepingStatus: "clean" });
    await writeAudit(ctx, { user, action: "check_in", entity: "reservation", entityId: reservation._id, hotelId: reservation.hotelId, details: room.number });
    return reservation._id;
  },
});

export const checkOut = mutation({
  args: {
    token: v.string(),
    reservationId: v.id("reservations"),
    extraItems: v.array(v.object({
      description: v.string(),
      amount: v.number(),
      accountCode: v.string(),
    })),
    paymentAmount: v.number(),
    method: v.string(),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "receptionist"]);
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "checked_in") throw new ConvexError("Only in-house guests can be checked out");
    requireHotel(user, reservation.hotelId);
    const hotel = await ctx.db.get(reservation.hotelId);
    const guest = await ctx.db.get(reservation.guestId);
    const room = await ctx.db.get(reservation.roomId);
    if (!hotel || !guest || !room) throw new ConvexError("Stay details are incomplete");
    const items = [
      {
        description: `Room ${room.number} · ${room.typeName} · ${reservation.nights} night(s)`,
        quantity: reservation.nights,
        unitPrice: reservation.nightlyRate,
        accountCode: "4000",
      },
      ...args.extraItems.filter((item) => item.description.trim() && Number(item.amount) > 0).map((item) => ({
        description: item.description.trim(),
        quantity: 1,
        unitPrice: Number(item.amount),
        accountCode: item.accountCode || "4200",
      })),
    ];
    const invoice = await createInvoice(ctx, {
      hotel,
      guestId: guest._id,
      reservationId: reservation._id,
      items,
      date: todayISO(),
      notes: reservation.notes,
      user,
      billTo: guest.fullName,
      paymentAmount: Number(args.paymentAmount || 0),
      method: args.method || "cash",
      reference: args.reference,
    });
    await ctx.db.patch(reservation._id, { status: "checked_out", checkedOutAt: Date.now() });
    await ctx.db.patch(room._id, { status: "cleaning", housekeepingStatus: "dirty" });
    await writeAudit(ctx, {
      user,
      action: "check_out",
      entity: "reservation",
      entityId: reservation._id,
      hotelId: reservation.hotelId,
      details: `${guest.fullName} · ${invoice.number}`,
    });
    return invoice._id;
  },
});
