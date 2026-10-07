import { ConvexError } from "convex/values";

export const ROLES = [
  "super_admin",
  "hotel_manager",
  "receptionist",
  "accountant",
  "housekeeping",
  "hr_admin",
  "restaurant_manager",
  "waiter",
  "kitchen",
];

export const COMPANY_ROLES = ["super_admin", "accountant", "hr_admin"];

export function publicUser(user, hotelName = "") {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    hotelId: user.hotelId ?? null,
    hotelName,
    active: user.active,
  };
}

export async function requireUser(ctx, token) {
  if (!token) throw new ConvexError("Please sign in");
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) {
    throw new ConvexError("Session expired. Please sign in again");
  }
  const user = await ctx.db.get(session.userId);
  if (!user || !user.active) throw new ConvexError("This account is disabled");
  return user;
}

export function assertRole(user, roles) {
  if (!roles.includes(user.role)) {
    throw new ConvexError("You do not have permission for this action");
  }
}

export function canSwitchHotel(user) {
  return COMPANY_ROLES.includes(user.role) && !user.hotelId;
}

export function resolveHotel(user, hotelId) {
  if (!canSwitchHotel(user)) {
    if (!user.hotelId) throw new ConvexError("No hotel is assigned to this account");
    if (hotelId && hotelId !== user.hotelId) {
      throw new ConvexError("You cannot access another hotel");
    }
    return user.hotelId;
  }
  return hotelId || null;
}

export function requireHotel(user, hotelId) {
  const scoped = resolveHotel(user, hotelId);
  if (!scoped) throw new ConvexError("Select a hotel first");
  return scoped;
}

export async function scopedRows(ctx, table, index, hotelId) {
  if (hotelId) {
    return await ctx.db
      .query(table)
      .withIndex(index, (q) => q.eq("hotelId", hotelId))
      .collect();
  }
  return await ctx.db.query(table).collect();
}

export async function writeAudit(ctx, { user, action, entity, entityId, hotelId, details }) {
  const row = {
    userName: user?.name || "System",
    action,
    entity,
    entityId: entityId ? String(entityId) : "",
    details: details || "",
    createdAt: Date.now(),
  };
  if (user?._id) row.userId = user._id;
  if (hotelId) row.hotelId = hotelId;
  await ctx.db.insert("auditLogs", row);
}

export async function getSettings(ctx) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "company"))
    .unique();
  return (
    row || {
      companyName: "Somali Hotels Group",
      currency: "USD",
      taxRate: 5,
      serviceCharge: 5,
    }
  );
}
