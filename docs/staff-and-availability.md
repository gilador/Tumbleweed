# Staff List & Availability — User Interactions

The Staff List is the left rail that lists every worker; the Availability section is the right pane that shows the selected worker's `(post, hour)` availability grid. Together they drive `userShiftData[*].constraints`, which the LP optimizer reads to decide who can fill each slot.

## Surfaces

| Component | File | Role |
|-----------|------|------|
| `WorkerList` | `src/components/WorkerList.tsx` | Desktop staff rail — names, selection, edit-mode checkboxes, assignment counts, scroll affordances |
| `WorkerListActions` | `src/components/WorkerListActions.tsx` | Edit-mode toolbar — add user, delete checked, select all, reset all availability |
| `AvailabilityTableView` (`mode="availability"`) | `src/components/AvailabilityTableView.tsx` | Desktop availability grid (posts × hours) for the selected user |
| `AvailabilityCopyBar` | `src/components/AvailabilityCopyBar.tsx` | Copy-to-other-days actions in weekly mode |
| `DayTabStrip` | `src/components/DayTabStrip.tsx` | Day picker with per-day indicators (`full` / `partial` / `empty`) |
| `StaffTab` | `src/components/mobile/StaffTab.tsx` | Mobile staff list |
| `StaffAvailability` | `src/components/mobile/StaffAvailability.tsx` | Mobile availability editor (post-grouped time-slot list) |

## Backing Logic

| Module | File | Role |
|--------|------|------|
| `useUserHandlers` | `src/hooks/useUserHandlers.ts` | `addUser`, `updateUserConstraints`, `updateUserName`, `removeUsers`, `handleUserSelect`, `resetAllAvailability` |
| `getDefaultConstraints` | `src/service/shiftManagerUtils.ts` | Builds an all-`true` `Constraint[][]` for a roster's posts × hours |
| `getDaySlice` / `getDisplayTime` | `src/service/weeklyScheduleUtils.ts` | Slice the flat hour grid into per-day windows in 7D mode |

State shape:
- `userShiftData: UserShiftData[]` — global, one entry per worker.
- `userShiftData[i].constraints: Constraint[][]` — `[postIndex][hourIndex]` → `{ postID, hourID, availability }`. Mirrors the active roster.
- `userShiftData[i].constraintsByRoster: Record<rosterId, Constraint[][]>` — full per-roster availability so switching rosters preserves each user's pattern.

## Staff List Interactions

### 1. Browse

- `WorkerList` renders every `User` from `recoilState.userShiftData`. Empty state shows a `IconUser` icon, `noWorkersAddedYet` title, and a `clickToAddWorker` hint.
- A `ResizeObserver` + scroll listener tracks `canScrollUp` / `canScrollDown`; when the list overflows, chevron buttons appear at the top and bottom (`WorkerList.tsx:38`) and smooth-scroll to the matching end.
- When any assignments exist (`hasAnyAssignments`), each row shows a small pill with that user's assignment count (`getAssignmentCount`) — the pill flips colors when the row is the active selection.

### 2. Select

- Clicking a worker row calls `handleUserClick` → `onSelectUser(userId)` → `handleUserSelect(userId)` (`useUserHandlers.ts:93`).
- Selection is **toggle**: clicking the already-selected user deselects them (`selectedUserId === userId ? null : userId`, `WorkerList.tsx:66`).
- Clicks are ignored while `isEditing` is `true` (`WorkerList.tsx:62`); only the checkbox is interactive in edit mode.
- Selecting a user:
  - Loads their `constraintsByRoster[activeRosterId]` (or `constraints` fallback) into the `AvailabilityTableView` on the right.
  - Highlights every assignment cell where `assignments[p][h] === selectedUserId` across the assignment block and the weekly grid.
  - In 7D mode, lights up the day tabs where the selected user has any assignment (`assignmentHighlightedDays`).
- Toggling **edit mode on** automatically deselects (`handleUserSelect(null)` in `ShiftManager.tsx:318`) so the availability pane goes blank.

### 3. Inline Rename

- In edit mode, each row's `ActionableText` exposes a rename affordance. Submitting calls `onUpdateUserName(userId, newName)` → `updateUserName` (`useUserHandlers.ts:72`), which patches `userShiftData[i].user.name`.
- Renames are immediate; there's no confirmation. The `EditableText`/`ActionableText` pair handles `Enter` to save and `Escape` to cancel.

