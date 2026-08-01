# Let's Be Friends Idea

## Product Vision

Let's Be Friends is a trust-first social app for finding, meeting, and booking friendly people for shared experiences. Instead of framing people as something to rent, the product frames approved providers as **Friend Hosts**: adults who offer their time, personality, hobbies, local knowledge, conversation, or activity support in a safe and respectful way.

The app should feel like social media because friendship is the center of the product. People can build a profile, show what they are good at, connect with others, post experience moments, and rate each other after completed hangouts or online sessions.

The product is not a dating app, adult-service marketplace, labor marketplace, therapy platform, medical service, legal service, or replacement for regulated professional work. The safest product language is **book time with a Friend Host**, **join an experience**, **meet a nearby friend**, or **connect online**.

## Core Concept

Users discover Friend Hosts based on what the host is good at. The product term for this is **Strengths**.

Examples of Strengths:

- Good listener
- Local tour buddy
- Coffee companion
- Language practice
- Study partner
- Fitness buddy
- Gaming teammate
- Food trip companion
- Event buddy
- Photography walk partner
- Online chat friend
- Hobby mentor

Friend Hosts define their profile around Strengths, safe activity categories, location availability, online availability, schedule, intro, boundaries, photos, ratings, and past experience posts.

Members can browse nearby or online Friend Hosts, view social proof, start a booking request, complete verification when required, and chat after the booking is allowed.

## Core Users

### Members

Members are people looking for friendship, companionship, shared activities, or someone nearby or online to spend time with.

Members can:

- Create a basic account.
- Build a social profile.
- Browse Friend Hosts.
- Search by Strengths, activity, location, availability, online mode, and rating.
- Start booking requests.
- Complete identity verification before booking.
- Chat after the booking flow allows it.
- Rate and review completed bookings.
- Post experience moments from completed bookings.
- Report users, posts, messages, and bookings.

### Friend Hosts

Friend Hosts are approved adults who offer safe, friendly experiences. They must submit a host profile and pass verification before appearing in discovery.

Friend Hosts can:

- Create a host profile.
- Choose curated activity categories.
- Add Strengths and boundaries.
- Set online and in-person availability.
- Submit identity verification through Persona.
- Wait for admin approval.
- Receive booking requests after approval.
- Accept or decline requests.
- Chat with members after booking is allowed.
- Rate and review members after completed bookings.
- Share experience posts from completed sessions.

### Admin

Admins manage the platform, policies, categories, reviewers, and high-risk actions.

Admins can:

- Manage admin users.
- Manage curated categories.
- Review audit logs.
- Suspend or reinstate users.
- Override reviewer decisions when necessary.
- Manage platform-level safety settings.

### Admin Reviewer

Reviewers handle operational trust and safety work.

Reviewers can:

- Review Friend Host applications.
- Review booking verification requests.
- Review Persona verification results.
- Approve or reject users for booking.
- Review reports.
- Hide or remove posts.
- Suspend profiles for policy violations.
- Leave internal notes.

## Registration And Verification Model

Basic signup should be lightweight. A user can sign up with Clerk and create a basic social profile without completing full identity verification.

Full registration and verification happens when trust is needed:

- A user attempts to start a booking.
- A user applies to become a Friend Host.
- A user performs another action that requires real-world trust.

When a user starts a booking while unverified, the app should:

1. Save the booking as a draft.
2. Explain that verification is required before the request can be sent.
3. Start Persona verification for government ID and selfie/liveness.
4. Store the Persona inquiry reference and verification status.
5. Send the request to the admin review queue.
6. Let an admin approve or reject the user for booking.
7. Send the booking request to the Friend Host only after approval.

Friend Hosts must be approved before they appear in search, lists, map discovery, recommendations, or public host profile browsing.

## Trust And Safety Principles

Trust and safety is part of the product, not an afterthought.

Core rules:

