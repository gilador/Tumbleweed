# Shift Assignment Block — User Interactions

The Shift Assignment block is the core grid where the manager sees who is assigned to which `(post, hour)` slot and edits assignments. It exists in two forms — a desktop daily/weekly grid (`AvailabilityTableView` in `mode="assignments"`) and a mobile day list (`AssignmentsTab`) — plus a compact weekly read-only grid (`WeeklyRosterGrid`). All three drive the same Recoil state via the same handler hooks.

## Surfaces

| Component | File | Role |
|-----------|------|------|
| `AvailabilityTableView` (`mode="assignments"`) | `src/components/AvailabilityTableView.tsx` | Desktop assignment grid (posts × hours), inline rename, post bulk-select |
| `WeeklyRosterGrid` | `src/components/WeeklyRosterGrid.tsx` | Compact 7-day grid, click-to-reassign dropdown (desktop) / tap-to-reveal (mobile) |
| `AssignmentsTab` | `src/components/mobile/AssignmentsTab.tsx` | Mobile day view grouped by time or by post, opens `ReassignSheet` |
| `ReassignSheet` | `src/components/mobile/ReassignSheet.tsx` | Mobile bottom sheet for picking a worker / unassigning |
| `PostListActions` | `src/components/PostListActions.tsx` | Edit-mode toolbar — add post, delete checked, select all |

## Backing Logic

| Module | File | Role |
|--------|------|------|
| `useAssignmentHandlers` | `src/hooks/useAssignmentHandlers.ts` | `handleAssignmentChange`, `handleAssignmentNameUpdate`, `handleClearAllAssignments` |
| `usePostHandlers` | `src/hooks/usePostHandlers.ts` | `addPost`, `handlePostEdit`, `handlePostCheck`, `handlePostUncheck`, `handlePostCheckAll`, `handleRemovePosts` |

State shape on the active roster:
- `assignments: (string | null)[][]` — `[postIndex][hourIndex]` → `userId | null`
- `manuallyEditedSlots: Record<slotKey, { originalUserId, currentUserId }>` — tracks slots the manager has overridden vs. the optimizer's output (`slotKey = "${postIndex}-${hourIndex}"`)
- `customCellDisplayNames: Record<slotKey, string>` — free-text labels typed in cells that don't match a known user name

## Interactions

### 1. View / Inspect

- **Desktop grid cell** — shows the assigned user's name or `–` when empty. The cell highlights (`colors.cell.selected`) when its user matches the currently selected user in the staff list (`selectedUserId`).
- **Weekly compact grid cell** — shows a 2-letter `badge` from `generateBadges`. Hover ⇒ tooltip with the full name. Tap (mobile) ⇒ reveals the full name in a popover (`revealCell` state in `WeeklyRosterGrid.tsx:102`).
- **Mobile cards** — `TimeCard` (group-by-time) and `PostCard` (group-by-post) lists. The current time slot is auto-expanded and badged with `now`.

### 2. Add an Assignment

There is no "add" action separate from "edit" — every cell already exists for every `(post, hour)` pair as soon as posts and hours are configured. Assigning an empty cell goes through the same path as reassigning:

- **Desktop weekly grid** — click an empty cell ⇒ dropdown opens with `–` (unassign) and every staff member ⇒ pick one ⇒ `handleReassign(userId)` ⇒ `onAssignmentChange(postIndex, hourIndex, userId)` (`WeeklyRosterGrid.tsx:144`).
- **Desktop daily table** — enter edit mode (`EditButton`), click the cell name, type the worker's name, save. `handleAssignmentNameUpdate` looks up the typed name; if it matches a known user, it's converted to `handleAssignmentChange`; otherwise it's stored as a `customCellDisplayName` and a `manuallyEditedSlots` entry is recorded (`useAssignmentHandlers.ts:60`).
- **Mobile** — tap any cell in `TimeCard`/`PostCard` ⇒ `setReassignTarget` opens the `ReassignSheet` ⇒ tap a worker ⇒ `onAssign(userId)`. Workers who are not available for that slot are dimmed and disabled (`isAvailable` check in `ReassignSheet.tsx:52`).

The bulk way to populate empty assignments is the **Optimize** action (`FloatingActionButton` on mobile, optimize button on desktop) — it runs the LP optimizer and fills in `assignments` programmatically.

### 3. Edit / Reassign

Editing a populated cell uses the same UI paths as adding. The differences in state effects:

