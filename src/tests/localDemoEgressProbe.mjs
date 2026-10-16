/**
 * Subprocess probe for the local demo network guard.
 * Stub mode replaces Socket.connect and fetch before the guard loads.
 * Transport mode uses real loopback sockets only.
 */
import http from 'node:http';
import http2 from 'node:http2';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mode = process.argv[2];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const guardHref = pathToFileURL(path.join(root, 'scripts/local-demo-block-egress.mjs')).href;
const failures = [];

function fail(name, detail) {
  failures.push(`${name}: ${detail}`);
}

if (mode === 'stub') {
  const calls = [];
  const fetchCalls = [];
  net.Socket.prototype.connect = function stubConnect(...args) {
    calls.push(args);
    return this;
  };
  globalThis.fetch = async function stubFetch(input, init) {
    fetchCalls.push({ input, init });
    return new Response('ok');
  };
  await import(guardHref);

  function refused(name, fn) {
    const before = calls.length;
    let error = null;
    try {
      fn();
    } catch (err) {
      error = err;
    }
    if (!error) fail(name, 'expected refusal');
    else if (error.code !== 'LOCAL_DEMO_EGRESS_REFUSED') fail(name, error.message || 'wrong error');
    if (calls.length !== before) fail(name, 'underlying connect ran');
  }

  function allowed(name, fn, pred) {
    const before = calls.length;
    try {
      fn();
    } catch (err) {
      fail(name, err instanceof Error ? err.message : String(err));
      return;
    }
    if (calls.length !== before + 1) {
      fail(name, `underlying connect count ${calls.length - before}`);
      return;
    }
    const args = calls[calls.length - 1];
    if (!pred(args[0], args)) fail(name, `normalized ${JSON.stringify(args[0])}`);
  }

  const socket = () => new net.Socket();
  const external = { port: 443, host: 'example.invalid' };

  refused('object external', () => socket().connect(external));
  refused('numeric external', () => socket().connect(443, 'example.invalid'));
  refused('string port external', () => socket().connect('443', 'example.invalid'));
  refused('normalized array external', () => socket().connect([external]));
  refused('createConnection object external', () => net.createConnection(external));
  refused('net.connect numeric external', () => net.connect(443, 'example.invalid'));
  refused('metadata address', () => socket().connect({ port: 80, host: '169.254.169.254' }));
  refused('documentation address', () => socket().connect({ port: 80, host: '192.0.2.1' }));
  refused('wildcard address', () => socket().connect({ port: 80, host: '0.0.0.0' }));
  refused('empty host', () => socket().connect(443, ''));
  refused('missing port', () => socket().connect({ host: '127.0.0.1' }));
  refused('port zero', () => socket().connect({ port: 0, host: '127.0.0.1' }));
  refused('ipc string', () => socket().connect('/tmp/guardentra-local.sock'));
  refused('empty ipc path', () => socket().connect({ path: '', port: 80, host: '127.0.0.1' }));
  refused('custom lookup', () => socket().connect({
    port: 80,
    host: '127.0.0.1',
    lookup: () => {},
  }));
  refused('conflicting hostname', () => socket().connect({
    port: 80,
    host: '127.0.0.1',
    hostname: 'example.invalid',
  }));
  refused('invalid callback', () => socket().connect({ port: 80, host: '127.0.0.1' }, 'nope'));
  refused('null path still checks host', () => socket().connect({
    path: null,
    port: 443,
    host: 'example.invalid',
  }));

  allowed('ipv4 object', () => socket().connect({ port: 9, host: '127.0.0.1' }), (opts) =>
    opts.host === '127.0.0.1' && opts.port === 9);
  allowed('localhost object', () => socket().connect({ port: 9, host: 'localhost' }), (opts) =>
    opts.host === '127.0.0.1' && opts.port === 9);
  allowed('default host', () => socket().connect({ port: 9 }), (opts) =>
    opts.host === '127.0.0.1' && opts.port === 9);
  allowed('numeric loopback', () => socket().connect(9, '127.0.0.1'), (opts) =>
    opts.host === '127.0.0.1' && opts.port === 9);
  allowed('ipv6', () => socket().connect({ port: 9, host: '::1' }), (opts) =>
    opts.host === '::1' && opts.port === 9);
  allowed('bracketed ipv6', () => socket().connect({ port: 9, host: '[::1]' }), (opts) =>
    opts.host === '::1');
  allowed('null callback', () => socket().connect({ port: 9, host: '127.0.0.1' }, null), (opts, args) =>
    opts.host === '127.0.0.1' && args.length === 1);
  allowed('http agent null path', () => socket().connect({
    path: null,
    port: 80,
    host: '127.0.0.1',
  }), (opts) => opts.host === '127.0.0.1' && opts.path === undefined && opts.port === 80);
  allowed('createConnection loopback', () => net.createConnection({ port: 9, host: '127.0.0.1' }), (opts) =>
    opts.host === '127.0.0.1' && opts.port === 9);
  allowed('net.connect loopback', () => net.connect(9, 'localhost'), (opts) =>
    opts.host === '127.0.0.1' && opts.port === 9);
  allowed('normalized array loopback', () => socket().connect([{ port: 9, host: 'localhost' }]), (opts) =>
    opts.host === '127.0.0.1');

  async function fetchRefused(name, input, init) {
    const before = fetchCalls.length;
    let error = null;
    try {
      await globalThis.fetch(input, init);
    } catch (err) {
      error = err;
    }
    if (!error) fail(name, 'expected refusal');
    else if (error.code !== 'LOCAL_DEMO_EGRESS_REFUSED') fail(name, error.message || 'wrong error');
    if (fetchCalls.length !== before) fail(name, 'underlying fetch ran');
  }

  await fetchRefused('external fetch', 'http://example.invalid/');
  await fetchRefused('fetch credentials', 'http://user:secret@127.0.0.1/');
  await fetchRefused('custom dispatcher', 'http://127.0.0.1/', { dispatcher: {} });
  await fetchRefused('non-http fetch', 'ftp://127.0.0.1/');

  const beforeFetch = fetchCalls.length;
  const response = await globalThis.fetch('http://127.0.0.1:9/health');
  if (!response.ok) fail('loopback fetch', 'stub response was not returned');
  const recorded = fetchCalls[fetchCalls.length - 1];
  if (fetchCalls.length !== beforeFetch + 1) fail('loopback fetch', 'underlying fetch missing');
  if (recorded?.init?.redirect !== 'error') fail('loopback fetch redirect', JSON.stringify(recorded?.init));

  const urlResponse = await globalThis.fetch(new URL('http://127.0.0.1:9/url'));
  if (!urlResponse.ok) fail('url fetch', 'stub response was not returned');
  if (fetchCalls.at(-1)?.init?.redirect !== 'error') fail('url fetch redirect', 'redirect was not forced');

  const requestResponse = await globalThis.fetch(new Request('http://[::1]:9/request'));
  if (!requestResponse.ok) fail('request fetch', 'stub response was not returned');
  if (fetchCalls.at(-1)?.init?.redirect !== 'error') fail('ipv6 fetch redirect', 'redirect was not forced');

  const forced = await globalThis.fetch('http://127.0.0.1:9/follow', { redirect: 'follow' });
  if (!forced.ok) fail('redirect override', 'stub response was not returned');
  if (fetchCalls.at(-1)?.init?.redirect !== 'error') fail('redirect override', 'follow was preserved');
} else if (mode === 'transport') {
  await import(guardHref);

  function expectRefused(name, fn) {
    try {
      fn();
      fail(name, 'expected refusal');
    } catch (err) {
      if (!err || err.code !== 'LOCAL_DEMO_EGRESS_REFUSED') {
        fail(name, err instanceof Error ? err.message : String(err));
      }
    }
  }

  expectRefused('real external object', () => net.connect({ port: 9, host: 'example.invalid' }));
  expectRefused('real external numeric', () => net.connect(9, 'example.invalid'));
  expectRefused('real external array', () => net.connect([{ port: 9, host: '192.0.2.1' }]));

  const tcp = await new Promise((resolve, reject) => {
    const server = net.createServer((connection) => {
      connection.end('ok');
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const client = net.connect({ port, host: '127.0.0.1' }, () => {
        client.once('data', (buf) => {
          client.end();
          server.close(() => resolve(String(buf)));
        });
      });
      client.on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  }).catch((err) => {
    fail('tcp loopback', err instanceof Error ? err.message : String(err));
    return '';
  });
  if (tcp && tcp !== 'ok') fail('tcp loopback', tcp);

  const httpBody = await new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.end('ready');
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}/`, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          server.close(() => resolve(Buffer.concat(chunks).toString()));
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  }).catch((err) => {
    fail('http url', err instanceof Error ? err.message : String(err));
    return '';
  });
  if (httpBody && httpBody !== 'ready') fail('http url', httpBody);

  const httpOptionsBody = await new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.end('opts');
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      http.get({ hostname: '127.0.0.1', port, path: '/' }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          server.close(() => resolve(Buffer.concat(chunks).toString()));
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  }).catch((err) => {
    fail('http options', err instanceof Error ? err.message : String(err));
    return '';
  });
  if (httpOptionsBody && httpOptionsBody !== 'opts') fail('http options', httpOptionsBody);

  const fetched = await (async () => {
    const server = http.createServer((_req, res) => {
      res.end('fetched');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      return await response.text();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  })().catch((err) => {
    fail('fetch loopback', err instanceof Error ? err.message : String(err));
    return '';
  });
  if (fetched && fetched !== 'fetched') fail('fetch loopback', fetched);

  let redirectRefused = false;
  const redirectServer = http.createServer((_req, res) => {
    res.writeHead(302, { Location: 'http://example.invalid/nope' });
    res.end();
  });
  await new Promise((resolve) => redirectServer.listen(0, '127.0.0.1', resolve));
  try {
    await fetch(`http://127.0.0.1:${redirectServer.address().port}/`);
  } catch {
    redirectRefused = true;
  } finally {
    await new Promise((resolve) => redirectServer.close(resolve));
  }
  if (!redirectRefused) fail('redirect', 'external redirect was followed or accepted');

  const h2 = await new Promise((resolve, reject) => {
    const server = http2.createServer((_req, res) => {
      res.end('h2');
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const session = http2.connect(`http://127.0.0.1:${port}`);
      const req = session.request({ ':path': '/' });
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        session.close();
        server.close(() => resolve(Buffer.concat(chunks).toString()));
      });
      req.on('error', (err) => {
        session.close();
        server.close();
        reject(err);
      });
      req.end();
    });
  }).catch((err) => {
    fail('http2', err instanceof Error ? err.message : String(err));
    return '';
  });
  if (h2 && h2 !== 'h2') fail('http2', h2);
} else {
  fail('mode', `unknown mode ${mode}`);
}

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`ok ${mode} ${failures.length}\n`);
