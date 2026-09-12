"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import MenuForm from "@/features/menu/components/menu-form";
import { menuItemQueryOptions } from "@/features/menu/api/queries";

export default function MenuEditView({ itemId }: { itemId: string }) {
  const { data } = useSuspenseQuery(menuItemQueryOptions(itemId));

  if (!data) {
    notFound();
  }

  return <MenuForm initialData={data} pageTitle={`Update ${data.name}`} />;
}
