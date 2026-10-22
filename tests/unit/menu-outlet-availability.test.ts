import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

async function loadMenu() {
  return await import("@/features/menu/api/service");
}

async function loadAvailability() {
  return await import("@/features/outlet/api/availability");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("outlet availability (closed by default)", () => {
  it("hides rows with no mapping and no override", async () => {
    const { isAvailableInOutlet } = await loadAvailability();
    expect(isAvailableInOutlet("outlet-a", "category", "cat-unknown")).toBe(false);
  });

  it("keeps a category visible only at its creation outlet", async () => {
    const { createMenuCategory, getMenuCategories } = await loadMenu();
    const cat = await createMenuCategory({ name: "Outlet A Specials" }, { outletId: "outlet-a" });
    const inA = await getMenuCategories({ outlet_id: "outlet-a" });
    const inB = await getMenuCategories({ outlet_id: "outlet-b" });
    expect(inA.map((c) => c.id)).toContain(cat.id);
    expect(inB.map((c) => c.id)).not.toContain(cat.id);
  }, 15000);

  it("keeps an item visible only at its creation outlet", async () => {
    const { createMenuCategory, createMenuItem, getMenuItems } = await loadMenu();
    const cat = await createMenuCategory({ name: "Shared Base" }, { outletId: "outlet-a" });
    const item = await createMenuItem({ name: "A-only Dish", category_id: cat.id } as never, {
      outletId: "outlet-a",
    });
    const inA = await getMenuItems({ outlet_id: "outlet-a" });
    const inB = await getMenuItems({ outlet_id: "outlet-b" });
    expect(inA.map((m) => m.id)).toContain(item.id);
    expect(inB.map((m) => m.id)).not.toContain(item.id);
  }, 15000);

  it("does not persist the catalog to localStorage (Phase 2: in-memory only)", async () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem");
    const { createMenuCategory, getMenuCategories } = await loadMenu();
    await createMenuCategory({ name: "Ephemeral Cat" }, { outletId: "outlet-a" });
    await getMenuCategories({ outlet_id: "outlet-a" });
    const menuWrites = setSpy.mock.calls.filter(([key]) => key === "pixaMenu");
    expect(menuWrites).toHaveLength(0);
    setSpy.mockRestore();
  }, 15000);
});
