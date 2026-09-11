"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import TableForm from "./table-form";
import { tableQueryOptions } from "../api/queries";

type TableViewPageProps = {
  tableId: string;
  duplicateFromId?: string;
};

export default function TableViewPage({ tableId, duplicateFromId }: TableViewPageProps) {
  if (tableId === "new") {
    if (duplicateFromId) {
      return <DuplicateTableView sourceId={duplicateFromId} />;
    }
    return <TableForm initialData={null} pageTitle="Create New Table" />;
  }

  return <EditTableView tableId={tableId} />;
}

function DuplicateTableView({ sourceId }: { sourceId: string }) {
  const { data } = useSuspenseQuery(tableQueryOptions(sourceId));

  if (!data) {
    notFound();
  }

  return (
    <TableForm
      initialData={null}
      duplicateFrom={data}
      pageTitle={`Duplicate Table ${data.number}`}
    />
  );
}

function EditTableView({ tableId }: { tableId: string }) {
  const { data } = useSuspenseQuery(tableQueryOptions(tableId));

  if (!data) {
    notFound();
  }

  return <TableForm initialData={data} pageTitle="Edit Table" />;
}
