import { describe, expect, it } from 'vitest';
import {
  findExistingDuplicates,
  parseVendorCsv,
  splitCsvLine,
  buildVendorCsvTemplate,
} from '../lib/vendor/csvBulk';

describe('csv bulk vendor import', () => {
  it('splits quoted CSV fields', () => {
    expect(splitCsvLine('Acme, "Cloud, SaaS", High')).toEqual(['Acme', 'Cloud, SaaS', 'High']);
  });

  it('parses valid rows and reports validation errors', () => {
    const csv = `name,category,criticality,primaryContactEmail
Good Co,SaaS,High,a@b.com
,Bad Category,High,x@y.com
Dup Co,IT Services,Medium,d@e.com
Dup Co,IT Services,Low,d2@e.com
`;
    const result = parseVendorCsv(csv);
    expect(result.rows.length).toBe(3);
    expect(result.errors.some((e) => /Row 2.*name/i.test(e))).toBe(true);
    expect(result.duplicatesInFile).toContain('Dup Co');
  });

  it('requires name and category headers', () => {
    const result = parseVendorCsv('foo,bar\n1,2');
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/name and category/i);
  });

  it('detects duplicates against existing vendors', () => {
    const hits = findExistingDuplicates(
      [{ name: 'Acme', category: 'SaaS' }, { name: 'NewCo', category: 'SaaS' }],
      ['acme', 'Other']
    );
    expect(hits).toEqual(['Acme']);
  });

  it('builds a downloadable template with headers', () => {
    const t = buildVendorCsvTemplate();
    expect(t).toMatch(/^name,category,criticality/);
    expect(t.split('\n').length).toBeGreaterThan(2);
  });
});
