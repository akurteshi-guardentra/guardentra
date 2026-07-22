import type { RiskLevel } from './types';
import { validateBulkVendorRow, type BulkVendorRow } from './validators';

export const BULK_VENDOR_HEADERS = [
  'name',
  'category',
  'criticality',
  'primaryContactName',
  'primaryContactEmail',
] as const;

export interface ParsedBulkVendor extends BulkVendorRow {
  primaryContactName?: string;
  criticality?: RiskLevel | string;
}

export interface BulkParseResult {
  rows: ParsedBulkVendor[];
  errors: string[];
  duplicatesInFile: string[];
}

/** Minimal CSV line splitter supporting quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '');
}

const HEADER_ALIASES: Record<string, keyof ParsedBulkVendor> = {
  name: 'name',
  vendor: 'name',
  vendorname: 'name',
  category: 'category',
  criticality: 'criticality',
  risk: 'criticality',
  risklevel: 'criticality',
  primarycontactname: 'primaryContactName',
  contact: 'primaryContactName',
  contactname: 'primaryContactName',
  primarycontactemail: 'primaryContactEmail',
  email: 'primaryContactEmail',
  contactemail: 'primaryContactEmail',
};

export function parseVendorCsv(text: string): BulkParseResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ['CSV must include a header row and at least one data row.'], duplicatesInFile: [] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const indexMap: Partial<Record<keyof ParsedBulkVendor, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) indexMap[key] = i;
  });

  if (indexMap.name == null || indexMap.category == null) {
    return {
      rows: [],
      errors: ['CSV header must include at least name and category columns.'],
      duplicatesInFile: [],
    };
  }

  const rows: ParsedBulkVendor[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();
  const duplicatesInFile: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: ParsedBulkVendor = {
      name: cols[indexMap.name!] || '',
      category: cols[indexMap.category!] || '',
      criticality: indexMap.criticality != null ? cols[indexMap.criticality] || 'Medium' : 'Medium',
      primaryContactName: indexMap.primaryContactName != null ? cols[indexMap.primaryContactName] || '' : '',
      primaryContactEmail: indexMap.primaryContactEmail != null ? cols[indexMap.primaryContactEmail] || '' : '',
    };

    const err = validateBulkVendorRow(row, i - 1);
    if (err) {
      errors.push(err);
      continue;
    }

    const key = row.name!.trim().toLowerCase();
    if (seen.has(key)) {
      duplicatesInFile.push(row.name!.trim());
    } else {
      seen.set(key, i);
    }

    if (!row.criticality) row.criticality = 'Medium';
    rows.push(row);
  }

  return { rows, errors, duplicatesInFile };
}

export function buildVendorCsvTemplate(): string {
  const header = BULK_VENDOR_HEADERS.join(',');
  const sample = [
    'TechCloud Services,Cloud Services,High,Sarah Chen,sarah@techcloud.example',
    'DataForce LLC,Data Processing,Medium,Mark Reed,mark@dataforce.example',
  ].join('\n');
  return `${header}\n${sample}\n`;
}

export function downloadVendorCsvTemplate() {
  const blob = new Blob([buildVendorCsvTemplate()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'guardentra-vendors-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Exact-name duplicates against existing register (case-insensitive). */
export function findExistingDuplicates(
  rows: ParsedBulkVendor[],
  existingNames: string[]
): string[] {
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const hits: string[] = [];
  for (const row of rows) {
    const name = row.name?.trim() || '';
    if (name && existing.has(name.toLowerCase())) hits.push(name);
  }
  return [...new Set(hits)];
}
