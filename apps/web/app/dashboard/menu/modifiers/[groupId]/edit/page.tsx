"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import ModifierGroupForm from "@/features/menu/components/modifier-group-form";
import ModifierOptionsManager from "@/features/menu/components/modifier-options-manager";
import { modifierGroupQueryOptions } from "@/features/menu/api/queries";

export default function EditModifierGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const { data: group, isPending } = useQuery(modifierGroupQueryOptions(groupId));
  if (isPending || !group)
    return (
      <PageContainer pageTitle="Add-on Group" isLoading>
        <div />
      </PageContainer>
    );
  return (
    <PageContainer
      pageTitle={group.name}
      pageDescription="Group rules, then its add-on options with KOT aliases and prices."
    >
      <div className="space-y-6">
        <ModifierGroupForm initialData={group} />
        <ModifierOptionsManager groupId={group.id} />
      </div>
    </PageContainer>
  );
}
