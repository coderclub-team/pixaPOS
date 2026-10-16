import type { Metadata } from "next";
import { cookies } from "next/headers";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@pixa/ui/base-ui/sonner";
import { fontVariables } from "@pixa/ui/themes/font.config";
import { DEFAULT_THEME, THEMES } from "@pixa/ui/themes/theme.config";
import ThemeProvider from "@pixa/ui/themes/theme-provider";
import { cn } from "@pixa/ui/lib/utils";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "pixaPOS Admin — SaaS Console",
    template: "%s | pixaPOS Admin",
  },
  description:
    "Organisation lifecycle, registrations, billing and audit for the pixaPOS owner team.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get("active_theme")?.value;
  const isValidTheme = THEMES.some((t) => t.value === activeThemeValue);
  const themeToApply = isValidTheme ? activeThemeValue! : DEFAULT_THEME;

  return (
    <html lang="en" suppressHydrationWarning data-theme={themeToApply}>
      <body
        className={cn(
          "bg-background overflow-x-hidden overscroll-none font-sans antialiased",
          fontVariables,
        )}
      >
        <NextTopLoader color="var(--primary)" showSpinner={false} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
