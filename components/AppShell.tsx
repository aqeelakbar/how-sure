"use client";

import type { ReactNode } from "react";
import { AboutHowSure } from "@/components/AboutHowSure";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AboutHowSure />
    </>
  );
}
