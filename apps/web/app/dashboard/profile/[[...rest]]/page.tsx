"use client";

import PageContainer from "@/components/layout/page-container";
import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
  return (
    <PageContainer
      pageTitle="Profile"
      pageDescription="Your personal account — name, email, phone, password, security and active sessions."
    >
      <UserProfile />
    </PageContainer>
  );
}
