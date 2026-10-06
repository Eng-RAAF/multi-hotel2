import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";
import { roundMoney } from "./lib/accounting";

async function decorate(ctx, guests) {
  const invoices = await ctx.db.query("invoices").collect();
  const reservations = await ctx.db.query("reservations").collect();
  return guests.map((guest) => {
    const guestInvoices = invoices.filter((invoice) => invoice.guestId === guest._id && invoice.status !== "cancelled");
    const balance = roundMoney(guestInvoices.reduce((sum, invoice) => sum + (invoice.total - invoice.paid), 0));
    const stays = reservations.filter((reservation) => reservation.guestId === guest._id);
    return { ...guest, balance, stays: stays.length };
  });
}

export const list = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, args.hotelId);
    const guests = hotelId
      ? await ctx.db.query("guests").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("guests").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    const rows = await decorate(ctx, guests);
    return rows
      .map((guest) => ({ ...guest, hotelName: names.get(guest.hotelId) || "" }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

export const save = mutation({
  args: {
    token: v.string(),
    guestId: v.optional(v.id("guests")),
    hotelId: v.id("hotels"),
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    idType: v.string(),
    idNumber: v.string(),
    nationality: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager", "receptionist", "accountant"]);
    const hotelId = requireHotel(user, args.hotelId);
    const fullName = args.fullName.trim();
    if (!fullName) throw new ConvexError("Guest name is required");
    const payload = {
      hotelId,
      fullName,
      phone: args.phone.trim(),
      email: args.email.trim().toLowerCase(),
      address: args.address.trim(),
      idType: args.idType || "passport",
      idNumber: args.idNumber.trim(),
      nationality: args.nationality.trim() || "Somali",
      notes: args.notes?.trim() || "",
    };
    if (args.guestId) {
      const existing = await ctx.db.get(args.guestId);
      if (!existing) throw new ConvexError("Guest not found");
      requireHotel(user, existing.hotelId);
      await ctx.db.patch(args.guestId, payload);
      await writeAudit(ctx, { user, action: "update", entity: "guest", entityId: args.guestId, hotelId, details: fullName });
      return args.guestId;
    }
    const guestId = await ctx.db.insert("guests", { ...payload, createdAt: Date.now() });
    await writeAudit(ctx, { user, action: "create", entity: "guest", entityId: guestId, hotelId, details: fullName });
    return guestId;
  },
});

export const history = query({
  args: { token: v.string(), guestId: v.id("guests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const guest = await ctx.db.get(args.guestId);
    if (!guest) return null;
    requireHotel(user, guest.hotelId);
    const reservations = await ctx.db.query("reservations").withIndex("by_guest", (q) => q.eq("guestId", guest._id)).collect();
    const invoices = (await ctx.db.query("invoices").withIndex("by_guest", (q) => q.eq("guestId", guest._id)).collect())
      .filter((invoice) => invoice.status !== "cancelled");
    const payments = (await ctx.db.query("payments").collect()).filter((payment) => payment.guestId === guest._id);
    const rooms = await ctx.db.query("rooms").collect();
    const roomMap = new Map(rooms.map((room) => [room._id, room.number]));
    return {
      guest,
      reservations: reservations.map((reservation) => ({ ...reservation, roomNumber: roomMap.get(reservation.roomId) || "" })),
      invoices,
      payments,
      balance: invoices.reduce((sum, invoice) => sum + (invoice.total - invoice.paid), 0),
    };
  },
});
