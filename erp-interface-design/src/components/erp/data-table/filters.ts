/** Payment table filter state (Payments_Table_Filters_Layout.md Phase 1 + 2). */
import { useCallback, useState } from "react";

export type DateRange = "allTime" | "today" | "thisWeek" | "thisMonth";

export interface PaymentFilterState {
  search: string;
  method: string;
  range: DateRange;
  from: string | null;
  to: string | null;
}

export function usePaymentFilters(): [PaymentFilterState, (next: Partial<PaymentFilterState>) => void] {
  const [state, setState] = useState<PaymentFilterState>({
    search: "",
    method: "All methods",
    range: "thisMonth",
    from: null,
    to: null,
  });

  const setFilters = useCallback(
    (next: Partial<PaymentFilterState>) => {
      setState((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const clear = useCallback(() => {
    setFilters({ search: "", method: "All methods", range: "thisMonth", from: null, to: null });
  }, [setFilters]);

  return [state, setFilters];
}
