"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import FloorForm from "./floor-form";
import { floorQueryOptions } from "../api/queries";

type FloorViewPageProps = {
  floorId: string;
};

export default function FloorViewPage({ floorId }: FloorViewPageProps) {
  if (floorId === "new") {
    return <FloorForm initialData={null} pageTitle="Create New Floor" />;
  }

  return <EditFloorView floorId={floorId} />;
}

function EditFloorView({ floorId }: { floorId: string }) {
  const { data } = useSuspenseQuery(floorQueryOptions(floorId));

  if (!data) {
    notFound();
  }

  return <FloorForm initialData={data} pageTitle="Edit Floor" />;
}