### 4. Bulk Selection

Same shift-click range pattern as the post list:

- `onCheckUser(userId, event)` (`ShiftManager.tsx:652`):
  - **Plain click** ⇒ append to `checkedUserIds`.
  - **Shift+click** ⇒ uses `lastCheckedUserRef` to add the contiguous range between the previous click and the current one.
- `onUncheckUser(userId)` removes the id from `checkedUserIds`.
- `WorkerListActions` exposes a **Select all** toggle (`IconSelectAll` ↔ `IconDeselect`) that flips between every-id and empty.

### 5. Bulk Operations

`WorkerListActions` (visible only when `isEditing`) groups four actions in a pill toolbar:

| Action | Icon | Handler | Effect |
|--------|------|---------|--------|
| **Add user** | `IconPlus` | `addUser` → `handleAddUser` | Inserts a new `UserShiftData` at the head of `userShiftData`. Generates a default name (`defaultMember`). Builds a fresh all-available `constraintsByRoster` for **every** roster, not just the active one, so the user is consistent across rosters. Shows `userWasAddedToStaff` toast. |
| **Delete checked** | `IconTrash` | `handleDelete` → confirmation `Dialog` → `onRemoveUsers(checkedUserIds)` | Confirmation dialog title is `deleteStaffConfirm` with the count. On confirm, `removeUsers` filters them out of `userShiftData`. Cancels with `no`. After delete, `checkedUserIds` is reset and `checkAllEnabled` is reset. |
| **Select all** | `IconSelectAll` / `IconDeselect` | `handleCheckAll` | Local `checkAllEnabled` state drives the icon; calls `onCheckAll(allWasClicked)`. Parent fills `checkedUserIds` with every user id or clears it. |
| **Reset all availability** | `IconRestore` | `handleResetAvailability` → confirmation `Dialog` → `onResetAllAvailability` | Confirmation dialog (`resetAllAvailabilityTitle` / `resetAllAvailabilityDescription`). On confirm, `resetAllAvailability` rebuilds `constraints` and `constraintsByRoster` for **every user** and **every roster** to all-`true` via `getDefaultConstraints` (`useUserHandlers.ts:98`). |

The toolbar is hidden via CSS (`-translate-y-12 opacity-0 pointer-events-none`) when not editing, but always present in the DOM.

## Availability Section Interactions (Desktop)

The grid only renders when a user is selected. With no selection, the panel shows a centered tumbleweed animation (`tumbleweed-anim.gif`) with `emptyStateTitle` and `pickStaffMember` copy (`AvailabilityTableView.tsx:574`).

### 1. Per-cell Toggle

- Click any `(post, hour)` cell ⇒ `toggleAvailability(postIndex, flatIndex)` (`AvailabilityTableView.tsx:295`).
- The cell shows a check (`IconCheck` on dark) when `availability === true` and an X (`IconX` on light) when `false`.
- Optimistic local state (`optimisticLocalConstraints`) updates the UI immediately; the parent then commits via `onConstraintsChange` → `updateUserConstraints` (`useUserHandlers.ts:48`), which patches both `constraints` and `constraintsByRoster[activeRosterId]`.
- **Infeasibility guard**: `wouldCreateInfeasibleSlot` (`AvailabilityTableView.tsx:266`) counts how many users are still available for the slot. If toggling this user to unavailable would leave **zero** users on the slot, the toggle is blocked and a `cannotMakeUnavailable` `alert()` is shown.
- The grid is opacity-dimmed and `pointerEvents: none` while `isEditing` is `true`, so renames in edit mode can't accidentally toggle availability (`AvailabilityTableView.tsx:743`).

### 2. Row / Column Toggles

- **Post row** — hovering a post name reveals a circular toggle (`togglePostRowAvailability`, `AvailabilityTableView.tsx:348`). It checks whether all of that post's slots in the visible day are currently available; if so, it sets the whole row to unavailable, otherwise to available.
- **Hour column** — hovering an hour header reveals a similar toggle (`toggleHourColumnAvailability`, `AvailabilityTableView.tsx:391`) with the same all-or-nothing logic on the column.
- Both go through the optimistic-state path and emit `onConstraintsChange`.

