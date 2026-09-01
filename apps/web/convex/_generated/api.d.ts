/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as bookingEvidence from "../bookingEvidence.js";
import type * as bookings from "../bookings.js";
import type * as companionLocations from "../companionLocations.js";
import type * as companions from "../companions.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as finance from "../finance.js";
import type * as http from "../http.js";
import type * as identityRecords from "../identityRecords.js";
import type * as identityVerification from "../identityVerification.js";
import type * as lib from "../lib.js";
import type * as migrations from "../migrations.js";
import type * as notificationCatalog from "../notificationCatalog.js";
import type * as notifications from "../notifications.js";
import type * as paymongo from "../paymongo.js";
import type * as persona from "../persona.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as safety from "../safety.js";
import type * as seeds from "../seeds.js";
import type * as seeds_philippinesCatalog from "../seeds/philippinesCatalog.js";
import type * as social from "../social.js";
import type * as users from "../users.js";
import type * as withdrawals from "../withdrawals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  bookingEvidence: typeof bookingEvidence;
  bookings: typeof bookings;
  companionLocations: typeof companionLocations;
  companions: typeof companions;
  conversations: typeof conversations;
  crons: typeof crons;
  finance: typeof finance;
  http: typeof http;
  identityRecords: typeof identityRecords;
  identityVerification: typeof identityVerification;
  lib: typeof lib;
  migrations: typeof migrations;
  notificationCatalog: typeof notificationCatalog;
  notifications: typeof notifications;
  paymongo: typeof paymongo;
  persona: typeof persona;
  pushNotifications: typeof pushNotifications;
  reports: typeof reports;
  reviews: typeof reviews;
  safety: typeof safety;
  seeds: typeof seeds;
  "seeds/philippinesCatalog": typeof seeds_philippinesCatalog;
  social: typeof social;
  users: typeof users;
  withdrawals: typeof withdrawals;
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

export declare const components: {
  geospatial: import("@convex-dev/geospatial/_generated/component.js").ComponentApi<"geospatial">;
};
