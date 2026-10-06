import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.string(),
    hotelId: v.optional(v.id("hotels")),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  settings: defineTable({
    key: v.string(),
    companyName: v.string(),
    currency: v.string(),
    taxRate: v.number(),
    serviceCharge: v.number(),
  }).index("by_key", ["key"]),

  hotels: defineTable({
    name: v.string(),
    city: v.string(),
    address: v.string(),
    phone: v.string(),
    email: v.string(),
    currency: v.string(),
    taxRate: v.number(),
    serviceCharge: v.number(),
    status: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_city", ["city"]),

  roomTypes: defineTable({
    hotelId: v.id("hotels"),
    name: v.string(),
    price: v.number(),
    capacity: v.number(),
  }).index("by_hotel", ["hotelId"]),

  rooms: defineTable({
    hotelId: v.id("hotels"),
    number: v.string(),
    typeName: v.string(),
    price: v.number(),
    capacity: v.number(),
    floor: v.string(),
    status: v.string(),
    housekeepingStatus: v.string(),
    notes: v.optional(v.string()),
  }).index("by_hotel", ["hotelId"]),

  guests: defineTable({
    hotelId: v.id("hotels"),
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    idType: v.string(),
    idNumber: v.string(),
    nationality: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_hotel", ["hotelId"]),

  reservations: defineTable({
    hotelId: v.id("hotels"),
    guestId: v.id("guests"),
    roomId: v.id("rooms"),
    checkIn: v.string(),
    checkOut: v.string(),
    status: v.string(),
    adults: v.number(),
    children: v.number(),
    nightlyRate: v.number(),
    nights: v.number(),
    total: v.number(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    checkedInAt: v.optional(v.number()),
    checkedOutAt: v.optional(v.number()),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_guest", ["guestId"])
    .index("by_room", ["roomId"]),

  customers: defineTable({
    hotelId: v.id("hotels"),
    name: v.string(),
    kind: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_hotel", ["hotelId"]),

  suppliers: defineTable({
    hotelId: v.id("hotels"),
    name: v.string(),
    category: v.string(),
    phone: v.string(),
    email: v.string(),
    address: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_hotel", ["hotelId"]),

  invoices: defineTable({
    hotelId: v.id("hotels"),
    guestId: v.optional(v.id("guests")),
    customerId: v.optional(v.id("customers")),
    reservationId: v.optional(v.id("reservations")),
    number: v.string(),
    date: v.string(),
    dueDate: v.string(),
    subtotal: v.number(),
    taxRate: v.number(),
    serviceRate: v.number(),
    tax: v.number(),
    serviceCharge: v.number(),
    total: v.number(),
    paid: v.number(),
    status: v.string(),
    notes: v.optional(v.string()),
    billTo: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_guest", ["guestId"])
    .index("by_number", ["number"]),

  invoiceItems: defineTable({
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    amount: v.number(),
    accountCode: v.string(),
  }).index("by_invoice", ["invoiceId"]),

  payments: defineTable({
    hotelId: v.id("hotels"),
    invoiceId: v.optional(v.id("invoices")),
    guestId: v.optional(v.id("guests")),
    customerId: v.optional(v.id("customers")),
    amount: v.number(),
    method: v.string(),
    date: v.string(),
    reference: v.string(),
    type: v.string(),
    notes: v.optional(v.string()),
    userId: v.id("users"),
    userName: v.string(),
    createdAt: v.number(),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_invoice", ["invoiceId"]),

  accounts: defineTable({
    code: v.string(),
    name: v.string(),
    type: v.string(),
    active: v.boolean(),
    description: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_type", ["type"]),

  journalEntries: defineTable({
    hotelId: v.id("hotels"),
    date: v.string(),
    description: v.string(),
    reference: v.string(),
    source: v.string(),
    sourceId: v.string(),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_date", ["date"]),

  journalLines: defineTable({
    entryId: v.id("journalEntries"),
    accountId: v.id("accounts"),
    accountCode: v.string(),
    debit: v.number(),
    credit: v.number(),
    hotelId: v.id("hotels"),
    date: v.string(),
    description: v.string(),
  })
    .index("by_entry", ["entryId"])
    .index("by_account", ["accountId"])
    .index("by_hotel", ["hotelId"]),

  incomeRecords: defineTable({
    hotelId: v.id("hotels"),
    date: v.string(),
    category: v.string(),
    accountCode: v.string(),
    amount: v.number(),
    method: v.string(),
    description: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_hotel", ["hotelId"]),

  expenses: defineTable({
    hotelId: v.id("hotels"),
    supplierId: v.optional(v.id("suppliers")),
    date: v.string(),
    category: v.string(),
    accountCode: v.string(),
    amount: v.number(),
    method: v.string(),
    description: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_hotel", ["hotelId"]),

  bills: defineTable({
    hotelId: v.id("hotels"),
    supplierId: v.id("suppliers"),
    number: v.string(),
    date: v.string(),
    dueDate: v.string(),
    description: v.string(),
    accountCode: v.string(),
    amount: v.number(),
    paid: v.number(),
    status: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_hotel", ["hotelId"])
    .index("by_supplier", ["supplierId"]),

  employees: defineTable({
    hotelId: v.id("hotels"),
    name: v.string(),
    position: v.string(),
    phone: v.string(),
    email: v.string(),
    salary: v.number(),
    status: v.string(),
    hireDate: v.string(),
    nationalId: v.string(),
  }).index("by_hotel", ["hotelId"]),

  attendance: defineTable({
    employeeId: v.id("employees"),
    hotelId: v.id("hotels"),
    date: v.string(),
    status: v.string(),
    notes: v.optional(v.string()),
  }).index("by_hotel_date", ["hotelId", "date"]),

  auditLogs: defineTable({
    userId: v.optional(v.id("users")),
    userName: v.string(),
    action: v.string(),
    entity: v.string(),
    entityId: v.string(),
    hotelId: v.optional(v.id("hotels")),
    details: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),
});
