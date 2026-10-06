import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "pixaPOS Admin — SaaS Console",
  description:
    "Organisation lifecycle, registrations, billing and audit for the pixaPOS owner team.",
};

/** Ungated shell: /admin/login lives here, outside the owner-gated console group. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
