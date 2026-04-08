import { generateBadges } from "../badgeUtils";

describe("generateBadges", () => {
  it("generates badge from first+last name initials", () => {
    const badges = generateBadges([
      { id: "1", name: "נתן חתוקה" },
    ]);
    expect(badges.get("1")).toBe("נח");
  });

  it("generates badge from first two chars for single name", () => {
    const badges = generateBadges([
      { id: "1", name: "דנה" },
    ]);
    expect(badges.get("1")).toBe("דנ");
  });

  it("handles two-character name", () => {
    const badges = generateBadges([
      { id: "1", name: "דן" },
    ]);
    expect(badges.get("1")).toBe("דן");
  });

  it("resolves collision with extended first-name portion", () => {
    const badges = generateBadges([
      { id: "1", name: "יוסי כהן" },
      { id: "2", name: "יעל כהן" },
    ]);
    expect(badges.get("1")).toBe("יוכ");
    expect(badges.get("2")).toBe("יעכ");
  });

  it("falls back to numeric suffix when extended badge still collides", () => {
    // Same first 2 chars + same last initial
    const badges = generateBadges([
      { id: "1", name: "יואב כהן" },
      { id: "2", name: "יואל כהן" },
    ]);
    const b1 = badges.get("1")!;
    const b2 = badges.get("2")!;
    // Both extend to "יוכ", so should get numeric suffixes
    expect(b1).toMatch(/^יוכ\d$/);
    expect(b2).toMatch(/^יוכ\d$/);
    expect(b1).not.toBe(b2);
  });

  it("is deterministic — same input produces same output", () => {
    const users = [
      { id: "1", name: "נתן חתוקה" },
      { id: "2", name: "יוסי כהן" },
      { id: "3", name: "דנה לוי" },
    ];
    const badges1 = generateBadges(users);
    const badges2 = generateBadges(users);
    expect(Array.from(badges1.entries())).toEqual(Array.from(badges2.entries()));
  });

  it("returns a badge for every user in the roster", () => {
    const users = [
      { id: "1", name: "נתן חתוקה" },
      { id: "2", name: "יוסי כהן" },
      { id: "3", name: "דנה לוי" },
      { id: "4", name: "שירה מזרחי" },
      { id: "5", name: "אמית" },
    ];
    const badges = generateBadges(users);
    expect(badges.size).toBe(5);
    for (const user of users) {
      expect(badges.has(user.id)).toBe(true);
      expect(badges.get(user.id)!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns empty map for empty roster", () => {
    const badges = generateBadges([]);
    expect(badges.size).toBe(0);
  });

  it("handles names with extra whitespace", () => {
    const badges = generateBadges([
      { id: "1", name: "  נתן   חתוקה  " },
    ]);
    expect(badges.get("1")).toBe("נח");
  });

  it("handles mix of single and two-part names without collision", () => {
    const badges = generateBadges([
      { id: "1", name: "נתן חתוקה" },
      { id: "2", name: "דנה" },
    ]);
    expect(badges.get("1")).toBe("נח");
    expect(badges.get("2")).toBe("דנ");
  });
});
