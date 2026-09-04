# Tech Stack

## Summary

Let's Be Friends is a pnpm monorepo with active web, admin, and Expo mobile applications. The applications share domain types, validation schemas, category constants, booking rules, map privacy helpers, and feed ranking helpers.

The product covers trust, discovery, booking workflow, admin review, chat, ratings, experience posts, safety reports, notifications, and the approved member-wallet booking flow. PayMongo QR Ph is used for provider-verified wallet top-ups. Companion payouts remain disabled until a provider is selected and activated.

## Project Structure

Use pnpm workspaces.

```txt
lets-be-friends/
  apps/
    web/
      # TanStack Start web app
    admin/
      # TanStack Start admin app
    mobile/
      # Expo Router and React Native mobile app
  packages/
    shared/
      # Shared types, Zod schemas, category constants, permissions, scoring helpers
  idea.md
  techstack.md
  package.json
  pnpm-workspace.yaml
```

The root `typecheck`, `test`, and `build` scripts verify the web, admin, and mobile applications. The shared package exports TypeScript source directly and has no standalone build script. Product changes should keep the web and mobile clients aligned where the same capability is released on both surfaces.

## Package Manager

Use `pnpm`.

Reasons:

- Works well with monorepos.
- Fast installs.
- Good workspace support.
- Keeps web, mobile, and shared packages organized.

## Local Development

Run the app from the repo root with:

```bash
pnpm dev
```

This starts both required development processes:

- `convex dev` for the Convex backend and generated API state.
- `vite dev` for the TanStack Start web app.

Use `pnpm dev:web` only when intentionally running the web server without Convex. Use `pnpm convex:dev` only when intentionally running Convex by itself.

## Web Application

Use **TanStack Start** with React and TypeScript.

Primary responsibilities:

- Public landing and product education.
- Authenticated member app.
- Companion profiles.
- Search and map discovery.
- Booking flow.
- Chat UI.
- Experience feed.

Recommended libraries:

- `@tanstack/react-start`
- `@tanstack/react-router`
- `@tanstack/react-query`
- `@tanstack/react-form`
- `typescript`
- `vite`

TanStack Start is a good fit because it is a full-stack React framework with routing, server functions, SSR support, and strong TypeScript patterns.

## Admin Application

Use the separate **TanStack Start** application in `apps/admin` for operational dashboards, review queues, moderation, settings, and audit access. Root verification includes this application.

## Mobile Application

Use **Expo SDK 57**, **React Native**, and **Expo Router** for the mobile app. Native development uses the Expo development client, while production-like repository verification creates a static web export.

Mobile reuses:

- Shared domain types.
- Zod schemas.
- Category constants.
- Booking status constants.
- Role and permission helpers.
- Search scoring helpers where possible.

## Backend And Database

Use **Convex** for backend, database, realtime state, server functions, file storage, and app logic.

Convex responsibilities:

- User profile data.
- Companion profiles.
- Search indexes.
- Booking state machine.
- Admin review queues.
- Chat messages.
- Ratings and reviews.
- Experience posts.
- Reports.
- Notifications.
- Audit logs.
- File storage metadata.

Convex should be the primary source of truth for product state. Clerk is the source of truth for authentication identity, and Persona is the source of truth for identity verification checks.

## Authentication

Use **Clerk**.

Clerk responsibilities:

- Signup.
- Login.
- Session management.
- Email or phone verification.
- Social login if enabled later.
- Basic user identity for auth.
- Coarse role metadata if useful.

Convex must still enforce permissions on the backend. Do not rely only on client-side Clerk role checks.

Use Convex's Clerk integration with `ConvexProviderWithClerk` for authenticated Convex calls from React.

## Identity Verification

Use **Persona** for government ID and selfie/liveness verification.

Persona responsibilities:

- Government ID collection.
- Selfie/liveness verification.
- Face match when applicable.
- Inquiry status.
- Verification result metadata.

Convex responsibilities:

- Store Persona inquiry IDs.
- Store verification status.
- Store admin decision status.
- Store reviewer notes.
- Store timestamps.
- Store audit logs.

Do not store raw government ID images in Convex. Keep sensitive identity documents inside Persona unless a future compliance review explicitly changes that policy.

Verification should not happen at signup by default. It should start when:

- A member tries to create a booking request.
- A user applies to become a Companion.
- An admin requires reverification.

## Admin System

Build the admin management system inside `apps/web`.

Recommended route group:

```txt
/admin
/admin/overview
/admin/companion-applications
/admin/booking-verification
/admin/reports
/admin/users
/admin/posts
/admin/reviews
/admin/categories
/admin/audit-logs
/admin/settings
```

Roles:

- `admin`
- `reviewer`

Admin permissions:

- Manage admins and reviewers.
- Manage categories.
- Manage platform settings.
- Suspend or reinstate users.
- Override review decisions.
- View audit logs.

