/**
 * Local TCP/fetch accident-prevention guard, not an OS network sandbox.
 * Loaded with node --import for the local demo server only.
 *
 * Every supported net.Socket.connect form is normalized before any socket or
 * DNS lookup. An unrecognized shape is refused. This does not constrain
 * child processes, native addons, or redirects outside this process.
 */
import net from 'node:net';

function refused(reason) {
  const error = new Error(`Local demo refused connection: ${reason}`);
  error.code = 'LOCAL_DEMO_EGRESS_REFUSED';
  return error;
}

function loopbackHost(value = 'localhost') {
  if (typeof value !== 'string') throw refused('invalid host');
  const host = value.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return '127.0.0.1';
  if (host === '::1' || host === '[::1]') return '::1';
  throw refused('non-loopback host');
}

export function normalizeConnect(input) {
  let args = input;
  let depth = 0;
  while (Array.isArray(args[0])) {
    if (++depth > 4 || args.length !== 1) throw refused('unsupported argument nesting');
    args = args[0];
  }
  const first = args[0];
  let options;
  let callback;
  if (first && typeof first === 'object') {
    if (args.length > 2) throw refused('unexpected options arguments');
    options = { ...first };
    callback = args[1];
  } else if (typeof first === 'number' ||
             (typeof first === 'string' && /^\d+$/.test(first))) {
    if (args.length > 3) throw refused('unexpected port arguments');
    options = { port: first };
    if (typeof args[1] === 'string') {
      options.host = args[1];
      callback = args[2];
    } else {
      if (args.length > 2) throw refused('unexpected callback arguments');
      callback = args[1];
    }
  } else {
    throw refused('unsupported connect form or IPC path');
  }
  if (callback === null) callback = undefined;
  if (callback !== undefined && typeof callback !== 'function') throw refused('invalid callback');
  // Node's HTTP Agent supplies path:null for a TCP connection, not an IPC path.
  if (options.path === null) delete options.path;
  for (const key of ['path', 'socketPath', 'socket', 'fd', 'handle', 'lookup']) {
    if (options[key] !== undefined) throw refused(`unsupported option ${key}`);
  }
  const portValue = options.port;
  if (!(typeof portValue === 'number' ||
        (typeof portValue === 'string' && /^\d+$/.test(portValue)))) {
    throw refused('missing or invalid port');
  }
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw refused('invalid TCP port');
  const host = loopbackHost(options.host === undefined ? options.hostname : options.host);
  if (options.hostname !== undefined && loopbackHost(options.hostname) !== host) {
    throw refused('conflicting hostname');
  }
  options.host = host;
  options.port = port;
  delete options.hostname;
  return callback === undefined ? [options] : [options, callback];
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function localDemoConnect(...args) {
  return originalConnect.apply(this, normalizeConnect(args));
};

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = async function localDemoFetch(input, init) {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (!['http:', 'https:'].includes(url.protocol)) throw refused('unsupported fetch protocol');
    loopbackHost(url.hostname);
    if (url.username || url.password) throw refused('URL credentials');
    if (init?.dispatcher !== undefined) throw refused('custom dispatcher');
    return originalFetch(input, { ...init, redirect: 'error' });
  };
}
