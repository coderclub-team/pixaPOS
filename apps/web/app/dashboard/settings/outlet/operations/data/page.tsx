"use client";

import PageContainer from "@/components/layout/page-container";
import SnapshotPanel from "@/features/system/components/snapshot-panel";

export default function DataBackupsPage() {
  return (
    <PageContainer pageTitle="Data & Backups" pageDescription="Outlet — Operations backups">
      <SnapshotPanel />
    </PageContainer>
  );
}
