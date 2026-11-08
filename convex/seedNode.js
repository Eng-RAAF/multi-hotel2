"use node";

import bcrypt from "bcryptjs";
import { action, internalAction } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";

const STAFF_PASSWORDS = [
  ["waiter1@mhmas.so", "Waiter1@123"],
  ["waiter2@mhmas.so", "Waiter2@123"],
  ["waiter3@mhmas.so", "Waiter3@123"],
  ["cook@mhmas.so", "Cook@123"],
];

const PASSWORDS = [
  ...STAFF_PASSWORDS,
  ["admin@mhmas.so", "Admin@123"],
  ["manager@mhmas.so", "Manager@123"],
  ["reception@mhmas.so", "Reception@123"],
  ["house@mhmas.so", "House@123"],
  ["accountant@mhmas.so", "Accountant@123"],
  ["hr@mhmas.so", "Hr@123"],
];

export const seed = action({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.runQuery(internal.auth.countUsers, {});
    if (existing > 0) throw new ConvexError("Demo data is already loaded");
    const hashes = [];
    for (const [email, password] of PASSWORDS) {
      hashes.push({ email, hash: await bcrypt.hash(password, 8) });
    }
    await ctx.runMutation(internal.seed.run, { hashes });
    return { ok: true };
  },
});

// Run once from the terminal: npx convex run seedNode:addRestaurantStaff
export const addRestaurantStaff = internalAction({
  args: {},
  handler: async (ctx) => {
    const hashes = [];
    for (const [email, password] of STAFF_PASSWORDS) {
      hashes.push({ email, hash: await bcrypt.hash(password, 8) });
    }
    return await ctx.runMutation(internal.seed.addRestaurantStaff, { hashes });
  },
});