- 18+ only for MVP.
- Friend Hosts must be approved before public discovery.
- Booking users must pass identity verification before sending a real booking request.
- Use Persona for government ID and selfie/liveness checks.
- Do not store raw government ID images in Convex.
- Store only verification metadata, review state, timestamps, and Persona reference IDs.
- Keep exact private locations hidden.
- Show only approximate city, neighborhood, or radius in discovery.
- Exact meeting details unlock only after the booking is accepted.
- Every profile, post, message, booking, and review must be reportable.
- Admin decisions must be audit-logged.
- Suspended users cannot appear in search, send booking requests, accept bookings, chat, or post.

## Activity Boundaries

The first version should use curated safe categories, not open-ended services.

Initial categories:

- Coffee or meal companion
- Local walk or city guide
- Study or productivity buddy
- Language practice
- Gaming session
- Hobby session
- Event companion
- Fitness or outdoor buddy
- Online conversation
- Online coworking
- Travel or neighborhood guide
- Photography or creative walk

Disallowed categories should include:

- Dating or romantic services
- Adult or sexual services
- Escorting
- Therapy or medical care
- Legal or financial advice
- Childcare
- High-risk physical activities
- Illegal activity
- Anything involving coercion, harassment, or discrimination

## Social Features

The app should feel like social media, but the feed should support the booking and friendship model rather than becoming a general-purpose content platform.

MVP social features:

- Social profile.
- Friend/follow relationship.
- Experience posts.
- Photos from safe, completed experiences.
- Ratings and reviews.
- Host highlights.
- Public Strengths.
- Public activity categories.

Experience posts should usually be connected to completed bookings. This keeps the feed authentic, reduces spam, and turns successful meetups into social proof.

## Booking Flow

The MVP booking model is **request first** and **no payments yet**.

Booking states:

- Draft
- Verification required
- Pending admin review
- Request sent
- Accepted
- Declined
- Cancelled
- Completed
- Review window
- Closed

Flow:

1. Member finds a Friend Host.
2. Member chooses online or in-person.
3. Member selects category, date, time, duration, and notes.
4. If verification is missing, the request becomes a draft and verification starts.
5. Persona handles government ID and selfie/liveness.
6. Admin reviews the verification request.
7. After approval, the booking request is sent to the Friend Host.
8. Friend Host accepts or declines.
9. If accepted, chat opens and safe meeting details can be shared.
10. After completion, both sides rate and review each other.
11. Either side can create an experience post if policy allows it.

## Chat Model

Chat should be tied to trust state.

MVP chat rules:

- No open direct messages to any user by default.
- Chat opens only after a booking reaches the allowed state.
- Chat can be disabled if a report, cancellation, suspension, or admin action requires it.
- Messages should be reportable.
- Admin should be able to review reported message context.

Convex can power direct messages in the MVP so permissions, moderation, and booking state stay in one backend.

## Ratings And Reviews

Ratings should be mutual. Both the member and Friend Host can review each other after a completed booking.

Review dimensions:

- Overall rating
- Safety and respect
- Communication
- Reliability
- Experience accuracy

Reviews should support:

- Public review text
- Private admin-only feedback
- Report review
- Hide review by admin
- Review window deadline

## Location And Nearby Discovery

Nearby matching is central to the product, but privacy matters.

Location rules:

- Use approximate location in public discovery.
- Support city, neighborhood, and radius filters.
- Support online-only mode.
- Do not show exact home coordinates.
- Do not expose exact meeting location until after booking acceptance.
- Let users update their service area and online availability.

Map view:

- Show approximate pins or clusters.
- Let users search this area.
- Let users filter by category, Strengths, online/in-person, availability, rating, and distance.
- Do not reveal exact address or precise live location.

## Search And Matching

Search should combine text, filters, location, and trust signals.

Search inputs:

- Text query
- Strengths
- Categories
- Online or in-person
- Distance radius
- Availability
- Language
- Rating
- Response rate
- Friend/follow graph
- Profile completeness

MVP ranking factors:

