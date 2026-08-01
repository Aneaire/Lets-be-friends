# Tech Stack

## Summary

Let's Be Friends will start as a web application and later expand to mobile. The first build should use a pnpm monorepo so the future React Native app can share types, validation schemas, category constants, and search scoring helpers with the web app.

The first web version should focus on trust, search, booking workflow, admin review, chat, ratings, and experience posts. Payments are intentionally out of scope for MVP, but the planned first payment method for the Philippines launch is PayMongo QR Ph.

## Project Structure

Use pnpm workspaces.

```txt
lets-be-friends/
  apps/
    web/
      # TanStack Start web app
    mobile/
      # Future React Native app, not implemented in MVP
  packages/
    shared/
      # Shared types, Zod schemas, category constants, permissions, scoring helpers
  idea.md
  techstack.md
  package.json
  pnpm-workspace.yaml
```

MVP implementation should only build `apps/web`. Keep `apps/mobile` as a documented future target unless there is a reason to scaffold it later.

## Package Manager

Use `pnpm`.

Reasons:

- Works well with monorepos.
- Fast installs.
- Good workspace support.
- Keeps web, future mobile, and shared packages organized.

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
- Friend Host profiles.
- Search and map discovery.
- Booking flow.
- Chat UI.
- Experience feed.
- Admin dashboard.

Recommended libraries:

- `@tanstack/react-start`
- `@tanstack/react-router`
- `@tanstack/react-query`
- `@tanstack/react-form`
- `typescript`
- `vite`

TanStack Start is a good fit because it is a full-stack React framework with routing, server functions, SSR support, and strong TypeScript patterns.

## Mobile Application

Use **React Native** later, after the web MVP is validated.

Decision to make later:

- Expo vs bare React Native.

Recommended default when mobile starts:

- Expo unless there is a native-module requirement that forces bare React Native.

Mobile should reuse:

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
- Friend Host profiles.
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
- A user applies to become a Friend Host.
- An admin requires reverification.

## Admin System

Build the admin management system inside `apps/web`.

Recommended route group:

```txt
/admin
/admin/overview
/admin/host-applications
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

- Review Friend Host applications.
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

Future mobile note:

- mapcn has a React Native direction through MapLibre/Mapbox-compatible components.
- Re-evaluate mobile map SDK choice during mobile planning.

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

- Host must be approved.
- Host must not be suspended.
- Host must be visible.
- Host must match online/in-person mode.
- Host must match allowed categories.

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

- Keeps booking permissions close to messages.
- Avoids a separate chat vendor in MVP.
- Makes moderation and reporting easier.
- Works with the same auth and admin model.

Chat rules:

- Chat opens only after booking reaches an allowed state.
- No unrestricted direct messages in MVP.
- Messages can be reported.
- Admin can review reported conversation context.
- Suspended users cannot send messages.

## Media Storage

Use **Convex File Storage** for MVP.

Store:

- Profile photos.
- Friend Host gallery photos.
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
- Host application approved.
- Host application rejected.
- Booking request sent.
- Booking accepted.
- Booking declined.
- Booking cancelled.
- Booking completed.
- New review.
- Report status update when appropriate.

Push notifications should wait until mobile or a later web push phase.

## Payments

Payments are not part of MVP, but the Phase 2 payment plan should use **PayMongo QR Ph** first.

Primary payment method:

- PayMongo QR Ph.
- Dynamic online QR Ph generated per booking payment.
- Payment Intent workflow with `qrph` as an allowed payment method.
- PayMongo webhooks for payment confirmation.

Why PayMongo QR Ph first:

- Strong fit for a Philippines-first launch.
- Supports payment through many local banks and e-wallets through the QR Ph standard.
- Better local payment familiarity than card-only checkout.
- Lets the product start with local digital payments before adding card, e-wallet-specific, or BNPL methods.

Recommended Phase 2 booking payment flow:

1. Member creates a booking request.
2. Friend Host accepts the request.
3. App creates a PayMongo Payment Intent for the accepted booking amount.
4. App creates or attaches a QR Ph payment method.
5. Member scans/pays the dynamic QR Ph code.
6. PayMongo webhook confirms payment.
7. Convex updates the booking payment state.
8. Final meeting details unlock only after valid payment confirmation.
9. After completion and review/cancellation window, admin or payout workflow settles the Friend Host payable amount.

Payment state fields to add later:

- `paymentProvider`
- `paymentIntentId`
- `paymentMethod`
- `paymentStatus`
- `amount`
- `currency`
- `platformFeeAmount`
- `hostPayableAmount`
- `paidAt`
- `expiresAt`
- `refundedAt`
- `payoutStatus`

Suggested payment statuses:

```ts
type PaymentProvider = "paymongo";
type PaymentMethod = "qrph";

