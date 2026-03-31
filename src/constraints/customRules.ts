import type { ConstraintRule, ConstraintContext, LPConstraint, CustomRuleConfig } from "./types";

/** Max shifts per worker per week */
function createMaxShiftsPerWeekRule(maxShifts: number): ConstraintRule {
  return {
    id: `custom-max-shifts-${maxShifts}`,
    name: `Max ${maxShifts} shifts per week`,
    category: "custom",
    enabled: true,
    generate(ctx: ConstraintContext): LPConstraint[] {
      const constraints: LPConstraint[] = [];
      for (let user = 0; user < ctx.numUsers; user++) {
        const vars: string[] = [];
        for (let post = 0; post < ctx.numPosts; post++) {
          for (let slot = 0; slot < ctx.numTimeSlots; slot++) {
            if (ctx.availability[user][post][slot]) {
              vars.push(`x_${user}_${post}_${slot}`);
            }
          }
        }
        if (vars.length > maxShifts) {
          constraints.push({
            expression: `${vars.join(" + ")} <= ${maxShifts}`,
            label: `User ${user}: max ${maxShifts} shifts per week`,
            category: "custom",
          });
        }
      }
      return constraints;
    },
  };
}

/** Worker incompatibility — two workers cannot be assigned to the same time slot */
function createIncompatibilityRule(userA: number, userB: number): ConstraintRule {
  return {
    id: `custom-incompat-${userA}-${userB}`,
    name: `Incompatibility: user ${userA} and ${userB}`,
    category: "custom",
    enabled: true,
    generate(ctx: ConstraintContext): LPConstraint[] {
      const constraints: LPConstraint[] = [];
      for (let slot = 0; slot < ctx.numTimeSlots; slot++) {
        const varsA: string[] = [];
        const varsB: string[] = [];
        for (let post = 0; post < ctx.numPosts; post++) {
          if (ctx.availability[userA]?.[post]?.[slot]) {
            varsA.push(`x_${userA}_${post}_${slot}`);
          }
          if (ctx.availability[userB]?.[post]?.[slot]) {
            varsB.push(`x_${userB}_${post}_${slot}`);
          }
        }
        if (varsA.length > 0 && varsB.length > 0) {
          constraints.push({
            expression: `${[...varsA, ...varsB].join(" + ")} <= 1`,
            label: `Users ${userA} and ${userB} cannot work same slot ${slot}`,
            category: "custom",
          });
        }
      }
      return constraints;
    },
  };
}

export function buildCustomRules(configs: CustomRuleConfig[]): ConstraintRule[] {
  const rules: ConstraintRule[] = [];
  for (const config of configs) {
    switch (config.type) {
      case "max-shifts-per-week":
        rules.push(createMaxShiftsPerWeekRule(config.params.maxShifts as number ?? 5));
        break;
      case "worker-incompatibility":
        rules.push(
          createIncompatibilityRule(
            config.params.userA as number,
            config.params.userB as number
          )
        );
        break;
      // required-role-per-slot would need role data on staff — placeholder for now
    }
  }
  return rules;
}
