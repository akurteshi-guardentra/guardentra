/**
 * Loaded with node --import for the local demo server only.
 * Allows loopback sockets and refuses every other destination.
 */
import net from 'node:net';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0']);

function hostOf(args) {
  const first = args[0];
  if (first == null) return '';
  if (typeof first === 'string') return args[1] ? String(args[0]) : '';
  if (typeof first === 'object') {
    return String(first.host || first.hostname || '');
  }
  return '';
}

function assertLoopback(host) {
  if (!host) return;
  if (LOOPBACK.has(host)) return;
  throw new Error(`Local demo refused a non-loopback connection to ${host}`);
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function localDemoConnect(...args) {
  assertLoopback(hostOf(args));
  return originalConnect.apply(this, args);
};

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = async function localDemoFetch(input, init) {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assertLoopback(url.hostname);
    return originalFetch(input, init);
  };
}
