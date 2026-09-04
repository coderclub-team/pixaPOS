"use client";
import type { WasteLog } from "../api/types";
import { Badge } from "@pixa/ui/base-ui/badge";
import { Card, CardContent } from "@pixa/ui/base-ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pixa/ui/base-ui/table";

export function WasteList({ logs }: { logs: WasteLog[] }) {
  if (logs.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No waste logs — log spoilage, expired, trimming to track cost loss.
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Cost Loss</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((w) => (
              <TableRow key={w.id}>
                <TableCell>{w.material_name ?? w.material_id ?? "-"}</TableCell>
                <TableCell>
                  {w.qty} {w.unit}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {w.reason}
                  </Badge>
                </TableCell>
                <TableCell>₹{w.cost_loss}</TableCell>
                <TableCell className="text-xs">
                  {new Date(w.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
