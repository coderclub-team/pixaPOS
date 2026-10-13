"use client";

import * as React from "react";
import PageContainer from "@/components/layout/page-container";
import { AttendanceRegister } from "@/features/payroll/components/attendance-register";

export default function AttendancePage() {
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  return (
    <PageContainer
      pageTitle="Attendance"
      pageDescription="Manager-marked daily register (no biometric devices). Absent days without approved leave deduct in payroll; unmarked days count as present."
    >
      <AttendanceRegister month={month} onMonthChange={setMonth} />
    </PageContainer>
  );
}
