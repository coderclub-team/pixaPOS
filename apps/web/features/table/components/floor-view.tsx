"use client";

import { useState } from "react";
import PageContainer from "@/components/layout/page-container";
import { useQuery } from "@tanstack/react-query";
import { floorsQueryOptions } from "@/features/floor/api/queries";
import { tableQueryOptions } from "@/features/table/api/queries";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@pixa/ui/base-ui/tabs";
import FloorPlanCanvas from "@/features/table/components/floor-plan-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Suspense } from "react";
import { Skeleton } from "@pixa/ui/base-ui/skeleton";

export default function FloorViewPage() {
  const { data: floors, isLoading } = useQuery(floorsQueryOptions());
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  if (isLoading) return <PageContainer pageTitle="Floor View" isLoading><div/></PageContainer>;

  const activeFloors = (floors ?? []).filter((f) => f.is_active);
  const currentFloorId = selectedFloorId ?? activeFloors[0]?.id;
  // H10: resolve the real table entity — never display ID fragments as names
  const { data: selectedTable } = useQuery({
    ...tableQueryOptions(selectedTableId ?? ""),
    enabled: !!selectedTableId,
  });

  return (
    <PageContainer
      pageTitle="Floor View"
      pageDescription="Operational view for seating management and live table status."
    >
      <div className="grid h-[calc(100vh-200px)] grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Tabs value={currentFloorId} onValueChange={setSelectedFloorId} className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                {activeFloors.map((f) => (
                  <TabsTrigger key={f.id} value={f.id}>
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
                  <div className="h-2 w-2 rounded-full bg-green-500" /> Available
                </Badge>
                <Badge variant="outline" className="gap-1 border-red-500 text-red-600">
                  <div className="h-2 w-2 rounded-full bg-red-500" /> Occupied
                </Badge>
              </div>
            </div>
            {activeFloors.map((f) => (
              <TabsContent key={f.id} value={f.id} className="h-[calc(100%-60px)]">
                <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
                  <FloorPlanCanvas 
                    floorId={f.id} 
                    selectedTableId={selectedTableId ?? undefined}
                    onSelectTable={setSelectedTableId}
                  />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Table Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedTableId ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                  <Icons.table className="mb-2 size-8 opacity-20" />
                  <p className="text-sm">Select a table on the map to view details.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Table Status</p>
                    <p className="text-2xl font-bold">
                      {selectedTable ? `Table ${selectedTable.number}` : "Table"}
                    </p>
                    {selectedTable && (
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {selectedTable.status.replace("_", " ")} • {selectedTable.seated_seats}/
                        {selectedTable.capacity} seats
                        {selectedTable.active_groups.length > 0 &&
                          ` • ${selectedTable.active_groups.length} group(s)`}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full justify-start gap-2">
                      <Icons.add className="size-4" /> Seat Guests
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Icons.edit className="size-4" /> View Order
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