Reviewer permissions:

- Review Companion applications.
- Review booking verification requests.
- Review reports.
- Moderate posts and reviews.
- Add internal notes.

Every admin action must write an audit log.

## Maps And Location

Use **mapcn** for map components and **Mapbox Search** for geocoding/search input.

Map UI:

- mapcn
- MapLibre
- Tailwind-compatible map components

Geocoding:

- Mapbox Search for converting user-entered places to coordinates.
- Reverse geocoding if needed for city/neighborhood display.

Privacy model:

- Store exact coordinates only when necessary.
- Store and expose approximate discovery coordinates.
- Show approximate pins or clusters.
- Unlock exact meeting details only after booking acceptance.

Mobile uses MapLibre-compatible native components behind platform-specific product map adapters. Public results expose rounded search and Companion areas, never exact meeting coordinates.

## Search And Matching

Start with **Convex-first search**.

Use:

- Convex indexes.
- Convex full-text search.
- Convex pagination.
- Geocell or grid-based location indexing.
- Radius filtering.
- App-level ranking logic.

Search inputs:

- Text query.
- Strengths.
- Categories.
- Online or in-person mode.
- Distance radius.
- Availability.
- Language.
- Rating.
- Response rate.
- Social graph signals.

Hard filters:

- Companion must be approved.
- Companion must not be suspended.
- Companion must be visible.
- Companion must match online/in-person mode.
- Companion must match allowed categories.

Ranking factors:

- Category match.
- Strength match.
- Distance.
- Availability.
- Rating quality.
- Review count.
- Response rate.
- Profile completeness.
- Social graph connection.
- Recent activity.

Keep ranking helpers in `packages/shared` so they can later move behind Algolia, Typesense, Meilisearch, or another search service if Convex-first search becomes limiting.

## Chat

Use **Convex Chat** built on Convex tables and realtime queries.

Reasons:

- Keeps direct and booking-message permissions in the same backend.
- Avoids a separate chat vendor in MVP.
- Makes moderation and reporting easier.
- Works with the same auth and admin model.

Chat rules:

- Signed-in users can start a direct conversation from another user's visible profile or post.
- Booking chat remains scoped to allowed booking states.
- Messages can be reported.
- Admin can review reported conversation context.
- Suspended users cannot send messages.
- Direct messages support up to four attachments. Images and videos below 3 MB are not compressed; larger media uses progressively stronger client-side compression based on its original size.

## Media Storage

Use **Convex File Storage** for MVP.

Store:

- Profile photos.
- Companion gallery photos.
- Experience post media.
- Safe public media assets.

Do not store:

- Raw government ID images.
- Persona selfie verification captures.
- Highly sensitive identity documents.

Those should remain in Persona.

## Email And Notifications

Use:

- Convex for in-app notifications.
- Resend for email.
- React Email for email templates.

Notification events:

- Verification submitted.
- Verification approved.
- Verification rejected.
- Companion application approved.
- Companion application rejected.
- Booking request sent.
- Booking accepted.
- Booking declined.
- Booking cancelled.
- Booking completed.
- New review.
- Report status update when appropriate.

Mobile push uses Expo Notifications in installed development or release builds. Permission is requested only after a ready member explicitly opts in. Payloads contain a notification ID and resolve the authorized destination through Convex. Web push and direct FCM or APNs integration are not released.

## Member Wallet, Booking Settlement, And Legacy Companion Fees

New bookings use the explicit `member_wallet_v2` model when `MEMBER_WALLET_V2_ENABLED=true`. The flag gates only new v2 booking and member top-up creation; runtime reads, reconciliation, evidence retention, and settlement for existing v2 rows are never gated.

Financial rules:

1. The server freezes the listed service subtotal plus a 15% member booking fee in integer centavos. Companion entitlement is 100% of the subtotal.
2. A member needs available booking balance greater than or equal to the total to send a request.
3. Companion acceptance atomically rechecks and transfers the total from member available to reserved. Insufficient balance leaves `request_sent` unchanged.
4. Mutual completion opens reviews and atomically transfers reserved funds to Companion pending earnings and platform pending revenue.
5. Settlement eligibility is exactly 24 hours after mutual completion. Durable scheduling plus bounded reconciliation moves due, unblocked pending balances to available idempotently.
6. A booking report by either participant blocks unsettled v2 funds. Evidence is never required for a report. Only a full admin with a required note can release blocked companion/platform funds or return them to member available balance.
7. Wallet accounts use deterministic keys and materialized available/reserved/pending buckets. Immutable transactions and entries use unique idempotency keys, safe-integer/nonnegative checks, and balanced internal transfers.
8. Allowed production financial writers are provider-verified member credit, booking accept reserve, cancellation release, mutual-completion allocation, internal settlement, and full-admin blocked-fund resolution.
9. The older 10% cash-booking commission obligations, companion fee ledger, PayMongo companion top-ups, and Saturday collection remain only for legacy bookings whose pricing model/purpose is missing or legacy.

