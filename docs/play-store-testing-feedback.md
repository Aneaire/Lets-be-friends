# Closed testing feedback log

The production access application asks what testers reported and what changed as
a result. Reconstructing that at the end produces vague answers, which is the
most common reason an application is refused. Keep this file current during the
test window, one row at a time.

## Test window

| Field | Value |
| --- | --- |
| Track | Closed testing, Alpha (`4699910311318565468`) |
| Invited testers | 16 emails in [play-store-assets/tester-emails.csv](play-store-assets/tester-emails.csv) |
| Required testers | 12 opted in, continuously, for 14 days |
| Opted in | 5 of 12 on 2026-11-24, recheck the Testers tab before applying |
| Window start | Not started. Play starts counting the day the 12th tester opts in |
| Build under test | versionCode 15 (0.1.7), EAS build `88b08a47` |
| Countries | Philippines only |

## Testers

Use the invited email as the identifier. Engagement matters to the review, so
record whether each tester actually used the app rather than only installing it.

| Tester | Opted in | First session | Last session | Reports filed |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## Feedback log

One row per report. Keep the wording close to what the tester said; paraphrase
only to remove personal details.

| Date | Tester | Area | Reported | Severity | Resolution | Fixed in |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

Severity scale:

- **Blocker**: the app cannot be used, or a payment or account action fails.
- **Major**: a main flow breaks but a workaround exists.
- **Minor**: confusing copy, spacing, or a small visual defect.
- **Idea**: not a defect, a request for something new.

Areas worth tracking separately because they carry policy weight: account
deletion, privacy and permissions, sign-in, bookings, messaging, and payment.

## Fixes shipped because of testing

The review reads this as proof that the test was real. Aim for at least three
entries with a named tester or a dated report behind each one.

| Build | Change | Triggered by |
| --- | --- | --- |
| 14 (0.1.7) | Removed broad photo and video permissions, system photo picker on Android 13 and above | Play declaration review |
| 13 (0.1.7) | Account deletion no longer crashes the app after the Clerk identity is removed | Testing the deletion flow |
| 15 (0.1.7) | App links declared on the www host only, so Play can verify them | Deep link domain check |

## Stability summary

Take the numbers from Play Console, Quality, Android vitals. Reviewers can see
the same screen, so quote it rather than describing it.

| Build | Crashes | ANRs | Notes |
| --- | --- | --- | --- |
| 15 |  |  |  |

## Rules that keep the test valid

- Testers must not complete a paid booking with a real Companion. Payments are
  live in production. If one happens, refund it, note it here, and tell the
  tester why.
- Testers who leave the test or lose access to their Google account stop
  counting. Keep 15 or 16 invited so a dropout does not restart the 14 days.
- A day with fewer than 12 opted in ends the run. The count restarts from the
  next day that 12 are active.
- New builds during the window are fine and do not reset the clock.

## Production access application draft

Fill this in as the test runs, then paste the finished answers into Play Console.

**How did you recruit testers?**
Channel by channel, with rough numbers per channel.

**How engaged were they?**
Opted-in count over time, sessions per tester, and how many reported something.

**What feedback did you collect and what did you change?**
Three to five concrete items, each with the report and the build that fixed it.

**Why is the app ready for production?**
Stable builds, complete store listing and declarations, working deletion and
privacy flows, no open blocker reports.

## Ready to apply

- [ ] 12 or more testers opted in for 14 continuous days
- [ ] Every blocker and major report closed, with the fix recorded above
- [ ] At least three improvements traceable to tester feedback
- [ ] No unrefunded paid booking by a tester
- [ ] Store listing, screenshots, and the data safety form still match the shipped build
- [ ] Reviewer account still signs in and shows the prepared test balance
