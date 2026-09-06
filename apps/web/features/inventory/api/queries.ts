import { queryOptions } from "@tanstack/react-query";
import {
  getPaymentById,
  getPayments,
  getPriceHistory,
  getPurchaseById,
  getPurchaseReturnById,
  getPurchaseReturns,
  getPurchases,
  getRawMaterials,
  getRawMaterialById,
  getRecipes,
  getRecipeById,
  getPurchaseOrders,
  getPurchaseOrderById,
  getStockLedger,
  getSupplierAdjustmentById,
  getSupplierAdjustments,
  getSupplierById,
  getSupplierLedger,
  getSupplierOutstanding,
  getSuppliers,
  getWasteLogs,
} from "./service";
import type {
  PaymentFilters,
  PurchaseFilters,
  PurchaseOrderFilters,
  PurchaseReturnFilters,
  RawMaterialFilters,
  StockLedgerFilters,
  SupplierAdjustmentFilters,
  SupplierFilters,
  SupplierLedgerFilters,
  WasteFilters,
} from "./types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  rawMaterials: (filters?: RawMaterialFilters) =>
    [...inventoryKeys.all, "raw-materials", filters ?? {}] as const,
  rawMaterial: (id: string) => [...inventoryKeys.all, "raw-material", id] as const,
  suppliers: (filters?: SupplierFilters) =>
    [...inventoryKeys.all, "suppliers", filters ?? {}] as const,
  supplier: (id: string) => [...inventoryKeys.all, "supplier", id] as const,
  recipes: () => [...inventoryKeys.all, "recipes"] as const,
  recipe: (id: string) => [...inventoryKeys.all, "recipe", id] as const,
  purchaseOrders: (filters?: PurchaseOrderFilters) =>
    [...inventoryKeys.all, "purchase-orders", filters ?? {}] as const,
  purchaseOrder: (id: string) => [...inventoryKeys.all, "purchase-order", id] as const,
  purchases: (filters?: PurchaseFilters) =>
    [...inventoryKeys.all, "purchases", filters ?? {}] as const,
  purchase: (id: string) => [...inventoryKeys.all, "purchase", id] as const,
  purchaseReturns: (filters?: PurchaseReturnFilters) =>
    [...inventoryKeys.all, "purchase-returns", filters ?? {}] as const,
  purchaseReturn: (id: string) => [...inventoryKeys.all, "purchase-return", id] as const,
  supplierAdjustments: (filters?: SupplierAdjustmentFilters) =>
    [...inventoryKeys.all, "supplier-adjustments", filters ?? {}] as const,
  supplierAdjustment: (id: string) => [...inventoryKeys.all, "supplier-adjustment", id] as const,
  supplierLedger: (filters?: SupplierLedgerFilters) =>
    [...inventoryKeys.all, "supplier-ledger", filters ?? {}] as const,
  supplierOutstanding: () => [...inventoryKeys.all, "supplier-outstanding"] as const,
  payments: (filters?: PaymentFilters) =>
    [...inventoryKeys.all, "payments", filters ?? {}] as const,
  payment: (id: string) => [...inventoryKeys.all, "payment", id] as const,
  waste: (filters?: WasteFilters) => [...inventoryKeys.all, "waste", filters ?? {}] as const,
  stock: (filters?: StockLedgerFilters) => [...inventoryKeys.all, "stock", filters ?? {}] as const,
  priceHistory: (materialId?: string) =>
    [...inventoryKeys.all, "price-history", materialId ?? "all"] as const,
};

export const rawMaterialsQueryOptions = (filters?: RawMaterialFilters) =>
  queryOptions({
    queryKey: inventoryKeys.rawMaterials(filters),
    queryFn: () => getRawMaterials(filters),
  });

export const rawMaterialQueryOptions = (id: string) =>
  queryOptions({ queryKey: inventoryKeys.rawMaterial(id), queryFn: () => getRawMaterialById(id) });

export const suppliersQueryOptions = (filters?: SupplierFilters) =>
  queryOptions({
    queryKey: inventoryKeys.suppliers(filters),
    queryFn: () => getSuppliers(filters),
  });

export const supplierQueryOptions = (id: string) =>
  queryOptions({ queryKey: inventoryKeys.supplier(id), queryFn: () => getSupplierById(id) });

export const recipesQueryOptions = () =>
  queryOptions({ queryKey: inventoryKeys.recipes(), queryFn: () => getRecipes() });

export const recipeQueryOptions = (id: string) =>
  queryOptions({ queryKey: inventoryKeys.recipe(id), queryFn: () => getRecipeById(id) });

export const purchaseOrdersQueryOptions = (filters?: PurchaseOrderFilters) =>
  queryOptions({
    queryKey: inventoryKeys.purchaseOrders(filters),
    queryFn: () => getPurchaseOrders(filters),
  });

export const purchaseOrderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: inventoryKeys.purchaseOrder(id),
    queryFn: () => getPurchaseOrderById(id),
  });

export const purchasesQueryOptions = (filters?: PurchaseFilters) =>
  queryOptions({
    queryKey: inventoryKeys.purchases(filters),
    queryFn: () => getPurchases(filters),
  });

export const purchaseQueryOptions = (id: string) =>
  queryOptions({
    queryKey: inventoryKeys.purchase(id),
    queryFn: () => getPurchaseById(id),
  });

export const wasteQueryOptions = (filters?: WasteFilters) =>
  queryOptions({ queryKey: inventoryKeys.waste(filters), queryFn: () => getWasteLogs(filters) });

export const stockLedgerQueryOptions = (filters?: StockLedgerFilters) =>
  queryOptions({ queryKey: inventoryKeys.stock(filters), queryFn: () => getStockLedger(filters) });

export const priceHistoryQueryOptions = (materialId?: string) =>
  queryOptions({
    queryKey: inventoryKeys.priceHistory(materialId),
    queryFn: () => getPriceHistory(materialId),
  });

export const purchaseReturnsQueryOptions = (filters?: PurchaseReturnFilters) =>
  queryOptions({
    queryKey: inventoryKeys.purchaseReturns(filters),
    queryFn: () => getPurchaseReturns(filters),
  });

export const purchaseReturnQueryOptions = (id: string) =>
  queryOptions({
    queryKey: inventoryKeys.purchaseReturn(id),
    queryFn: () => getPurchaseReturnById(id),
  });

export const supplierAdjustmentsQueryOptions = (filters?: SupplierAdjustmentFilters) =>
  queryOptions({
    queryKey: inventoryKeys.supplierAdjustments(filters),
    queryFn: () => getSupplierAdjustments(filters),
  });

export const supplierAdjustmentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: inventoryKeys.supplierAdjustment(id),
    queryFn: () => getSupplierAdjustmentById(id),
  });

export const supplierLedgerQueryOptions = (filters?: SupplierLedgerFilters) =>
  queryOptions({
    queryKey: inventoryKeys.supplierLedger(filters),
    queryFn: () => getSupplierLedger(filters),
  });

export const supplierOutstandingQueryOptions = () =>
  queryOptions({
    queryKey: inventoryKeys.supplierOutstanding(),
    queryFn: () => getSupplierOutstanding(),
  });

export const paymentsQueryOptions = (filters?: PaymentFilters) =>
  queryOptions({
    queryKey: inventoryKeys.payments(filters),
    queryFn: () => getPayments(filters),
  });

export const paymentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: inventoryKeys.payment(id),
    queryFn: () => getPaymentById(id),
  });
