import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";

export const metadata: Metadata = { title: "App" };

export default function AppPage() {
  return <AppShell />;
}
