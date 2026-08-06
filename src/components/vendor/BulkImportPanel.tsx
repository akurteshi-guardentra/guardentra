import React from 'react';
import { Download, Upload, X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { ParsedBulkVendor } from '../../lib/vendor/csvBulk';

type BulkImportPanelProps = {
  bulkFileRef: React.RefObject<HTMLInputElement | null>;
  bulkFileName: string;
  bulkRows: ParsedBulkVendor[];
  bulkErrors: string[];
  bulkDupes: string[];
  bulkExisting: string[];
  bulkMessage: string;
  bulkSuccess: boolean;
  bulkImporting: boolean;
  bulkDragOver: boolean;
  setBulkDragOver: (value: boolean) => void;
  onBulkFile: (file: File) => void | Promise<void>;
  importBulkRows: (skipExisting: boolean) => void | Promise<void>;
  resetBulkState: () => void;
  closeBulkModal: () => void;
  downloadVendorCsvTemplate: () => void;
};

export function BulkImportPanel({
  bulkFileRef,
  bulkFileName,
  bulkRows,
  bulkErrors,
  bulkDupes,
  bulkExisting,
  bulkMessage,
  bulkSuccess,
  bulkImporting,
  bulkDragOver,
  setBulkDragOver,
  onBulkFile,
  importBulkRows,
  resetBulkState,
  closeBulkModal,
  downloadVendorCsvTemplate,
}: BulkImportPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !bulkImporting) closeBulkModal();
      }}
    >
      <div className="w-full max-w-xl space-y-4 rounded-xl border border-white/10 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Bulk upload vendors</h3>
            <p className="mt-1 text-sm text-slate-400">
              1) Download template → 2) Fill &amp; save as CSV → 3) Choose file → 4) Import
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close bulk upload"
            disabled={bulkImporting}
            onClick={closeBulkModal}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            disabled={bulkImporting}
            onClick={() => downloadVendorCsvTemplate()}
          >
            <Download className="mr-2 h-4 w-4" /> Download template
          </Button>
          <Button
            type="button"
            className="bg-primary text-white hover:bg-primary/90"
            disabled={bulkImporting}
            onClick={() => bulkFileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Choose CSV
          </Button>
          <input
            ref={bulkFileRef}
            type="file"
            accept=".csv,text/csv,text/plain,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onBulkFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <div
          className={cn(
            'rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
            bulkDragOver ? 'border-primary bg-primary/10' : 'border-white/15 bg-white/[0.02]',
            bulkImporting && 'pointer-events-none opacity-60'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setBulkDragOver(true);
          }}
          onDragLeave={() => setBulkDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setBulkDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void onBulkFile(f);
          }}
        >
          <p className="text-sm text-slate-300">
            {bulkFileName ? (
              <>
                Selected: <span className="font-medium text-white">{bulkFileName}</span>
              </>
            ) : (
              'Drop a .csv file here, or use Choose CSV'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Columns: name, category, criticality, primaryContactName, primaryContactEmail
          </p>
        </div>

        {bulkErrors.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">
            {bulkErrors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        {(bulkDupes.length > 0 || bulkExisting.length > 0) && !bulkSuccess && (
          <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">
            {bulkDupes.length > 0 && <p>Duplicates in file: {bulkDupes.join(', ')}</p>}
            {bulkExisting.length > 0 && (
              <p>
                Already in register: {bulkExisting.join(', ')} — use{' '}
                <span className="font-medium">Import (skip existing)</span> to keep them out.
              </p>
            )}
          </div>
        )}

        {bulkRows.length > 0 && !bulkSuccess && (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              {bulkRows.length} valid row(s) ready to import
              {bulkErrors.length ? ` · ${bulkErrors.length} row(s) skipped with errors` : ''}.
            </p>
            <div className="max-h-36 overflow-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.slice(0, 8).map((row, idx) => (
                    <tr key={`${row.name}-${idx}`} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-white">{row.name}</td>
                      <td className="px-3 py-1.5">{row.category}</td>
                      <td className="px-3 py-1.5">{row.criticality || 'Medium'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bulkRows.length > 8 && (
                <p className="border-t border-white/5 px-3 py-1.5 text-[11px] text-slate-500">
                  +{bulkRows.length - 8} more row(s)
                </p>
              )}
            </div>
          </div>
        )}

        {bulkMessage && (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              bulkSuccess
                ? 'bg-emerald-500/10 text-emerald-200'
                : 'bg-white/5 text-slate-200'
            )}
          >
            {bulkMessage}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {bulkSuccess ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                onClick={() => {
                  resetBulkState();
                  bulkFileRef.current?.click();
                }}
              >
                Upload another
              </Button>
              <Button
                type="button"
                className="bg-primary text-white hover:bg-primary/90"
                onClick={closeBulkModal}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                disabled={bulkImporting}
                onClick={closeBulkModal}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                disabled={!bulkRows.length || bulkImporting}
                title={
                  !bulkRows.length
                    ? 'Choose a CSV with at least one valid row first'
                    : 'Import new vendors only; skip names already in the register'
                }
                onClick={() => void importBulkRows(true)}
              >
                {bulkImporting ? 'Importing…' : 'Import (skip existing)'}
              </Button>
              <Button
                type="button"
                className="bg-primary text-white hover:bg-primary/90"
                disabled={!bulkRows.length || bulkImporting}
                title={
                  !bulkRows.length
                    ? 'Choose a CSV with at least one valid row first'
                    : 'Import every valid row (may create duplicate names)'
                }
                onClick={() => void importBulkRows(false)}
              >
                {bulkImporting ? 'Importing…' : 'Import all valid'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
