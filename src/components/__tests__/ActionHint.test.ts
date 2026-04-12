import { getActionHint } from "../../service/actionHint";

const base = {
  posts: 3,
  staff: 5,
  opHours: 9,
  hasAssignments: false,
  isOptimized: false,
  selectedShiftCount: null as number | null,
  optimizationFailed: false,
};

function hint(overrides: Partial<typeof base> = {}) {
  return getActionHint({ ...base, ...overrides });
}

describe("getActionHint — missing inputs", () => {
  it("no staff → hintAddStaff", () => {
    expect(hint({ staff: 0 }).hint).toEqual({ key: "hintAddStaff" });
  });

  it("no posts → hintAddPosts", () => {
    expect(hint({ posts: 0 }).hint).toEqual({ key: "hintAddPosts" });
  });

  it("no staff takes priority over no posts", () => {
    expect(hint({ staff: 0, posts: 0 }).hint).toEqual({ key: "hintAddStaff" });
  });
});

describe("getActionHint — feasibility via levels", () => {
  it("feasible config → hintRunOptimizer", () => {
    // 5 staff, 3 posts, 9h → 1 shift feasible (5 >= 3)
    expect(hint().hint).toEqual({ key: "hintRunOptimizer" });
  });

  it("infeasible config (staff < posts) → hintOverCapacity", () => {
    // 2 staff, 5 posts → no feasible levels
    const r = hint({ staff: 2, posts: 5 });
    expect(r.hint!.key).toBe("hintOverCapacity");
    expect(r.variant).toBe("warning");
  });

  it("selected infeasible level shows warning even if other levels feasible", () => {
    // 4 staff, 3 posts, select 4 shifts (infeasible for this count)
    const r = hint({ staff: 4, posts: 3, selectedShiftCount: 4, opHours: 10 });
    // The selected level is infeasible → show warning, don't encourage optimizing
    expect(r.hint!.key).toBe("hintOverCapacity");
    expect(r.variant).toBe("warning");
  });

  it("selected feasible level shows run optimizer hint", () => {
    // 5 staff, 3 posts, select 1 shift (feasible)
    const r = hint({ staff: 5, posts: 3, selectedShiftCount: 1, opHours: 9 });
    expect(r.hint).toEqual({ key: "hintRunOptimizer" });
    expect(r.variant).toBe("info");
  });

  it("no selected level with feasible levels → hintRunOptimizer", () => {
    // selectedShiftCount is null, but feasible levels exist
    const r = hint({ staff: 5, posts: 3, selectedShiftCount: null });
    expect(r.hint).toEqual({ key: "hintRunOptimizer" });
    expect(r.variant).toBe("info");
  });
});

describe("getActionHint — optimized state", () => {
  it("optimized + assignments → success", () => {
    const r = hint({ isOptimized: true, hasAssignments: true });
    expect(r.hint).toEqual({ key: "hintOptimized" });
    expect(r.variant).toBe("success");
  });

  it("optimized without assignments but no failure flag → hintRunOptimizer", () => {
    // isOptimized=true but no assignments and no failure flag — stale state, re-run
    const r = hint({ isOptimized: true, hasAssignments: false });
    expect(r.hint).toEqual({ key: "hintRunOptimizer" });
  });

  it("optimization explicitly failed → hintOverCapacity", () => {
    const r = hint({ isOptimized: false, hasAssignments: false, optimizationFailed: true });
    expect(r.hint!.key).toBe("hintOverCapacity");
    expect(r.variant).toBe("warning");
  });
});

describe("getActionHint — manual assignments", () => {
  it("has assignments, not optimized → hintNotOptimized", () => {
    const r = hint({ hasAssignments: true, isOptimized: false });
    expect(r.hint).toEqual({ key: "hintNotOptimized" });
  });
});

describe("getActionHint — priority order", () => {
  it("no staff wins over optimized", () => {
    expect(hint({ staff: 0, isOptimized: true, hasAssignments: true }).hint).toEqual({ key: "hintAddStaff" });
  });

  it("no posts wins over optimized", () => {
    expect(hint({ posts: 0, isOptimized: true, hasAssignments: true }).hint).toEqual({ key: "hintAddPosts" });
  });

  it("infeasibility wins over optimized (config changed after optimization)", () => {
    // 2 staff, 10 posts, optimized flag stale
    const r = hint({ staff: 2, posts: 10, isOptimized: true, hasAssignments: true });
    expect(r.hint!.key).toBe("hintOverCapacity");
    expect(r.variant).toBe("warning");
  });
});
