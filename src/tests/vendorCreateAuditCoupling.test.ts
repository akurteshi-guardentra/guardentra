import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#160 hosted vendor create durable audit coupling', () => {
  it('exposes vendor create through the existing authenticated org route', () => {
    const route = read('server/routes/orgEvidence.ts');
    expect(route).toContain("router.post('/vendor-create'");
    expect(route).toContain('handleOrgVendorCreate(req, res, vendorDeps)');
  });

  it('removes the hosted client Firestore transaction and uses the server boundary', () => {
    const page = read('src/pages/VendorsDirectory.tsx');
    const start = page.indexOf('const createVendor = async (input:');
    const end = page.indexOf('\n  const handleAddVendor', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const create = page.slice(start, end);
    expect(create).toContain("fetch('/api/org/vendor-create'");
    expect(create).not.toContain('runTransaction(db');
    const hostedFetch = create.indexOf("fetch('/api/org/vendor-create'");
    const hostedCatch = create.indexOf('    } catch (ex)', hostedFetch);
    const localAudit = create.indexOf('void emitAuditBestEffort');
    expect(localAudit).toBeGreaterThan(-1);
    expect(localAudit).toBeLessThan(hostedFetch);
    expect(hostedCatch).toBeGreaterThan(hostedFetch);
    expect(create.slice(hostedFetch, hostedCatch)).not.toContain('emitAuditBestEffort');
  });
});
