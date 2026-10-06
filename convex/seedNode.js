"use node";

import bcrypt from "bcryptjs";
import { action } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";

const PASSWORDS = [
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
