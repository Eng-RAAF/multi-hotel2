import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertRole, requireHotel, requireUser, resolveHotel, writeAudit } from "./lib/auth";
import { paymentAccount, postJournal, roundMoney } from "./lib/accounting";
import { createInvoice } from "./lib/billing";
import { addDays, todayISO } from "./lib/dates";

const FLOOR = ["super_admin", "hotel_manager", "restaurant_manager", "waiter", "receptionist"];
const KITCHEN = ["super_admin", "hotel_manager", "restaurant_manager", "kitchen"];
const MANAGE = ["super_admin", "hotel_manager", "restaurant_manager"];
const REPORT = ["super_admin", "hotel_manager", "restaurant_manager", "accountant"];
const ORDER_ROLES = [...new Set([...FLOOR, ...KITCHEN])];
const NEXT = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: ["completed"],
};

function scoped(rows, hotelId) {
  return hotelId ? rows.filter((row) => row.hotelId === hotelId) : rows;
}

async function hotelRows(ctx, table, index, hotelId) {
  if (hotelId) return await ctx.db.query(table).withIndex(index, (q) => q.eq("hotelId", hotelId)).collect();
  return await ctx.db.query(table).collect();
}

export const listMenu = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ORDER_ROLES);
    const hotelId = resolveHotel(user, args.hotelId);
    const categories = await hotelRows(ctx, "menuCategories", "by_hotel", hotelId);
    const items = await hotelRows(ctx, "menuItems", "by_hotel", hotelId);
    return {
      categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const bootstrap = mutation({
  args: { token: v.string(), hotelId: v.id("hotels") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ORDER_ROLES);
    const hotelId = requireHotel(user, args.hotelId);
    const existing = await ctx.db.query("menuCategories").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect();
    if (existing.length) return { created: false };
    const rice = await ctx.db.insert("menuCategories", { hotelId, name: "Rice dishes" });
    const drinks = await ctx.db.insert("menuCategories", { hotelId, name: "Drinks" });
    const grill = await ctx.db.insert("menuCategories", { hotelId, name: "Grill" });
    const menu = [
      [rice, "Chicken & Rice", "Spiced chicken with rice", 6],
      [rice, "Goat & Rice", "Slow-cooked goat with rice", 8],
      [grill, "Grilled fish", "Fish with lime and salad", 7],
      [drinks, "Juice", "Fresh fruit juice", 2],
      [drinks, "Water", "Bottled water", 1],
    ];
    for (const [categoryId, name, description, price] of menu) {
      await ctx.db.insert("menuItems", { hotelId, categoryId, name, description, price, available: true, imageUrl: "" });
    }
    for (let number = 1; number <= 6; number += 1) {
      await ctx.db.insert("restaurantTables", { hotelId, number: String(number), seats: number <= 2 ? 2 : 4, status: "available" });
    }
    const stock = [
      ["Rice", "kg", 40, 10],
      ["Chicken", "kg", 15, 5],
      ["Meat", "kg", 12, 4],
      ["Oil", "litre", 10, 3],
      ["Vegetables", "kg", 8, 3],
      ["Drinks", "bottle", 48, 12],
      ["Water", "bottle", 60, 12],
    ];
    for (const [name, unit, quantity, reorderLevel] of stock) {
      await ctx.db.insert("restaurantInventory", { hotelId, name, unit, quantity, reorderLevel });
    }
    return { created: true };
  },
});

export const saveCategory = mutation({
  args: { token: v.string(), hotelId: v.id("hotels"), categoryId: v.optional(v.id("menuCategories")), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Category name is required");
    if (args.categoryId) {
      await ctx.db.patch(args.categoryId, { name });
      return args.categoryId;
    }
    return await ctx.db.insert("menuCategories", { hotelId, name });
  },
});

export const removeCategory = mutation({
  args: { token: v.string(), categoryId: v.id("menuCategories") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new ConvexError("Category not found");
    requireHotel(user, category.hotelId);
    const items = await ctx.db.query("menuItems").withIndex("by_category", (q) => q.eq("categoryId", category._id)).collect();
    if (items.length) throw new ConvexError("Move or delete the dishes in this category first");
    await ctx.db.delete(category._id);
  },
});

