# Play Console listing content

Copy-paste material for the first submission. Fill the angle-bracket placeholders
before using it. The copy matches the shipped app on 2026-11-18; if the product
changes, update this file first, then the console.

Do not use em dashes in any Play Console field.

## App identity

| Field | Value |
| --- | --- |
| App name (max 30 chars) | Let's Be Friends |
| Package name | `com.letsbefriends.mobile` |
| Default language | English (Philippines) |
| App or game | App |
| Category | Social |
| Tags | Social, Lifestyle |
| Contact email | letsbefriends896@gmail.com (interim, owner decision 2026-11-20; replace with a dedicated support address before scaling and bump the policy version when it changes) |
| Website | https://www.letsbefriends.space |
| Privacy policy | https://www.letsbefriends.space/privacy-policy |
| Account deletion | https://www.letsbefriends.space/account-deletion |
| Content is 18+ | Yes |

## Store listing

Short description (max 80 characters):

```
Book vetted Companions for online or in-person company, safely.
```

Full description (max 4000 characters):

```
Let's Be Friends is a trust-first way to find company for everyday moments: a
coffee, a walk, a museum visit, a video call, or an event you would rather not
attend alone.

Every Companion passes identity review before appearing in discovery, so the
person you meet has been checked by our safety team. Members also complete
identity review before their first booking.

WHAT YOU CAN DO

- Discover Companions near you by activity, city, and session format.
- Book an online session or an in-person session with a clear rate and duration.
- Message before and after the booking, with reports and blocking available in
  every conversation.
- Pay through the app wallet, top up with PayMongo, and keep a record of every
  booking and transaction.
- Leave a review after a completed experience, and read reviews from other
  members.
- Join Circles to talk with people who share your interests, and follow members
  whose posts you enjoy.

BUILT FOR SAFETY

- Identity review for members and Companions.
- Approximate location only. Exact meeting details stay in the booking.
- In-app reporting, blocking, and moderation.
- Clear boundaries and rates before you book.
- Account deletion in Settings at any time.

COMPANIONS

If you enjoy hosting, listening, and showing people around, you can apply to
become a Companion. Add your rate, availability, and the activities you offer.
Companion sessions are real-world services arranged through the app.

Companions must be 18 or older. Let's Be Friends does not facilitate sexual
services, and Companions set their own boundaries.

Support: letsbefriends896@gmail.com
Terms: https://www.letsbefriends.space/terms-and-conditions
Privacy: https://www.letsbefriends.space/privacy-policy
```

Release notes for 0.1.7:

```
First release. Discover vetted Companions, book online or in-person sessions,
message safely, manage your wallet, and delete your account from Settings.
```

## Graphics and screenshots

| Asset | Requirement | State |
| --- | --- | --- |
| App icon | 512 x 512 PNG, 32-bit, no transparency, under 1 MB | Ready: `docs/play-store-assets/icon-512.png` |
| Feature graphic | 1024 x 500 PNG or JPEG, no transparency | Ready: `docs/play-store-assets/feature-graphic-light-1024x500.png` and the dark variant |
| Phone screenshots | 2 to 8 images, 9:16 or 16:9, minimum 320 px, PNG or JPEG | 5 captured at 1080 x 1920, see below |
| 7 inch tablet screenshots | Optional, 2 to 8 | Skipped |
| 10 inch tablet screenshots | Optional, 2 to 8 | Skipped |
| Promo video | Optional, YouTube URL | Skipped |

Phone screenshots in `docs/play-store-assets/`, captured 2026-11-20 from the
emulator with the production APK, 1080 x 1920, flattened, each under 300 KB:

1. `phone-01-discovery.png`, Explore with filters and verified badges
2. `phone-02-companion.png`, Companion profile with Strengths, rate, availability
3. `phone-03-booking.png`, booking request form
4. `phone-04-conversation.png`, chat with the booking context card
5. `phone-05-wallet.png`, balance, reserved, pending, QR Ph top-up

The production data in shots 2 and 4 is test content with typos, so replace them
with polished screens before the production launch. Development deployment data
is cleaner, but capturing it needs a preview build pointing at
`rosy-poodle-216`.

All five use the light theme. If you want a dark theme shot in the set, switch
the app to Dark in Settings and recapture one screen, then swap it in.

## Data safety answers

Match these to the current app behavior. Each answer below is grounded in the
schema and the code paths, not in marketing copy.

| Section | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | Yes |
| Is all user data encrypted in transit? | Yes, TLS everywhere |
| Can users request that their data be deleted? | Yes, in Settings and at /account-deletion |
| Does the app collect data from children? | No, 18+ only |

Data collected:

| Data type | Collected | Shared | Purposes | Required or optional |
| --- | --- | --- | --- | --- |
| Name (display name, first and last name) | Yes | Yes, to other members | App functionality, account management | Required for a profile |
| Email address | Yes | No | Account management, authentication | Required to sign in |
| User IDs | Yes | No | Account management, fraud prevention | Required |
| Other personal info (username, bio, city or area) | Yes | Yes, to other members | App functionality | Required for a public profile |
| Approximate location | Yes | Yes, rounded area shown to other members | App functionality, discovery, safety | Required for discovery |
| Photos and videos (profile photo, posts, reviews, chat attachments, ID image, selfie) | Yes | Yes, to other members; ID image only to the identity field reader | App functionality, identity review, safety | Photos optional, ID image and selfie required for identity review |
| Files and documents (chat attachments) | Yes | Yes, to the recipient | App functionality | Optional |
| Messages (in-app chat) | Yes | Yes, to the recipient | App functionality, safety review after a report | Required for chat |
| Financial info: purchase history (bookings, top ups, withdrawals) | Yes | No | App functionality, accounting, fraud prevention | Required to pay |
| Financial info: other (payout bank account, encrypted at rest) | Yes | Yes, to PayMongo for payouts | App functionality, payouts | Required to withdraw as a Companion |
| App activity: in-app actions and user-generated content (posts, comments, likes, saves, follows, bookings) | Yes | Yes, public content to other members | App functionality, recommendations, safety | Required for social features |
| Device or other IDs (Expo push token, app installation ID) | Yes | Yes, to Expo for push delivery | App functionality, notifications | Optional, members can decline notifications |

