"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@pixa/ui/base-ui/card";
import { Button } from "@pixa/ui/base-ui/button";
import { renderText } from "../api/render";
import { PAPER_PROFILES, type PaperSize } from "../api/types";
import type { PrintDoc } from "../api/docs";
import { cn } from "@pixa/ui/lib/utils";

const PAPERS: PaperSize[] = ["P58", "P78", "P80"];

/** Live text preview of a print doc with paper-width switcher. */
export default function ReceiptPreview({
  doc,
  title,
  logoUrl,
  initialPaper,
}: {
  doc: PrintDoc;
  title: string;
  logoUrl?: string;
  initialPaper?: PaperSize;
}) {
  const [paper, setPaper] = useState<PaperSize>(initialPaper ?? "P80");
  const lines = renderText(doc, paper);
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-left text-xl font-bold">{title}</CardTitle>
          <div className="flex gap-1">
            {PAPERS.map((p) => (
              <Button
                key={p}
                variant={paper === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPaper(p)}
              >
                {PAPER_PROFILES[p].label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logoUrl ? (
          <div className="mb-2 flex justify-center">
            <Image
              src={logoUrl}
              alt="Outlet logo preview"
              width={96}
              height={96}
              className="max-h-24 object-contain"
            />
          </div>
        ) : null}
        <pre
          className={cn(
            "overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100",
          )}
        >
          {lines.join("\n")}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          {PAPER_PROFILES[paper].chars} chars · {PAPER_PROFILES[paper].use}. Same layout math as the
          ESC/POS bytes.
        </p>
      </CardContent>
    </Card>
  );
}
