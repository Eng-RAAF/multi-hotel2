import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";
import { todayISO } from "./lib/dates";

function visibleUser(user, hotelName = "") {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    hotelId: user.hotelId ?? null,
    hotelName,
    active: user.active,
    createdAt: user.createdAt,
  };
}

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hr_admin"]);
    const [users, hotels] = await Promise.all([ctx.db.query("users").collect(), ctx.db.query("hotels").collect()]);
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return users.map((row) => visibleUser(row, names.get(row.hotelId) || "")).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveUser = internalMutation({
  args: {
    actorId: v.id("users"),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    passwordHash: v.optional(v.string()),
    role: v.string(),
    hotelId: v.optional(v.id("hotels")),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new ConvexError("Unauthorized");
    if (!args.name || !args.email.includes("@")) throw new ConvexError("Name and a valid email are required");
    const companyWide = ["super_admin", "accountant", "hr_admin"].includes(args.role);
    const existingEmail = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", args.email)).unique();
    if (existingEmail && existingEmail._id !== args.userId) throw new ConvexError("That email is already in use");
    if (!companyWide && !args.hotelId) throw new ConvexError("Assign this user to a hotel");
    if (args.userId) {
      const current = await ctx.db.get(args.userId);
      if (!current) throw new ConvexError("User not found");
      const next = {
        name: args.name,
        email: args.email,
        passwordHash: args.passwordHash || current.passwordHash,
        role: args.role,
        active: args.active,
        createdAt: current.createdAt,
      };
      if (!companyWide && args.hotelId) next.hotelId = args.hotelId;
      await ctx.db.replace(args.userId, next);
      await writeAudit(ctx, { user: actor, action: "update", entity: "user", entityId: args.userId, details: args.email });
      return args.userId;
    }
    if (!args.passwordHash) throw new ConvexError("A password is required for a new user");
    const userRow = {
      name: args.name,
      email: args.email,
      passwordHash: args.passwordHash,
      role: args.role,
      active: args.active,
      createdAt: Date.now(),
    };
    if (!companyWide && args.hotelId) userRow.hotelId = args.hotelId;
    const userId = await ctx.db.insert("users", userRow);
    await writeAudit(ctx, { user: actor, action: "create", entity: "user", entityId: userId, hotelId: args.hotelId, details: args.email });
    return userId;
  },
});

export const listEmployees = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hr_admin", "hotel_manager"]);
    const hotelId = resolveHotel(user, args.hotelId);
    const employees = hotelId
      ? await ctx.db.query("employees").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("employees").collect();
    const hotels = await ctx.db.query("hotels").collect();
    const names = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    return employees.map((employee) => ({ ...employee, hotelName: names.get(employee.hotelId) || "" })).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveEmployee = mutation({
  args: {
    token: v.string(),
    employeeId: v.optional(v.id("employees")),
    hotelId: v.id("hotels"),
    name: v.string(),
    position: v.string(),
    phone: v.string(),
    email: v.string(),
    salary: v.number(),
    status: v.string(),
    hireDate: v.string(),
    nationalId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hr_admin", "hotel_manager"]);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Employee name is required");
    const payload = {
      hotelId,
      name,
      position: args.position.trim(),
      phone: args.phone.trim(),
      email: args.email.trim().toLowerCase(),
      salary: Number(args.salary || 0),
      status: args.status === "inactive" ? "inactive" : "active",
      hireDate: args.hireDate || todayISO(),
      nationalId: args.nationalId.trim(),
    };
    if (args.employeeId) {
      await ctx.db.patch(args.employeeId, payload);
      return args.employeeId;
    }
    const id = await ctx.db.insert("employees", payload);
    await writeAudit(ctx, { user, action: "create", entity: "employee", entityId: id, hotelId, details: name });
    return id;
  },
});

export const listAttendance = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")), date: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hr_admin", "hotel_manager"]);
    const hotelId = resolveHotel(user, args.hotelId);
    if (!hotelId) return [];
    return await ctx.db.query("attendance").withIndex("by_hotel_date", (q) => q.eq("hotelId", hotelId).eq("date", args.date)).collect();
  },
});

export const markAttendance = mutation({
  args: {
    token: v.string(),
    employeeId: v.id("employees"),
    date: v.string(),
    status: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ["super_admin", "hr_admin", "hotel_manager"]);
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new ConvexError("Employee not found");
    requireHotel(user, employee.hotelId);
    if (!["present", "absent", "leave"].includes(args.status)) throw new ConvexError("Choose a valid attendance status");
    const existing = (await ctx.db.query("attendance").withIndex("by_hotel_date", (q) => q.eq("hotelId", employee.hotelId).eq("date", args.date)).collect())
      .find((row) => row.employeeId === employee._id);
    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status, notes: args.notes?.trim() || "" });
      return existing._id;
    }
    return await ctx.db.insert("attendance", {
      employeeId: employee._id,
      hotelId: employee.hotelId,
      date: args.date,
      status: args.status,
      notes: args.notes?.trim() || "",
    });
  },
});
