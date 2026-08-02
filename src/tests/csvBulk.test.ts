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

  it('handles BOM, blank lines, aliases, and bad emails under stress', () => {
    const csv = `\uFEFFvendor name, category , risk level , email

"Quoted, Inc",SaaS,Critical,ok@ex.com

Bad Email Co,Cloud Services,High,not-an-email
Weird Crit,IT Services,Extreme,a@b.com
Ok Two,Data Processing,,c@d.com
`;
    const result = parseVendorCsv(csv);
    expect(result.rows.some((r) => r.name === 'Quoted, Inc')).toBe(true);
    expect(result.rows.some((r) => r.name === 'Ok Two' && r.criticality === 'Medium')).toBe(true);
    expect(result.errors.some((e) => /invalid email/i.test(e))).toBe(true);
    expect(result.errors.some((e) => /criticality must be/i.test(e))).toBe(true);
  });

  it('accepts lowercase criticality and semicolon-delimited Excel CSV', () => {
    const csv = `name;category;criticality;email
Euro Co;SaaS;high;a@b.com
Nordic AS;Cloud Services;LOW;c@d.com
`;
    const result = parseVendorCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].criticality).toBe('High');
    expect(result.rows[1].criticality).toBe('Low');
  });

  it('parses a large valid CSV without dropping rows', () => {
    const header = 'name,category,criticality,primaryContactName,primaryContactEmail';
    const lines = Array.from({ length: 120 }, (_, i) =>
      `Vendor ${i},SaaS,${['Low', 'Medium', 'High', 'Critical'][i % 4]},Contact ${i},v${i}@ex.com`
    );
    const result = parseVendorCsv([header, ...lines].join('\n'));
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(120);
    expect(result.duplicatesInFile).toEqual([]);
  });
});
