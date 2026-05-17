# Shift Configuration

The Shift Configuration UI is the manager-facing surface that defines the time window the schedule covers and how that window is sliced into shifts. It is the input layer for the LP optimizer: every change here recomputes shift hours, rebuilds availability constraint slots, and may invalidate existing assignments.

## Surfaces

| Component | File | Role |
|-----------|------|------|
| `ShiftInfoSettingsView` | `src/components/ShiftInfoSettingsView.tsx` | Main settings panel — schedule mode, time window, intensity slider, capacity hint |
| `ShiftsRange` | `src/components/ShiftsRange.tsx` | Standalone start/end time inputs with duration validation |
| `ShiftHours` | `src/components/ShiftHours.tsx` | Read-only display of computed shift start times |
| `ShiftInformation` | `src/components/ShiftInformation.tsx` | Read-only summary of duration + rest time |
| `ShiftDuration` | `src/components/ShiftDuration.tsx` | Compact `HH:MM → HH:MM` typographic label used inline |

Backing logic:

| Module | File | Role |
|--------|------|------|
| `computeLevels` | `src/service/shiftLevels.ts` | Enumerates feasible/infeasible shift counts for a window |
| `useLevels` | `src/hooks/useLevels.ts` | React hook wrapping `computeLevels` against current state |
| `useScheduleMode` | `src/hooks/useScheduleMode.ts` | 24H ↔ 7D mode switching and start-date control |
| `generateDynamicHours` / `generateWeeklyDynamicHours` | `src/service/shiftManagerUtils.ts` | Build the hour grid the optimizer consumes |
| `shiftHourHelperService` | `src/service/shiftHourHelperService.ts` | Hour parsing/encoding helpers |

## Functionalities

### 1. Schedule Mode (24H vs 7D)

Toggle at the top of `ShiftInfoSettingsView`. Driven by `useScheduleMode`.

- **24H** — single-day schedule. Hour grid built via `generateDynamicHours`.
- **7D** — weekly schedule. Hour grid built via `generateWeeklyDynamicHours`. A date picker appears for the week's start date (`updateStartDate`).
- Switching modes calls `switchTo24H()` / `switchTo7D()` and rebuilds hours/assignments accordingly.

### 2. Time Window (Operation Hours)

Defines `startTime` → `endTime` for the active roster. Two ways to set it:

**Presets** (`activePreset`):
- `9to5` — 09:00 → 17:00
- `morning` — 06:00 → 14:00
- `noon` — 12:00 → 20:00
- `evening` — 16:00 → 00:00
- `24h` — 00:00 → 00:00
- `custom` — falls back to last manually-entered times

`detectPreset(start, end)` auto-selects the matching preset on load; manual edits flip the dropdown to `custom`.

**Manual entry** via two `TimeInput` fields. Either field flips the preset to `custom` and triggers `applyTimeChange`.

A live duration label (`opHours`) is shown next to the inputs. `ShiftsRange` exposes the same flow as a standalone card and rejects overnight windows (`endTotalMinutes <= startTotalMinutes` ⇒ `Invalid`).

### 3. Shift Intensity (Levels Slider)

Driven by `useLevels` → `computeLevels(opHours, posts, staff)`.

A "level" is a candidate **shift count** for the window where each shift duration divides cleanly into 15-minute increments (`(opHours * 4) % shiftCount === 0`). Each level carries:

- `shifts` — number of shifts
- `duration` — hours per shift
- `feasible` — whether `staff × ceil(shifts/2) ≥ shifts × posts` (the LP no-consecutive-slots bound)
- `neededSlots`, `availableSlots`, `shiftsPerWorker`, `workHours`, `restBetween`
- `staffGap` / `postGap` — when infeasible, how many extra workers are needed or how many posts must be removed

UI behavior:

- **No levels** ⇒ "no feasible schedule" message
- **One level** ⇒ centered single-dot indicator with stats; if infeasible, shows `needMoreStaff` hint
- **Multiple levels** ⇒ horizontal slider from `Few` (intense) → `Many` (relaxed). Feasible levels are clickable; infeasible dots are dimmed and show a hover tooltip explaining the gap.

Selecting a level invokes `handleLevelChange` → `setLevel(level.shifts)` → `applyLevel(level)`.

### 4. Capacity Hint

Below the time row, when a level is selected:

```
{staff} staff can cover {availableSlots} assignments
| {posts} posts × {shifts} shifts = {neededSlots} assignments needed
```

Color flips to red and a `⚠` appears when the level is not feasible.

### 5. "How It Works" Summary

Bottom card, shown only when a level is selected:

- Line 1: `{shifts}×{duration}h shifts · {posts} posts · {staff} staff`
- Line 2: `Each worker: {shiftsPerWorker} shifts, {workHours}h work · {restBetween}h rest between shifts`

### 6. Read-only Displays

- `ShiftHours` renders the computed shift start times as chips, or an `Invalid` state when none are computable.
- `ShiftInformation` renders rest time → duration with a `Configured` / `Invalid` badge.
- `ShiftDuration` renders a compact LTR `HH:MM → HH:MM` label (forced LTR even in Hebrew RTL).

## State Effects

Every change in `ShiftInfoSettingsView` (preset, manual time, level) flows through `applyLevel` or `applyTimeChange`, both of which:

1. Compute the new hour grid via `generateDynamicHours` or `generateWeeklyDynamicHours`.
2. Update the active roster's `startTime`, `endTime`, and `hours`.
3. Rebuild `userShiftData[*].constraints` so each user has an availability cell per `(post, hour)` pair, preserving prior values where the slot still exists and defaulting new slots to `availability: true`.
4. Mirror the rebuilt constraints into `constraintsByRoster[activeRosterId]`.
5. Clear `assignments` only when the hour count actually changed (`roster.hours.length !== newHours.length`), otherwise preserve existing assignments.
6. Persist `selectedShiftCount` (level changes only).

All updates go through `updateActiveRoster` so the rest of the app sees a single atomic Recoil transition.

## Validation Rules

- Operation window must be > 0 minutes; overnight windows are rejected by `ShiftsRange.calculateDuration`.
- A level is only listed if its duration is ≥ `minShiftDuration` (default 0.5h) and divides into 15-minute increments.
- A level is only selectable if feasible under the LP no-consecutive bound.
- `ShiftHours` and `ShiftInformation` flag invalid states with red borders, an `Invalid` label, and an explanatory message (`unableToCalculateShiftTimes`, `unableToCalculateShiftDuration`, `endTimeAfterStartTime`).

## i18n / RTL Notes

- All labels go through `t(...)` with English defaults; Hebrew strings live in `he.json`.
- Arrows between start/end use `icon-flip` so they render correctly in RTL.
- `ShiftDuration` forces `dir="ltr"` so the time-arrow-time order survives RTL flipping.