Not collected: precise location, phone number, contacts, calendar, health and
fitness, browsing history, installed apps, crash logs, diagnostics.

Also declare no advertising ID use. The app has no ad SDK and does not read the
advertising ID, which Play asks about separately under App content.

Third parties that receive data: Clerk for authentication, Convex for hosting,
PayMongo for payments and payouts, Expo for push delivery, OpenAI for the ID field
reader only, and map tile providers for map display. The Privacy Policy lists
these categories.

## The 10 app content declarations

Play lists these under App content. All ten were unstarted on 2026-11-19.

| Declaration | Answer |
| --- | --- |
| Privacy policy | `https://www.letsbefriends.space/privacy-policy` |
| Ads | No ads |
| Sign in details (app access) | Reviewer account credentials and the instructions below |
| Content ratings | Questionnaire answers below |
| Target audience and content | 18 and over only, no child-directed content |
| Data safety | Table above |
| Advertising ID | No. The app does not use the advertising ID or any ad SDK |
| Government apps | No |
| Financial features | No financial products. The app takes payment for real-world services through PayMongo and holds booking credit. It does not lend, bank, trade securities, or handle crypto |
| Health apps | No health features |

Answer the financial features questions truthfully rather than picking the shortest path. The app is a booking marketplace, not a financial product, and declaring otherwise would both be inaccurate and force an organization account.

## Content rating questionnaire

Use category Social networking and these answers:

| Question | Answer |
| --- | --- |
| Violence, blood, or gore | No |
| Sexuality or suggestive content | No |
| Profanity or crude humor in the app's own content | No |
| Users can create and share content | Yes |
| Users can interact online, including strangers | Yes |
| Users can share their location with other users | Yes, approximate area and booking meeting details |
| Users can purchase real-world goods or services | Yes, Companion sessions |
| Digital goods purchase | No |
| Gambling, simulated gambling | No |
| Alcohol, tobacco, drugs | No |
| Fear or horror themes | No |
| Ads | No |

Expect an 18+ style rating from IARC given the social and location answers. That
matches the app's Terms.

UGC requirements: Play requires reporting, blocking, and moderation for apps with
user-generated content, and this app already has all three. Note that in the
reviewer notes.

## App access instructions for reviewers

Sign-in is Google only, so the reviewer account must be a Google account that you
create for this purpose. Do not hand over a personal Google account, since review
access includes everything that account can reach.

Prepare it in this order:

1. Create a dedicated Google account, for example `lbf.reviewer@gmail.com`.
2. Install the production build and sign that account in once, so the member row
   exists in Convex.
3. Run the internal mutation that approves identity and funds the wallet:

```bash
cd apps/web
npx convex run --prod internal:reviewerAccess.prepareReviewerAccount \
  '{"confirm":"reviewer","clerkUserId":"<clerk user id>","fundCentavos":50000}'
```

The mutation is idempotent, writes an audit entry, and credits the balance through
the wallet ledger with `test_member_credit`, so no balance is edited by hand.

Then paste these instructions into the declaration:

```
Test member account: lbf.reviewer@gmail.com
Password: <paste it from your password manager>

The account is already identity approved and onboarded, with a ₱500.00 test
balance, so bookings and messaging work immediately.

Notes:
- Discovery, Circles, and profiles are visible after sign in.
- Booking a Companion needs no payment in the reviewer account; the wallet is
  pre-funded with a test balance.
- Account deletion is at Settings, Delete account. The public page is
  https://www.letsbefriends.space/account-deletion.
- Identity review normally requires a government ID. If you want to exercise
  that flow, ask us and we will reset the test account for it.
```

Create the reviewer account before submitting, and keep it out of production data
if you use a dedicated environment.

## Payments declaration

Companion sessions are real-world services arranged in the app, not digital
goods. Under Play's Payments policy this app is not required to use Google Play
Billing. In the payments declaration, state that:

- The app arranges real-world Companion sessions.
- Payments are processed by PayMongo, a licensed Philippine payment provider.
- Google Play Billing is not used because no digital content is sold.

Also review the Financial features declaration. The app collects payments and
supports Companion payouts, but it is not a bank or lender. Declare payments and
payouts honestly and do not claim banking features.

## Closed testing plan

For a personal developer account created after November 2023:

1. Create the app and upload the first AAB to the internal track.
2. Move to closed testing with at least 12 testers who stay opted in for 14
   continuous days.
3. Apply for production access after that window.
4. Keep the tester list and the dates, since Play asks for them.

The 14 days cannot start until `eas submit` works, which needs the service
account, so the order is: create app, create service account, build AAB, submit to
internal, then open closed testing.

## What only the owner can fill

- Support email address, and who monitors it.
- Developer name and address shown on the listing.
- Screenshots and feature graphic from a real device.
- Test member account credentials for reviewers.
- The 12 tester email list.
- Play Console account type, personal or organization.

## Related documents

- [play-store-readiness.md](play-store-readiness.md) tracks what is done and what
  is missing.
- [play-store-release.md](play-store-release.md) covers the build and credential
  path.
- [account-deletion.md](account-deletion.md) covers what deletion does, for the
  data safety answers.
