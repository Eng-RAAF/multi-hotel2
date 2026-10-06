import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertRole, requireUser, resolveHotel } from "./lib/auth";

export const write = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    userName: v.string(),
    action: v.string(),
    entity: v.string(),
    entityId: v.string(),
    hotelId: v.optional(v.id("hotels")),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", { ...args, createdAt: Date.now() });
  },
});

export const list = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hotel_manager"]);
    const hotelId = resolveHotel(user, args.hotelId);
    const logs = await ctx.db.query("auditLogs").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return logs
      .filter((log) => !hotelId || log.hotelId === hotelId)
      .map((log) => ({ ...log, hotelName: names.get(log.hotelId) || "" }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
  },
});
