"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import RecipeForm from "./recipe-form";
import { recipeQueryOptions } from "../api/queries";

export default function RecipeViewPage({ recipeId }: { recipeId: string }) {
  if (recipeId === "new") return <RecipeForm initialData={null} pageTitle="Create Recipe" />;
  return <EditView recipeId={recipeId} />;
}
function EditView({ recipeId }: { recipeId: string }) {
  const { data } = useSuspenseQuery(recipeQueryOptions(recipeId));
  if (!data) notFound();
  return <RecipeForm initialData={data} pageTitle="Edit Recipe" />;
}
