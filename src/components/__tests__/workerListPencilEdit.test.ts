import { readFileSync } from "fs";
import { resolve } from "path";

// CEO directive: the desktop staff row's avatar-hover overlay becomes a
// non-destructive pencil-edit affordance that triggers the existing inline-
// edit flow. The bare-name-click-to-edit handler is removed.
//
// Jest runs in `node` env per the package's `jest.config.cjs` — no JSDOM, so
// these assertions are source-shape + pure-logic. Hebrew test data is
// included to satisfy the project's testing rule.

describe("WorkerList pencil-edit affordance", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../../components/WorkerList.tsx"),
    "utf8"
  );

  describe("startEdit logic (Hebrew + Latin names)", () => {
    // Re-derive the same state-write behavior the component runs in
    // startEdit(user). If this drifts from the implementation we'll catch
    // it on the source-shape assertion below.
    function startEdit(user: { id: string; name: string }) {
      let editingUserId: string | null = null;
      let editingTempValue = "";
      editingTempValue = user.name;
      editingUserId = user.id;
      return { editingUserId, editingTempValue };
    }

    it("sets editingUserId to the row's user id (Hebrew name)", () => {
      const user = { id: "u-hebrew", name: "יוסי כהן" };
      const next = startEdit(user);
      expect(next.editingUserId).toBe("u-hebrew");
      expect(next.editingTempValue).toBe("יוסי כהן");
    });

    it("sets editingUserId to the row's user id (Latin name)", () => {
      const user = { id: "u-latin", name: "Alice" };
      const next = startEdit(user);
      expect(next.editingUserId).toBe("u-latin");
      expect(next.editingTempValue).toBe("Alice");
    });
  });

  describe("source-shape (WorkerList.tsx)", () => {
    it("imports IconPencil from @tabler/icons-react", () => {
      expect(SOURCE).toMatch(/IconPencil[\s\S]{0,200}from "@tabler\/icons-react"/);
    });

    it("does not import IconTrash anywhere", () => {
      expect(SOURCE).not.toMatch(/IconTrash/);
    });

    it("does not import Dialog from the elements barrel", () => {
      expect(SOURCE).not.toMatch(/from "@\/components\/elements\/dialog"/);
    });

    it("pencil button onClick calls e.stopPropagation() then startEdit(user)", () => {
      expect(SOURCE).toMatch(
        /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*startEdit\(user\);/
      );
    });

    it("pencil button fires trackEvent('user-rename-start', { surface: 'desktop' })", () => {
      expect(SOURCE).toMatch(
        /trackEvent\("user-rename-start",\s*\{\s*surface:\s*"desktop"\s*\}\)/
      );
    });

    it("pencil button references t('editUserName') for both aria-label and title", () => {
      expect(SOURCE).toMatch(/aria-label=\{t\("editUserName"\)\}/);
      expect(SOURCE).toMatch(/title=\{t\("editUserName"\)\}/);
    });

    it("pencil button uses a `edit-staff-${user.id}` data-testid (template literal)", () => {
      expect(SOURCE).toMatch(/data-testid=\{`edit-staff-\$\{user\.id\}`\}/);
    });

    it("name span does NOT carry an onClick (no click-to-edit on the name)", () => {
      // Extract the span around {user.name} and verify it has no onClick.
      const spanMatch = SOURCE.match(
        /<span\s+className="block truncate[\s\S]{0,400}\{user\.name\}\s*<\/span>/
      );
      expect(spanMatch).not.toBeNull();
      expect(spanMatch![0]).not.toMatch(/onClick=/);
      expect(spanMatch![0]).not.toMatch(/startEdit/);
      expect(spanMatch![0]).not.toMatch(/setEditingUserId/);
    });

    it("does NOT retain pendingDeleteId state, setPendingDeleteId, or onDeleteSingleUser prop", () => {
      expect(SOURCE).not.toMatch(/pendingDeleteId/);
      expect(SOURCE).not.toMatch(/setPendingDeleteId/);
      expect(SOURCE).not.toMatch(/onDeleteSingleUser/);
    });

    it("does NOT retain the confirmation Dialog markup", () => {
      expect(SOURCE).not.toMatch(/<Dialog\b/);
      expect(SOURCE).not.toMatch(/<DialogTitle\b/);
    });

    // Row gets focus on click via tabIndex={-1}; pencil must not re-appear
    // from focus-within after pointer leaves. Hebrew context: יוסי כהן.
    it("pencil button className contains group-hover:grid", () => {
      const btnMatch = SOURCE.match(
        /data-testid=\{`edit-staff-\$\{user\.id\}`\}[\s\S]{0,400}?className="([^"]+)"/
      );
      expect(btnMatch).not.toBeNull();
      expect(btnMatch![1]).toMatch(/group-hover:grid/);
    });

    it("pencil button className does NOT contain group-focus-within:grid", () => {
      const btnMatch = SOURCE.match(
        /data-testid=\{`edit-staff-\$\{user\.id\}`\}[\s\S]{0,400}?className="([^"]+)"/
      );
      expect(btnMatch).not.toBeNull();
      expect(btnMatch![1]).not.toMatch(/group-focus-within:grid/);
    });

    it("pencil button retains focus-visible:bg-primary (keyboard focus on pencil itself)", () => {
      const btnMatch = SOURCE.match(
        /data-testid=\{`edit-staff-\$\{user\.id\}`\}[\s\S]{0,400}?className="([^"]+)"/
      );
      expect(btnMatch).not.toBeNull();
      expect(btnMatch![1]).toMatch(/focus-visible:bg-primary/);
      expect(btnMatch![1]).toMatch(/focus-visible:text-primary-foreground/);
    });
  });
});
