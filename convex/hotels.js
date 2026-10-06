import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, scopedRows, writeAudit } from "./lib/auth";

export const list = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, args.hotelId);
    const hotels = hotelId ? [await ctx.db.get(hotelId)].filter(Boolean) : await ctx.db.query("hotels").collect();
    const rooms = await ctx.db.query("rooms").collect();
    return hotels
      .map((hotel) => {
        const hotelRooms = rooms.filter((room) => room.hotelId === hotel._id);
        const occupied = hotelRooms.filter((room) => room.status === "occupied").length;
        return {
          ...hotel,
          rooms: hotelRooms.length,
          occupied,
          occupancy: hotelRooms.length ? Math.round((occupied / hotelRooms.length) * 100) : 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const save = mutation({
  args: {
    token: v.string(),
    hotelId: v.optional(v.id("hotels")),
    name: v.string(),
    city: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    currency: v.string(),
    taxRate: v.number(),
    serviceCharge: v.number(),
    status: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const name = args.name.trim();
    const city = args.city.trim();
    if (!name || !city) throw new ConvexError("Hotel name and city are required");
    const payload = {
      name,
      city,
      address: args.address.trim(),
      phone: args.phone.trim(),
      email: args.email.trim().toLowerCase(),
      currency: args.currency || "USD",
      taxRate: Number(args.taxRate || 0),
      serviceCharge: Number(args.serviceCharge || 0),
      status: args.status === "inactive" ? "inactive" : "active",
      notes: args.notes?.trim() || "",
    };
    if (args.hotelId) {
      const existing = await ctx.db.get(args.hotelId);
      if (!existing) throw new ConvexError("Hotel not found");
      if (user.role !== "super_admin") {
        assertRole(user, ["hotel_manager"]);
        if (user.hotelId !== args.hotelId) throw new ConvexError("You cannot edit another hotel");
      }
      await ctx.db.patch(args.hotelId, payload);
      await writeAudit(ctx, { user, action: "update", entity: "hotel", entityId: args.hotelId, hotelId: args.hotelId, details: name });
      return args.hotelId;
    }
    assertRole(user, ["super_admin"]);
    const hotelId = await ctx.db.insert("hotels", { ...payload, createdAt: Date.now() });
    await writeAudit(ctx, { user, action: "create", entity: "hotel", entityId: hotelId, hotelId, details: name });
    return hotelId;
  },
});

export const options = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, user.hotelId || undefined);
    const hotels = await scopedRows(ctx, "hotels", "by_city", null);
    const visible = hotelId ? hotels.filter((hotel) => hotel._id === hotelId) : hotels;
    return visible.map((hotel) => ({
      _id: hotel._id,
      name: hotel.name,
      city: hotel.city,
      currency: hotel.currency,
      taxRate: hotel.taxRate,
      serviceCharge: hotel.serviceCharge,
      status: hotel.status,
    }));
  },
});

export const assertOwned = mutation({
  args: { token: v.string(), hotelId: v.id("hotels") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    return requireHotel(user, args.hotelId);
  },
});
