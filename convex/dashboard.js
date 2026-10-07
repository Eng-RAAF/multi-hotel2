import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, resolveHotel } from "./lib/auth";
import { roundMoney } from "./lib/accounting";
import { addDays, lastMonthKeys, monthStart, todayISO } from "./lib/dates";

function inHotel(row, hotelId) {
  return !hotelId || row.hotelId === hotelId;
}

export const summary = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hotelId = resolveHotel(user, args.hotelId);
    const showFinancials = ["super_admin", "hotel_manager", "accountant"].includes(user.role);
    const today = todayISO();
    const from = monthStart(today);
    const [hotels, rooms, reservations, guests, payments, bills, accounts, lines] = await Promise.all([
      ctx.db.query("hotels").collect(),
      ctx.db.query("rooms").collect(),
      ctx.db.query("reservations").collect(),
      ctx.db.query("guests").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("bills").collect(),
      ctx.db.query("accounts").collect(),
      ctx.db.query("journalLines").collect(),
    ]);
    const visibleHotels = hotels.filter((hotel) => !hotelId || hotel._id === hotelId);
    const visibleRooms = rooms.filter((room) => inHotel(room, hotelId));
    const occupied = visibleRooms.filter((room) => room.status === "occupied").length;
    const available = visibleRooms.filter((room) => room.status === "available").length;
    const guestNames = new Map(guests.map((guest) => [guest._id, guest.fullName]));
    const roomNumbers = new Map(rooms.map((room) => [room._id, room.number]));
    const hotelNames = new Map(hotels.map((hotel) => [hotel._id, hotel.name]));
    const stay = (reservation) => ({
      _id: reservation._id,
      guestName: guestNames.get(reservation.guestId) || "",
      roomNumber: roomNumbers.get(reservation.roomId) || "",
      hotelName: hotelNames.get(reservation.hotelId) || "",
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      status: reservation.status,
    });
    const scopedReservations = reservations.filter((reservation) => inHotel(reservation, hotelId));
    const accountType = new Map(accounts.map((account) => [account.code, account.type]));
    const monthLines = lines.filter((line) => inHotel(line, hotelId) && line.date >= from && line.date <= today);
    let monthlyRevenue = 0;
    let monthlyExpenses = 0;
    for (const line of monthLines) {
      const type = accountType.get(line.accountCode);
      if (type === "income") monthlyRevenue += line.credit - line.debit;
      if (type === "expense") monthlyExpenses += line.debit - line.credit;
    }
    const todayRevenue = payments
      .filter((payment) => inHotel(payment, hotelId) && payment.date === today)
      .reduce((sum, payment) => sum + (payment.type === "refund" ? -payment.amount : payment.amount), 0);
    const [invoices, invoiceItems] = await Promise.all([
      ctx.db.query("invoices").collect(),
      ctx.db.query("invoiceItems").collect(),
    ]);
    const yesterday = addDays(today, -1);
    const showRestaurant = ["super_admin", "hotel_manager", "accountant", "receptionist"].includes(user.role);
    const overnightGuests = scopedReservations
      .filter((row) => row.checkIn <= yesterday && row.checkOut > yesterday && ["checked_in", "checked_out"].includes(row.status))
      .map((reservation) => {
        const related = invoices.filter((invoice) => {
          if (invoice.status === "cancelled" || !inHotel(invoice, hotelId)) return false;
          if (invoice.reservationId) return invoice.reservationId === reservation._id;
          return invoice.guestId === reservation.guestId && invoice.date >= reservation.checkIn && invoice.date <= reservation.checkOut;
        });
        let restaurant = 0;
        let due = 0;
        for (const invoice of related) {
          const amount = invoiceItems
            .filter((item) => item.invoiceId === invoice._id && item.accountCode === "4100")
            .reduce((sum, item) => sum + item.amount, 0);
          if (!amount || invoice.total <= 0) continue;
          const balance = Math.max(0, invoice.total - invoice.paid);
          restaurant += amount;
          due += (amount * balance) / invoice.total;
        }
        return {
          ...stay(reservation),
          restaurant: showRestaurant ? roundMoney(restaurant) : 0,
          restaurantDue: showRestaurant ? roundMoney(due) : 0,
        };
      })
      .sort((a, b) => b.restaurantDue - a.restaurantDue || a.guestName.localeCompare(b.guestName));
    const restaurantDue = roundMoney(overnightGuests.reduce((sum, row) => sum + row.restaurantDue, 0));
    const receivables = invoices
      .filter((invoice) => inHotel(invoice, hotelId) && (invoice.status === "unpaid" || invoice.status === "partial"))
      .reduce((sum, invoice) => sum + (invoice.total - invoice.paid), 0);
    const payables = bills
      .filter((bill) => inHotel(bill, hotelId) && (bill.status === "unpaid" || bill.status === "partial"))
      .reduce((sum, bill) => sum + (bill.amount - bill.paid), 0);
    const months = lastMonthKeys(6);
    const monthlyChart = months.map((month) => {
      let revenue = 0;
      let expenses = 0;
      for (const line of lines) {
        if (!inHotel(line, hotelId) || !line.date.startsWith(month)) continue;
        const type = accountType.get(line.accountCode);
        if (type === "income") revenue += line.credit - line.debit;
        if (type === "expense") expenses += line.debit - line.credit;
      }
      return { month: month.slice(5), revenue: roundMoney(revenue), expenses: roundMoney(expenses) };
    });
    const hotelPerformance = visibleHotels.map((hotel) => {
      const hotelRooms = rooms.filter((room) => room.hotelId === hotel._id);
      const hotelOccupied = hotelRooms.filter((room) => room.status === "occupied").length;
      let revenue = 0;
      let expenses = 0;
      for (const line of monthLines) {
        if (line.hotelId !== hotel._id) continue;
        const type = accountType.get(line.accountCode);
        if (type === "income") revenue += line.credit - line.debit;
        if (type === "expense") expenses += line.debit - line.credit;
      }
      return {
        _id: hotel._id,
        name: hotel.name,
        city: hotel.city,
        revenue: roundMoney(revenue),
        expenses: roundMoney(expenses),
        profit: roundMoney(revenue - expenses),
        occupancy: hotelRooms.length ? Math.round((hotelOccupied / hotelRooms.length) * 100) : 0,
      };
    });
    return {
      showFinancials,
      hotels: visibleHotels.length,
      rooms: visibleRooms.length,
      occupied,
      available,
      cleaning: visibleRooms.filter((room) => room.status === "cleaning" || room.housekeepingStatus === "dirty").length,
      maintenance: visibleRooms.filter((room) => room.status === "maintenance").length,
      occupancy: visibleRooms.length ? Math.round((occupied / visibleRooms.length) * 100) : 0,
      todayCheckIns: scopedReservations.filter((row) => row.checkIn === today && ["pending", "confirmed", "checked_in"].includes(row.status)).map(stay),
      todayCheckOuts: scopedReservations.filter((row) => row.checkOut === today && row.status === "checked_in").map(stay),
      todayRevenue: showFinancials ? roundMoney(todayRevenue) : 0,
      monthlyRevenue: showFinancials ? roundMoney(monthlyRevenue) : 0,
      monthlyExpenses: showFinancials ? roundMoney(monthlyExpenses) : 0,
      profit: showFinancials ? roundMoney(monthlyRevenue - monthlyExpenses) : 0,
      receivables: showFinancials ? roundMoney(receivables) : 0,
      payables: showFinancials ? roundMoney(payables) : 0,
      monthlyChart: showFinancials ? monthlyChart : [],
      hotelPerformance: showFinancials ? hotelPerformance : hotelPerformance.map((hotel) => ({ ...hotel, revenue: 0, expenses: 0, profit: 0 })),
      overnightGuests,
      overnightCount: overnightGuests.length,
      restaurantDue,
    };
  },
});
