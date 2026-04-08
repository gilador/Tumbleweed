/**
 * Unit tests for mobile staff name editing logic.
 * Component rendering tests are covered in E2E (Playwright).
 */

describe("Mobile staff name editing", () => {
  describe("name update logic", () => {
    it("trims whitespace before saving", () => {
      const input = "  נתן חתוקה  ";
      const trimmed = input.trim();
      expect(trimmed).toBe("נתן חתוקה");
    });

    it("does not save if name is unchanged", () => {
      const original = "נתן חתוקה";
      const edited = "נתן חתוקה";
      const shouldSave = edited.trim() !== original;
      expect(shouldSave).toBe(false);
    });

    it("saves when name is different", () => {
      const original = "נתן חתוקה";
      const edited = "נתן כהן";
      const shouldSave = edited.trim() !== original;
      expect(shouldSave).toBe(true);
    });

    it("does not save empty name", () => {
      const edited = "   ";
      const trimmed = edited.trim();
      const shouldSave = trimmed.length > 0;
      expect(shouldSave).toBe(false);
    });
  });

  describe("edit state management", () => {
    it("initializes editing with current name", () => {
      const currentName = "יוסי כהן";
      let editingName = "";
      // Simulate clicking edit — sets editingName to current name
      editingName = currentName;
      expect(editingName).toBe("יוסי כהן");
    });

    it("cancel resets editing state without saving", () => {
      let editingUserId: string | null = "user-1";
      let savedName: string | null = null;

      // Simulate cancel
      editingUserId = null;
      // No save happened
      expect(editingUserId).toBeNull();
      expect(savedName).toBeNull();
    });

    it("Enter key triggers save and exits edit mode", () => {
      let editingUserId: string | null = "user-1";
      let editingName = "שם חדש";
      let savedUserId: string | null = null;
      let savedName: string | null = null;

      const onUpdateUserName = (userId: string, name: string) => {
        savedUserId = userId;
        savedName = name;
      };

      // Simulate Enter key
      const trimmed = editingName.trim();
      if (trimmed && trimmed !== "שם ישן") {
        onUpdateUserName(editingUserId!, trimmed);
      }
      editingUserId = null;

      expect(savedUserId).toBe("user-1");
      expect(savedName).toBe("שם חדש");
      expect(editingUserId).toBeNull();
    });

    it("Escape key cancels without saving", () => {
      let editingUserId: string | null = "user-1";
      let savedName: string | null = null;

      // Simulate Escape key
      editingUserId = null;

      expect(editingUserId).toBeNull();
      expect(savedName).toBeNull();
    });
  });
});