- Category match
- Strength match
- Distance
- Online availability
- Schedule availability
- Rating quality
- Review count
- Response reliability
- Profile completeness
- Social graph connection
- Recent activity
- Safety status

Hard filters:

- Host must be approved.
- Host must not be suspended.
- Host must match online/in-person mode.
- Host must be in an allowed category.
- Host must satisfy basic safety and visibility rules.

## Admin Management System

The admin system is required for MVP because verification does not happen at signup. Admin approval controls whether verified users can book and whether Friend Hosts can appear publicly.

Admin dashboard areas:

- Overview
- Host applications
- Booking verification requests
- Persona verification results
- Reports
- Users
- Posts
- Reviews
- Categories
- Audit logs
- Settings

Admin queue fields:

- Request type
- User
- Risk level
- Persona status
- Submitted profile data
- Booking draft or host application context
- Internal notes
- Decision history
- Assigned reviewer
- Created time
- SLA/status

Admin actions:

- Approve
- Reject
- Request resubmission
- Suspend user
- Hide post
- Remove review
- Escalate to admin
- Add internal note

Every admin action must create an audit log entry.

## MVP Scope

Build web first.

MVP includes:

- Clerk authentication.
- Basic user profile.
- Friend Host application.
- Persona verification flow.
- Admin review dashboard.
- Approved host discovery.
- Search and filters.
- Map view with approximate locations.
- Booking draft and request flow.
- Convex chat after allowed booking state.
- Ratings and reviews.
- Experience posts.
- Reports and moderation.
- In-app and email notifications.

MVP excludes:

- Payments.
- Escrow.
- Mobile app.
- Push notifications.
- Advanced AI recommendations.
- Open-ended custom services.
- Public exact location.
- Full global rollout.

## Future Phases

### Phase 2: Payments

Add paid bookings with **PayMongo QR Ph** as the first planned payment method for the Philippines launch.

Payment direction:

- Use PayMongo QR Ph for local checkout.
- Prefer dynamic online QR Ph codes per booking payment.
- Keep static QR Ph as an operational fallback, not the default in-app booking checkout.
- Collect payment only after the Friend Host accepts the booking or when the product has clear cancellation/refund rules.
- Track payment state inside the booking.
- Add platform fees, cancellation policy, refund policy, host payable balance, payout operations, and tax/business requirements.

Payment states to add later:

- Payment pending
- QR generated
- Paid
- Expired
- Failed
- Refund pending
- Refunded
- Payout pending
- Paid out

Important payment rules:

- Do not unlock final meeting details until the booking is accepted and the payment state is valid.
- Do not treat a QR screenshot as proof of payment.
- Use PayMongo webhook events as the source of truth for payment confirmation.
- Add admin tools for payment disputes, failed payments, refunds, and manual reconciliation.
- Re-check PayMongo account eligibility, wallet status, payout support, and business compliance before implementation.

### Phase 3: Mobile

Build the React Native app after the web product model is validated. Reuse shared types, validation, categories, and scoring helpers where possible.

### Phase 4: Better Matching

Add stronger recommendations, semantic matching, saved searches, availability-aware ranking, and personalized discovery.

### Phase 5: Safety Expansion

Add deeper moderation workflows, automatic risk flags, richer report triage, safety check-ins, and stronger policy enforcement.

## Product Language

Use:

- Friend Host
- Member
- Strengths
- Book time
- Booking request
- Experience
- Hangout
- Online session
- In-person session
- Nearby friends
- Verified for booking
- Approved host

Avoid:

- Rent a person
- Rented friend
- Proficiency
- Escort
- Service provider
- Customer buys a person
- Seller

## Success Criteria

The product is working when:

- Members can quickly understand what Friend Hosts offer.
- Friend Hosts feel respected and not objectified.
- Verification happens only when needed, but before risky actions.
- Admins can confidently approve or reject users.
- Nearby search feels useful without exposing exact locations.
- Booking flow feels friendly, not cold or transactional.
- Ratings and experience posts create trust.
- Unsafe or unclear activity categories are prevented early.
