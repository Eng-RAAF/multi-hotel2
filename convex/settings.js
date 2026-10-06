import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, getSettings, requireUser, writeAudit } from "./lib/auth";

export const get = query({
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

export const update = mutation({
  args: {
    token: v.string(),
    companyName: v.string(),
    currency: v.string(),
    taxRate: v.number(),
    serviceCharge: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin"]);
    const companyName = args.companyName.trim();
    if (!companyName) throw new ConvexError("Company name is required");
    const currency = args.currency.trim().toUpperCase() || "USD";
    const payload = {
      key: "company",
      companyName,
      currency,
      taxRate: Number(args.taxRate || 0),
      serviceCharge: Number(args.serviceCharge || 0),
    };
    const existing = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", "company")).unique();
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("settings", payload);
    await writeAudit(ctx, { user, action: "update", entity: "settings", details: companyName });
  },
});
