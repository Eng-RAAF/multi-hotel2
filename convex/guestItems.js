import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, scopedRows, writeAudit } from "./lib/auth";

const STAFF = ["super_admin", "hotel_manager", "receptionist"];
const CATEGORIES = ["luggage", "valuables", "documents", "electronics", "clothing", "other"];

export const list = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, STAFF);
    const hotelId = resolveHotel(user, args.hotelId);
    const items = await scopedRows(ctx, "guestItems", "by_hotel", hotelId);
    const guests = new Map((await scopedRows(ctx, "guests", "by_hotel", hotelId)).map((g) => [g._id, g]));
    const hotels = new Map((await ctx.db.query("hotels").collect()).map((h) => [h._id, h.name]));
    const reservations = await scopedRows(ctx, "reservations", "by_hotel", hotelId);
    const inHouse = new Set(reservations.filter((r) => r.status === "checked_in").map((r) => r.guestId));
    const rows = await Promise.all(
      items.map(async (item) => ({ ...item, photoUrl: item.photoId ? await ctx.storage.getUrl(item.photoId) : null })),
    );
    return rows
      .map((item) => {
        const guest = guests.get(item.guestId);
        return {
          ...item,
          guestName: guest?.fullName || "",
          guestPhone: guest?.phone || "",
          hotelName: hotels.get(item.hotelId) || "",
          // Still holding the item but the guest is no longer staying with us.
          guestLeft: item.status === "stored" && !inHouse.has(item.guestId),
        };
      })
      .sort((a, b) => (a.status === b.status ? b.storedAt - a.storedAt : a.status === "stored" ? -1 : 1));
  },
});

// Guests that can be picked when storing an item: in-house guests first (with their room), then the rest.
export const guestOptions = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, STAFF);
    const hotelId = resolveHotel(user, args.hotelId);
    const guests = await scopedRows(ctx, "guests", "by_hotel", hotelId);
    const reservations = (await scopedRows(ctx, "reservations", "by_hotel", hotelId)).filter((r) => r.status === "checked_in");
    const rooms = new Map((await scopedRows(ctx, "rooms", "by_hotel", hotelId)).map((room) => [room._id, room.number]));
    const stay = new Map(reservations.map((r) => [r.guestId, r]));
    return guests
      .map((guest) => {
        const reservation = stay.get(guest._id);
        return {
          _id: guest._id,
          hotelId: guest.hotelId,
          fullName: guest.fullName,
          reservationId: reservation?._id ?? null,
          roomNumber: reservation ? rooms.get(reservation.roomId) || "" : "",
          inHouse: Boolean(reservation),
        };
      })
      .sort((a, b) => Number(b.inHouse) - Number(a.inHouse) || a.fullName.localeCompare(b.fullName));
  },
});

// Short-lived URL the browser uploads the item photo to; the returned storageId is then passed to `store`.
export const photoUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, STAFF);
    return await ctx.storage.generateUploadUrl();
  },
});

export const store = mutation({
  args: {
    token: v.string(),
    itemId: v.optional(v.id("guestItems")),
    guestId: v.id("guests"),
    description: v.string(),
    category: v.string(),
    categoryLabel: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    removePhoto: v.optional(v.boolean()),
    quantity: v.number(),
    location: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, STAFF);
    const guest = await ctx.db.get(args.guestId);
    if (!guest) throw new ConvexError("Guest not found");
    const hotelId = requireHotel(user, guest.hotelId);
    const description = args.description.trim();
    if (!description) throw new ConvexError("Describe the item");
    if (!CATEGORIES.includes(args.category)) throw new ConvexError("Choose a valid category");
    const categoryLabel = args.category === "other" ? args.categoryLabel?.trim() || "" : "";
    if (args.category === "other" && !categoryLabel) throw new ConvexError("Write what type of item it is");
    const quantity = Math.floor(args.quantity);
    if (!(quantity >= 1)) throw new ConvexError("Quantity must be at least 1");

    const reservation = (await ctx.db.query("reservations").withIndex("by_guest", (q) => q.eq("guestId", guest._id)).collect())
      .find((r) => r.status === "checked_in");
    const room = reservation ? await ctx.db.get(reservation.roomId) : null;
    const payload = {
      guestId: guest._id,
      description,
      category: args.category,
      categoryLabel,
      quantity,
      location: args.location.trim(),
      notes: args.notes?.trim() || "",
    };

    if (args.itemId) {
      const existing = await ctx.db.get(args.itemId);
      if (!existing) throw new ConvexError("Item not found");
      requireHotel(user, existing.hotelId);
      if (existing.status !== "stored") throw new ConvexError("Returned items cannot be edited");
      if (existing.hotelId !== hotelId) throw new ConvexError("Guest belongs to another hotel");
      const patch = { ...payload };
      if (args.photoId || args.removePhoto) {
        // Replacing or removing: drop the old file so storage doesn't fill with orphans.
        if (existing.photoId && existing.photoId !== args.photoId) await ctx.storage.delete(existing.photoId);
        patch.photoId = args.photoId ?? undefined;
      }
      await ctx.db.patch(args.itemId, patch);
      await writeAudit(ctx, { user, action: "update", entity: "guest item", entityId: args.itemId, hotelId, details: `${existing.tagNumber} · ${description}` });
      return args.itemId;
    }

    const count = (await ctx.db.query("guestItems").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()).length;
    const tagNumber = `ST-${String(count + 1).padStart(4, "0")}`;
    const row = {
      ...payload,
      hotelId,
      roomNumber: room?.number || "",
      tagNumber,
      status: "stored",
      storedAt: Date.now(),
      storedByName: user.name,
    };
    if (reservation) row.reservationId = reservation._id;
    if (args.photoId) row.photoId = args.photoId;
    const itemId = await ctx.db.insert("guestItems", row);
    await writeAudit(ctx, { user, action: "create", entity: "guest item", entityId: itemId, hotelId, details: `${tagNumber} · ${description} · ${guest.fullName}` });
    return itemId;
  },
});

export const giveBack = mutation({
  args: { token: v.string(), itemId: v.id("guestItems"), returnedTo: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, STAFF);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("Item not found");
    requireHotel(user, item.hotelId);
    if (item.status !== "stored") throw new ConvexError("This item was already returned");
    const returnedTo = args.returnedTo.trim();
    if (!returnedTo) throw new ConvexError("Enter who collected the item");
    await ctx.db.patch(item._id, { status: "returned", returnedAt: Date.now(), returnedByName: user.name, returnedTo });
    await writeAudit(ctx, { user, action: "return", entity: "guest item", entityId: item._id, hotelId: item.hotelId, details: `${item.tagNumber} → ${returnedTo}` });
    return item._id;
  },
});
