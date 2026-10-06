import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, resolveHotel } from "./lib/auth";

export const run = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")), q: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const term = args.q.trim().toLowerCase();
    if (term.length < 2) return [];
    const hotelId = resolveHotel(user, args.hotelId);
    const financial = ["super_admin", "hotel_manager", "accountant", "receptionist"].includes(user.role);
    const results = [];
    const guests = hotelId
      ? await ctx.db.query("guests").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
      : await ctx.db.query("guests").collect();
    for (const guest of guests) {
      const hay = `${guest.fullName} ${guest.phone} ${guest.email} ${guest.idNumber}`.toLowerCase();
      if (hay.includes(term)) results.push({ type: "guest", label: guest.fullName, hint: guest.phone, to: "/guests" });
    }
    if (["super_admin", "hotel_manager", "receptionist"].includes(user.role)) {
      const reservations = hotelId
        ? await ctx.db.query("reservations").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
        : await ctx.db.query("reservations").collect();
      const guestNames = new Map(guests.map((guest) => [guest._id, guest.fullName]));
      for (const reservation of reservations) {
        const name = guestNames.get(reservation.guestId) || "";
        if (`${name} ${reservation.status}`.toLowerCase().includes(term)) {
          results.push({ type: "reservation", label: name, hint: `${reservation.checkIn} · ${reservation.status}`, to: "/reservations" });
        }
      }
    }
    if (financial) {
      const invoices = hotelId
        ? await ctx.db.query("invoices").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect()
        : await ctx.db.query("invoices").collect();
      for (const invoice of invoices) {
        if (`${invoice.number} ${invoice.billTo}`.toLowerCase().includes(term)) {
          results.push({ type: "invoice", label: invoice.number, hint: invoice.billTo, to: `/invoices/${invoice._id}` });
        }
      }
    }
    return results.slice(0, 8);
  },
});
