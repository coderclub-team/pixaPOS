export type ShareableEntity =
  | "category"
  | "menu_item"
  | "raw_material"
  | "recipe"
  | "supplier"
  | "modifier_group"
  | "promo";

export const SHAREABLE_ENTITIES: { value: ShareableEntity; label: string }[] = [
  { value: "category", label: "Categories" },
  { value: "menu_item", label: "Menu items" },
  { value: "raw_material", label: "Raw materials" },
  { value: "recipe", label: "Recipes" },
  { value: "supplier", label: "Suppliers" },
  { value: "modifier_group", label: "Modifier groups" },
  { value: "promo", label: "Promos" },
];

export type AvailabilityOverride = {
  is_available: boolean;
  /** For menu items: replaces every variant's selling price in that outlet. */
  price_override?: number;
};

type AvailabilityState = Record<string, AvailabilityOverride>;

const STORAGE_KEY = "pixaOutletAvailability";

const keyOf = (outletId: string, entity: ShareableEntity, entityId: string) =>
  `${outletId}:${entity}:${entityId}`;

function readState(): AvailabilityState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { overrides?: AvailabilityState };
    return parsed?.overrides ?? {};
  } catch {
    return {};
  }
}

function writeState(state: AvailabilityState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ overrides: state }));
  } catch {
    /* ignore */
  }
}

/** Explicit override, if any. Absence means hidden (closed by default). */
export function getAvailability(
  outletId: string,
  entity: ShareableEntity,
  entityId: string,
): AvailabilityOverride | null {
  return readState()[keyOf(outletId, entity, entityId)] ?? null;
}

/** Availability check used by ordering surfaces. Closed by default: an
 * entity is visible at an outlet only with a server mapping row or an
 * explicit local override. */
export function isAvailableInOutlet(
  outletId: string,
  entity: ShareableEntity,
  entityId: string,
): boolean {
  return getAvailability(outletId, entity, entityId)?.is_available ?? false;
}

export function getPriceOverride(
  outletId: string,
  entity: ShareableEntity,
  entityId: string,
): number | undefined {
  return getAvailability(outletId, entity, entityId)?.price_override;
}

export function setAvailability(
  outletId: string,
  entity: ShareableEntity,
  entityId: string,
  patch: AvailabilityOverride,
): void {
  const state = readState();
  state[keyOf(outletId, entity, entityId)] = patch;
  writeState(state);
}

export type BulkShareResult = { applied: number; skipped: number; failed: number };

/**
 * Bulk share/unshare org masters with target outlets. Promos are
 * outlet-scoped rows, so sharing copies the promo into each target;
 * every other entity gets an availability override (shared master kept).
 * Idempotent — re-running converges instead of duplicating.
 */
export async function bulkShare(input: {
  outletIds: string[];
  entity: ShareableEntity;
  entityIds: string[];
  is_available: boolean;
  price_override?: number;
}): Promise<BulkShareResult> {
  const { outletIds, entity, entityIds, is_available, price_override } = input;
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  if (entity === "promo") {
    const { getPromoById, createPromo, getPromos } = await import("@/features/promos/api/service");
    for (const outletId of outletIds) {
      const existing = await getPromos().catch(() => []);
      const codes = new Set(existing.filter((p) => p.outlet_id === outletId).map((p) => p.code));
      for (const promoId of entityIds) {
        try {
          const promo = await getPromoById(promoId);
          if (!promo) {
            skipped += 1;
            continue;
          }
          if (promo.outlet_id === outletId || codes.has(promo.code)) {
            skipped += 1;
            continue;
          }
          const { id: _drop, outlet_id: _dropOutlet, ...rest } = promo;
          void _drop;
          void _dropOutlet;
          await createPromo({ ...rest, code: promo.code }, outletId);
          codes.add(promo.code);
          applied += 1;
        } catch {
          failed += 1;
        }
      }
    }
    return { applied, skipped, failed };
  }

  const state = readState();
  for (const outletId of outletIds) {
    for (const entityId of entityIds) {
      try {
        const patch: AvailabilityOverride = { is_available };
        if (entity === "menu_item" && price_override !== undefined) {
          patch.price_override = price_override;
        }
        state[keyOf(outletId, entity, entityId)] = patch;
        applied += 1;
      } catch {
        failed += 1;
      }
    }
  }
  writeState(state);
  return { applied, skipped, failed };
}
