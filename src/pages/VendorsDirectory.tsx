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

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveAssessmentStatus(vendor: Vendor): AssessmentStatus {
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

export function VendorsDirectory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const orgId = profile?.organizationId;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState<ParsedBulkVendor[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkDupes, setBulkDupes] = useState<string[]>([]);
  const [bulkExisting, setBulkExisting] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'vendors'),
      where('organizationId', '==', orgId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor));
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setVendors(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [orgId]);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const hay = `${v.name} ${v.category} ${v.primaryContactName || ''}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return false;
      const level = effectiveRiskLevel(v);
      if (riskFilter !== 'all' && level !== riskFilter) return false;
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && deriveAssessmentStatus(v) !== statusFilter) return false;
      return true;
    });
  }, [vendors, search, riskFilter, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, riskFilter, categoryFilter, statusFilter]);

  const kpis = useMemo(() => {
    const criticalHigh = vendors.filter((v) => {
      const l = effectiveRiskLevel(v);
      return l === 'Critical' || l === 'High';
    }).length;
    const due = vendors.filter((v) => {
      const s = deriveAssessmentStatus(v);
      return s === 'Due Soon' || s === 'Overdue';
    }).length;
    const needsAttention = vendors.filter((v) => {
      const s = deriveAssessmentStatus(v);
      return s === 'Overdue' || s === 'Due Soon' || effectiveRiskLevel(v) === 'Critical';
    }).length;
    return {
      total: vendors.length,
      criticalHigh,
      due,
      needsAttention,
    };
  }, [vendors]);

  const handleAddVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orgId) return;
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
      await addDoc(collection(db, 'vendors'), {
        name: input.name.trim(),
        category: input.category,
        criticality: input.criticality,
        status: 'Active',
        riskScore: 0,
        organizationId: orgId,
        createdAt: new Date().toISOString(),
        primaryContactName: input.primaryContactName.trim() || undefined,
        primaryContactEmail: input.primaryContactEmail.trim() || undefined,
        ownerName: profile?.displayName || profile?.email || 'Unassigned',
        assessmentStatus: 'Not Started',
      });
      setShowAdd(false);
    } catch (ex: any) {
      setFormError(ex?.message || 'Failed to create vendor.');
    } finally {
      setSaving(false);
    }
  };

  const onBulkFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseVendorCsv(text);
    setBulkErrors(parsed.errors);
    setBulkDupes(parsed.duplicatesInFile);
    setBulkRows(parsed.rows);
    setBulkExisting(findExistingDuplicates(parsed.rows, vendors.map((v) => v.name)));
    setBulkMessage('');
  };

  const importBulkRows = async (skipExisting: boolean) => {
    if (!orgId || !bulkRows.length) return;
    setBulkImporting(true);
    setBulkMessage('');
    const existing = new Set(vendors.map((v) => v.name.trim().toLowerCase()));
    let imported = 0;
    let skipped = 0;
    try {
      for (const row of bulkRows) {
        const name = row.name!.trim();
        if (skipExisting && existing.has(name.toLowerCase())) {
          skipped += 1;
          continue;
        }
        const criticality = (['Critical', 'High', 'Medium', 'Low'].includes(String(row.criticality))
          ? row.criticality
          : 'Medium') as RiskLevel;
        await addDoc(collection(db, 'vendors'), {
          name,
          category: row.category!.trim(),
          criticality,
          status: 'Active',
          riskScore: 0,
          organizationId: orgId,
          createdAt: new Date().toISOString(),
          primaryContactName: row.primaryContactName?.trim() || undefined,
          primaryContactEmail: row.primaryContactEmail?.trim() || undefined,
          ownerName: profile?.displayName || profile?.email || 'Unassigned',
          assessmentStatus: 'Not Started',
        });
        existing.add(name.toLowerCase());
        imported += 1;
      }
      setBulkMessage(`Imported ${imported} vendor(s)${skipped ? `, skipped ${skipped} existing` : ''}.`);
      if (imported > 0) {
        setBulkRows([]);
        setBulkDupes([]);
        setBulkExisting([]);
      }
    } catch (ex: any) {
      setBulkMessage(ex?.message || 'Import failed.');
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 -m-6 p-6 lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vendors</h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage, assess, and monitor every third party in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="bg-white border-slate-200 text-slate-700"
                onClick={() => setShowBulk(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Vendors', value: kpis.total, icon: Building2, tone: 'text-slate-700' },
              { label: 'Critical / High Risk', value: kpis.criticalHigh, icon: ShieldAlert, tone: 'text-rose-600' },
              { label: 'Assessments Due', value: kpis.due, icon: CalendarClock, tone: 'text-orange-600' },
              { label: 'Needs Attention', value: kpis.needsAttention, icon: AlertTriangle, tone: 'text-amber-600' },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
                  <card.icon className={cn('h-4 w-4', card.tone)} />
                </div>
                <p className={cn('mt-2 text-2xl font-semibold', card.tone)}>{loading ? '—' : card.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendors..."
                  className="pl-9 bg-white border-slate-200"
                />
              </div>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">Risk Level</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">Category</option>
                {VENDOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">Status</option>
                {['Not Started', 'In Progress', 'Due Soon', 'Overdue', 'Completed'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Button variant="outline" className="border-slate-200 text-slate-600" disabled>
                <Filter className="mr-2 h-4 w-4" />
                More Filters
              </Button>
              <Button variant="outline" className="border-slate-200 text-slate-600" disabled>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading vendors…</td>
                    </tr>
                  )}
                  {!loading && pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        No vendors yet. Add one to start your third-party register.
                      </td>
                    </tr>
                  )}
                  {pageRows.map((v) => {
                    const level = effectiveRiskLevel(v);
                    const aStatus = deriveAssessmentStatus(v);
                    return (
                      <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                              {v.name.slice(0, 2).toUpperCase()}
                            </div>
                            <button
                              type="button"
                              className="font-medium text-slate-900 hover:text-blue-600"
                              onClick={() => navigate(`/vendors/legacy?focus=${v.id}`)}
                            >
                              {v.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{v.category || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{v.primaryContactName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', riskBandClasses(level))}>
                            {level}
                            {v.riskScore > 0 ? ` ${v.riskScore}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', assessmentStatusClasses(aStatus))}>
                            {aStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{v.ownerName || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(v.nextReviewAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/assessments/new?vendorId=${v.id}`}
                            className="mr-2 text-xs font-medium text-blue-600 hover:underline"
                          >
                            Assess
                          </Link>
                          <button type="button" className="text-slate-400 hover:text-slate-700" aria-label="More">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
              <span>
                {filtered.length === 0
                  ? '0 vendors'
                  : `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, filtered.length)} of ${filtered.length} vendors`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200"
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                Add One Vendor
              </button>
              <button
                type="button"
                onClick={() => setShowBulk(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <Upload className="h-4 w-4 text-blue-600" />
                Bulk Upload Vendors
              </button>
              <button
                type="button"
                onClick={() => navigate('/assessments/new')}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <UserPlus className="h-4 w-4 text-blue-600" />
                Invite Vendor
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Bulk Upload in 3 Steps</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li><span className="font-medium text-slate-800">1.</span> Download Template</li>
              <li><span className="font-medium text-slate-800">2.</span> Upload Excel/CSV</li>
              <li><span className="font-medium text-slate-800">3.</span> Review & Import</li>
            </ol>
            <Button
              variant="outline"
              className="mt-3 w-full border-slate-200 text-slate-700"
              onClick={() => downloadVendorCsvTemplate()}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV template
            </Button>
            <p className="mt-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <Sparkles className="h-4 w-4 shrink-0" />
              Import flags duplicate names in-file and against your existing register.
            </p>
          </div>

          <Link to="/vendors/legacy" className="block text-center text-xs text-slate-400 hover:text-slate-600">
            Open classic vendor workspace
          </Link>
        </aside>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleAddVendor}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold">Add Vendor</h3>
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <div>
              <label className="text-xs font-medium text-slate-600">Name</label>
              <Input name="name" className="mt-1 border-slate-200" required />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Category</label>
              <select name="category" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" required>
                {VENDOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Criticality</label>
              <select name="criticality" className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-sm" defaultValue="Medium">
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Primary contact</label>
              <Input name="primaryContactName" className="mt-1 border-slate-200" placeholder="Name" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Contact email</label>
              <Input name="primaryContactEmail" type="email" className="mt-1 border-slate-200" placeholder="email@vendor.com" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Bulk upload vendors</h3>
            <p className="text-sm text-slate-500">CSV with columns: name, category, criticality, primaryContactName, primaryContactEmail</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => downloadVendorCsvTemplate()}>
                <Download className="mr-2 h-4 w-4" /> Template
              </Button>
              <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => bulkFileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Choose CSV
              </Button>
              <input
                ref={bulkFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onBulkFile(f);
                  e.target.value = '';
                }}
              />
            </div>
            {bulkErrors.length > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {bulkErrors.map((e) => <div key={e}>{e}</div>)}
              </div>
            )}
            {(bulkDupes.length > 0 || bulkExisting.length > 0) && (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                {bulkDupes.length > 0 && <p>Duplicates in file: {bulkDupes.join(', ')}</p>}
                {bulkExisting.length > 0 && <p>Already in register: {bulkExisting.join(', ')}</p>}
              </div>
            )}
            {bulkRows.length > 0 && (
              <p className="text-sm text-slate-600">{bulkRows.length} valid row(s) ready to import.</p>
            )}
            {bulkMessage && <p className="text-sm text-slate-700">{bulkMessage}</p>}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="border-slate-200" onClick={() => setShowBulk(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-200"
                disabled={!bulkRows.length || bulkImporting}
                onClick={() => void importBulkRows(true)}
              >
                Import (skip existing)
              </Button>
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!bulkRows.length || bulkImporting}
                onClick={() => void importBulkRows(false)}
              >
                {bulkImporting ? 'Importing…' : 'Import all valid'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
