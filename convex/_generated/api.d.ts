/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounting from "../accounting.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authNode from "../authNode.js";
import type * as billing from "../billing.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as guests from "../guests.js";
import type * as hotels from "../hotels.js";
import type * as http from "../http.js";
import type * as lib_accounting from "../lib/accounting.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_roomCharge from "../lib/roomCharge.js";
import type * as people from "../people.js";
import type * as reports from "../reports.js";
import type * as reservations from "../reservations.js";
import type * as roomCharges from "../roomCharges.js";
import type * as rooms from "../rooms.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seedNode from "../seedNode.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounting: typeof accounting;
  audit: typeof audit;
  auth: typeof auth;
  authNode: typeof authNode;
  billing: typeof billing;
  crons: typeof crons;
  dashboard: typeof dashboard;
  guests: typeof guests;
  hotels: typeof hotels;
  http: typeof http;
  "lib/accounting": typeof lib_accounting;
  "lib/auth": typeof lib_auth;
  "lib/billing": typeof lib_billing;
  "lib/dates": typeof lib_dates;
  "lib/roomCharge": typeof lib_roomCharge;
  people: typeof people;
  reports: typeof reports;
  reservations: typeof reservations;
  roomCharges: typeof roomCharges;
  rooms: typeof rooms;
  search: typeof search;
  seed: typeof seed;
  seedNode: typeof seedNode;
  settings: typeof settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
