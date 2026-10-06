"use client";

import { useState } from "react";
import PageContainer from "@/components/layout/page-container";
import PrinterForm from "@/features/print-studio/components/printer-form";
import PrinterList from "@/features/print-studio/components/printer-list";
import { printersQueryOptions } from "@/features/print-studio/api/queries";
import { Button } from "@pixa/ui/base-ui/button";
import { useQuery } from "@tanstack/react-query";

export default function PrintersPage() {
  const { data: printers, isPending } = useQuery(printersQueryOptions());
  const [adding, setAdding] = useState(false);

  if (isPending || !printers) {
    return (
      <PageContainer pageTitle="Printers" isLoading>
        <div />
      </PageContainer>
    );
  }

  return (
    <PageContainer pageTitle="Printers" pageDescription="Print Studio — printer fleet">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {!adding && (
          <div className="flex justify-end">
            <Button onClick={() => setAdding(true)}>Add printer</Button>
          </div>
        )}
        {adding ? (
          <PrinterForm
            initialData={{
              name: "",
              connection: "NETWORK",
              address: "",
              port: "9100",
              paper: "P80",
              chars_per_line: "",
              supports_raster: true,
              qr_mode_byte: "auto",
              is_default: printers.length === 0,
              is_active: true,
            }}
            onDone={() => setAdding(false)}
          />
        ) : (
          <PrinterList printers={printers} />
        )}
      </div>
    </PageContainer>
  );
}
