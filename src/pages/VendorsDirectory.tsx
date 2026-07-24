import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import {
  Search,
  Upload,
  Plus,
  Download,
  Filter,
  MoreVertical,
  ShieldAlert,
  CalendarClock,
  AlertTriangle,
  Building2,
  UserPlus,
  Sparkles,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import type { AssessmentStatus, RiskLevel, Vendor } from '../lib/vendor/types';
import { VENDOR_CATEGORIES, RISK_LEVELS } from '../lib/vendor/constants';
import { assessmentStatusClasses, effectiveRiskLevel, riskBandClasses } from '../lib/vendor/risk';
import { validateVendorForm } from '../lib/vendor/validators';
import {
  downloadVendorCsvTemplate,
  findExistingDuplicates,
  parseVendorCsv,
  type ParsedBulkVendor,
} from '../lib/vendor/csvBulk';
import { downloadVendorRegisterReport } from '../lib/vendor/reportExport';
import {
  createLocalVendor,
  isFirestoreUnavailableError,
  listLocalVendors,
} from '../lib/vendor/localVendorStore';
import { useOrgAssessments } from '../lib/vendor/useOrgAssessments';
import { deriveStatusFromAssessments } from '../lib/vendor/localAssessmentStore';

const SELECT_CLASS =
  'h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white [&>option]:bg-slate-950 [&>option]:text-white';

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveAssessmentStatus(
  vendor: Vendor,
  linkedAssessments?: { status?: string; dueAt?: string; dueDate?: string; progressPct?: number; progress?: number }[]
): AssessmentStatus {
  if (linkedAssessments?.length) {
    const fromAsm = deriveStatusFromAssessments(linkedAssessments);
    if (fromAsm) return fromAsm;
  }
  if (vendor.assessmentStatus) return vendor.assessmentStatus;
  if (vendor.lastAssessmentAt) return 'Completed';
  if (vendor.nextReviewAt) {
    const due = new Date(vendor.nextReviewAt).getTime();
    const soon = Date.now() + 14 * 24 * 60 * 60 * 1000;
    if (due < Date.now()) return 'Overdue';
    if (due < soon) return 'Due Soon';
  }
  return 'Not Started';
}

function vendorPayload(
  orgId: string,
  input: {
    name: string;
    category: string;
    criticality: RiskLevel;
    primaryContactName?: string;
    primaryContactEmail?: string;
    ownerName?: string;
  }
) {
  return {
    name: input.name.trim(),
    category: input.category,
    criticality: input.criticality,
    status: 'Active' as const,
    riskScore: 0,
    organizationId: orgId,
    createdAt: new Date().toISOString(),
    primaryContactName: input.primaryContactName?.trim() || undefined,
    primaryContactEmail: input.primaryContactEmail?.trim() || undefined,
    ownerName: input.ownerName || 'Unassigned',
    assessmentStatus: 'Not Started' as const,
  };
}

export function VendorsDirectory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const orgId = profile?.organizationId;
  const { assessments: orgAssessments } = useOrgAssessments(orgId);

  const assessmentsByVendor = useMemo(() => {
    const map = new Map<string, typeof orgAssessments>();
    for (const a of orgAssessments) {
      const list = map.get(a.vendorId) || [];
      list.push(a);
      map.set(a.vendorId, list);
    }
    return map;
  }, [orgAssessments]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataMode, setDataMode] = useState<'firestore' | 'local'>('firestore');
  const dataModeRef = useRef<'firestore' | 'local'>('firestore');
  const [dataError, setDataError] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState<ParsedBulkVendor[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkDupes, setBulkDupes] = useState<string[]>([]);
  const [bulkExisting, setBulkExisting] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const refreshLocal = (id: string) => {
    setVendors(listLocalVendors(id));
    dataModeRef.current = 'local';
    setDataMode('local');
    setLoading(false);
  };

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setDataError('Your profile has no organization yet. Sign out/in or complete onboarding.');
      return;
    }

    setLoading(true);
    setDataError('');
    let settled = false;
    let unsub: (() => void) | null = null;

    const fallBackLocal = (message: string) => {
      if (settled && dataModeRef.current === 'local') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      setDataError(message);
      refreshLocal(orgId);
    };

    // Firestore can hang without calling error when the (default) DB is missing.
    const failSafe = window.setTimeout(() => {
      fallBackLocal(
        'Cloud database timed out — using local browser storage so you can still add, search, filter, and bulk-import vendors.'
      );
    }, 3500);

    const q = query(collection(db, 'vendors'), where('organizationId', '==', orgId));
    unsub = onSnapshot(
      q,
      (snap) => {
        if (settled && dataModeRef.current === 'local') return;
        settled = true;
        window.clearTimeout(failSafe);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor));
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setVendors(rows);
        dataModeRef.current = 'firestore';
        setDataMode('firestore');
        setDataError('');
        setLoading(false);
      },
      (err) => {
        console.error('Vendors listener failed:', err);
        window.clearTimeout(failSafe);
        if (isFirestoreUnavailableError(err)) {
          fallBackLocal(
            'Cloud Firestore is unavailable (database may not exist). Using local browser storage so you can still add, search, filter, and bulk-import vendors.'
          );
        } else {
          fallBackLocal(err.message || 'Failed to load vendors from Firestore. Using local storage.');
        }
      }
    );
    return () => {
      window.clearTimeout(failSafe);
      if (unsub) unsub();
    };
  }, [orgId]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.ownerName?.trim()) set.add(v.ownerName.trim());
    });
    return [...set].sort();
  }, [vendors]);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const hay = `${v.name} ${v.category} ${v.primaryContactName || ''} ${v.primaryContactEmail || ''} ${v.ownerName || ''}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      const level = effectiveRiskLevel(v);
      if (riskFilter !== 'all' && level !== riskFilter) return false;
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && deriveAssessmentStatus(v, assessmentsByVendor.get(v.id)) !== statusFilter) {
        return false;
      }
      if (ownerFilter !== 'all' && (v.ownerName || 'Unassigned') !== ownerFilter) return false;
      return true;
    });
  }, [vendors, search, riskFilter, categoryFilter, statusFilter, ownerFilter, assessmentsByVendor]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, riskFilter, categoryFilter, statusFilter, ownerFilter]);

  const kpis = useMemo(() => {
    const criticalHigh = vendors.filter((v) => {
      const l = effectiveRiskLevel(v);
      return l === 'Critical' || l === 'High';
    }).length;
    const due = vendors.filter((v) => {
      const s = deriveAssessmentStatus(v, assessmentsByVendor.get(v.id));
      return s === 'Due Soon' || s === 'Overdue';
    }).length;
    const needsAttention = vendors.filter((v) => {
      const s = deriveAssessmentStatus(v, assessmentsByVendor.get(v.id));
      return s === 'Overdue' || s === 'Due Soon' || effectiveRiskLevel(v) === 'Critical';
    }).length;
    return { total: vendors.length, criticalHigh, due, needsAttention };
  }, [vendors, assessmentsByVendor]);

  const clearFilters = () => {
    setSearch('');
    setRiskFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setOwnerFilter('all');
  };

  const createVendor = async (input: {
    name: string;
    category: string;
    criticality: RiskLevel;
    primaryContactName?: string;
    primaryContactEmail?: string;
  }) => {
    if (!orgId) throw new Error('No organization on your profile — cannot save vendors.');
    const ownerName = profile?.displayName || profile?.email || 'Unassigned';
    const payload = vendorPayload(orgId, { ...input, ownerName });

    const saveLocal = () => {
      createLocalVendor(orgId, { ...input, ownerName });
      refreshLocal(orgId);
    };

    // Once local mode is active, never block the UI on a hanging Firestore write.
    if (dataModeRef.current === 'local') {
      saveLocal();
      return;
    }

    try {
      const writeTimeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          const err = new Error('Cloud write timed out');
          (err as { code?: string }).code = 'unavailable';
          reject(err);
        }, 4000);
      });
      await Promise.race([addDoc(collection(db, 'vendors'), payload), writeTimeout]);
    } catch (ex) {
      if (isFirestoreUnavailableError(ex)) {
        setDataError(
          'Cloud Firestore write failed. Switched to local browser storage for this session.'
        );
        saveLocal();
        return;
      }
      throw ex;
    }
  };

  const handleAddVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get('name') || ''),
      category: String(fd.get('category') || ''),
      criticality: String(fd.get('criticality') || 'Medium') as RiskLevel,
      primaryContactName: String(fd.get('primaryContactName') || ''),
      primaryContactEmail: String(fd.get('primaryContactEmail') || ''),
    };
    const err = validateVendorForm(input);
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createVendor(input);
      setShowAdd(false);
    } catch (ex: any) {
      setFormError(ex?.message || 'Failed to create vendor.');
    } finally {
      setSaving(false);
    }
  };

  const resetBulkState = () => {
    setBulkRows([]);
    setBulkErrors([]);
    setBulkDupes([]);
    setBulkExisting([]);
    setBulkImporting(false);
    setBulkMessage('');
    setBulkFileName('');
    setBulkSuccess(false);
    setBulkDragOver(false);
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  const openBulkModal = () => {
    resetBulkState();
    setShowBulk(true);
  };

  const closeBulkModal = () => {
    setShowBulk(false);
    resetBulkState();
  };

  const onBulkFile = async (file: File) => {
    const looksCsv =
      /\.csv$/i.test(file.name) ||
      !file.type ||
      /csv|text\/plain|excel|spreadsheetml/i.test(file.type);
    if (!looksCsv) {
      setBulkSuccess(false);
      setBulkFileName(file.name);
      setBulkErrors(['Please upload a .csv file (Excel: File → Save As → CSV UTF-8).']);
      setBulkRows([]);
      setBulkDupes([]);
      setBulkExisting([]);
      setBulkMessage('');
      return;
    }
    const text = await file.text();
    const parsed = parseVendorCsv(text);
    setBulkFileName(file.name);
    setBulkSuccess(false);
    setBulkErrors(parsed.errors);
    setBulkDupes(parsed.duplicatesInFile);
    setBulkRows(parsed.rows);
    setBulkExisting(findExistingDuplicates(parsed.rows, vendors.map((v) => v.name)));
    setBulkMessage(
      parsed.rows.length
        ? ''
        : parsed.errors.length
          ? ''
          : 'No valid rows found in this CSV.'
    );
  };

  const importBulkRows = async (skipExisting: boolean) => {
    if (!orgId) {
      setBulkMessage('No organization on your profile — cannot import.');
      return;
    }
    if (!bulkRows.length || bulkImporting) return;
    setBulkImporting(true);
    setBulkMessage('');
    const existing = new Set(vendors.map((v) => v.name.trim().toLowerCase()));
    let imported = 0;
    let skipped = 0;
    const failures: string[] = [];
    const pending = [...bulkRows];
    try {
      for (const row of pending) {
        const name = row.name!.trim();
        if (skipExisting && existing.has(name.toLowerCase())) {
          skipped += 1;
          continue;
        }
        const critRaw = String(row.criticality || 'Medium');
        const criticality = (
          RISK_LEVELS.find((level) => level.toLowerCase() === critRaw.toLowerCase()) || 'Medium'
        ) as RiskLevel;
        try {
          await createVendor({
            name,
            category: row.category!.trim(),
            criticality,
            primaryContactName: row.primaryContactName?.trim() || '',
            primaryContactEmail: row.primaryContactEmail?.trim() || '',
          });
          existing.add(name.toLowerCase());
          imported += 1;
        } catch (rowErr: any) {
          failures.push(`${name}: ${rowErr?.message || 'failed'}`);
        }
      }
      const failNote = failures.length ? ` ${failures.length} failed.` : '';
      const summary = `Imported ${imported} vendor(s)${skipped ? `, skipped ${skipped} existing` : ''}.${failNote}`;
      setBulkMessage(summary);
      setBulkErrors(failures);
      if (imported > 0 || (skipExisting && skipped > 0 && failures.length === 0)) {
        setBulkSuccess(true);
        setBulkRows([]);
        setBulkDupes([]);
        setBulkExisting([]);
      }
    } catch (ex: any) {
      setBulkMessage(ex?.message || 'Import failed.');
      setBulkSuccess(false);
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {dataError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">
            {dataMode === 'local' ? 'Local vendor mode' : 'Vendors data warning'}
          </p>
          <p className="mt-1 text-amber-100/80">{dataError}</p>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white text-glow">
                Vendors
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Manage, assess, and monitor every third party in one place.
                {dataMode === 'local' && (
                  <span className="ml-2 rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    Local store
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/10 text-slate-300 hover:bg-white/5"
                onClick={openBulkModal}
              >
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </Button>
              <Button
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => {
                  setFormError('');
                  setShowAdd(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Vendors', value: kpis.total, icon: Building2, tone: 'text-white' },
              {
                label: 'Critical / High Risk',
                value: kpis.criticalHigh,
                icon: ShieldAlert,
                tone: 'text-rose-400',
              },
              { label: 'Assessments Due', value: kpis.due, icon: CalendarClock, tone: 'text-orange-400' },
              {
                label: 'Needs Attention',
                value: kpis.needsAttention,
                icon: AlertTriangle,
                tone: 'text-amber-400',
              },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {card.label}
                  </p>
                  <card.icon className={cn('h-4 w-4', card.tone)} />
                </div>
                <p
                  className={cn(
                    'mt-2 font-display text-3xl font-bold text-white text-glow',
                    card.tone
                  )}
                >
                  {loading ? '—' : card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/50">
            <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
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
                className={SELECT_CLASS}
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
                className={SELECT_CLASS}
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
                className={SELECT_CLASS}
                aria-label="Status"
              >
                <option value="all">Status</option>
                {['Not Started', 'In Progress', 'Due Soon', 'Overdue', 'Completed'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'border-white/10 text-slate-300',
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
                className="border-white/10 text-slate-300"
                onClick={() => downloadVendorRegisterReport(filtered)}
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
                  Showing {filtered.length} of {vendors.length}
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Primary Contact</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="px-4 py-3 font-medium">Assessment</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Next Review</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Loading vendors…
                      </td>
                    </tr>
                  )}
                  {!loading && pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        {vendors.length === 0
                          ? 'No vendors yet. Add one or bulk-upload a CSV to start your register.'
                          : 'No vendors match the current filters.'}
                      </td>
                    </tr>
                  )}
                  {pageRows.map((v) => {
                    const level = effectiveRiskLevel(v);
                    const linked = assessmentsByVendor.get(v.id) || [];
                    const aStatus = deriveAssessmentStatus(v, linked);
                    return (
                      <tr key={v.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-slate-300">
                              {v.name.slice(0, 2).toUpperCase()}
                            </div>
                            <button
                              type="button"
                              className="font-medium text-white hover:text-primary"
                              onClick={() => navigate(`/vendors/${v.id}/impact`)}
                            >
                              {v.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{v.category || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {v.primaryContactName || v.primaryContactEmail || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              riskBandClasses(level)
                            )}
                          >
                            {level}
                            {v.riskScore > 0 ? ` ${v.riskScore}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/assessments?vendorId=${encodeURIComponent(v.id)}`}
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium hover:underline',
                              assessmentStatusClasses(aStatus)
                            )}
                            title={
                              linked.length
                                ? `${linked.length} assessment(s) — view tracker`
                                : 'No assessments yet — open tracker'
                            }
                          >
                            {aStatus}
                            {linked.length > 0 ? ` · ${linked.length}` : ''}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{v.ownerName || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(v.nextReviewAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/vendors/${v.id}/impact`}
                            className="mr-2 text-xs font-medium text-slate-300 hover:text-white hover:underline"
                          >
                            Impact
                          </Link>
                          <Link
                            to={`/assessments/new?vendorId=${v.id}`}
                            className="mr-2 text-xs font-medium text-primary hover:underline"
                          >
                            Assess
                          </Link>
                          <button type="button" className="text-slate-400 hover:text-white" aria-label="More">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-sm text-slate-400">
              <span>
                {filtered.length === 0
                  ? '0 vendors'
                  : `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, filtered.length)} of ${filtered.length} vendors`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
            <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setShowAdd(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <Plus className="h-4 w-4 text-primary" />
                Add One Vendor
              </button>
              <button
                type="button"
                onClick={openBulkModal}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <Upload className="h-4 w-4 text-primary" />
                Bulk Upload Vendors
              </button>
              <button
                type="button"
                onClick={() => navigate('/assessments/new')}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <UserPlus className="h-4 w-4 text-primary" />
                Invite Vendor
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
            <h2 className="text-sm font-semibold text-white">Bulk Upload in 3 Steps</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-400">
              <li>
                <span className="font-medium text-slate-200">1.</span> Download Template
              </li>
              <li>
                <span className="font-medium text-slate-200">2.</span> Upload CSV (not .xlsx)
              </li>
              <li>
                <span className="font-medium text-slate-200">3.</span> Review & Import
              </li>
            </ol>
            <Button
              variant="outline"
              className="mt-3 w-full border-white/10 text-white"
              onClick={() => downloadVendorCsvTemplate()}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV template
            </Button>
            <p className="mt-4 flex gap-2 rounded-lg bg-primary/10 p-3 text-xs text-primary">
              <Sparkles className="h-4 w-4 shrink-0" />
              Import flags duplicate names in-file and against your existing register.
            </p>
          </div>

          <Link
            to="/vendors/legacy"
            className="block text-center text-xs text-slate-400 hover:text-slate-300"
          >
            Open classic vendor workspace
          </Link>
        </aside>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleAddVendor}
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
                onClick={() => setShowAdd(false)}
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
      )}

      {showBulk && (
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
      )}
    </div>
  );
}
