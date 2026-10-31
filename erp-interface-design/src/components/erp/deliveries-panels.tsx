import type { Dispatch, SetStateAction } from "react";

/**
 * Filter type definitions for delivery module
 * Defines the structure for status filters and search functionality
 */

export type StatusFilter = "awaiting_pickup" | "in_transit" | "delivered" | "all";

export interface FilterConfig {
  id: StatusFilter;
  label: string;
  icon: string;
  count?: number;
  color?: string;
}

export interface FilterState {
  status: StatusFilter;
  searchQuery: string;
  isLoading: boolean;
}

export interface FilterProps {
  config: FilterConfig[];
  activeFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts: Record<StatusFilter, number>;
}

/**
 * Status filter tab component
 */
export function StatusFilterTab({
  config,
  active,
  onClick,
}: {
  config: FilterConfig;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
      {config.count !== undefined && (
        <span className={`text-xs px-2 py-1 rounded-full ${
          active ? "bg-white/20' : 'bg-gray-200' 
        }`}>
          {config.count}
        </span>
      )}
    </button>
  );
}

/**
 * Search input component
 */
export function SearchInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pl-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        🔍
      </span>
    </div>
  );
}

/**
 * Filter state hook
 */
export function useFilterState(initialFilters: FilterConfig[] = []) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetFilters = () => {
    setStatus("all");
    setSearchQuery("");
  };

  const filteredStatuses = (deliveries: any[]) => {
    switch (status) {
      case "awaiting_pickup":
        return deliveries.filter(d => 
          d.status === "PENDING" || d.status === "READY_FOR_DISPATCH"
        );
      case "in_transit":
        return deliveries.filter(d => d.status === "IN_TRANSIT");
      case "delivered":
        return deliveries.filter(d => d.status === "COMPLETED_DELIVERED");
      default:
        return deliveries;
    }
  };

  return {
    status,
    setStatus,
    searchQuery,
    setSearchQuery,
    isLoading,
    setIsLoading,
    resetFilters,
    filteredStatuses,
  };
}

/**
 * Filter bar component
 */
export function DeliveryFilterBar({
  config,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  counts,
}: FilterProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {config.map((filter) => (
          <StatusFilterTab
            key={filter.id}
            config={filter}
            active={activeFilter === filter.id}
            onClick={() => onFilterChange(filter.id)}
          />
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search deliveries..."
          className="w-full px-4 py-2 pl-10 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </span>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>Showing {counts[activeFilter] || 0} orders</p>
        <span>Filtered by: {config.find(c => c.id === activeFilter)?.label || "All"}</span>
      </div>
    </div>
  );
}