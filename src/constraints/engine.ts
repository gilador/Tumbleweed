import type { ConstraintContext, ConstraintRule, LPConstraint, ConstraintConfig, ConstraintCategory } from "./types";
import { allIsraeliLaborRules } from "./israeliLaborLaw";
import { buildCustomRules } from "./customRules";

/**
 * Collects and generates all enabled constraint rules for the LP model.
 * Returns LP constraint strings to inject into the model, plus metadata
 * for infeasibility attribution.
 */
export function generateAllConstraints(
  ctx: ConstraintContext,
  config: ConstraintConfig
): { constraints: LPConstraint[]; constraintIdStart: number } {
  const activeRules: ConstraintRule[] = [];

  // Add enabled regulation rules
  for (const rule of allIsraeliLaborRules) {
    if (config.activeRegulations.includes(rule.id)) {
      activeRules.push({ ...rule, enabled: true });
    }
  }

  // Add custom rules
  const customRules = buildCustomRules(config.customRules);
  activeRules.push(...customRules);

  // Generate all constraints
  const allConstraints: LPConstraint[] = [];
  for (const rule of activeRules) {
    if (rule.enabled) {
      allConstraints.push(...rule.generate(ctx));
    }
  }

  return { constraints: allConstraints, constraintIdStart: 0 };
}

/**
 * Attempts to attribute infeasibility to a specific constraint category.
 * Runs the solver with different constraint subsets to identify which
 * category (availability, regulation, custom) caused the failure.
 */
export function attributeInfeasibility(
  allConstraints: LPConstraint[]
): { category: ConstraintCategory; details: string } {
  // Group constraints by category
  const byCategory: Record<ConstraintCategory, LPConstraint[]> = {
    availability: [],
    regulation: [],
    custom: [],
  };

  for (const c of allConstraints) {
    byCategory[c.category].push(c);
  }

  // Report the category with the most constraints as likely culprit
  // A more sophisticated approach would re-run the solver with
  // each category removed to find the minimal infeasible subset.
  const counts = Object.entries(byCategory)
    .filter(([_, cs]) => cs.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  if (counts.length === 0) {
    return {
      category: "availability",
      details: "No staff available for one or more time slots",
    };
  }

  const [topCategory, topConstraints] = counts[0];
  return {
    category: topCategory as ConstraintCategory,
    details: `${topConstraints.length} ${topCategory} constraint(s) may be causing the conflict. Example: ${topConstraints[0].label}`,
  };
}

/** List all available regulation rule IDs and names */
export function listRegulationRules(): { id: string; name: string }[] {
  return allIsraeliLaborRules.map((r) => ({ id: r.id, name: r.name }));
}
