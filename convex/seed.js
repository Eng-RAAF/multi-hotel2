import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { DEFAULT_ACCOUNTS, postJournal, roundMoney } from "./lib/accounting";
import { createInvoice, recordPayment } from "./lib/billing";
import { addDays, monthStart, shiftMonth, todayISO } from "./lib/dates";

const HOTELS = [
  { name: "Hotel Jazeera", city: "Mogadishu", address: "Maka Al-Mukarama Road", phone: "+252 61 500 1001", email: "jazeera@mhmas.so" },
  { name: "Garowe Grand Hotel", city: "Garowe", address: "Garowe City Center", phone: "+252 90 700 2002", email: "garowe@mhmas.so" },
  { name: "Bosaso Palace Hotel", city: "Bosaso", address: "Bosaso Port Road", phone: "+252 90 600 3003", email: "bosaso@mhmas.so" },
  { name: "Hargeisa Crown Hotel", city: "Hargeisa", address: "Independence Avenue", phone: "+252 63 400 4004", email: "hargeisa@mhmas.so" },
  { name: "Kismayo Beach Hotel", city: "Kismayo", address: "Lido Beach Road", phone: "+252 61 800 5005", email: "kismayo@mhmas.so" },
];

const USERS = [
  { name: "Amina Yusuf", email: "admin@mhmas.so", role: "super_admin" },
  { name: "Hassan Ali", email: "manager@mhmas.so", role: "hotel_manager", hotelIndex: 0 },
  { name: "Hodan Mohamed", email: "reception@mhmas.so", role: "receptionist", hotelIndex: 0 },
  { name: "Fadumo Warsame", email: "house@mhmas.so", role: "housekeeping", hotelIndex: 0 },
  { name: "Abdi Nur", email: "accountant@mhmas.so", role: "accountant" },
  { name: "Sahra Omar", email: "hr@mhmas.so", role: "hr_admin" },
];

const GUESTS = [
  ["Ayaan Ali", "Somali"],
  ["Mohamed Abdi", "Somali"],
  ["Fatima Hassan", "Somali"],
  ["Omar Yusuf", "Kenyan"],
  ["Hodan Jama", "Somali"],
  ["John Smith", "British"],
];

const TYPES = [
  { name: "Single", price: 25, capacity: 1 },
  { name: "Double", price: 40, capacity: 2 },
  { name: "Suite", price: 70, capacity: 3 },
  { name: "Deluxe", price: 55, capacity: 2 },
];

const ROOM_NUMBERS = ["101", "102", "103", "104", "201", "202", "203", "204"];
const PRESETS = [
  { status: "occupied", housekeepingStatus: "clean" },
  { status: "occupied", housekeepingStatus: "clean" },
  { status: "cleaning", housekeepingStatus: "dirty" },
  { status: "maintenance", housekeepingStatus: "dirty" },
  { status: "reserved", housekeepingStatus: "clean" },
  { status: "reserved", housekeepingStatus: "clean" },
  { status: "available", housekeepingStatus: "clean" },
  { status: "available", housekeepingStatus: "inspected" },
];

async function bookIncome(ctx, { hotelId, date, accountCode, amount, description, method, user, category }) {
  const id = await ctx.db.insert("incomeRecords", {
    hotelId,
    date,
    category,
    accountCode,
    amount,
    method,
    description,
    userId: user._id,
    createdAt: Date.now(),
  });
  await postJournal(ctx, {
    hotelId,
    date,
    description,
    reference: `INC-${String(id).slice(-6)}`,
    source: "income",
    sourceId: id,
    userId: user._id,
    lines: [
      { accountCode: method === "bank" ? "1010" : method === "mobile_money" ? "1020" : "1000", debit: amount, credit: 0 },
      { accountCode, debit: 0, credit: amount },
    ],
  });
}

async function bookExpense(ctx, { hotelId, date, accountCode, amount, description, method, user, category }) {
  const id = await ctx.db.insert("expenses", {
    hotelId,
    date,
    category,
    accountCode,
    amount,
    method,
    description,
    userId: user._id,
    createdAt: Date.now(),
  });
  await postJournal(ctx, {
    hotelId,
    date,
    description,
    reference: `EXP-${String(id).slice(-6)}`,
    source: "expense",
    sourceId: id,
    userId: user._id,
    lines: [
      { accountCode, debit: amount, credit: 0 },
      { accountCode: method === "bank" ? "1010" : "1000", debit: 0, credit: amount },
    ],
  });
}