export const saveItem = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    itemId: v.optional(v.id("menuItems")),
    categoryId: v.id("menuCategories"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    available: v.boolean(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Dish name is required");
    if (args.price < 0) throw new ConvexError("Price cannot be negative");
    const payload = {
      hotelId,
      categoryId: args.categoryId,
      name,
      description: args.description.trim(),
      price: roundMoney(args.price),
      available: args.available,
      imageUrl: args.imageUrl.trim(),
    };
    if (args.itemId) {
      await ctx.db.patch(args.itemId, payload);
      return args.itemId;
    }
    return await ctx.db.insert("menuItems", payload);
  },
});

export const removeItem = mutation({
  args: { token: v.string(), itemId: v.id("menuItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("Dish not found");
    requireHotel(user, item.hotelId);
    const lines = await ctx.db.query("restaurantOrderItems").collect();
    if (lines.some((line) => line.menuItemId === item._id)) {
      await ctx.db.patch(item._id, { available: false });
      return "hidden";
    }
    await ctx.db.delete(item._id);
    return "deleted";
  },
});

export const listTables = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FLOOR);
    const hotelId = resolveHotel(user, args.hotelId);
    const tables = await hotelRows(ctx, "restaurantTables", "by_hotel", hotelId);
    return tables.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  },
});

export const saveTable = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    tableId: v.optional(v.id("restaurantTables")),
    number: v.string(),
    seats: v.number(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, [...MANAGE, "waiter"]);
    const hotelId = requireHotel(user, args.hotelId);
    const number = args.number.trim();
    if (!number) throw new ConvexError("Table number is required");
    const status = ["available", "occupied", "reserved", "cleaning"].includes(args.status) ? args.status : "available";
    const payload = { hotelId, number, seats: Number(args.seats || 2), status };
    if (args.tableId) {
      await ctx.db.patch(args.tableId, payload);
      return args.tableId;
    }
    return await ctx.db.insert("restaurantTables", payload);
  },
});