- `handleAssignmentChange(p, h, newUserId)` (`useAssignmentHandlers.ts:7`) reads the current `userId` in that slot. If `newUserId !== originalUserId`, it records a `manuallyEditedSlots[slotKey] = { originalUserId, currentUserId: newUserId }`. If a previous edit already exists for that slot:
  - If `newUserId === existingEdit.originalUserId` (the manager reverted to the optimizer's original), the edit entry is **deleted**.
  - Otherwise `currentUserId` is updated.
- Any `customCellDisplayNames[slotKey]` is cleared as soon as a real user is assigned.
- `handleAssignmentNameUpdate(p, h, name)` (used by the desktop inline rename) tries to resolve `name` to a known user. If it can, it falls through to `handleAssignmentChange`. If it can't, the typed string is stored in `customCellDisplayNames` and a `manuallyEditedSlots` entry is created so the slot is flagged as a manual override even though no `userId` was assigned.

The optimistic UI on the desktop cell (`AssignmentCell` in `AvailabilityTableView.tsx:48`) handles the rename round-trip: it shows the typed value immediately, syncs once the prop updates, and resets if Escape is pressed (`handleCancel`).

### 4. Remove an Assignment

- **Desktop weekly grid** — open the dropdown on a cell, click `–` ⇒ `handleReassign(null)` ⇒ slot is set to `null` and a `manuallyEditedSlots` override is recorded.
- **Mobile** — open `ReassignSheet`, tap **Unassign** at the bottom ⇒ `onAssign(null)` (`ReassignSheet.tsx:88`).
- **Desktop daily table** — clear the cell text in inline-edit mode; an empty string with no matching user is treated as a custom display name of `""`.
- **Clear all** — desktop and mobile both expose a destructive action that calls `handleClearAllAssignments`. It zeros out `assignments`, empties `manuallyEditedSlots`, and empties `customCellDisplayNames` (`useAssignmentHandlers.ts:112`). On mobile this is gated by a confirmation dialog (`isClearDialogOpen`).

### 5. Bulk Selection — Posts (rows)

Bulk operations target **post rows**, not individual assignment cells.

- Bulk selection lives behind the **edit mode** toggle (`EditButton`). When `isEditing` is true, each post name in the assignment table renders as an `ActionableText` with a checkbox.
- **Click a post checkbox** ⇒ `handlePostCheck(postId, event)` (`usePostHandlers.ts:104`):
  - **Plain click** ⇒ adds `postId` to `checkedPostIds`.
  - **Shift+click** ⇒ uses `lastCheckedPostRef` to add the contiguous range between the last-checked post and the current one (`usePostHandlers.ts:108`).
- **Uncheck** ⇒ `handlePostUncheck(postId)` removes the id.
- **Select all toggle** in `PostListActions` ⇒ `handlePostCheckAll(true|false)` ⇒ either fills `checkedPostIds` with every post id or clears it. The icon flips between `IconSelectAll` and `IconDeselect` based on local `checkAllEnabled` state.

### 6. Bulk Operations on Posts

`PostListActions` (`src/components/PostListActions.tsx`) is the only bulk-ops surface and is visible only while `isEditing` is true (a CSS slide-in). Three actions:

| Action | Handler | Effect |
|--------|---------|--------|
| **Add** (`IconPlus`) | `addPost` | Inserts a new post at the start of the active roster. Generates a default name (`defaultPost` translation) if none was typed, extends every user's `constraints` with a new row of `availability: true`, and adds a fresh `null` assignment row. Returns the new post's name for the success toast. |
| **Delete** (`IconTrash`) | `handleRemovePosts(checkedPostIds)` | Opens a confirmation `Dialog` showing the count (`deletePostsConfirm`). On confirm, removes the posts, splices the matching rows out of `assignments`, removes the same rows from every user's `constraints` and `constraintsByRoster[activeRosterId]`, and clears `checkedPostIds`. On cancel, no state changes. |
| **Select all** (`IconSelectAll` / `IconDeselect`) | `handlePostCheckAll` | Toggles between "all posts checked" and "no posts checked". Internal `checkAllEnabled` flag mirrors the icon. |

Toasts (`showSuccess(t("postWasAdded"))`) confirm successful adds; failures bubble through `showError`/`showInfo`.

### 7. Selection Highlight (cross-block)

Selecting a worker in the staff list (`selectedUserId`) does **not** select cells, but it visually highlights every assignment cell where `assignments[p][h] === selectedUserId`:

- Desktop daily table — `isCellSelected` flips the cell's class to `colors.cell.selected` (`AvailabilityTableView.tsx:847`).
- Weekly compact grid — same logic, plus the cell becomes `font-bold` (`WeeklyRosterGrid.tsx:228`).
- In weekly mode, the day-tab strip highlights every day where the selected user has at least one assignment (`assignmentHighlightedDays`, `AvailabilityTableView.tsx:210`).

### 8. Keyboard / Accessibility

- The shift-settings panel closes on `Escape` (`ShiftManager.tsx:171`).
- Inline edit on assignment cells supports `Enter`/`Escape` via `EditableText`. `Escape` triggers `handleCancel` which discards the optimistic name.
- `WeeklyRosterGrid` cells use `role="gridcell"` and stable `data-testid`s (`cell-{postIndex}-{hourIndex}`, `day-header-{idx}`).

### 9. Toast Feedback

User-visible operations on the assignment block emit toasts via `showSuccess` / `showInfo` / `showError`:
- `t("postWasAdded", { name })` after add.
- `t("availabilityResetToAllAvailable")` / `t("availabilitySetToAllUnavailable")` after the matching availability bulk actions.
- `t("alreadyOptimised")` when tapping the disabled FAB.
- `t("exportedToDrive")` on share success.

### 10. Side Effects on the Optimizer

Because `manuallyEditedSlots` records every divergence from the LP solution:

- A future re-optimize can preserve manual overrides (the LP can pin `assignments[p][h] === currentUserId` for any slot in `manuallyEditedSlots`).
- Reverting a slot to its original optimized value automatically deletes the override entry, so the slot is no longer pinned.
- `handleClearAllAssignments` wipes both `assignments` and `manuallyEditedSlots`, returning the roster to a fully unpinned state ready for a fresh optimize run.

## Mobile vs. Desktop Summary

| Action | Desktop | Mobile |
|--------|---------|--------|
| View name | Always visible | Tap cell to reveal (compact grid), or expand `TimeCard`/`PostCard` (cards view) |
| Reassign | Click cell ⇒ inline dropdown / inline rename | Tap cell ⇒ `ReassignSheet` bottom sheet |
| Unassign | Pick `–` in dropdown / clear text | Tap **Unassign** in sheet |
| Add post | `PostListActions` toolbar in edit mode | Same toolbar via `SettingsTab` |
| Delete posts | Bulk-check + `IconTrash` ⇒ confirm dialog | Same |
| Clear all assignments | Direct button | Trash icon ⇒ confirm dialog |
| Optimize | Toolbar button | Floating Action Button |
