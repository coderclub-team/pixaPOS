import type { Metadata } from "next";
import KdsWallboard from "./wallboard";

export const metadata: Metadata = {
  title: "KDS Wallboard",
  description: "Live kitchen display — installable, works offline.",
};

export default function KdsPage() {
  return <KdsWallboard />;
}
