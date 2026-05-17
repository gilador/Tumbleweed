import { computeMenuPosition } from "./contextMenuPosition";

describe("computeMenuPosition", () => {
  const VW = 1000;
  const VH = 800;

  it("returns the cursor position when the menu fits", () => {
    expect(
      computeMenuPosition({
        x: 100,
        y: 100,
        menuW: 180,
        menuH: 200,
        viewportW: VW,
        viewportH: VH,
      })
    ).toEqual({ left: 100, top: 100 });
  });

  it("flips horizontally when overflowing the right edge", () => {
    const r = computeMenuPosition({
      x: 950,
      y: 100,
      menuW: 180,
      menuH: 200,
      viewportW: VW,
      viewportH: VH,
    });
    expect(r.left).toBe(950 - 180);
  });

  it("flips vertically when overflowing the bottom edge", () => {
    const r = computeMenuPosition({
      x: 100,
      y: 750,
      menuW: 180,
      menuH: 200,
      viewportW: VW,
      viewportH: VH,
    });
    expect(r.top).toBe(750 - 200);
  });

  it("clamps to 0 when flipped position would be negative", () => {
    const r = computeMenuPosition({
      x: 50,
      y: 50,
      menuW: 200,
      menuH: 100,
      viewportW: 100,
      viewportH: 90,
    });
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
  });
});
