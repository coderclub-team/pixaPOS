"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import RawMaterialForm from "./raw-material-form";
import { rawMaterialQueryOptions } from "../api/queries";

export default function RawMaterialViewPage({ materialId }: { materialId: string }) {
  if (materialId === "new")
    return <RawMaterialForm initialData={null} pageTitle="Create Raw Material" />;
  return <EditView materialId={materialId} />;
}
function EditView({ materialId }: { materialId: string }) {
  const { data } = useSuspenseQuery(rawMaterialQueryOptions(materialId));
  if (!data) notFound();
  return <RawMaterialForm initialData={data} pageTitle="Edit Raw Material" />;
}
