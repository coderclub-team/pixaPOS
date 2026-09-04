"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import UserForm from "./user-form";
import { userQueryOptions } from "../api/queries";

type UserViewPageProps = {
  userId: string;
};

export default function UserViewPage({ userId }: UserViewPageProps) {
  if (userId === "new") {
    return <UserForm initialData={null} pageTitle="Create New User" />;
  }

  return <EditUserView userId={userId} />;
}

function EditUserView({ userId }: { userId: string }) {
  const id = Number(userId);
  if (Number.isNaN(id)) notFound();

  const { data } = useSuspenseQuery(userQueryOptions(id));

  if (!data) notFound();

  return <UserForm initialData={data} pageTitle="Edit User" />;
}
