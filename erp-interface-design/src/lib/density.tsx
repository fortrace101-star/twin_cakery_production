import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Density } from "@/components/data-table/DataTable";

/**
 * Table-density preference (erp_design.md E2: compact / comfortable / spacious),
 * persisted per user in localStorage under `tc-density`.
 *
 * Falls back to `comfortable` when rendered outside the provider (unit tests,
 * storybook-style harnesses), so consumers never need a null check.
 */
const KEY = "tc-density";
const DEFAULT: Density = "comfortable";

type DensityCtx = { density: Density; setDensity: (d: Density) => void };
const DensityContext = createContext<DensityCtx>({ density: DEFAULT, setDensity: () => {} });

function load(): Density {
  try {
    const v = localStorage.getItem(KEY);
    return v === "compact" || v === "spacious" ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setState] = useState<Density>(load);
  const setDensity = useCallback((d: Density) => {
    setState(d);
    try {
      localStorage.setItem(KEY, d);
    } catch {
      /* private mode — preference is session-only */
    }
  }, []);
  return <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityCtx {
  return useContext(DensityContext);
}