Optional booking evidence uses private image upload grants. The Companion decides start evidence and the member decides end evidence; either can upload or explicitly skip after a strict warning, and that role must decide before completion. The server validates MIME, size, ownership, grant age, and reuse. Ordinary booking/admin lists never expose evidence URLs. Reviewer/admin access requires a linked active booking report and creates an audit log. Bounded purge retains evidence while a report is active.

PayMongo safety requirements:

- Secret-key calls create and retrieve Payment Intents. Public-key calls create the QR Ph Payment Method and attach it with the Payment Intent client key.
- Provider idempotency keys protect all creation/attachment writes.
- The exact bounded raw webhook body is HMAC-verified before JSON parsing.
- Test/live mode, canonical intent ID, amount, PHP currency, QR Ph method, top-up purpose, and beneficiary are revalidated before credit.
- Provider event IDs plus raw-body hashes prevent duplicate or conflicting settlement.
- `payment.paid`, `payment.failed`, and `qrph.expired` update retained attempts; scheduled reconciliation repairs missed webhooks.
- Companion withdrawals submit PayMongo InstaPay batch transfers behind `COMPANION_WITHDRAWALS_ENABLED`, with encrypted payout methods, 24-hour holds, reserve-then-submit ledger moves, idempotency keys, per-transfer callback URL when configured, and canonical transfer reconciliation for `transfer.outward.successful` and `transfer.outward.failed`.

## UI Stack

Use:

- Tailwind CSS.
- shadcn/ui.
- Radix primitives.
- lucide-react icons.
- mapcn for maps.

Design direction:

- Warm trust.
- Friendly social app feel.
- Calm booking and admin workflows.
- Safety-forward without making the app feel cold.
- Product UI should be clear, structured, and efficient.

Avoid:

- Overly playful booking screens.
- Marketplace language that makes people feel like products.
- Dating-app visual patterns.
- Exact-location-heavy map UI.
- Decorative UI that weakens trust.

## Forms And Validation

Use:

- TanStack Form for complex forms.
- Zod for schemas and validation.
- Shared schemas in `packages/shared` when useful.

Important forms:

- Profile setup.
- Companion application.
- Strength selection.
- Availability setup.
- Booking request draft.
- Report form.
- Admin review decision.
- Category management.

## Suggested Convex Tables

### `users`

Stores app-level user state linked to Clerk.

Fields:

- `clerkUserId`
- `role`
- `verificationStatus`
- `bookingEligibilityStatus`
- `companionApprovalStatus`
- `suspendedAt`
- `createdAt`
- `updatedAt`

### `profiles`

Stores public social profile data.

Fields:

- `userId`
- `displayName`
- `handle`
- `bio`
- `photoStorageId`
- `city`
- `region`
- `country`
- `languages`
- `interests`
- `visibility`

### `companionProfiles`

Stores Companion profile data.

Fields:

- `userId`
- `headline`
- `intro`
- `strengthIds`
- `categoryIds`
- `boundaries`
- `onlineEnabled`
- `inPersonEnabled`
- `approxLocation`
- `serviceRadiusKm`
- `availability`
- `approvalStatus`
- `averageRating`
- `reviewCount`
- `responseRate`

### `categories`

Stores curated safe categories.

Fields:

- `name`
- `slug`
- `description`
- `mode`
- `isActive`
- `sortOrder`

### `strengths`

Stores platform-approved Strengths.

Fields:

- `name`
- `slug`
- `description`
- `categoryIds`
- `isActive`

### `verificationRequests`

Stores booking or companion verification workflow.

Fields:

- `userId`
- `purpose`
- `personaInquiryId`
- `status`
- `adminStatus`
- `reviewerId`
- `decisionReason`
- `submittedAt`
- `reviewedAt`

### `bookings`

Stores booking state.

Fields:

- `memberId`
- `companionId`
- `categoryId`
- `mode`
- `requestedStart`
- `requestedDurationMinutes`
- `locationType`
- `approxLocation`
- `exactLocation`
- `notes`
- `status`
- `verificationRequestId`
- `acceptedAt`
- `completedAt`
- `cancelledAt`

### `directConversations`

Stores one direct conversation for each pair of users.

Fields:

- `participantOneId`
- `participantTwoId`
- `pairKey`
- `lastMessageAt`
- `createdAt`
- `updatedAt`

### `directMessages`

Stores direct chat messages. Booking-scoped messages remain in `messages`.

Fields:

- `conversationId`
- `senderId`
- `body`
- `attachments` (`storageId`, `kind`, `fileName`, `contentType`, `size`, `originalSize`, `compressionPercent`)
- `reportable`
- `createdAt`

