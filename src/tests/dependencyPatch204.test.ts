import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type LockPackage = {
  version?: string;
  resolved?: string;
  dependencies?: Record<string, string>;
  dev?: boolean;
  optional?: boolean;
};

const readJson = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));

const pkg = readJson('package.json') as {
  dependencies: Record<string, string>;
  overrides?: Record<string, unknown>;
};
const packages = (readJson('package-lock.json') as { packages: Record<string, LockPackage> }).packages;

const entry = (path: string) => {
  const item = packages[path];
  expect(item, path).toBeTruthy();
  return item;
};

const resolvedVersions = (packageName: string) => {
  const suffix = `node_modules/${packageName}`;
  return Object.entries(packages)
    .filter(([path]) => path === suffix || path.endsWith(`/${suffix}`))
    .map(([, item]) => item.version)
    .sort();
};

describe('#204 in-range dependency patch', () => {
  it('keeps the root ranges and does not add an override', () => {
    expect(pkg.dependencies.express).toBe('^5.2.1');
    expect(pkg.dependencies['react-router-dom']).toBe('^7.15.1');
    expect(pkg.dependencies.firebase).toBe('^12.13.0');
    expect(pkg.dependencies['firebase-admin']).toBe('^13.10.0');
    expect(pkg.overrides).toBeUndefined();
  });

  it('resolves the four approved families and retains Express 5.2.1', () => {
    expect(entry('node_modules/express').version).toBe('5.2.1');
    expect(entry('node_modules/express').dependencies?.['proxy-addr']).toBe('^2.0.7');
    expect(entry('node_modules/firebase-tools/node_modules/express').version).toBe('4.22.2');
    expect(entry('node_modules/firebase-tools/node_modules/express').dependencies?.['proxy-addr']).toBe('~2.0.7');
    expect(entry('node_modules/proxy-addr').version).toBe('2.0.8');
    expect(entry('node_modules/proxy-addr').resolved).toBe(
      'https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.8.tgz',
    );

    expect(entry('node_modules/react-router-dom').version).toBe('7.18.2');
    expect(entry('node_modules/react-router-dom').dependencies?.['react-router']).toBe('7.18.2');
    expect(entry('node_modules/react-router').version).toBe('7.18.2');

    expect(entry('node_modules/firebase-admin').version).toBe('13.10.0');
    expect(entry('node_modules/firebase-admin').dependencies?.['@fastify/busboy']).toBe('^3.0.0');
    expect(entry('node_modules/@fastify/busboy').version).toBe('3.2.2');

    expect(entry('node_modules/@google-cloud/tasks').version).toBe('7.1.0');
    expect(entry('node_modules/@google-cloud/tasks/node_modules/google-gax').dependencies?.['@grpc/grpc-js']).toBe(
      '^1.12.6',
    );
    expect(entry('node_modules/@google-cloud/tasks/node_modules/@grpc/grpc-js').version).toBe('1.14.5');

    expect(entry('node_modules/google-gax').version).toBe('4.6.1');
    expect(entry('node_modules/google-gax').dependencies?.['@grpc/grpc-js']).toBe('^1.10.9');
    expect(entry('node_modules/google-gax/node_modules/@grpc/grpc-js').version).toBe('1.14.5');
    expect(entry('node_modules/google-gax/node_modules/@grpc/grpc-js').optional).toBe(true);

    expect(entry('node_modules/@google-cloud/pubsub/node_modules/google-gax').dependencies?.['@grpc/grpc-js']).toBe(
      '^1.12.6',
    );
    expect(entry('node_modules/@google-cloud/pubsub/node_modules/@grpc/grpc-js').version).toBe('1.14.5');
    expect(entry('node_modules/@google-cloud/pubsub/node_modules/@grpc/grpc-js').dev).toBe(true);
  });

  it('preserves the Firestore client gRPC branch that cannot accept 1.14.x', () => {
    expect(entry('node_modules/firebase').version).toBe('12.16.0');
    expect(entry('node_modules/@firebase/firestore').version).toBe('4.16.0');
    expect(entry('node_modules/@firebase/firestore').dependencies?.['@grpc/grpc-js']).toBe('~1.9.0');
    expect(entry('node_modules/@grpc/grpc-js').version).toBe('1.9.16');
    expect(resolvedVersions('@grpc/grpc-js')).toEqual(['1.14.5', '1.14.5', '1.14.5', '1.9.16']);
  });

  it('does not leave a second resolved copy of the other patched packages', () => {
    expect(resolvedVersions('proxy-addr')).toEqual(['2.0.8']);
    expect(resolvedVersions('react-router')).toEqual(['7.18.2']);
    expect(resolvedVersions('react-router-dom')).toEqual(['7.18.2']);
    expect(resolvedVersions('@fastify/busboy')).toEqual(['3.2.2']);
  });
});
