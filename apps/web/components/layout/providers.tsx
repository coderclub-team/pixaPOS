"use client";
import React from "react";
import { ActiveThemeProvider } from "../themes/active-theme";
import QueryProvider from "./query-provider";
import LocalMirrorBootstrap from "./local-mirror-bootstrap";
import PairDeviceBootstrap from "../device-pair-bootstrap";

export default function Providers({
  activeThemeValue,
  children,
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <QueryProvider>
          <LocalMirrorBootstrap />
          <PairDeviceBootstrap />
          {children}
        </QueryProvider>
      </ActiveThemeProvider>
    </>
  );
}
