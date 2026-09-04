"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import SupplierForm from "./supplier-form";
import { supplierQueryOptions } from "../api/queries";

export default function SupplierViewPage({ supplierId }: { supplierId: string }) {
  if (supplierId === "new") return <SupplierForm initialData={null} pageTitle="Create Supplier" />;
  return <EditView supplierId={supplierId} />;
}
function EditView({ supplierId }: { supplierId: string }) {
  const { data } = useSuspenseQuery(supplierQueryOptions(supplierId));
  if (!data) notFound();
  return <SupplierForm initialData={data} pageTitle="Edit Supplier" />;
}
