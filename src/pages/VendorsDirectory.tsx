import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  doc,
  runTransaction,
} from 'firebase/firestore';
import {
  Upload,
  Plus,
  Download,
  Building2,
  UserPlus,
  Sparkles,
  ShieldAlert,
  CalendarClock,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { PageBand } from '../components/spine/PageShell';
import { VendorsPageHeader, VendorsStatsGrid } from '../components/vendor/VendorsPageHeader';
import { VendorsFiltersBar } from '../components/vendor/VendorsFiltersBar';
import { VendorTable } from '../components/vendor/VendorTable';
import { deriveAssessmentStatus } from '../components/vendor/vendorsHelpers';

const AddVendorDialog = lazy(() =>
  import('../components/vendor/AddVendorDialog').then((m) => ({ default: m.AddVendorDialog }))
);
const InviteVendorDialog = lazy(() =>
  import('../components/vendor/InviteVendorDialog').then((m) => ({ default: m.InviteVendorDialog }))
);
const BulkImportPanel = lazy(() =>
  import('../components/vendor/BulkImportPanel').then((m) => ({ default: m.BulkImportPanel }))
);
import type { RiskLevel, Vendor } from '../lib/vendor/types';
import { RISK_LEVELS } from '../lib/vendor/constants';
import { effectiveRiskLevel } from '../lib/vendor/risk';
import { validateVendorForm } from '../lib/vendor/validators';
import {
  downloadVendorCsvTemplate,
  findExistingDuplicates,
  parseVendorCsv,
  type ParsedBulkVendor,
} from '../lib/vendor/csvBulk';
import { downloadVendorRegisterReport } from '../lib/vendor/reportExport';
import { sendEmailBestEffort } from '../lib/notifications';
import {
  createLocalVendor,
  isFirestoreUnavailableError,
  listLocalVendors,
} from '../lib/vendor/localVendorStore';
import { useOrgAssessments } from '../lib/vendor/useOrgAssessments';

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
  const [showInvite, setShowInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);
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
  const [menuVendorId, setMenuVendorId] = useState<string | null>(null);
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
      // Transaction so the vendor create and the org's vendorCount stay in lockstep —
      // Firestore rules enforce the actual cap (organizations.vendorCount < vendorCap,
      // Starter default 25) using this same counter. This is soft enforcement: it stops
      // normal over-cap growth through the app, but doesn't prevent a client bypassing
      // the increment via direct Firestore access — see firestore.rules' orgField()
      // comment and docs/KNOWN_ISSUES.md.
      const write = runTransaction(db, async (tx) => {
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await tx.get(orgRef);
        const orgData = orgSnap.data() || {};
        const count = typeof orgData.vendorCount === 'number' ? orgData.vendorCount : 0;
        const cap = typeof orgData.vendorCap === 'number' ? orgData.vendorCap : 25;
        if (count >= cap) {
          throw new Error(`Vendor limit reached (${cap} on your plan). Upgrade to add more vendors.`);
        }
        const vendorRef = doc(collection(db, 'vendors'));
        tx.set(vendorRef, payload);
        tx.set(orgRef, { vendorCount: count + 1 }, { merge: true });
      });
      await Promise.race([write, writeTimeout]);
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

  /** Distinct from "Add One Vendor": creates the vendor, records a vendor_invites
   * audit entry (previously declared in COLLECTIONS but never written anywhere),
   * and emails the vendor a welcome notice — all in one step. */
  const handleInviteVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get('name') || ''),
      category: String(fd.get('category') || ''),
      criticality: 'Medium' as RiskLevel,
      primaryContactName: String(fd.get('primaryContactName') || ''),
      primaryContactEmail: String(fd.get('primaryContactEmail') || ''),
    };
    const err = validateVendorForm(input);
    if (err) {
      setInviteError(err);
      return;
    }
    if (!input.primaryContactEmail) {
      setInviteError('Contact email is required to send an invite.');
      return;
    }
    setInviteSaving(true);
    setInviteError('');
    try {
      await createVendor(input);

      if (orgId) {
        try {
          await addDoc(collection(db, 'vendor_invites'), {
            organizationId: orgId,
            vendorName: input.name,
            vendorEmail: input.primaryContactEmail,
            invitedByEmail: profile?.email || null,
            status: 'sent',
            createdAt: new Date().toISOString(),
          });
        } catch (invEx) {
          console.warn('Could not record vendor_invites audit entry', invEx);
        }
      }

      void sendEmailBestEffort({
        to: input.primaryContactEmail,
        subject: `You've been added as a vendor in Guardentra`,
        text: `Hi${input.primaryContactName ? ` ${input.primaryContactName}` : ''},\n\n${input.name} has been added to Guardentra's vendor register${profile?.displayName ? ` by ${profile.displayName}` : ''}. A security assessment questionnaire will follow separately.\n\nNo action is needed from you yet.`,
      });

      setShowInvite(false);
    } catch (ex: any) {
      setInviteError(ex?.message || 'Failed to invite vendor.');
    } finally {
      setInviteSaving(false);
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

  const vendorStatCards = [
    { label: 'Total Vendors', value: loading ? '—' : kpis.total, icon: Building2, tone: 'h-5 w-5 text-white' },
    { label: 'Critical / High Risk', value: loading ? '—' : kpis.criticalHigh, icon: ShieldAlert, tone: 'h-5 w-5 text-rose-400' },
    { label: 'Assessments Due', value: loading ? '—' : kpis.due, icon: CalendarClock, tone: 'h-5 w-5 text-orange-400' },
    { label: 'Needs Attention', value: loading ? '—' : kpis.needsAttention, icon: AlertTriangle, tone: 'h-5 w-5 text-amber-400' },
  ];

  return (
    <VendorsPageHeader
      dataMode={dataMode}
      onOpenBulk={openBulkModal}
      onOpenAdd={() => {
        setFormError('');
        setShowAdd(true);
      }}
    >
      {dataError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">
            {dataMode === 'local' ? 'Local vendor mode' : 'Vendors data warning'}
          </p>
          <p className="mt-1 text-amber-100/80">{dataError}</p>
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <VendorsStatsGrid cards={vendorStatCards} />

          <PageBand className="overflow-hidden p-0">
            <VendorsFiltersBar
              search={search}
              setSearch={setSearch}
              riskFilter={riskFilter}
              setRiskFilter={setRiskFilter}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              ownerFilter={ownerFilter}
              setOwnerFilter={setOwnerFilter}
              showMoreFilters={showMoreFilters}
              setShowMoreFilters={setShowMoreFilters}
              owners={owners}
              filteredCount={filtered.length}
              totalCount={vendors.length}
              clearFilters={clearFilters}
              onExport={() => downloadVendorRegisterReport(filtered)}
            />

            <VendorTable
              loading={loading}
              pageRows={pageRows}
              vendorsTotal={vendors.length}
              filteredCount={filtered.length}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              setPage={setPage}
              menuVendorId={menuVendorId}
              setMenuVendorId={setMenuVendorId}
              assessmentsByVendor={assessmentsByVendor}
              onNavigate={navigate}
            />
          </PageBand>
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
                onClick={() => {
                  setInviteError('');
                  setShowInvite(true);
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Invite Vendor
                </span>
                <span className="pl-6 text-xs text-slate-500">Add vendor &amp; send a welcome email</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/assessments/triage')}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Invite to assessment
                </span>
                <span className="pl-6 text-xs text-slate-500">FastTrack triage · then wizard</span>
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
        <Suspense fallback={null}>
          <AddVendorDialog
            formError={formError}
            saving={saving}
            onClose={() => setShowAdd(false)}
            onSubmit={handleAddVendor}
          />
        </Suspense>
      )}

      {showInvite && (
        <Suspense fallback={null}>
          <InviteVendorDialog
            inviteError={inviteError}
            inviteSaving={inviteSaving}
            onClose={() => setShowInvite(false)}
            onSubmit={handleInviteVendor}
          />
        </Suspense>
      )}

      {showBulk && (
        <Suspense fallback={null}>
          <BulkImportPanel
            bulkFileRef={bulkFileRef}
            bulkFileName={bulkFileName}
            bulkRows={bulkRows}
            bulkErrors={bulkErrors}
            bulkDupes={bulkDupes}
            bulkExisting={bulkExisting}
            bulkMessage={bulkMessage}
            bulkSuccess={bulkSuccess}
            bulkImporting={bulkImporting}
            bulkDragOver={bulkDragOver}
            setBulkDragOver={setBulkDragOver}
            onBulkFile={onBulkFile}
            importBulkRows={importBulkRows}
            resetBulkState={resetBulkState}
            closeBulkModal={closeBulkModal}
            downloadVendorCsvTemplate={downloadVendorCsvTemplate}
          />
        </Suspense>
      )}
    </VendorsPageHeader>
  );
}
