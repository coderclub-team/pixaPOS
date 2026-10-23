/**
 * Inventory domain — server implementation (Postgres-backed via Drizzle).
 *
 * Scoped to organization + outlet. Manages purchase orders, inward goods receipts,
 * inventory transactions, wastage, supplier ledger, and stock balances.
 * Server-only: import from API route handlers and server actions, never client bundles.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { ulid } from "@pixa/contracts";
import {
  db,
  inventoryTxns,
  purchaseOrderItems,
  purchaseOrders,
  purchases,
  purchaseItems,
  rawMaterials,
  suppliers,
  wasteLogs,
  supplierAdjustments,
  supplierPayments,
} from "@pixa/db";
import { recordServerEvent } from "@/features/events/api/server";
import type {
  Purchase,
  PurchaseFilters,
  PurchaseOrder,
  PurchaseOrderFilters,
  PurchaseOrderPayload,
  PurchasePayload,
  StockLedgerEntry,
  StockLedgerFilters,
  SupplierAdjustment,
  SupplierAdjustmentFilters,
  SupplierAdjustmentPayload,
  SupplierPayment,
  PaymentFilters,
  SupplierPaymentPayload,
  WasteFilters,
  WasteLog,
  WastePayload,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Purchase Orders                                                            */
/* -------------------------------------------------------------------------- */

export async function listPurchaseOrders(
  organizationId: string,
  outletId?: string | null,
  filters?: PurchaseOrderFilters,
): Promise<PurchaseOrder[]> {
  const conditions = [
    eq(purchaseOrders.organizationId, organizationId),
    isNull(purchaseOrders.deletedAt),
  ];
  if (outletId) conditions.push(eq(purchaseOrders.outletId, outletId));
  if (filters?.supplier_id) conditions.push(eq(purchaseOrders.supplierId, filters.supplier_id));
  if (filters?.status) conditions.push(eq(purchaseOrders.status, filters.status));

  const pos = await db()
    .select({
      po: purchaseOrders,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.createdAt));

  if (pos.length === 0) return [];

  const poIds = pos.map((p) => p.po.id);
  const items = await db()
    .select({
      item: purchaseOrderItems,
      materialName: rawMaterials.name,
    })
    .from(purchaseOrderItems)
    .leftJoin(rawMaterials, eq(rawMaterials.id, purchaseOrderItems.materialId))
    .where(
      and(
        eq(purchaseOrderItems.organizationId, organizationId),
        inArray(purchaseOrderItems.purchaseOrderId, poIds),
      ),
    );

  const itemsByPo = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByPo.get(it.item.purchaseOrderId) ?? [];
    list.push(it);
    itemsByPo.set(it.item.purchaseOrderId, list);
  }

  return pos.map(({ po, supplierName }) => {
    const rawItems = itemsByPo.get(po.id) ?? [];
    return {
      id: po.id,
      outlet_id: po.outletId,
      po_number: po.poNumber,
      supplier_id: po.supplierId,
      supplier_name: supplierName ?? undefined,
      status: po.status as PurchaseOrder["status"],
      subtotal: po.subtotalPaise / 100,
      tax_amount: po.taxPaise / 100,
      tax: po.taxPaise / 100,
      total_amount: po.totalPaise / 100,
      total: po.totalPaise / 100,
      po_date: po.poDate || po.createdAt.toISOString().slice(0, 10),
      expected_at: po.expectedAt ?? undefined,
      expected_delivery_date: po.expectedAt ?? undefined,
      notes: po.notes ?? undefined,
      items: rawItems.map(({ item, materialName }) => ({
        material_id: item.materialId,
        material_name: materialName ?? undefined,
        qty: item.qty,
        unit: item.unit ?? undefined,
        unit_cost: item.unitCostPaise / 100,
        tax_percent: item.taxPercent,
        line_total: (item.qty * item.unitCostPaise) / 100,
      })),
      created_at: po.createdAt.toISOString(),
      updated_at: po.updatedAt.toISOString(),
    };
  });
}

export async function getPurchaseOrderById(
  organizationId: string,
  id: string,
): Promise<PurchaseOrder | null> {
  const list = await listPurchaseOrders(organizationId, null);
  return list.find((p) => p.id === id) ?? null;
}

