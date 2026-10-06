import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";

const ROOM_STATUSES = ["available", "occupied", "reserved", "cleaning", "maintenance", "out_of_service"];
const HOUSEKEEPING = ["clean", "dirty", "cleaning", "inspected"];

async function hotelName(ctx, hotelId) {
  const hotel = await ctx.db.get(hotelId);
  return hotel?.name || "";
}

export const list = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, args.hotelId);
    const rooms = hotelId
      ? await ctx.db.query("rooms").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("rooms").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return rooms
      .map((room) => ({ ...room, hotelName: names.get(room.hotelId) || "" }))
      .sort((a, b) => a.hotelName.localeCompare(b.hotelName) || a.number.localeCompare(b.number, undefined, { numeric: true }));
  },
});

export const types = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, args.hotelId);
    const rows = hotelId
      ? await ctx.db.query("roomTypes").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("roomTypes").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveType = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    name: v.string(),
    price: v.number(),
    capacity: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager"]);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Room type name is required");
    const id = await ctx.db.insert("roomTypes", {
      hotelId,
      name,
      price: Number(args.price),
      capacity: Number(args.capacity || 1),
    });
    await writeAudit(ctx, { user, action: "create", entity: "room_type", entityId: id, hotelId, details: name });
    return id;
  },
});

export const save = mutation({
  args: {
    token: v.string(),
    roomId: v.optional(v.id("rooms")),
    hotelId: v.id("hotels"),
    number: v.string(),
    typeName: v.string(),
    price: v.number(),
    capacity: v.number(),
    floor: v.string(),
    status: v.string(),
    housekeepingStatus: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "receptionist"]);
    const hotelId = requireHotel(user, args.hotelId);
    if (!ROOM_STATUSES.includes(args.status)) throw new ConvexError("Choose a valid room status");
    if (!HOUSEKEEPING.includes(args.housekeepingStatus)) throw new ConvexError("Choose a valid housekeeping status");
    const number = args.number.trim();
    if (!number) throw new ConvexError("Room number is required");
    const siblings = await ctx.db.query("rooms").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect();
    if (siblings.some((room) => room.number === number && room._id !== args.roomId)) {
      throw new ConvexError("This room number already exists in the hotel");
    }
    const payload = {
      hotelId,
      number,
      typeName: args.typeName.trim(),
      price: Number(args.price),
      capacity: Number(args.capacity || 1),
      floor: args.floor.trim() || "1",
      status: args.status,
      housekeepingStatus: args.housekeepingStatus,
      notes: args.notes?.trim() || "",
    };
    if (args.roomId) {
      await ctx.db.patch(args.roomId, payload);
      await writeAudit(ctx, { user, action: "update", entity: "room", entityId: args.roomId, hotelId, details: number });
      return args.roomId;
    }
    const roomId = await ctx.db.insert("rooms", payload);
    await writeAudit(ctx, { user, action: "create", entity: "room", entityId: roomId, hotelId, details: number });
    return roomId;
  },
});

export const updateCondition = mutation({
  args: {
    token: v.string(),
    roomId: v.id("rooms"),
    status: v.string(),
    housekeepingStatus: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "housekeeping", "receptionist"]);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new ConvexError("Room not found");
    requireHotel(user, room.hotelId);
    if (!ROOM_STATUSES.includes(args.status) || !HOUSEKEEPING.includes(args.housekeepingStatus)) {
      throw new ConvexError("Choose a valid room condition");
    }
    if (room.status === "occupied" && ["available", "reserved"].includes(args.status)) {
      throw new ConvexError("Check the guest out before marking this room available");
    }
    await ctx.db.patch(room._id, {
      status: args.status,
      housekeepingStatus: args.housekeepingStatus,
      notes: args.notes?.trim() || room.notes || "",
    });
    await writeAudit(ctx, {
      user,
      action: "update",
      entity: "housekeeping",
      entityId: room._id,
      hotelId: room.hotelId,
      details: `${room.number} → ${args.housekeepingStatus}`,
    });
    return await hotelName(ctx, room.hotelId);
  },
});
