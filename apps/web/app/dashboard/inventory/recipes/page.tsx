"use client";
import PageContainer from "@/components/layout/page-container";
import { RecipeList } from "@/features/inventory/components/recipe-list";
import { recipesQueryOptions } from "@/features/inventory/api/queries";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";
import Link from "next/link";
import { Protect } from "@clerk/nextjs";

export default function RecipesPage() {
  const { data: recipes, isPending } = useQuery(recipesQueryOptions());
  if (isPending)
    return (
      <PageContainer pageTitle="Recipes" pageDescription="Inventory — Recipes (BOM)" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle="Recipes"
      pageDescription="Inventory — Bill of Materials. Recipes define ingredient quantities, cost per serve and margin vs selling price."
      pageHeaderAction={
        <Protect permission="org:recipes:manage" fallback={null}>
          <Link
            href="/dashboard/inventory/recipes/new"
            className={cn(buttonVariants(), "text-xs md:text-sm")}
          >
            <Icons.add className="mr-2 h-4 w-4" /> Add New
          </Link>
        </Protect>
      }
    >
      <RecipeList recipes={recipes ?? []} />
    </PageContainer>
  );
}