export async function createPurchaseOrder(
  organizationId: string,
  outletId: string,
  payload: PurchaseOrderPayload,
  by = "staff",
): Promise<PurchaseOrder> {
  const id = ulid();
  const subtotalPaise = Math.round(
    (payload.items ?? []).reduce((acc, it) => acc + it.qty * it.unit_cost, 0) * 100,
  );
  const taxPaise = Math.round(
    (payload.items ?? []).reduce(
      (acc, it) => acc + it.qty * it.unit_cost * ((it.tax_percent ?? 0) / 100),
      0,
    ) * 100,
  );
  const totalPaise = subtotalPaise + taxPaise;

  const poNumber = payload.po_number || `PO-${Date.now().toString(36).toUpperCase()}`;

  await db()
    .insert(purchaseOrders)
    .values({
      id,
      organizationId,
      outletId,
      supplierId: payload.supplier_id,
      poNumber,
      status: payload.status ?? "draft",
      subtotalPaise,
      taxPaise,
      totalPaise,
      poDate: payload.po_date || new Date().toISOString().slice(0, 10),
      expectedAt: payload.expected_delivery_date || payload.expected_at || null,
      notes: payload.notes || null,
    });

  if (payload.items && payload.items.length > 0) {
    await db()
      .insert(purchaseOrderItems)
      .values(
        payload.items.map((it) => ({
          id: ulid(),
          organizationId,
          purchaseOrderId: id,
          materialId: it.material_id,
          qty: it.qty,
          unit: it.unit || "pcs",
          unitCostPaise: Math.round(it.unit_cost * 100),
          taxPercent: it.tax_percent ?? 0,
        })),
      );
  }

  await recordServerEvent({
    outlet_id: outletId,
    organization_id: organizationId,
    entity_type: "PURCHASE_ORDER",
    entity_id: id,
    event_type: "PURCHASE_ORDER_CREATED",
    actor_id: by,
    metadata: { poNumber, totalPaise },
  });

  const out = await getPurchaseOrderById(organizationId, id);
  if (!out) throw new Error("Failed to retrieve created purchase order");
  return out;
}

export async function updatePurchaseOrder(
  organizationId: string,
  id: string,
  payload: Partial<PurchaseOrderPayload>,
  by = "staff",
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrderById(organizationId, id);
  if (!existing) throw new Error("Purchase order not found");

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (payload.status) updates.status = payload.status;
  if (payload.notes !== undefined) updates.notes = payload.notes || null;
  if (payload.expected_delivery_date !== undefined || payload.expected_at !== undefined)
    updates.expectedAt = payload.expected_delivery_date || payload.expected_at || null;
  if (payload.po_date !== undefined) updates.poDate = payload.po_date;

  await db()
    .update(purchaseOrders)
    .set(updates)
    .where(and(eq(purchaseOrders.organizationId, organizationId), eq(purchaseOrders.id, id)));

  const out = await getPurchaseOrderById(organizationId, id);
  if (!out) throw new Error("Purchase order not found");
  return out;
}

/* -------------------------------------------------------------------------- */
/* Purchases / Inward Receipts                                               */
/* -------------------------------------------------------------------------- */

