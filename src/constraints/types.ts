/**
 * Constraint rule interface for the LP optimizer.
 * Each rule generates LP constraint strings that get appended to the model.
 */

export interface ConstraintContext {
  numUsers: number;
  numPosts: number;
  numTimeSlots: number;
  /** availability[user][post][timeSlot] */
  availability: boolean[][][];
  /** Hours per time slot */
  hoursPerSlot: number;
  /** Staff metadata (age, etc.) if available */
  staffMeta?: StaffMeta[];
}

export interface StaffMeta {
  userId: number;
  age?: number;
  isYouth?: boolean;
}

export interface LPConstraint {
  /** LP constraint string, e.g. "x_0_0_0 + x_0_0_1 <= 1" */
  expression: string;
  /** Human-readable label for infeasibility reporting */
  label: string;
  /** Category for infeasibility attribution */
  category: ConstraintCategory;
}

export type ConstraintCategory = "availability" | "regulation" | "custom";

export interface ConstraintRule {
  id: string;
  name: string;
  category: ConstraintCategory;
  /** Whether this rule is currently enabled */
  enabled: boolean;
  /** Generate LP constraints for the model */
  generate(ctx: ConstraintContext): LPConstraint[];
}

export interface ConstraintConfig {
  activeRegulations: string[];
  customRules: CustomRuleConfig[];
}

export interface CustomRuleConfig {
  type: "max-shifts-per-week" | "required-role-per-slot" | "worker-incompatibility";
  params: Record<string, unknown>;
}
