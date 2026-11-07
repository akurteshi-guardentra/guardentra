import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  effectiveEvidenceState,
  evidenceStateLabel,
  isTrustedState,
  type EvidenceItem,
  type EvidenceTrustMap,
} from '../../lib/vendor/evidenceTrust';
import { fetchOrgEvidenceDownloadUrl } from '../../lib/vendor/evidenceUpload';
import { cn } from '../../lib/utils';

/**
 * Vendor evidence files for one question, as the reviewer sees them (#124
 * follow-up). The review panel listed answers but never the uploaded files, so a
 * reviewer could not see that a file had been quarantined or open a clean one.
 * The state comes from the backend trust map only. Download is offered only for
 * authoritative clean files; the server (/api/org/evidence-download) still
 * enforces tenant, path, clean state and generation on every request.
 */
export function ReviewEvidenceList({
  assessmentId,
  items,
  trustMap,
  allowDownload,
}: {
  assessmentId: string;
  items: unknown[] | undefined;
  trustMap?: EvidenceTrustMap | null;
  allowDownload: boolean;
}) {
  const [error, setError] = useState('');
  const files = (Array.isArray(items) ? items : []).filter(
    (f): f is EvidenceItem => Boolean(f) && typeof f === 'object'
  );
  if (!files.length) return null;
  return (
    <div className="mt-2 space-y-1" data-testid="review-evidence-list">
      {files.map((f, i) => {
        const state = effectiveEvidenceState(f, trustMap);
        const clean = isTrustedState(state);
        const blocked = state === 'quarantined' || state === 'scan_failed';
        return (
          <div
            key={f.storagePath || `${f.fileName}-${i}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{f.fileName || 'Unnamed file'}</span>
              <span
                className={cn(
                  'shrink-0 text-[10px] uppercase tracking-wide',
                  clean ? 'text-emerald-400' : blocked ? 'text-rose-400' : 'text-slate-500'
                )}
              >
                {evidenceStateLabel(state)}
              </span>
            </span>
            {allowDownload && clean && f.storagePath && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                onClick={() => {
                  setError('');
                  void fetchOrgEvidenceDownloadUrl({ assessmentId, storagePath: f.storagePath! })
                    .then((url) => window.open(url, '_blank', 'noopener,noreferrer'))
                    .catch((err: Error) => setError(err.message || 'Evidence download was not authorized.'));
                }}
              >
                <Download className="h-3 w-3" />
                Open
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