### `ratings`

Stores mutual reviews.

Fields:

- `bookingId`
- `reviewerId`
- `revieweeId`
- `overall`
- `safety`
- `communication`
- `reliability`
- `text`
- `privateFeedback`
- `status`

### `experiencePosts`

Stores social posts tied to completed experiences.

Fields:

- `authorId`
- `bookingId`
- `caption`
- `mediaStorageIds`
- `visibility`
- `status`
- `reportedCount`

### `reports`

Stores moderation reports.

Fields:

- `reporterId`
- `targetType`
- `targetId`
- `reason`
- `details`
- `status`
- `assignedReviewerId`
- `resolution`

### `notifications`

Stores in-app notifications.

Fields:

- `userId`
- `type`
- `title`
- `body`
- `targetType`
- `targetId`
- `readAt`

### `adminAuditLogs`

Stores admin actions.

Fields:

- `actorId`
- `action`
- `targetType`
- `targetId`
- `before`
- `after`
- `note`
- `createdAt`

## Important Status Types

```ts
type UserRole = "member" | "friendCompanion" | "admin" | "reviewer";

type VerificationStatus =
  | "none"
  | "required"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

type CompanionApprovalStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "rejected"
  | "suspended";

type BookingStatus =
  | "draft"
  | "verification_required"
  | "pending_admin_review"
  | "request_sent"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed"
  | "review_window"
  | "closed";

type PostStatus = "draft" | "published" | "hidden" | "flagged" | "removed";
```

## Testing

Use:

- Vitest for unit tests.
- React Testing Library for components.
- Playwright for end-to-end tests.
- Convex test utilities where applicable.

Critical test scenarios:

- User can sign up but remains unverified.
- Unverified user can browse approved companions.
- Unverified user cannot send booking request directly.
- Starting a booking creates a draft and starts verification.
- Persona result updates verification state.
- Admin can approve or reject verification.
- Approved Companion appears in search.
- Pending Companion does not appear in search.
- Suspended users cannot book, chat, post, or appear in discovery.
- Map returns approximate locations only.
- Direct chat is available between active users; booking chat opens only for allowed booking states.
- Completed booking allows mutual ratings.
- Experience post requires a completed booking.
- Admin actions write audit logs.
- Booking price and 10% commission are frozen server-side in integer centavos.
- Both participants must confirm completion before commission accrues exactly once.
- Saturday collection supports full and partial payment and restricts acceptance while past due.
- PayMongo QR Ph top-up credit requires webhook or reconciliation confirmation and is idempotent.
- Expired top-up QR attempts can be replaced without deleting financial history.

## Environment Variables

Expected environment variables:

```txt
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CONVEX_DEPLOYMENT=
VITE_CONVEX_URL=
PERSONA_API_KEY=
PERSONA_TEMPLATE_ID=
PERSONA_WEBHOOK_SECRET=
MAPBOX_ACCESS_TOKEN=
RESEND_API_KEY=
PAYMONGO_SECRET_KEY=
PAYMONGO_PUBLIC_KEY=
PAYMONGO_WEBHOOK_SECRET=
PAYMONGO_MODE=test
```

Actual names may change during implementation based on provider SDK requirements.

## Deployment Notes

Decide companion during implementation.

Good candidates:

- Netlify for TanStack Start.
- Cloudflare Workers for TanStack Start.
- Vercel if the TanStack Start deployment path is validated.

Convex deploys separately through Convex.

## Future Additions To Decide Later

- Payouts and tax handling.
- Refund and cancellation policies.
- Advanced moderation provider.
- Dedicated search service.
- Analytics provider.
- Error monitoring provider.

Recommended likely additions:

- Stripe only if the product later needs broader international card coverage.
- Sentry for error monitoring.
- PostHog or similar for product analytics.
- A dedicated moderation provider if user-generated content grows quickly.

## Official Documentation References

- TanStack Start: https://tanstack.com/start/latest/docs/framework/react/overview
- Clerk TanStack Start: https://clerk.com/docs/tanstack-react-start/getting-started/quickstart
- Convex and Clerk: https://docs.convex.dev/auth/clerk
- Convex TanStack Start: https://docs.convex.dev/client/tanstack/tanstack-start/
- Convex Search: https://docs.convex.dev/search/text-search
- Convex File Storage: https://docs.convex.dev/file-storage
- Persona Verification: https://docs.withpersona.com/verification-types
- mapcn: https://www.mapcn.dev/docs
- Mapbox Search JS React: https://docs.mapbox.com/mapbox-search-js/guides/geocoding/react/
- Resend and React Email: https://react.email/docs/integrations/resend
- PayMongo QR Ph: https://developers.paymongo.com/docs/qr-ph-1
- PayMongo QR Ph API: https://developers.paymongo.com/docs/qr-ph-api
