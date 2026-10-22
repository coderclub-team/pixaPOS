import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/repo", () => ({
  writeScope: vi.fn(async () => {}),
  readScope: vi.fn(async () => []),
}));

const CATALOG_KEY = "pixaMenu";

function seedCatalog(categories: Array<Record<string, unknown>>) {
  window.localStorage.setItem(
    CATALOG_KEY,
    JSON.stringify({ version: 1, categories, items: [], modifierGroups: [], modifiers: [] }),
  );
}

async function loadMenu() {
  return await import("@/features/menu/api/service");
}

async function loadAvailability() {
  return await import("@/features/outlet/api/availability");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
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

  it("grandfathers pre-existing local rows at the first outlet that reads them", async () => {
    const { getMenuCategories } = await loadMenu();
    seedCatalog([{ id: "legacy-cat-1", name: "Legacy Cat", slug: "legacy-cat", is_active: true }]);
    // First filtered read at outlet-c stamps the legacy row visible there...
    const inC = await getMenuCategories({ outlet_id: "outlet-c" });
    expect(inC.map((c) => c.id)).toContain("legacy-cat-1");
    // ...but it stays hidden at an outlet that never saw it.
    const inD = await getMenuCategories({ outlet_id: "outlet-d" });
    expect(inD.map((c) => c.id)).not.toContain("legacy-cat-1");
  }, 15000);
});
