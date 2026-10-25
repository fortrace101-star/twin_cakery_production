import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Density } from "@/components/data-table/DataTable";

/**
 * Table-density preference (erp_design.md E2: compact / comfortable / spacious).
 *
 * Session-only (no browser storage): all data lives in Postgres.
 *
 * Falls back to `comfortable` when rendered outside the provider (unit tests,
 * storybook-style harnesses), so consumers never need a null check.
 */
const DEFAULT: Density = "comfortable";

type DensityCtx = { density: Density; setDensity: (d: Density) => void };
const DensityContext = createContext<DensityCtx>({ density: DEFAULT, setDensity: () => {} });

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setState] = useState<Density>(DEFAULT);
  const setDensity = useCallback((d: Density) => {
    setState(d);
  }, []);
  return <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityCtx {
  return useContext(DensityContext);
}
