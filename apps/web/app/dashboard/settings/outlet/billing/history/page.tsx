"use client";

import { useQuery } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import PrintHistory from "@/features/print-studio/components/print-history";
import { printJobsQueryOptions } from "@/features/print-studio/api/queries";

export default function PrintHistoryPage() {
  const { data: jobs, isPending } = useQuery(printJobsQueryOptions());

  if (isPending || !jobs) {
    return (
      <PageContainer pageTitle="Print history" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      pageTitle="Print history"
      pageDescription="Print Studio — queued, sent and failed jobs"
    >
      <div className="mx-auto w-full max-w-3xl">
        <PrintHistory jobs={jobs} />
      </div>
    </PageContainer>
  );
}