export const listOrders = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")), kitchen: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, ORDER_ROLES);
    const hotelId = resolveHotel(user, args.hotelId);
    let orders = await hotelRows(ctx, "restaurantOrders", "by_hotel", hotelId);
    if (args.kitchen) orders = orders.filter((order) => ["pending", "preparing", "ready"].includes(order.status));
    const items = await ctx.db.query("restaurantOrderItems").collect();
    const tables = await ctx.db.query("restaurantTables").collect();
    const rooms = await ctx.db.query("rooms").collect();
    const guests = await ctx.db.query("guests").collect();
    const tableName = new Map(tables.map((table) => [table._id, table.number]));
    const roomName = new Map(rooms.map((room) => [room._id, room.number]));
    const guestName = new Map(guests.map((guest) => [guest._id, guest.fullName]));
    return orders
      .map((order) => ({
        ...order,
        items: items.filter((item) => item.orderId === order._id),
        tableNumber: order.tableId ? tableName.get(order.tableId) || "" : "",
        roomNumber: order.roomId ? roomName.get(order.roomId) || "" : "",
        guestName: order.guestId ? guestName.get(order.guestId) || "" : "",
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const inHouse = query({
  args: { token: v.string(), hotelId: v.id("hotels") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FLOOR);
    const hotelId = requireHotel(user, args.hotelId);
    const stays = await ctx.db.query("reservations").withIndex("by_hotel", (q) => q.eq("hotelId", hotelId)).collect();
    const guests = await ctx.db.query("guests").collect();
    const rooms = await ctx.db.query("rooms").collect();
    const guestName = new Map(guests.map((guest) => [guest._id, guest.fullName]));
    const roomName = new Map(rooms.map((room) => [room._id, room.number]));
    return stays
      .filter((stay) => stay.status === "checked_in")
      .map((stay) => ({
        _id: stay._id,
        guestId: stay.guestId,
        roomId: stay.roomId,
        guestName: guestName.get(stay.guestId) || "",
        roomNumber: roomName.get(stay.roomId) || "",
      }));
  },
});

export const createOrder = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    type: v.string(),
    tableId: v.optional(v.id("restaurantTables")),
    reservationId: v.optional(v.id("reservations")),
    notes: v.string(),
    items: v.array(v.object({
      menuItemId: v.id("menuItems"),
      quantity: v.number(),
      notes: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, FLOOR);
    const hotelId = requireHotel(user, args.hotelId);
    if (!["dine_in", "takeaway", "room"].includes(args.type)) throw new ConvexError("Choose dine-in, takeaway, or room");
    if (!args.items.length) throw new ConvexError("Add at least one dish");
    let tableId;
    let reservationId;
    let guestId;
    let roomId;
    if (args.type === "dine_in") {
      if (!args.tableId) throw new ConvexError("Choose a table");
      const table = await ctx.db.get(args.tableId);
      if (!table || table.hotelId !== hotelId) throw new ConvexError("Table not found");
      if (table.status === "occupied") throw new ConvexError("That table is occupied");
      tableId = table._id;
      await ctx.db.patch(table._id, { status: "occupied" });
    }
    if (args.type === "room") {
      if (!args.reservationId) throw new ConvexError("Choose the guest room");
      const stay = await ctx.db.get(args.reservationId);
      if (!stay || stay.hotelId !== hotelId || stay.status !== "checked_in") throw new ConvexError("That guest is not checked in");
      reservationId = stay._id;
      guestId = stay.guestId;
      roomId = stay.roomId;
    }
    const lines = [];
    for (const line of args.items) {
      const item = await ctx.db.get(line.menuItemId);
      if (!item || item.hotelId !== hotelId || !item.available) throw new ConvexError("A selected dish is not available");
      const quantity = Number(line.quantity);
      if (quantity <= 0) throw new ConvexError("Quantity must be at least 1");
      lines.push({
        menuItemId: item._id,
        name: item.name,
        quantity,
        unitPrice: item.price,
        amount: roundMoney(item.price * quantity),
        notes: line.notes.trim(),
      });
    }
    const count = (await ctx.db.query("restaurantOrders").collect()).length;
    const orderId = await ctx.db.insert("restaurantOrders", {
      hotelId,
      number: `R-${1000 + count + 1}`,
      type: args.type,
      status: "pending",
      notes: args.notes.trim(),
      subtotal: roundMoney(lines.reduce((sum, line) => sum + line.amount, 0)),
      postedToBill: false,
      createdBy: user._id,
      createdAt: Date.now(),
      ...(tableId ? { tableId } : {}),
      ...(reservationId ? { reservationId } : {}),
      ...(guestId ? { guestId } : {}),
      ...(roomId ? { roomId } : {}),
    });
    for (const line of lines) await ctx.db.insert("restaurantOrderItems", { orderId, ...line });
    await writeAudit(ctx, { user, action: "create", entity: "restaurant_order", entityId: orderId, hotelId, details: args.type });
    return orderId;
  },
});

async function finishOrder(ctx, order, user) {
  if (order.postedToBill) return order.invoiceId;
  const hotel = await ctx.db.get(order.hotelId);
  const lines = await ctx.db.query("restaurantOrderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
  let billTo = "Restaurant";
  if (order.type === "dine_in" && order.tableId) {
    const table = await ctx.db.get(order.tableId);
    billTo = `Table ${table?.number || ""}`;
  }
  if (order.type === "takeaway") billTo = "Takeaway";
  if (order.guestId) {
    const guest = await ctx.db.get(order.guestId);
    billTo = guest?.fullName || billTo;
  }
  const invoice = await createInvoice(ctx, {
    hotel,
    guestId: order.guestId,
    reservationId: order.reservationId,
    items: lines.map((line) => ({
      description: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      accountCode: "4100",
    })),
    date: todayISO(),
    notes: order.notes || `Restaurant ${order.number}`,
    user,
    billTo,
    taxRate: 0,
    serviceRate: 0,
    paymentAmount: order.type === "room" ? 0 : order.subtotal,
    method: "cash",
  });
  await ctx.db.patch(order._id, { postedToBill: true, invoiceId: invoice._id });
  if (order.tableId) await ctx.db.patch(order.tableId, { status: "available" });
  return invoice._id;
}

export const setOrderStatus = mutation({
  args: { token: v.string(), orderId: v.id("restaurantOrders"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found");
    requireHotel(user, order.hotelId);
    if (args.status === "ready") assertRole(user, KITCHEN);
    else if (args.status === "preparing") assertRole(user, [...KITCHEN, ...FLOOR]);
    else assertRole(user, FLOOR);
    const allowed = NEXT[order.status] || [];
    if (!allowed.includes(args.status)) throw new ConvexError("That status change is not allowed");
    if (args.status === "completed") await finishOrder(ctx, order, user);
    await ctx.db.patch(order._id, { status: args.status });
    if (args.status === "cancelled" && order.tableId) await ctx.db.patch(order.tableId, { status: "available" });
    await writeAudit(ctx, { user, action: args.status, entity: "restaurant_order", entityId: order._id, hotelId: order.hotelId, details: order.number });
    return order._id;
  },
});

export const listInventory = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, [...MANAGE, "kitchen"]);
    const hotelId = resolveHotel(user, args.hotelId);
    const items = await hotelRows(ctx, "restaurantInventory", "by_hotel", hotelId);
    return items
      .map((item) => ({ ...item, low: item.quantity <= item.reorderLevel }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveStockItem = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    itemId: v.optional(v.id("restaurantInventory")),
    name: v.string(),
    unit: v.string(),
    quantity: v.number(),
    reorderLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Item name is required");
    const payload = { hotelId, name, unit: args.unit.trim() || "unit", quantity: Number(args.quantity || 0), reorderLevel: Number(args.reorderLevel || 0) };
    if (args.itemId) {
      await ctx.db.patch(args.itemId, payload);
      return args.itemId;
    }
    return await ctx.db.insert("restaurantInventory", payload);
  },
});

export const moveStock = mutation({
  args: {
    token: v.string(),
    itemId: v.id("restaurantInventory"),
    type: v.string(),
    quantity: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, [...MANAGE, "kitchen"]);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("Stock item not found");
    requireHotel(user, item.hotelId);
    if (!["received", "used", "wasted"].includes(args.type)) throw new ConvexError("Choose received, used, or wasted");
    const quantity = Number(args.quantity);
    if (quantity <= 0) throw new ConvexError("Quantity must be greater than zero");
    const next = args.type === "received" ? item.quantity + quantity : item.quantity - quantity;
    if (next < -0.001) throw new ConvexError("Not enough stock");
    await ctx.db.patch(item._id, { quantity: roundMoney(Math.max(0, next)) });
    await ctx.db.insert("restaurantStockMoves", {
      hotelId: item.hotelId,
      itemId: item._id,
      type: args.type,
      quantity,
      date: todayISO(),
      notes: args.notes.trim(),
      userId: user._id,
      createdAt: Date.now(),
    });
  },
});