### 3. Header-bar Bulk Actions

Two buttons in the panel header (visible only when a user is selected):

- **All available** (`handleReset`, `AvailabilityTableView.tsx:437`) ⇒ rewrites every constraint to `availability: true` and emits the `availabilityResetToAllAvailable` toast.
- **Unavailable** (`handleSetAllUnavailable`, line 462) ⇒ rewrites every constraint to `availability: false` and emits the `availabilitySetToAllUnavailable` toast.

### 4. Weekly-mode Day Controls

When `scheduleMode === "7d"`:

- **Day tab strip** at the top of the grid drives `selectedDay` (0–6). Each tab carries a `DayIndicator` colour:
  - `"full"` — every visible slot is available.
  - `"empty"` — none are.
  - `"partial"` — mixed (computed from `effectiveAvailabilityConstraints` over each day's slice).
- **All day available / All day unavailable** buttons (`toggleDayAvailability(selectedDay, true|false)`, `AvailabilityTableView.tsx:486`) flip every slot in just the selected day's slice.
- **`AvailabilityCopyBar`** below the day tabs offers three copy buttons:
  - `copyToAllDays` — copy the source day's pattern into the other six.
  - `copyToWeekdays` — copy into the locale-specific weekday indices (excluding the source if it falls within them).
  - `copyToWeekend` — copy into weekend indices.
  Each calls `handleCopyAvailability(targetDayIndices)` (`AvailabilityTableView.tsx:230`), which slices the source day's constraints and writes them into each target day's slice without disturbing other days.

### 5. Optimistic Sync

- `optimisticLocalConstraints` is reset to `null` whenever the underlying `availabilityConstraints` prop or `user.id` changes (`AvailabilityTableView.tsx:522`), so switching users or receiving a server-side update wipes any uncommitted UI state.
- All toggles funnel through `setOptimisticLocalConstraints(newConstraints) → onConstraintsChange(newConstraints)` so the pane never feels laggy even if the parent is doing extra work (e.g., persistence to Drive or the server).

## Mobile Equivalents

### Staff List (`StaffTab`)

- Same selection + add/remove/edit semantics, but selecting a worker navigates to a dedicated `StaffAvailability` page rather than splitting the screen.

### Availability (`StaffAvailability`)

- Top bar — back button (returns to staff list) and the user's name with `– availability` suffix.
- **Day tabs + copy bar** in 7D mode, identical behaviour to desktop.
- **Bulk actions row** — `allAvailable` and `allUnavailable` buttons that call `setAll(true|false)` (`StaffAvailability.tsx:75`), rewriting every constraint at once.
- **Post sections** — one collapsible card per post:
  - Tapping the post header runs `togglePost(postIndex)` — flips every slot in that post (for the visible day window).
  - The header shows `availableCount/total` plus a check mark when all are available.
  - Each time-slot row is a tappable button calling `toggleSlot(postIndex, flatIndex)` ⇒ `onUpdateConstraints(userId, newConstraints)`.

The mobile flow does **not** have the desktop's infeasibility guard — taps are unconditional.

## Cross-section Behaviour

- **Edit mode is shared** across staff and post lists. Toggling it via the `EditButton` reveals both `WorkerListActions` and `PostListActions` toolbars and unlocks inline rename + checkbox UI everywhere.
- **`selectedUserId` is the bridge**: it controls which user the availability grid edits, which assignment cells are highlighted, and (in 7D) which day tabs are highlighted in the assignment view.
- **Multi-roster**: every constraint write touches both `constraints` (mirror of active roster) and `constraintsByRoster[activeRosterId]`. Adding a user pre-builds an entry per roster; resetting availability rebuilds entries for every roster.
- **No optimistic UI on the mobile path** — `StaffAvailability` writes synchronously through `onUpdateConstraints` on every tap.

## Validation & Safety

- **Last-available-user guard** (desktop): can't toggle a user off if they're the only available staff for that slot.
- **Delete confirmation** (both staff and post lists): two-step confirm dialog with explicit `onceDeletedNoUndo` warning; cancel leaves state untouched.
- **Reset-availability confirmation**: separate dialog from delete, since the action is irreversible across all rosters.
- **Add user is non-destructive** — no confirmation needed; the new user starts fully available across every roster.
