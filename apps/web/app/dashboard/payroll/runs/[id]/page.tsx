"use client";

import * as React from "react";
import PageContainer from "@pixa/ui/layout/page-container";
import { RunDetail } from "@/features/payroll/components/run-detail";

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return (
    <PageContainer pageTitle="Payroll Run" pageDescription="Payroll — Run detail">
      <RunDetail runId={id} />
    </PageContainer>
  );
}