export const run = internalMutation({
  args: { hashes: v.array(v.object({ email: v.string(), hash: v.string() })) },
  handler: async (ctx, args) => {
    if (await ctx.db.query("users").first()) return { already: true };
    const today = todayISO();
    const hashMap = new Map(args.hashes.map((row) => [row.email, row.hash]));

    await ctx.db.insert("settings", {
      key: "company",
      companyName: "Somali Hotels Group",
      currency: "USD",
      taxRate: 5,
      serviceCharge: 5,
    });
    for (const account of DEFAULT_ACCOUNTS) {
      await ctx.db.insert("accounts", { ...account, active: true, description: "" });
    }

    const hotelIds = [];
    for (const hotel of HOTELS) {
      hotelIds.push(await ctx.db.insert("hotels", {
        ...hotel,
        currency: "USD",
        taxRate: 5,
        serviceCharge: 5,
        status: "active",
        notes: "",
        createdAt: Date.now(),
      }));
    }

    let adminId = null;
    for (const spec of USERS) {
      const passwordHash = hashMap.get(spec.email);
      if (!passwordHash) throw new ConvexError(`Missing password hash for ${spec.email}`);
      const row = {
        name: spec.name,
        email: spec.email,
        passwordHash,
        role: spec.role,
        active: true,
        createdAt: Date.now(),
      };
      if (spec.hotelIndex !== undefined) row.hotelId = hotelIds[spec.hotelIndex];
      const userId = await ctx.db.insert("users", row);
      if (spec.role === "super_admin") adminId = userId;
    }
    const admin = await ctx.db.get(adminId);

    for (let h = 0; h < hotelIds.length; h += 1) {
      const hotelId = hotelIds[h];
      const hotel = await ctx.db.get(hotelId);
      const scale = [1, 0.7, 0.58, 0.52, 0.44][h];
      for (const type of TYPES) {
        await ctx.db.insert("roomTypes", { hotelId, ...type });
      }
      const roomIds = [];
      for (let r = 0; r < ROOM_NUMBERS.length; r += 1) {
        const type = TYPES[r % TYPES.length];
        roomIds.push(await ctx.db.insert("rooms", {
          hotelId,
          number: ROOM_NUMBERS[r],
          typeName: type.name,
          price: type.price,
          capacity: type.capacity,
          floor: r < 4 ? "1" : "2",
          status: PRESETS[r].status,
          housekeepingStatus: PRESETS[r].housekeepingStatus,
          notes: PRESETS[r].status === "maintenance" ? "Air conditioning repair" : "",
        }));
      }
      const guestIds = [];
      for (let g = 0; g < GUESTS.length; g += 1) {
        guestIds.push(await ctx.db.insert("guests", {
          hotelId,
          fullName: GUESTS[g][0],
          phone: `+252 61 ${h}${g}22 10${g}${h}`,
          email: `${GUESTS[g][0].split(" ")[0].toLowerCase()}${h}@guest.so`,
          address: HOTELS[h].city,
          idType: g % 2 === 0 ? "passport" : "national_id",
          idNumber: `P${h}${g}4821${g}`,
          nationality: GUESTS[g][1],
          notes: "",
          createdAt: Date.now(),
        }));
      }

      await ctx.db.insert("customers", {
        hotelId,
        name: h % 2 === 0 ? "Horn of Africa Tours" : "Dahabshiil Travel",
        kind: "travel_agency",
        phone: `+252 61 700 30${h}0`,
        email: `agency${h}@travel.so`,
        address: HOTELS[h].city,
        notes: "",
        createdAt: Date.now(),
      });
      const foodSupplier = await ctx.db.insert("suppliers", {
        hotelId,
        name: `${HOTELS[h].city} Fresh Foods`,
        category: "Food supplier",
        phone: `+252 61 300 40${h}0`,
        email: `food${h}@supplier.so`,
        address: HOTELS[h].city,
        notes: "",
        createdAt: Date.now(),
      });
      await ctx.db.insert("suppliers", {
        hotelId,
        name: "Somali Power & Water",
        category: "Utility provider",
        phone: "+252 61 100 0001",
        email: `utilities${h}@supplier.so`,
        address: HOTELS[h].city,
        notes: "",
        createdAt: Date.now(),
      });

      const staff = [
        ["Hotel Manager", 900],
        ["Receptionist", 450],
        ["Housekeeper", 300],
      ];
      const employeeIds = [];
      for (let s = 0; s < staff.length; s += 1) {
        employeeIds.push(await ctx.db.insert("employees", {
          hotelId,
          name: ["Hassan Ali", "Hodan Mohamed", "Fadumo Warsame", "Nimco Farah", "Abdirahman Ali", "Khadija Omar"][(h + s) % 6],
          position: staff[s][0],
          phone: `+252 61 900 ${h}${s}21`,
          email: `staff${h}${s}@mhmas.so`,
          salary: staff[s][1],
          status: "active",
          hireDate: "2024-03-01",
          nationalId: `NID-${h}${s}2291`,
        }));
      }
      if (h === 0) {
        for (const employeeId of employeeIds) {
          await ctx.db.insert("attendance", { employeeId, hotelId, date: today, status: "present", notes: "" });
        }
      }

      const stays = [
        { room: 0, guest: 0, checkIn: addDays(today, -1), checkOut: addDays(today, 2), status: "checked_in" },
        { room: 1, guest: 1, checkIn: addDays(today, -2), checkOut: today, status: "checked_in" },
        { room: 4, guest: 2, checkIn: addDays(today, 1), checkOut: addDays(today, 4), status: "confirmed" },
        { room: 5, guest: 3, checkIn: today, checkOut: addDays(today, 3), status: "confirmed" },
      ];
      for (const stay of stays) {
        const room = await ctx.db.get(roomIds[stay.room]);
        const nights = Math.max(1, Math.round((new Date(stay.checkOut) - new Date(stay.checkIn)) / 86400000));
        const reservation = {
          hotelId,
          guestId: guestIds[stay.guest],
          roomId: room._id,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          status: stay.status,
          adults: 2,
          children: 0,
          nightlyRate: room.price,
          nights,
          total: roundMoney(room.price * nights),
          notes: "",
          createdBy: admin._id,
          createdAt: Date.now(),
        };
        if (stay.status === "checked_in") reservation.checkedInAt = Date.now();
        await ctx.db.insert("reservations", reservation);
      }

      let roomRevenue = 0;
      const methods = ["cash", "mobile_money", "bank", "card"];
      for (let i = 0; i < 4; i += 1) {
        const checkOut = addDays(today, -(i + 1));
        const checkIn = addDays(checkOut, -3);
        const room = await ctx.db.get(roomIds[6 + (i % 2)]);
        const guest = await ctx.db.get(guestIds[i % guestIds.length]);
        const nights = 3;
        const reservationId = await ctx.db.insert("reservations", {
          hotelId,
          guestId: guest._id,
          roomId: room._id,
          checkIn,
          checkOut,
          status: "checked_out",
          adults: 1,
          children: 0,
          nightlyRate: room.price,
          nights,
          total: roundMoney(room.price * nights),
          notes: "",
          createdBy: admin._id,
          createdAt: Date.now(),
          checkedOutAt: Date.now(),
        });
        const invoice = await createInvoice(ctx, {
          hotel,
          guestId: guest._id,
          reservationId,
          items: [{
            description: `Room ${room.number} · ${room.typeName} · ${nights} nights`,
            quantity: nights,
            unitPrice: room.price,
            accountCode: "4000",
          }],
          date: checkOut,
          user: admin,
          billTo: guest.fullName,
          paymentAmount: 0,
        });
        roomRevenue += invoice.subtotal;
        const mode = i % 5;
        if (mode === 0) continue;
        const amount = mode === 1 ? roundMoney(invoice.total * 0.5) : invoice.total;
        await recordPayment(ctx, {
          invoice,
          amount,
          method: methods[i % methods.length],
          date: checkOut,
          reference: `RCT-${h}${i}${checkOut.replace(/-/g, "").slice(4)}`,
          user: admin,
          type: "payment",
        });
      }

      const target = Math.round(8200 * scale);
      const remainder = roundMoney(Math.max(0, target - roomRevenue));
      if (remainder > 0) {
        await bookIncome(ctx, {
          hotelId,
          date: addDays(monthStart(today), 1),
          accountCode: "4000",
          amount: remainder,
          description: "Front office room sales summary",
          method: "cash",
          user: admin,
          category: "Room revenue",
        });
      }
      await bookIncome(ctx, {
        hotelId,
        date: addDays(today, -2),
        accountCode: "4100",
        amount: Math.round(900 * scale),
        description: "Restaurant sales",
        method: "cash",
        user: admin,
        category: "Restaurant revenue",
      });
      await bookIncome(ctx, {
        hotelId,
        date: addDays(today, -1),
        accountCode: "4300",
        amount: Math.round(220 * scale),
        description: "Laundry services",
        method: "mobile_money",
        user: admin,
        category: "Laundry revenue",
      });
      await bookExpense(ctx, {
        hotelId,
        date: addDays(monthStart(today), 1),
        accountCode: "5000",
        amount: Math.round(2100 * scale),
        description: "Monthly salaries",
        method: "bank",
        user: admin,
        category: "Salaries",
      });
      await bookExpense(ctx, {
        hotelId,
        date: addDays(today, -3),
        accountCode: "5100",
        amount: Math.round(380 * scale),
        description: "Electricity bill",
        method: "mobile_money",
        user: admin,
        category: "Electricity",
      });
      await bookExpense(ctx, {
        hotelId,
        date: addDays(today, -3),
        accountCode: "5110",
        amount: Math.round(140 * scale),
        description: "Water bill",
        method: "cash",
        user: admin,
        category: "Water",
      });

      for (let m = 1; m <= 4; m += 1) {
        const date = addDays(shiftMonth(monthStart(today), -m), 12);
        await bookIncome(ctx, {
          hotelId,
          date,
          accountCode: "4000",
          amount: Math.round(8200 * scale),
          description: "Room sales summary",
          method: "bank",
          user: admin,
          category: "Room revenue",
        });
        await bookIncome(ctx, {
          hotelId,
          date,
          accountCode: "4100",
          amount: Math.round(1200 * scale),
          description: "Restaurant sales summary",
          method: "cash",
          user: admin,
          category: "Restaurant revenue",
        });
        await bookExpense(ctx, {
          hotelId,
          date,
          accountCode: "5000",
          amount: Math.round(2100 * scale),
          description: "Monthly salaries",
          method: "bank",
          user: admin,
          category: "Salaries",
        });
        await bookExpense(ctx, {
          hotelId,
          date,
          accountCode: "5100",
          amount: Math.round(640 * scale),
          description: "Utilities",
          method: "mobile_money",
          user: admin,
          category: "Electricity",
        });
      }

      const billAmount = Math.round(640 * scale);
      const billId = await ctx.db.insert("bills", {
        hotelId,
        supplierId: foodSupplier,
        number: `BILL-${1001 + h}`,
        date: addDays(today, -5),
        dueDate: addDays(today, 10),
        description: "Food and beverage supplies",
        accountCode: "5200",
        amount: billAmount,
        paid: 0,
        status: "unpaid",
        createdBy: admin._id,
        createdAt: Date.now(),
      });
      await postJournal(ctx, {
        hotelId,
        date: addDays(today, -5),
        description: `Bill BILL-${1001 + h} — food supplies`,
        reference: `BILL-${1001 + h}`,
        source: "bill",
        sourceId: billId,
        userId: admin._id,
        lines: [
          { accountCode: "5200", debit: billAmount, credit: 0 },
          { accountCode: "2000", debit: 0, credit: billAmount },
        ],
      });
    }

    const lines = await ctx.db.query("journalLines").collect();
    const debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
    if (Math.abs(debit - credit) > 0.05) throw new ConvexError(`Unbalanced demo books: ${debit} vs ${credit}`);

    await ctx.db.insert("auditLogs", {
      userId: admin._id,
      userName: admin.name,
      action: "seed",
      entity: "system",
      entityId: "",
      details: "Loaded demo hotels for Somalia",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
