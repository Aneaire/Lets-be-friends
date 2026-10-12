# Companion profile work handover

Date: 2026-10-11  
Workspace: `/home/aneaire/Projects/lets-be-friends`  
Branch: `main`  
Status: category dialog implementation in progress, not committed or pushed.

## User requests and completed work

1. Fix the mobile Companion creation layout shown in the user's screenshot.
2. Commit and push that fix.
3. Add a dialog in step 2 so users can browse categories, using React Intersection Observer to load more categories as they scroll.
4. Create this handover and a prompt to resume the work.

The mobile layout repair is complete and pushed to `origin/main`:

- Commit: `8c3da25`, `fix(web): prevent mobile Companion editor actions from covering fields`.
- Save actions now follow the fields in normal flow instead of covering the motivation field.
- The first-step action fills the row without an empty spacer.
- Mobile requirements stack beneath their labels.
- Preview and review cards retain consistent spacing.
- Includes component/style regression tests and `CompanionEditorLayout.stories.tsx` for 320, 390, and 430 pixels.

That commit contains only the five Companion layout files. Unrelated mobile, safety, and Frienday work remains in the shared worktree.

## Current category-dialog implementation

Uncommitted implementation has been written in:

- `apps/web/src/features/companion-application/ActivityCategoryPicker.tsx`
- The category-picker/category-browser rules in `apps/web/src/styles.css`

Read the current files and `git diff` before resuming. Do not overwrite the partially implemented feature.

Current component changes:

- Replaces the inline category browser with a self-blue **Browse categories** button.
- Keeps removable selected activity chips and the existing custom category entry outside the dialog.
- Uses the shared `Dialog`, `SearchField`, and `Button` components.
- Opens **Browse activity categories**, with search, multi-selection, and a **Done** footer.
- Uses `useInView` from the installed `react-intersection-observer` dependency.
- Uses the actual bounded `.category-browser-scroll` element as the observer root.
- Renders batches of 12, with a **Load more categories** fallback.
- Resets search and visible count on reopen and query changes.
- Guards selection additions with the supplied maximum and allows removal at the limit.
- Uses self-blue semantic styles and a single-column list on narrow screens.

The list is local: `packages/shared/src/index.ts` exports 51 standard `activityCategories`, `maximumCompanionActivityCategories = 10`, normalization, and custom-category validation. Progressive loading means rendering more local options, not making network requests.

`ActivityCategoryPicker` is used by `apps/web/src/routes/become-companion.tsx` in step 2. The onboarding application component has a separate picker; do not change it as part of this task.

## Work still required

1. Review the partial component and CSS for correctness and responsive sizing.
2. Verify observer pagination across repeated scrolls and search changes. The current sentinel is persistent and `onChange` loads on entry; prove that it rearms correctly, stops at the end, avoids runaway loading, and does not stall after a query change while still in view.
3. Check scroll reset on search/reopen and that search, footer, and options remain accessible in short mobile viewports.
4. Update `apps/web/tests/components/ActivityCategoryPicker.test.tsx`. At the handover snapshot it still tests the old inline browser and Show more behavior, so those expectations need replacement.
5. Add Storybook coverage for the new picker/dialog. At the handover snapshot no category-browser story exists yet.
6. Add deterministic component tests for opening/closing, observer-root and paging behavior, searched batches, end-of-list, no matches/reset, preserved selections, maximum enforcement/removal, custom validation, and reopening.
7. Add browser story interactions that prove real scrolling loads further options, search works, Escape/Done close correctly, opener focus restores, and mobile/desktop light/dark layouts are usable.
8. Run focused checks, then the required repository gates. Review and preserve unrelated changes.
9. Report the result and any failed gates accurately. The user has not yet requested a commit/push for this new category-dialog change.

## Existing patterns and references

- `apps/web/src/features/discovery/CategoryFilterDialog.tsx` and its tests/stories show modal search and focus patterns. Its category option accents are social pink, so do not copy that accent for Companion setup.
- `apps/web/src/design-system/molecules/Dialog.tsx` provides portals, Escape/backdrop dismissal, focus trapping, focus restoration, and body scroll locking.
- `apps/web/src/design-system/molecules/SearchField.tsx` provides search and clearing.
- `apps/web/src/design-system/atoms/Button.tsx` provides semantic intents.
- `docs/testing.md` is the testing contract.
- React Intersection Observer documentation: https://github.com/thebuilder/react-intersection-observer . Inspect installed types/source for the version actually used.

## Routing and workspace rules

Follow the user-provided global instructions and repository `AGENTS.md`.

