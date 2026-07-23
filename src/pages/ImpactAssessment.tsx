import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Paperclip, Trash2, Upload } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { RISK_LEVELS } from '../lib/vendor/constants';
import type { RiskLevel, Vendor } from '../lib/vendor/types';
import { riskBandClasses } from '../lib/vendor/risk';
import { combineImpactAndSecurity, securityLevelFromScore, vendorRatingLabel } from '../lib/vendor/vendorRating';
import { uploadVendorAttachment, type UploadedEvidence } from '../lib/vendor/evidenceUpload';

const IMPACT_PROMPTS: { id: string; label: string; hint: string }[] = [
  {
    id: 'data',
    label: 'What data does this vendor access?',
    hint: 'None / non-sensitive → Low; confidential → High; regulated PII/PHI → Critical',
  },
  {
    id: 'ops',
    label: 'How critical is this vendor to operations?',
    hint: 'Nice-to-have → Low; core workflow → High; business stop if down → Critical',
  },
  {
    id: 'replace',
    label: 'How hard is it to replace this vendor?',
    hint: 'Easy swap → Low; multi-month migration → High',
  },
];

export function ImpactAssessment() {
  const { vendorId = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [impactLevel, setImpactLevel] = useState<RiskLevel>('Medium');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<UploadedEvidence[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vendorId) return;
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'vendors', vendorId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError('Vendor not found.');
          setVendor(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as Vendor;
        setVendor(data);
        if (data.impactLevel) setImpactLevel(data.impactLevel);
        if (data.impactNotes) setNotes(data.impactNotes);
        if (data.attachments?.length) {
          setAttachments(
            data.attachments.map((a) => ({
              fileName: a.fileName,
              contentType: a.contentType,
              sizeBytes: a.sizeBytes,
              storagePath: a.storagePath,
              downloadUrl: a.downloadUrl || '',
              uploadedAt: a.uploadedAt,
            }))
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load vendor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const preview = useMemo(() => {
    const security = securityLevelFromScore(vendor?.riskScore);
    return vendorRatingLabel(impactLevel, vendor?.riskScore);
  }, [impactLevel, vendor?.riskScore]);

  const save = async () => {
    if (!vendor || !profile) return;
    if (profile.organizationId && vendor.organizationId !== profile.organizationId) {
      setError('You do not have access to this vendor.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const security = securityLevelFromScore(vendor.riskScore);
      const finalRating = combineImpactAndSecurity(impactLevel, security) || undefined;
      await updateDoc(doc(db, 'vendors', vendor.id), {
        impactLevel,
        impactNotes: notes.trim() || null,
        impactCompletedAt: new Date().toISOString(),
        impactCompletedBy: profile.displayName || profile.email || profile.uid,
        finalRating: finalRating || null,
        criticality: impactLevel,
        attachments: attachments.map((a) => ({
          fileName: a.fileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          storagePath: a.storagePath,
          downloadUrl: a.downloadUrl,
          uploadedAt: a.uploadedAt,
          uploadedBy: profile.displayName || profile.email || profile.uid,
        })),
      });
      navigate('/vendors');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save impact assessment.');
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (fileList: FileList | null) => {
    if (!fileList?.length || !vendor || !profile?.organizationId) return;
    setUploading(true);
    setError('');
    try {
      const uploaded: UploadedEvidence[] = [];
      for (const file of Array.from(fileList)) {
        uploaded.push(
          await uploadVendorAttachment({
            orgId: profile.organizationId,
            vendorId: vendor.id,
            file,
          })
        );
      }
      const next = [...attachments, ...uploaded];
      setAttachments(next);
      await updateDoc(doc(db, 'vendors', vendor.id), {
        attachments: next.map((a) => ({
          fileName: a.fileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          storagePath: a.storagePath,
          downloadUrl: a.downloadUrl,
          uploadedAt: a.uploadedAt,
          uploadedBy: profile.displayName || profile.email || profile.uid,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAttachment = async (storagePath: string) => {
    if (!vendor || !profile) return;
    const next = attachments.filter((a) => a.storagePath !== storagePath);
    setAttachments(next);
    await updateDoc(doc(db, 'vendors', vendor.id), { attachments: next });
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Loading vendor…</div>;
  }

  if (!vendor) {
    return (
      <div className="space-y-4 p-8">
        <p className="text-rose-400">{error || 'Vendor not found.'}</p>
        <Link to="/vendors" className="text-primary hover:underline">Back to vendors</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 md:p-8">
      <div>
        <Link to="/vendors" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Vendors
        </Link>
        <h1 className="text-2xl font-semibold text-white">Impact Assessment</h1>
        <p className="mt-1 text-slate-400">
          Business impact for <span className="text-white">{vendor.name}</span>. Combined with the security
          questionnaire to produce a final vendor rating.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Guidance</h2>
        <ul className="mt-3 space-y-3">
          {IMPACT_PROMPTS.map((p) => (
            <li key={p.id} className="text-sm">
              <div className="font-medium text-slate-200">{p.label}</div>
              <div className="text-slate-500">{p.hint}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">Impact level</label>
        <div className="flex flex-wrap gap-2">
          {RISK_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setImpactLevel(level)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                impactLevel === level
                  ? riskBandClasses(level)
                  : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20'
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="impact-notes" className="text-sm font-medium text-slate-300">Notes</label>
        <textarea
          id="impact-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Rationale for this impact band…"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
      </div>

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-sky-100/90">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <div>
            <div className="font-medium text-sky-200">Final assessment</div>
            <p className="mt-1 text-sky-100/70">{preview.message}</p>
            {preview.rating && (
              <span className={cn('mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', riskBandClasses(preview.rating))}>
                {preview.rating}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Paperclip className="h-4 w-4 text-slate-400" />
              General attachments
            </h2>
            <p className="text-xs text-slate-500">Vendor-level files (SOC reports, contracts). Max 20MB each.</p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => void onUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500">No attachments yet.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((f) => (
              <li
                key={f.storagePath}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
              >
                <a
                  href={f.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-slate-200 hover:text-primary"
                >
                  {f.fileName}
                </a>
                <button
                  type="button"
                  className="text-slate-500 hover:text-rose-400"
                  aria-label={`Remove ${f.fileName}`}
                  onClick={() => void removeAttachment(f.storagePath)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save impact assessment'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/10"
          onClick={() => navigate(`/assessments/new?vendorId=${vendor.id}`)}
        >
          Continue to security assessment
        </Button>
      </div>
    </div>
  );
}