export async function listPurchases(
  organizationId: string,
  outletId?: string | null,
  filters?: PurchaseFilters,
): Promise<Purchase[]> {
  const conditions = [eq(purchases.organizationId, organizationId), isNull(purchases.deletedAt)];
  if (outletId) conditions.push(eq(purchases.outletId, outletId));
  if (filters?.supplier_id) conditions.push(eq(purchases.supplierId, filters.supplier_id));
  if (filters?.payment_status) conditions.push(eq(purchases.paymentStatus, filters.payment_status));

  const list = await db()
    .select({
      pur: purchases,
      supplierName: suppliers.name,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .where(and(...conditions))
    .orderBy(desc(purchases.createdAt));

  if (list.length === 0) return [];

  const purIds = list.map((p) => p.pur.id);
  const items = await db()
    .select({
      item: purchaseItems,
      materialName: rawMaterials.name,
    })
    .from(purchaseItems)
    .leftJoin(rawMaterials, eq(rawMaterials.id, purchaseItems.materialId))
    .where(
      and(
        eq(purchaseItems.organizationId, organizationId),
        inArray(purchaseItems.purchaseId, purIds),
      ),
    );

  const itemsByPur = new Map<string, typeof items>();
  for (const it of items) {
    const l = itemsByPur.get(it.item.purchaseId) ?? [];
    l.push(it);
    itemsByPur.set(it.item.purchaseId, l);
  }

  return list.map(({ pur, supplierName }) => {
    const rawItems = itemsByPur.get(pur.id) ?? [];
    return {
      id: pur.id,
      outlet_id: pur.outletId,
      purchase_number: pur.purchaseNumber,
      po_id: pur.purchaseOrderId ?? undefined,
      purchase_order_id: pur.purchaseOrderId ?? undefined,
      supplier_id: pur.supplierId,
      supplier_name: supplierName ?? undefined,
      subtotal: pur.subtotalPaise / 100,
      tax_amount: pur.taxPaise / 100,
      tax: pur.taxPaise / 100,
      landed_cost: pur.landedPaise / 100,
      total_amount: pur.totalPaise / 100,
      total: pur.totalPaise / 100,
      paid_amount: pur.paidPaise / 100,
      balance_amount: (pur.totalPaise - pur.paidPaise) / 100,
      payment_status: pur.paymentStatus as Purchase["payment_status"],
      payment_mode: (pur.paymentMode as Purchase["payment_mode"]) ?? undefined,
      bill_date: pur.billDate || pur.createdAt.toISOString().slice(0, 10),
      notes: pur.notes ?? undefined,
      items: rawItems.map(({ item, materialName }) => ({
        material_id: item.materialId,
        material_name: materialName ?? undefined,
        qty: item.qty,
        unit: item.unit ?? "pcs",
        unit_cost: item.unitCostPaise / 100,
        batch_no: item.batchNo ?? undefined,
        line_total: (item.qty * item.unitCostPaise) / 100,
      })),
      created_at: pur.createdAt.toISOString(),
      updated_at: pur.updatedAt.toISOString(),
    };
  });
}

export async function getPurchaseById(
  organizationId: string,
  id: string,
): Promise<Purchase | null> {
  const all = await listPurchases(organizationId, null);
  return all.find((p) => p.id === id) ?? null;
}

export async function createPurchase(
  organizationId: string,
  outletId: string,
  payload: PurchasePayload,
  by = "staff",
): Promise<Purchase> {
  const id = ulid();
  const subtotalPaise = Math.round(
    (payload.items ?? []).reduce((acc, it) => acc + it.qty * it.unit_cost, 0) * 100,
  );
  const taxPaise = Math.round(
    (payload.items ?? []).reduce(
      (acc, it) => acc + it.qty * it.unit_cost * ((it.tax_percent ?? 0) / 100),
      0,
    ) * 100,
  );
  const landedPaise = Math.round((payload.landed_cost ?? 0) * 100);
  const totalPaise = subtotalPaise + taxPaise + landedPaise;
  const paidPaise = Math.round((payload.paid_amount ?? 0) * 100);
  const paymentStatus = paidPaise >= totalPaise ? "paid" : paidPaise > 0 ? "partial" : "unpaid";

  const purchaseNumber = payload.purchase_number || `PUR-${Date.now().toString(36).toUpperCase()}`;

  await db()
    .insert(purchases)
    .values({
      id,
      organizationId,
      outletId,
      purchaseNumber,
      purchaseOrderId: payload.purchase_order_id || payload.po_id || null,
      supplierId: payload.supplier_id,
      subtotalPaise,
      taxPaise,
      landedPaise,
      totalPaise,
      paidPaise,
      paymentStatus,
      paymentMode: payload.payment_mode || null,
      billDate: payload.bill_date || new Date().toISOString().slice(0, 10),
      notes: payload.notes || null,
    });

  if (payload.items && payload.items.length > 0) {
    for (const it of payload.items) {
      const lineId = ulid();
      const unitCostPaise = Math.round(it.unit_cost * 100);

      await db()
        .insert(purchaseItems)
        .values({
          id: lineId,
          organizationId,
          purchaseId: id,
          materialId: it.material_id,
          qty: it.qty,
          unit: it.unit || "pcs",
          unitCostPaise,
          batchNo: it.batch_no || null,
        });

      // Record stock ledger entry
      await db().insert(inventoryTxns).values({
        id: ulid(),
        organizationId,
        outletId,
        rawMaterialId: it.material_id,
        transactionType: "purchase",
        quantity: it.qty,
        referenceType: "purchase",
        referenceId: id,
      });

      // Update material stock & moving average cost
      const [mat] = await db()
        .select()
        .from(rawMaterials)
        .where(
          and(eq(rawMaterials.organizationId, organizationId), eq(rawMaterials.id, it.material_id)),
        )
        .limit(1);

      if (mat) {
        const currentQty = Number(mat.stockQty ?? 0);
        const currentAvg = Number(mat.avgCostPaise ?? 0);
        const newQty = currentQty + it.qty;
        const newAvg =
          newQty > 0
            ? Math.round((currentQty * currentAvg + it.qty * unitCostPaise) / newQty)
            : unitCostPaise;

        await db()
          .update(rawMaterials)
          .set({
            stockQty: sql`${rawMaterials.stockQty} + ${it.qty}`,
            costPricePaise: unitCostPaise,
            avgCostPaise: newAvg,
            updatedAt: new Date(),
          })
          .where(eq(rawMaterials.id, it.material_id));
      }
    }
  }

  // If tied to a PO, advance PO status to received
  const targetPoId = payload.purchase_order_id || payload.po_id;
  if (targetPoId) {
    await db()
      .update(purchaseOrders)
      .set({ status: "received", updatedAt: new Date() })
      .where(
        and(eq(purchaseOrders.organizationId, organizationId), eq(purchaseOrders.id, targetPoId)),
      );
  }

  await recordServerEvent({
    outlet_id: outletId,
    organization_id: organizationId,
    entity_type: "PURCHASE",
    entity_id: id,
    event_type: "PURCHASE_RECORDED",
    actor_id: by,
    metadata: { purchaseNumber, totalPaise },
  });

  const out = await getPurchaseById(organizationId, id);
  if (!out) throw new Error("Failed to retrieve created purchase");
  return out;
}

/* -------------------------------------------------------------------------- */
/* Wastage                                                                    */
/* -------------------------------------------------------------------------- */

export async function listWasteLogs(
  organizationId: string,
  outletId: string,
  filters?: WasteFilters,
): Promise<WasteLog[]> {
  const conditions = [
    eq(wasteLogs.organizationId, organizationId),
    eq(wasteLogs.outletId, outletId),
    isNull(wasteLogs.deletedAt),
  ];

  if (filters?.material_id) conditions.push(eq(wasteLogs.rawMaterialId, filters.material_id));
  if (filters?.recipe_id) conditions.push(eq(wasteLogs.recipeId, filters.recipe_id));
  if (filters?.reason) conditions.push(eq(wasteLogs.reason, filters.reason));

  const rows = await db()
    .select()
    .from(wasteLogs)
    .where(and(...conditions))
    .orderBy(desc(wasteLogs.createdAt));

  return rows.map((r) => ({
    id: r.id,
    outlet_id: r.outletId,
    material_id: r.rawMaterialId ?? undefined,
    material_name: r.materialName ?? undefined,
    recipe_id: r.recipeId ?? undefined,
    recipe_name: r.recipeName ?? undefined,
    variant_id: r.variantId ?? undefined,
    variant_name: r.variantName ?? undefined,
    order_id: r.orderId ?? undefined,
    order_number: r.orderNumber ?? undefined,
    qty: Number(r.qty),
    unit: r.unit,
    reason: r.reason as WasteLog["reason"],
    notes: r.notes ?? undefined,
    photo_url: r.photoUrl ?? undefined,
    cost_loss: r.costLossPaise / 100,
    created_by: r.createdBy ?? undefined,
    created_at: r.createdAt.toISOString(),
  }));
}

export async function createWasteLog(
  organizationId: string,
  outletId: string,
  payload: WastePayload,
  by = "staff",
): Promise<WasteLog> {
  const id = ulid();

  let costLossPaise = 0;
  let materialName = payload.material_id || undefined;

  if (payload.material_id) {
    const [mat] = await db()
      .select()
      .from(rawMaterials)
      .where(
        and(
          eq(rawMaterials.organizationId, organizationId),
          eq(rawMaterials.id, payload.material_id),
        ),
      )
      .limit(1);

    if (mat) {
      materialName = mat.name;
      const avgCostPaise = Number(mat.avgCostPaise ?? mat.costPricePaise ?? 0);
      costLossPaise = Math.round(payload.qty * avgCostPaise);

      // Deduct stock from raw material
      await db()
        .update(rawMaterials)
        .set({
          stockQty: sql`${rawMaterials.stockQty} - ${payload.qty}`,
          updatedAt: new Date(),
        })
        .where(eq(rawMaterials.id, mat.id));

      // Record in stock ledger
      await db()
        .insert(inventoryTxns)
        .values({
          id: ulid(),
          organizationId,
          outletId,
          rawMaterialId: mat.id,
          transactionType: "waste",
          quantity: -Math.abs(payload.qty),
          referenceType: "waste",
          referenceId: id,
        });
    }
  }

  const [row] = await db()
    .insert(wasteLogs)
    .values({
      id,
      organizationId,
      outletId,
      rawMaterialId: payload.material_id || null,
      materialName: materialName || null,
      recipeId: payload.recipe_id || null,
      variantId: payload.variant_id || null,
      orderId: payload.order_id || null,
      qty: String(payload.qty),
      unit: payload.unit || "pcs",
      reason: payload.reason,
      notes: payload.notes || null,
      photoUrl: payload.photo_url || null,
      costLossPaise,
      createdBy: payload.created_by || by,
    })
    .returning();

  await recordServerEvent({
    outlet_id: outletId,
    organization_id: organizationId,
    entity_type: "WASTE_LOG",
    entity_id: id,
    event_type: "WASTE_LOGGED",
    actor_id: by,
    metadata: { reason: payload.reason, qty: payload.qty, costLossPaise },
  });

  return {
    id: row.id,
    outlet_id: row.outletId,
    material_id: row.rawMaterialId ?? undefined,
    material_name: row.materialName ?? undefined,
    recipe_id: row.recipeId ?? undefined,
    variant_id: row.variantId ?? undefined,
    order_id: row.orderId ?? undefined,
    qty: Number(row.qty),
    unit: row.unit,
    reason: row.reason as WasteLog["reason"],
    notes: row.notes ?? undefined,
    photo_url: row.photoUrl ?? undefined,
    cost_loss: row.costLossPaise / 100,
    created_by: row.createdBy ?? undefined,
    created_at: row.createdAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Stock Ledger                                                               */
/* -------------------------------------------------------------------------- */

export async function getStockLedger(
  organizationId: string,
  outletId: string,
  filters?: StockLedgerFilters,
): Promise<StockLedgerEntry[]> {
  const conditions = [
    eq(inventoryTxns.organizationId, organizationId),
    eq(inventoryTxns.outletId, outletId),
  ];
  if (filters?.material_id) conditions.push(eq(inventoryTxns.rawMaterialId, filters.material_id));
  if (filters?.type) conditions.push(eq(inventoryTxns.transactionType, filters.type));

  const rows = await db()
    .select({
      txn: inventoryTxns,
      mat: rawMaterials,
    })
    .from(inventoryTxns)
    .leftJoin(rawMaterials, eq(rawMaterials.id, inventoryTxns.rawMaterialId))
    .where(and(...conditions))
    .orderBy(desc(inventoryTxns.createdAt));

  return rows.map(({ txn, mat }) => ({
    id: txn.id,
    material_id: txn.rawMaterialId,
    material_name: mat?.name ?? "Unknown Material",
    type: txn.transactionType as StockLedgerEntry["type"],
    qty_delta: txn.quantity,
    previous_qty: Number(mat?.stockQty ?? 0) - txn.quantity,
    new_qty: Number(mat?.stockQty ?? 0),
    resulting_stock: Number(mat?.stockQty ?? 0),
    unit: mat?.unit ?? "pcs",
    reference_id: txn.referenceId ?? undefined,
    created_at: txn.createdAt.toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/* Supplier Adjustments & Payments                                            */
/* -------------------------------------------------------------------------- */

export async function listSupplierAdjustments(
  organizationId: string,
  outletId: string,
  filters?: SupplierAdjustmentFilters,
): Promise<SupplierAdjustment[]> {
  const conditions = [
    eq(supplierAdjustments.organizationId, organizationId),
    eq(supplierAdjustments.outletId, outletId),
  ];
  if (filters?.supplier_id)
    conditions.push(eq(supplierAdjustments.supplierId, filters.supplier_id));

  const rows = await db()
    .select({
      adj: supplierAdjustments,
      supplierName: suppliers.name,
    })
    .from(supplierAdjustments)
    .leftJoin(suppliers, eq(suppliers.id, supplierAdjustments.supplierId))
    .where(and(...conditions))
    .orderBy(desc(supplierAdjustments.createdAt));

  return rows.map(({ adj, supplierName }) => ({
    id: adj.id,
    outlet_id: adj.outletId,
    adjustment_number: `ADJ-${adj.id.slice(0, 8)}`,
    category: "other" as SupplierAdjustment["category"],
    supplier_id: adj.supplierId,
    supplier_name: supplierName ?? undefined,
    type: adj.type as SupplierAdjustment["type"],
    amount: adj.amountPaise / 100,
    reason: adj.reason,
    notes: adj.notes ?? undefined,
    reference: adj.referenceId ?? undefined,
    reference_id: adj.referenceId ?? undefined,
    bill_date: adj.createdAt.toISOString().slice(0, 10),
    status: "posted" as SupplierAdjustment["status"],
    created_at: adj.createdAt.toISOString(),
    updated_at: adj.updatedAt.toISOString(),
  }));
}

export async function createSupplierAdjustment(
  organizationId: string,
  outletId: string,
  payload: SupplierAdjustmentPayload,
): Promise<SupplierAdjustment> {
  const id = ulid();
  const amountPaise = Math.round(payload.amount * 100);
  const reason = payload.reason || payload.category || "Adjustment";
  const referenceId = payload.reference_id || payload.reference || null;

  const [row] = await db()
    .insert(supplierAdjustments)
    .values({
      id,
      organizationId,
      outletId,
      supplierId: payload.supplier_id,
      type: payload.type,
      amountPaise,
      reason,
      notes: payload.notes || null,
      referenceId,
    })
    .returning();

  const [sup] = await db()
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.id, payload.supplier_id));

  return {
    id: row.id,
    outlet_id: row.outletId,
    adjustment_number: `ADJ-${row.id.slice(0, 8)}`,
    category: (payload.category as SupplierAdjustment["category"]) ?? "other",
    supplier_id: row.supplierId,
    supplier_name: sup?.name ?? undefined,
    type: row.type as SupplierAdjustment["type"],
    amount: row.amountPaise / 100,
    reason: row.reason,
    notes: row.notes ?? undefined,
    reference: row.referenceId ?? undefined,
    reference_id: row.referenceId ?? undefined,
    bill_date: payload.bill_date || row.createdAt.toISOString().slice(0, 10),
    status: "posted",
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listSupplierPayments(
  organizationId: string,
  outletId: string,
  filters?: PaymentFilters,
): Promise<SupplierPayment[]> {
  const conditions = [
    eq(supplierPayments.organizationId, organizationId),
    eq(supplierPayments.outletId, outletId),
  ];
  if (filters?.supplier_id) conditions.push(eq(supplierPayments.supplierId, filters.supplier_id));

  const rows = await db()
    .select({
      pay: supplierPayments,
      supplierName: suppliers.name,
    })
    .from(supplierPayments)
    .leftJoin(suppliers, eq(suppliers.id, supplierPayments.supplierId))
    .where(and(...conditions))
    .orderBy(desc(supplierPayments.createdAt));

  return rows.map(({ pay, supplierName }) => ({
    id: pay.id,
    outlet_id: pay.outletId,
    payment_number: `PAY-${pay.id.slice(0, 8)}`,
    supplier_id: pay.supplierId,
    supplier_name: supplierName ?? undefined,
    amount: pay.amountPaise / 100,
    payment_mode: pay.paymentMode as SupplierPayment["payment_mode"],
    bill_date: pay.paymentDate || pay.createdAt.toISOString().slice(0, 10),
    payment_date: pay.paymentDate,
    status: "posted" as SupplierPayment["status"],
    reference: pay.reference ?? undefined,
    notes: pay.notes ?? undefined,
    created_at: pay.createdAt.toISOString(),
    updated_at: pay.updatedAt.toISOString(),
  }));
}

export async function createSupplierPayment(
  organizationId: string,
  outletId: string,
  payload: SupplierPaymentPayload,
): Promise<SupplierPayment> {
  const id = ulid();
  const amountPaise = Math.round(payload.amount * 100);
  const paymentDate =
    payload.payment_date || payload.bill_date || new Date().toISOString().slice(0, 10);

  const [row] = await db()
    .insert(supplierPayments)
    .values({
      id,
      organizationId,
      outletId,
      supplierId: payload.supplier_id,
      amountPaise,
      paymentMode: payload.payment_mode,
      paymentDate,
      reference: payload.reference || null,
      notes: payload.notes || null,
    })
    .returning();

  const [sup] = await db()
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.id, payload.supplier_id));

  return {
    id: row.id,
    outlet_id: row.outletId,
    payment_number: `PAY-${row.id.slice(0, 8)}`,
    supplier_id: row.supplierId,
    supplier_name: sup?.name ?? undefined,
    amount: row.amountPaise / 100,
    payment_mode: row.paymentMode as SupplierPayment["payment_mode"],
    bill_date: row.paymentDate,
    payment_date: row.paymentDate,
    status: "posted",
    reference: row.reference ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
