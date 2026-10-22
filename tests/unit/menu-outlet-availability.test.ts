import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  getMenuCategories,
  getMenuItems,
  getMenuItemById,
} from "@/features/menu/api/service";

const serverCategory = (over: Record<string, unknown> = {}) => ({
  id: "seed_cat_1",
  organizationId: "org_test",
  name: "Starters",
  slug: "starters",
  description: null,
  imageUrl: null,
  parentId: null,
  sortOrder: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const serverItem = (over: Record<string, unknown> = {}) => ({
  id: "seed_item_1",
  organizationId: "org_test",
  name: "Paneer Tikka",
  categoryId: "seed_cat_1",
  category_name: "Starters",
  productType: "simple",
  itemType: "service",
  vegType: "veg",
  hsnCode: null,
  taxable: false,
  taxPercent: null,
  images: [{ url: "https://img/x.jpg", sort_order: 0 }],
  availableChannels: ["dine_in", "pickup", "delivery"],
  modifierGroupIds: [],
  variants: [
    {
      id: "seed_var_1",
      menuItemId: "seed_item_1",
      name: "Regular",
      sku: "PANEER-001",
      sellingPrice: 250,
      comparePrice: null,
      recipeId: null,
      isDefault: true,
      isActive: true,
    },
  ],
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => payload,
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ rows: [] }) }) as Response),
  );
});

describe("menu service (server-backed)", () => {
  it("passes outlet_id through so closed-by-default is enforced server-side", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rows: [] }) });
    await getMenuItems({ outlet_id: "outlet-a" });
    expect(f).toHaveBeenCalledWith(
      expect.stringContaining("/api/masters/items?outlet_id=outlet-a"),
      expect.anything(),
    );
  });

  it("maps server rows to client shape (images, variants, category names)", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ rows: [serverItem()] }),
    });
    const [item] = await getMenuItems({ outlet_id: "outlet-a" });
    expect(item.image_url).toBe("https://img/x.jpg");
    expect(item.image_urls).toEqual(["https://img/x.jpg"]);
    expect(item.variants).toHaveLength(1);
    expect(item.variants[0].selling_price).toBe(250);
    expect(item.category_name).toBe("Starters");
  });

  it("creates a category scoped to the outlet (outlet_ids sent)", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rows: [] }) }); // dup check
    f.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "mc_new" }) });
    f.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ row: serverCategory({ id: "mc_new", name: "Biryani" }) }),
    });
    const cat = await createMenuCategory({ name: "Biryani" }, { outletId: "outlet-a" });
    const posted = JSON.parse((f.mock.calls[1][1] as RequestInit).body as string);
    expect(posted.outlet_ids).toEqual(["outlet-a"]);
    expect(cat.id).toBe("mc_new");
  });

  it("rejects duplicate category names without hitting the server twice", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ rows: [serverCategory({ name: "Starters" })] }),
    });
    await expect(createMenuCategory({ name: "starters" })).rejects.toThrow(
      "Category already exists",
    );
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("creates an item then its variants, scoped to the outlet", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rows: [] }) }); // variants dup check
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rows: [] }) }); // slug check
    f.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "mi_new" }) }); // POST item
    f.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "mv_new" }) }); // POST variant
    f.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ row: serverItem({ id: "mi_new" }) }),
    });
    const item = await createMenuItem(
      {
        name: "Dosa",
        category_id: "seed_cat_1",
        variants: [{ name: "Regular", sku: "DOSA-001", selling_price: 99 }],
      } as never,
      { outletId: "outlet-a" },
    );
    const posted = JSON.parse((f.mock.calls[2][1] as RequestInit).body as string);
    expect(posted.outlet_ids).toEqual(["outlet-a"]);
    expect(item.id).toBe("mi_new");
  });

  it("reads single items through the server endpoint", async () => {
    mockFetchOnce({ row: serverItem() });
    const item = await getMenuItemById("seed_item_1");
    expect(item?.name).toBe("Paneer Tikka");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/masters/items/seed_item_1"),
      expect.anything(),
    );
  });

  it("deletes through the server and surfaces not-found", async () => {
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ rows: [] }) }); // in-use check
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) }); // DELETE
    await expect(deleteMenuCategory("seed_cat_1")).resolves.toBeUndefined();
    expect(f).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/masters/categories/seed_cat_1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
