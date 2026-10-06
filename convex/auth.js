import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getSettings, publicUser, requireUser, writeAudit } from "./lib/auth";

const SESSION_MS = 1000 * 60 * 60 * 24 * 14;

export const countUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    return user ? 1 : 0;
  },
});

export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const userByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    try {
      return await requireUser(ctx, args.token);
    } catch {
      return null;
    }
  },
});

export const createSession = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      token: args.token,
      userId: args.userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_MS,
    });
  },
});

export const initialized = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    return Boolean(user);
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    const user = await ctx.db.get(session.userId);
    if (!user || !user.active) return null;
    const hotel = user.hotelId ? await ctx.db.get(user.hotelId) : null;
    return publicUser(user, hotel?.name || "");
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session) return;
    const user = await ctx.db.get(session.userId);
    await ctx.db.delete(session._id);
    if (user) await writeAudit(ctx, { user, action: "logout", entity: "session", details: user.email });
  },
});

export const company = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.token);
    const settings = await getSettings(ctx);
    return {
      companyName: settings.companyName,
      currency: settings.currency,
      taxRate: settings.taxRate,
      serviceCharge: settings.serviceCharge,
    };
  },
});