type PaymentStatus =
  | "not_required"
  | "pending"
  | "qr_generated"
  | "paid"
  | "expired"
  | "failed"
  | "refund_pending"
  | "refunded";

type PayoutStatus =
  | "not_started"
  | "pending"
  | "processing"
  | "paid_out"
  | "failed"
  | "manual_review";
```

Important implementation notes:

- Use PayMongo webhook confirmation as the source of truth, not screenshots or user claims.
- Dynamic online QR Ph codes are preferred for booking checkout because they are tied to a specific transaction.
- Static QR Ph should only be considered for manual/in-store-style fallback flows.
- QR Ph code expiry must be handled in the UI and booking state.
- Before implementation, verify PayMongo account activation, QR Ph eligibility, wallet status, settlement timing, payout options, refund behavior, and marketplace compliance.
- Keep payout accounting in Convex even if payouts start as manual operations.

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
- Friend Host application.
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
- `hostApprovalStatus`
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

### `hostProfiles`

Stores Friend Host profile data.

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

Stores booking or host verification workflow.

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
- `hostId`
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

### `conversations`

Stores chat rooms tied to bookings.

Fields:

- `bookingId`
- `participantIds`
- `status`
- `openedAt`
- `closedAt`

### `messages`

Stores chat messages.

Fields:

- `conversationId`
- `senderId`
- `body`
- `attachmentStorageIds`
- `reportedAt`
- `deletedAt`
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
type UserRole = "member" | "friendHost" | "admin" | "reviewer";

type VerificationStatus =
  | "none"
  | "required"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

type HostApprovalStatus =
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
- Unverified user can browse approved hosts.
- Unverified user cannot send booking request directly.
- Starting a booking creates a draft and starts verification.
- Persona result updates verification state.
- Admin can approve or reject verification.
- Approved Friend Host appears in search.
- Pending Friend Host does not appear in search.
- Suspended users cannot book, chat, post, or appear in discovery.
- Map returns approximate locations only.
- Chat opens only for allowed booking state.
- Completed booking allows mutual ratings.
- Experience post requires a completed booking.
- Admin actions write audit logs.
- Phase 2: PayMongo QR Ph payment cannot unlock meeting details until webhook-confirmed.
- Phase 2: Expired QR Ph payment returns booking to a payable state without duplicating charges.
- Phase 2: Payment reconciliation and payout status changes are audit-logged.

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
```

Actual names may change during implementation based on provider SDK requirements.

## Deployment Notes

Decide hosting during implementation.

Good candidates:

- Netlify for TanStack Start.
- Cloudflare Workers for TanStack Start.
- Vercel if the TanStack Start deployment path is validated.

Convex deploys separately through Convex.

## Future Additions To Decide Later

- Payouts and tax handling.
- Refund and cancellation policies.
- Push notifications.
- Advanced moderation provider.
- Dedicated search service.
- Expo vs bare React Native.
- Mobile map provider.
- Analytics provider.
- Error monitoring provider.

Recommended likely additions:

- PayMongo QR Ph for the first Philippines payment method.
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