export const listSuppliers = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = resolveHotel(user, args.hotelId);
    const suppliers = await hotelRows(ctx, "restaurantSuppliers", "by_hotel", hotelId);
    const purchases = scoped(await ctx.db.query("restaurantPurchases").collect(), hotelId);
    return suppliers
      .map((supplier) => ({
        ...supplier,
        purchases: purchases.filter((purchase) => purchase.supplierId === supplier._id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const saveSupplier = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    supplierId: v.optional(v.id("restaurantSuppliers")),
    name: v.string(),
    phone: v.string(),
    address: v.string(),
    products: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = requireHotel(user, args.hotelId);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Supplier name is required");
    const payload = { hotelId, name, phone: args.phone.trim(), address: args.address.trim(), products: args.products.trim() };
    if (args.supplierId) {
      await ctx.db.patch(args.supplierId, payload);
      return args.supplierId;
    }
    return await ctx.db.insert("restaurantSuppliers", payload);
  },
});

export const listPurchases = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = resolveHotel(user, args.hotelId);
    const purchases = await hotelRows(ctx, "restaurantPurchases", "by_hotel", hotelId);
    const suppliers = await ctx.db.query("restaurantSuppliers").collect();
    const names = new Map(suppliers.map((supplier) => [supplier._id, supplier.name]));
    return purchases
      .map((purchase) => ({ ...purchase, supplierName: names.get(purchase.supplierId) || "" }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

async function bookRestaurantExpense(ctx, { hotelId, date, category, accountCode, amount, method, description, user }) {
  const id = await ctx.db.insert("restaurantExpenses", {
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
  await ctx.db.insert("expenses", {
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
    reference: `REX-${String(id).slice(-6)}`,
    source: "restaurant_expense",
    sourceId: id,
    userId: user._id,
    lines: [
      { accountCode, debit: amount, credit: 0 },
      { accountCode: paymentAccount(method), debit: 0, credit: amount },
    ],
  });
  return id;
}

export const savePurchase = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    supplierId: v.id("restaurantSuppliers"),
    itemId: v.optional(v.id("restaurantInventory")),
    date: v.string(),
    description: v.string(),
    quantity: v.number(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = requireHotel(user, args.hotelId);
    const amount = roundMoney(args.amount);
    if (amount <= 0) throw new ConvexError("Enter the purchase amount");
    const purchase = {
      hotelId,
      supplierId: args.supplierId,
      date: args.date || todayISO(),
      description: args.description.trim() || "Food purchase",
      quantity: Number(args.quantity || 0),
      amount,
      createdBy: user._id,
      createdAt: Date.now(),
    };
    if (args.itemId) purchase.itemId = args.itemId;
    const id = await ctx.db.insert("restaurantPurchases", purchase);
    if (args.itemId && args.quantity > 0) {
      const item = await ctx.db.get(args.itemId);
      if (item) {
        await ctx.db.patch(item._id, { quantity: roundMoney(item.quantity + Number(args.quantity)) });
        await ctx.db.insert("restaurantStockMoves", {
          hotelId,
          itemId: item._id,
          type: "received",
          quantity: Number(args.quantity),
          date: purchase.date,
          notes: purchase.description,
          userId: user._id,
          createdAt: Date.now(),
        });
      }
    }
    await bookRestaurantExpense(ctx, {
      hotelId,
      date: purchase.date,
      category: "Food purchases",
      accountCode: "5200",
      amount,
      method: "cash",
      description: purchase.description,
      user,
    });
    return id;
  },
});

export const listExpenses = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, REPORT);
    const hotelId = resolveHotel(user, args.hotelId);
    const rows = await hotelRows(ctx, "restaurantExpenses", "by_hotel", hotelId);
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const saveExpense = mutation({
  args: {
    token: v.string(),
    hotelId: v.id("hotels"),
    date: v.string(),
    category: v.string(),
    accountCode: v.string(),
    amount: v.number(),
    method: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, MANAGE);
    const hotelId = requireHotel(user, args.hotelId);
    const amount = roundMoney(args.amount);
    if (amount <= 0) throw new ConvexError("Enter an expense amount");
    return await bookRestaurantExpense(ctx, {
      hotelId,
      date: args.date || todayISO(),
      category: args.category.trim() || "Other",
      accountCode: args.accountCode || "5900",
      amount,
      method: args.method || "cash",
      description: args.description.trim() || args.category,
      user,
    });
  },
});

export const report = query({
  args: { token: v.string(), hotelId: v.optional(v.id("hotels")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    assertRole(user, REPORT);
    const hotelId = resolveHotel(user, args.hotelId);
    const today = todayISO();
    const week = addDays(today, -6);
    const month = today.slice(0, 7);
    const orders = (await hotelRows(ctx, "restaurantOrders", "by_hotel", hotelId)).filter((order) => order.status === "completed");
    const items = await ctx.db.query("restaurantOrderItems").collect();
    const expenses = await hotelRows(ctx, "restaurantExpenses", "by_hotel", hotelId);
    const inventory = await hotelRows(ctx, "restaurantInventory", "by_hotel", hotelId);
    const purchases = await hotelRows(ctx, "restaurantPurchases", "by_hotel", hotelId);
    const sumOrders = (rows) => roundMoney(rows.reduce((sum, order) => sum + order.subtotal, 0));
    const createdOn = (order, from, prefix) => {
      const date = new Date(order.createdAt).toISOString().slice(0, 10);
      if (prefix) return date.startsWith(prefix);
      return date >= from && date <= today;
    };
    const sold = new Map();
    for (const order of orders) {
      for (const line of items.filter((item) => item.orderId === order._id)) {
        const current = sold.get(line.name) || { name: line.name, quantity: 0, amount: 0 };
        current.quantity += line.quantity;
        current.amount = roundMoney(current.amount + line.amount);
        sold.set(line.name, current);
      }
    }
    const daily = sumOrders(orders.filter((order) => createdOn(order, today)));
    const weekly = sumOrders(orders.filter((order) => createdOn(order, week)));
    const monthly = sumOrders(orders.filter((order) => createdOn(order, null, month)));
    const monthExpenses = roundMoney(expenses.filter((row) => row.date.startsWith(month)).reduce((sum, row) => sum + row.amount, 0));
    return {
      todayOrders: orders.filter((order) => createdOn(order, today)).length,
      daily,
      weekly,
      monthly,
      monthExpenses,
      profit: roundMoney(monthly - monthExpenses),
      best: [...sold.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
      inventory: inventory.map((item) => ({ ...item, low: item.quantity <= item.reorderLevel })),
      purchases: purchases.length,
      purchaseTotal: roundMoney(purchases.filter((row) => row.date.startsWith(month)).reduce((sum, row) => sum + row.amount, 0)),
    };
  },
});
