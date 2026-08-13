import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { VENDOR_CATEGORIES, RISK_LEVELS } from '../../lib/vendor/constants';

export const SELECT_CLASS =
  'h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white [&>option]:bg-slate-950 [&>option]:text-white';

type AddVendorDialogProps = {
  formError: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function AddVendorDialog({ formError, saving, onClose, onSubmit }: AddVendorDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-white">Add Vendor</h3>
        {formError && <p className="text-sm text-rose-400">{formError}</p>}
        <div>
          <label className="text-xs font-medium text-slate-400">Name</label>
          <Input name="name" className="mt-1 border-white/10 bg-black/20 text-white" required />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400">Category</label>
          <select name="category" className={cn(SELECT_CLASS, 'mt-1 w-full')} required>
            {VENDOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400">Criticality</label>
          <select
            name="criticality"
            className={cn(SELECT_CLASS, 'mt-1 w-full')}
            defaultValue="Medium"
          >
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400">Primary contact</label>
          <Input
            name="primaryContactName"
            className="mt-1 border-white/10 bg-black/20 text-white"
            placeholder="Name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400">Contact email</label>
          <Input
            name="primaryContactEmail"
            type="email"
            className="mt-1 border-white/10 bg-black/20 text-white"
            placeholder="email@vendor.com"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-primary text-white hover:bg-primary/90"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
