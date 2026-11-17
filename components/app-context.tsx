"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import type { Bootstrap } from "@/lib/types";
export type ComposerScope = {
  organization_id?: string;
  community_id?: string;
  bridge_id?: string;
  audience?: string;
};
type AppContextValue = {
  data: Bootstrap;
  selectedOrg: string;
  setSelectedOrg: (id: string) => void;
  refresh: () => Promise<void>;
  openComposer: (scope?: ComposerScope) => void;
  socket: Socket | null;
  connected: boolean;
};
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp requires AppShell");
  return value;
}
