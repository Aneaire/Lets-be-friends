# Notification catalog

The typed catalog in `apps/web/convex/notificationCatalog.ts` is the source of truth for notification setup. The Convex schema derives its accepted notification kinds from the catalog. In-app presentation, tap destinations, native push presentation, priority checks, privacy rules, and mute behavior also read catalog fields.

Each catalog entry records:

- the product family and active status;
- the backend actions that trigger it;
- the intended recipient;
- the destination opened by a tap;
- the allowed priority values;
- the lock-screen privacy and preview policy;
- whether block and mute preferences suppress it;
- the deduplication rule;
- the in-app copy and native push policy.

## Adding a notification

1. Add an entry to `notificationCatalog` with every required field.
2. Call `createNotification` from the owning backend action with one of the entry's allowed priorities and the target IDs required by its destination.
3. Add a producer integration test that proves the event creates one notification for the right recipient and does not create one for excluded actors.
4. Add presentation assertions for its in-app title, body, destination, native push copy, and privacy behavior.
5. Run the focused tests, Convex code generation with explicit deployment approval, and the repository typecheck, test, and build gates.

The catalog coverage test fails when an entry lacks tracking fields or produces empty copy. `createNotification` rejects a priority that its catalog entry does not allow. Since the schema reads the catalog keys, a catalog entry becomes a valid stored kind without a second hand-maintained list.
