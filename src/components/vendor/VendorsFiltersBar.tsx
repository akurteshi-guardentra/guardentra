import { Search, Download, Filter, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { VENDOR_CATEGORIES, RISK_LEVELS } from '../../lib/vendor/constants';
import { SELECT_CLASS } from './AddVendorDialog';

type VendorsFiltersBarProps = {
  search: string;
  setSearch: (value: string) => void;
  riskFilter: string;
  setRiskFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  ownerFilter: string;
  setOwnerFilter: (value: string) => void;
  showMoreFilters: boolean;
  setShowMoreFilters: (value: boolean | ((prev: boolean) => boolean)) => void;
  owners: string[];
  filteredCount: number;
  totalCount: number;
  clearFilters: () => void;
  onExport: () => void;
};

export function VendorsFiltersBar({
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  ownerFilter,
  setOwnerFilter,
  showMoreFilters,
  setShowMoreFilters,
  owners,
  filteredCount,
  totalCount,
  clearFilters,
  onExport,
}: VendorsFiltersBarProps) {
  return (
    <>
      {/* lg:flex-wrap + shrink-0 on the controls: without them these six items
          shared one non-wrapping row, and between ~1024-1280px the selects were
          squeezed below the width of their own longest option ("Payment
          Processing", "Not Started"), so the labels ran into the neighbouring
          control. Wrapping matches the More Filters row directly below. */}
      <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative flex-1 lg:min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="border-white/10 bg-black/20 pl-9 text-white"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className={cn(SELECT_CLASS, 'shrink-0')}
          aria-label="Risk Level"
        >
          <option value="all">Risk Level</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={cn(SELECT_CLASS, 'shrink-0')}
          aria-label="Category"
        >
          <option value="all">Category</option>
          {VENDOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={cn(SELECT_CLASS, 'shrink-0')}
          aria-label="Status"
        >
          <option value="all">Status</option>
          {['Not Started', 'Sent', 'In Progress', 'Under Review', 'Due Soon', 'Overdue', 'Completed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'shrink-0 border-white/10 text-slate-300',
            showMoreFilters && 'border-primary/40 bg-primary/10 text-primary'
          )}
          onClick={() => setShowMoreFilters((v) => !v)}
        >
          <Filter className="mr-2 h-4 w-4" />
          More Filters
        </Button>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-white/10 text-slate-300"
          onClick={onExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {showMoreFilters && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className={SELECT_CLASS}
            aria-label="Owner"
          >
            <option value="all">Owner</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10"
            onClick={clearFilters}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
          <span className="text-xs text-slate-500">
            Showing {filteredCount} of {totalCount}
          </span>
        </div>
      )}
    </>
  );
}
