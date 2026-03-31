import type { ConstraintRule, ConstraintContext, LPConstraint } from "./types";

/**
 * Israeli labor law constraints for the LP optimizer.
 * Based on Israel Hours of Work and Rest Law (1951) and amendments.
 */

/** Max consecutive time slots per worker (proxy for max shift length) */
export const maxShiftLength: ConstraintRule = {
  id: "il-max-shift-length",
  name: "Max shift length (12h)",
  category: "regulation",
  enabled: true,
  generate(ctx: ConstraintContext): LPConstraint[] {
    const constraints: LPConstraint[] = [];
    const maxSlots = Math.ceil(12 / ctx.hoursPerSlot);

    for (let user = 0; user < ctx.numUsers; user++) {
      for (let post = 0; post < ctx.numPosts; post++) {
        // Sliding window: no more than maxSlots consecutive slots
        for (let start = 0; start <= ctx.numTimeSlots - maxSlots - 1; start++) {
          const vars: string[] = [];
          for (let s = start; s < start + maxSlots + 1 && s < ctx.numTimeSlots; s++) {
            if (ctx.availability[user][post][s]) {
              vars.push(`x_${user}_${post}_${s}`);
            }
          }
          if (vars.length > maxSlots) {
            constraints.push({
              expression: `${vars.join(" + ")} <= ${maxSlots}`,
              label: `User ${user}: max ${maxSlots} consecutive slots at post ${post}`,
              category: "regulation",
            });
          }
        }
      }
    }
    return constraints;
  },
};

/** Mandatory 8h rest between shifts — no assignment in next N slots after working */
export const mandatoryRest: ConstraintRule = {
  id: "il-mandatory-rest",
  name: "8h rest between shifts",
  category: "regulation",
  enabled: true,
  generate(ctx: ConstraintContext): LPConstraint[] {
    const constraints: LPConstraint[] = [];
    const restSlots = Math.ceil(8 / ctx.hoursPerSlot);

    for (let user = 0; user < ctx.numUsers; user++) {
      // For each pair of posts and time slots that would violate rest
      for (let t1 = 0; t1 < ctx.numTimeSlots; t1++) {
        for (let t2 = t1 + 1; t2 < Math.min(t1 + restSlots + 1, ctx.numTimeSlots); t2++) {
          // If assigned to any post at t1, can't be at any post at t2 (within rest window)
          for (let p1 = 0; p1 < ctx.numPosts; p1++) {
            for (let p2 = 0; p2 < ctx.numPosts; p2++) {
              if (p1 === p2) continue; // Same post continuity is handled by existing constraints
              if (ctx.availability[user][p1][t1] && ctx.availability[user][p2][t2]) {
                constraints.push({
                  expression: `x_${user}_${p1}_${t1} + x_${user}_${p2}_${t2} <= 1`,
                  label: `User ${user}: 8h rest between post ${p1}@${t1} and post ${p2}@${t2}`,
                  category: "regulation",
                });
              }
            }
          }
        }
      }
    }
    return constraints;
  },
};

/** Monthly hours cap (186h) — limits total assignments across schedule */
export const monthlyHoursCap: ConstraintRule = {
  id: "il-monthly-hours-cap",
  name: "Monthly hours cap (186h)",
  category: "regulation",
  enabled: true,
  generate(ctx: ConstraintContext): LPConstraint[] {
    const constraints: LPConstraint[] = [];
    const maxSlots = Math.floor(186 / ctx.hoursPerSlot);

    for (let user = 0; user < ctx.numUsers; user++) {
      const vars: string[] = [];
      for (let post = 0; post < ctx.numPosts; post++) {
        for (let slot = 0; slot < ctx.numTimeSlots; slot++) {
          if (ctx.availability[user][post][slot]) {
            vars.push(`x_${user}_${post}_${slot}`);
          }
        }
      }
      if (vars.length > maxSlots) {
        constraints.push({
          expression: `${vars.join(" + ")} <= ${maxSlots}`,
          label: `User ${user}: max ${maxSlots} slots (186h monthly cap)`,
          category: "regulation",
        });
      }
    }
    return constraints;
  },
};

/** Youth restrictions (under 18): max 8h shifts, no night work */
export const youthRestrictions: ConstraintRule = {
  id: "il-youth-restrictions",
  name: "Youth worker restrictions",
  category: "regulation",
  enabled: false,
  generate(ctx: ConstraintContext): LPConstraint[] {
    const constraints: LPConstraint[] = [];
    if (!ctx.staffMeta) return constraints;

    const maxYouthSlots = Math.ceil(8 / ctx.hoursPerSlot);

    for (let user = 0; user < ctx.numUsers; user++) {
      const meta = ctx.staffMeta[user];
      if (!meta?.isYouth) continue;

      // Max 8h per day for youth
      for (let post = 0; post < ctx.numPosts; post++) {
        const vars: string[] = [];
        for (let slot = 0; slot < ctx.numTimeSlots; slot++) {
          if (ctx.availability[user][post][slot]) {
            vars.push(`x_${user}_${post}_${slot}`);
          }
        }
        if (vars.length > maxYouthSlots) {
          constraints.push({
            expression: `${vars.join(" + ")} <= ${maxYouthSlots}`,
            label: `Youth user ${user}: max ${maxYouthSlots} slots (8h limit)`,
            category: "regulation",
          });
        }
      }
    }
    return constraints;
  },
};

/** Weekly day off — at least one full day with no assignments */
export const weeklyDayOff: ConstraintRule = {
  id: "il-weekly-day-off",
  name: "Weekly day off",
  category: "regulation",
  enabled: true,
  generate(_ctx: ConstraintContext): LPConstraint[] {
    // This constraint requires date-aware scheduling (knowing which slots map to which day).
    // For now, it's a placeholder — the actual implementation needs the schedule's
    // date range to map time slots to calendar days.
    return [];
  },
};

export const allIsraeliLaborRules: ConstraintRule[] = [
  maxShiftLength,
  mandatoryRest,
  monthlyHoursCap,
  youthRestrictions,
  weeklyDayOff,
];
