"use node";

import bcrypt from "bcryptjs";
import { action } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { ROLES } from "./lib/auth";

function token() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const user = await ctx.runQuery(internal.auth.userByEmail, { email });
    if (!user || !user.active) throw new ConvexError("Invalid email or password");
    const matches = await bcrypt.compare(args.password, user.passwordHash);
    if (!matches) throw new ConvexError("Invalid email or password");
    const sessionToken = token();
    await ctx.runMutation(internal.auth.createSession, { userId: user._id, token: sessionToken });
    await ctx.runMutation(internal.audit.write, {
      userId: user._id,
      userName: user.name,
      action: "login",
      entity: "session",
      entityId: "",
      hotelId: user.hotelId,
      details: email,
    });
    return { token: sessionToken };
  },
});

export const saveUser = action({
  args: {
    token: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    role: v.string(),
    hotelId: v.optional(v.id("hotels")),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.runQuery(internal.auth.userByToken, { token: args.token });
    if (!actor || !["super_admin", "hr_admin"].includes(actor.role)) {
      throw new ConvexError("You do not have permission to manage users");
    }
    if (!ROLES.includes(args.role)) throw new ConvexError("Choose a valid role");
    if (args.password && args.password.length < 6) throw new ConvexError("Password must be at least 6 characters");
    const payload = {
      actorId: actor._id,
      name: args.name.trim(),
      email: args.email.toLowerCase().trim(),
      role: args.role,
      active: args.active,
    };
    if (args.userId) payload.userId = args.userId;
    if (args.password) payload.passwordHash = await bcrypt.hash(args.password, 8);
    if (args.hotelId) payload.hotelId = args.hotelId;
    return await ctx.runMutation(internal.people.saveUser, payload);
  },
});