- First coding attempts must use the instructed OpenCode model. The repository explicitly requests Muse: `opencode-go/muse-spark-1.3-contributor`.
- That exact model was attempted for both tasks and failed because an active OpenCode Go subscription is required. The category attempt wrote no code.
- The instructed escalation fallback is a collaboration agent using `gpt-5.6-sol` with `medium` reasoning. The partial category implementation came from this fallback.
- Do not silently substitute another OpenCode model. If the required capability remains unavailable, use the explicitly authorized escalation or disclose the blocker.
- Preserve black-and-white light/dark styling. Self/profile/setup actions use semantic blue. Discovery/social actions use pink. No hard-coded logo colors in JSX, no gradients, and no user-facing em dashes.
- Scan `apps/web/src` and `apps/admin/src` for user-facing em dashes before handing back UI work.

The worktree has many concurrent, unrelated edits, particularly mobile parity changes, `FriendayGuide`, and safety copy/layout. `styles.css` includes unrelated `.safety-report-steps` changes. Never stage the entire stylesheet or all files indiscriminately. Use selective staging if later asked to commit.

## Verification history and current limits

For the completed mobile layout fix:

- Focused Companion tests: 13 passed.
- Focused layout browser stories: 3 passed.
- Full web/admin Storybook run: 227 passed.
- Both Storybook builds and UI static checks passed.
- Web typecheck passed after the layout story was added.
- Light/dark mobile fixture previews were inspected through T3 Code.
- The local application browser was signed out, so the authenticated production flow and physical-phone keyboard behavior were not verified.

Full repository gates were run repeatedly. Baseline runs passed, but later runs encountered changing unrelated work:

- Mobile Circle test: `circleActionError` returned the fallback instead of the backend error.
- Mobile syntax error in `SocialFeedCard.tsx`: two imports were concatenated on line 21, blocking a later typecheck/build run.
- Mobile Storybook runner: dependency transform parse error in `expo-image-picker/src/ImagePicker.ts`.
- A web `SocialComments` test timed out in a loaded full-suite run, then passed in a focused retry with the Companion tests (15 tests total).

These are historical observations, not claims about the current files. Concurrent workers may have repaired them. Re-run current checks and do not alter unrelated code merely to clear this task's gates.

No tests or typecheck results have yet been established for the new category-dialog implementation at this handover snapshot.

Required final commands:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm validate:ui
```

`validate:ui` covers static UI checks, both Storybook builds, and both Storybook browser suites. For a direct web Vitest run on Node 26, use `NODE_OPTIONS=--no-experimental-webstorage` as described in `docs/testing.md`. Avoid concurrent heavy compilations and tests if they cause unrelated timeouts.

Prior logs are in `/tmp/lbf-companion-*.log`; they may disappear between sessions. They describe the earlier layout task, not successful validation of the new category feature.

## Browser context

A web development server was available at `http://localhost:3000` and a web Storybook server at `http://localhost:6006`. Check availability again. Prefer T3 Code `preview_status`, `preview_open` if needed, and the `preview_*` tools. Do not assume the browser is authenticated. Use a real picker Storybook harness to verify this feature without production-account writes.

## Copy-and-paste continuation prompt

```text
Continue the Companion profile category-browser work in /home/aneaire/Projects/lets-be-friends. Read docs/companion-profile-handover-2026-10-11.md, AGENTS.md, and docs/testing.md first, then inspect the current git status and diff. The prior mobile layout fix is already pushed as 8c3da25. The new step-2 category dialog is partially implemented and uncommitted in ActivityCategoryPicker.tsx and the category CSS. Complete and review it without overwriting unrelated mobile, safety, or Frienday changes.

The user wants a dialog for browsing and selecting categories with react-intersection-observer loading further options on scroll. Preserve selected removable chips, custom categories, the 10-category limit, semantic self-blue styling, black/white light and dark themes, and existing submission behavior. Verify repeated observer pagination inside the actual dialog scroll root, search/reset/reopen behavior, end-of-list, accessible fallback loading, keyboard closure/focus restoration, and mobile sizing. Update the old picker tests and add real Storybook scroll/interaction coverage.

Follow the required coding-worker routing. The exact OpenCode Muse model was already attempted for this task and blocked by the inactive Go subscription; use the authorized gpt-5.6-sol medium escalation if that remains the blocker. Review all changes, run focused tests and the required pnpm typecheck/test/build/validate:ui gates, and disclose current failures rather than assuming historical failures persist. Finish the implementation and report results. Do not commit or push the new category-dialog changes unless I ask.
```
