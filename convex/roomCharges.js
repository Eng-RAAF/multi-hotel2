import { internalMutation } from "./_generated/server";
import { todayISO } from "./lib/dates";
import { postRoomNight, unchargedNights } from "./lib/roomCharge";

export const postDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = todayISO();
    const stays = await ctx.db.query("reservations").collect();
    let posted = 0;
    for (const reservation of stays) {
      if (reservation.status !== "checked_in") continue;
      const nights = await unchargedNights(ctx, reservation, today, false);
      for (const night of nights) {
        const invoiceId = await postRoomNight(ctx, reservation, night);
        if (invoiceId) posted += 1;
      }
    }
    return { posted };
  },
});
