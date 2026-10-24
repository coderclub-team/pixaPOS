import { ApiReference } from "@scalar/nextjs-api-reference";

export const dynamic = "force-dynamic";

export const GET = ApiReference({
  spec: { url: "/api/openapi.json" },
  theme: "default",
  layout: "modern",
  metaData: { title: "pixaPOS API — Scalar" },
});
