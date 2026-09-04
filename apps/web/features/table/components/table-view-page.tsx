"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import TableForm from "./table-form";
import { tableQueryOptions } from "../api/queries";

type TableViewPageProps = {
  tableId: string;
};

export default function TableViewPage({ tableId }: TableViewPageProps) {
  if (tableId === "new") {
    return <TableForm initialData={null} pageTitle="Create New Table" />;
  }

  return <EditTableView tableId={tableId} />;
}

function EditTableView({ tableId }: { tableId: string }) {
  const { data } = useSuspenseQuery(tableQueryOptions(tableId));

  if (!data) {
    notFound();
  }

  return <TableForm initialData={data} pageTitle="Edit Table" />;
}
