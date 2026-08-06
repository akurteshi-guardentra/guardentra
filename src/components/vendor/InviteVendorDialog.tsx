import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { VENDOR_CATEGORIES } from '../../lib/vendor/constants';
import { SELECT_CLASS } from './AddVendorDialog';

type InviteVendorDialogProps = {
  inviteError: string;
  inviteSaving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function InviteVendorDialog({
  inviteError,
  inviteSaving,
  onClose,
  onSubmit,
}: InviteVendorDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">Invite Vendor</h3>
          <p className="mt-1 text-xs text-slate-500">
            Adds the vendor to your register and emails them a welcome notice. A security
            assessment can be sent separately once you're ready.
          </p>
        </div>
        {inviteError && <p className="text-sm text-rose-400">{inviteError}</p>}
        <div>
          <label className="text-xs font-medium text-slate-400">Vendor name</label>
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
          <label className="text-xs font-medium text-slate-400">Contact name</label>
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
            required
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
            disabled={inviteSaving}
          >
            {inviteSaving ? 'Sending…' : 'Add & Invite'}
          </Button>
        </div>
      </form>
    </div>
  );
}
