import { queryOptions } from "@tanstack/react-query";
import {
  getPriceHistory,
  getPurchaseById,
  getPurchases,
  getRawMaterials,
  getRawMaterialById,
  getRecipes,
  getRecipeById,
  getPurchaseOrders,
  getPurchaseOrderById,
  getStockLedger,
  getSupplierById,
  getSuppliers,
  getWasteLogs,
} from "./service";
import type {
  PurchaseFilters,
  PurchaseOrderFilters,
  RawMaterialFilters,
  SupplierFilters,
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
  waste: (filters?: WasteFilters) => [...inventoryKeys.all, "waste", filters ?? {}] as const,
  stock: () => [...inventoryKeys.all, "stock"] as const,
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

export const stockLedgerQueryOptions = () =>
  queryOptions({ queryKey: inventoryKeys.stock(), queryFn: () => getStockLedger() });

export const priceHistoryQueryOptions = (materialId?: string) =>
  queryOptions({
    queryKey: inventoryKeys.priceHistory(materialId),
    queryFn: () => getPriceHistory(materialId),
  });
