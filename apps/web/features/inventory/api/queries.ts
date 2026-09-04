import { queryOptions } from "@tanstack/react-query";
import {
  getPriceHistory,
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
import type { RawMaterialFilters, SupplierFilters, WasteFilters } from "./types";

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
  purchaseOrders: () => [...inventoryKeys.all, "purchase-orders"] as const,
  purchaseOrder: (id: string) => [...inventoryKeys.all, "purchase-order", id] as const,
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

export const purchaseOrdersQueryOptions = () =>
  queryOptions({ queryKey: inventoryKeys.purchaseOrders(), queryFn: () => getPurchaseOrders() });

export const purchaseOrderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: inventoryKeys.purchaseOrder(id),
    queryFn: () => getPurchaseOrderById(id),
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
