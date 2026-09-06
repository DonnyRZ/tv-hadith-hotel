/* global AbortSignal, clearTimeout, console, fetch, process, setTimeout, URL */

import { createRequire } from 'node:module';

const REQUEST_TIMEOUT_MS = 10_000;
const TV_UPDATE_PACKAGE_NAME = 'com.roomservice.tv';
const TV_PRODUCTION_CERTIFICATE_SHA256 =
  '50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904';
const MAX_TV_UPDATE_BYTES = 250 * 1024 * 1024;

function hasFlag(name) {
  return process.argv.includes(name);
}

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} requires a value`);
  }
  return value.trim();
}

function requiredOption(name) {
  const value = readOption(name);
  if (value === undefined) throw new Error(`Missing required option ${name}`);
  return value;
}

function credentialOption(option, environmentName) {
  const optionValue = readOption(option);
  if (optionValue !== undefined) return optionValue;
  const environmentValue = process.env[environmentName]?.trim();
  return environmentValue === undefined || environmentValue.length === 0
    ? undefined
    : environmentValue;
}

function normalizeStaffOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && readOption('--environment', 'production') === 'production') {
    throw new Error('--staff-url must use HTTPS for production');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('--staff-url must not contain credentials, query parameters, or fragments');
  }
  url.pathname = url.pathname.replace(/\/+$/u, '');
  return url;
}

function normalizeApiBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && readOption('--environment', 'production') === 'production') {
    throw new Error('--api-url must use HTTPS for production');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('--api-url must not contain credentials, query parameters, or fragments');
  }
  const pathname = url.pathname.replace(/\/+$/u, '');
  if (pathname !== '' && pathname !== '/api/v1') {
    throw new Error('--api-url must be an API origin or an origin ending in /api/v1');
  }
  url.pathname = pathname === '/api/v1' ? pathname : '/api/v1';
  return url;
}

function endpoint(base, path) {
  const url = new URL(base);
  const relative = new URL(path, 'http://preflight.local');
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}${relative.pathname}`;
  url.search = relative.search;
  return url;
}

async function getResponse(url, init = {}) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `${init.method ?? 'GET'} ${url.pathname} could not be reached: ${error.message}`,
      { cause: error },
    );
  }
}

async function readJson(response, label) {
  const contentType = response.headers.get('content-type') ?? '';
  const rawBody = await response.text();
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      `${label} returned HTTP ${response.status} with ${contentType || 'no'} content type; expected JSON`,
    );
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHealth(health, label, expectedEnvironment) {
  assert(health?.status === 'ok', `${label} health status is not ok`);
  assert(health?.service === 'room-service-api', `${label} is not the room-service API`);
  assert(
    health?.environment === expectedEnvironment,
    `${label} environment is ${health?.environment ?? 'missing'}, expected ${expectedEnvironment}`,
  );
  assert(
    typeof health?.releaseId === 'string' && health.releaseId.length > 0,
    `${label} releaseId is missing`,
  );
  assert(health?.dependencies?.database === 'ok', `${label} database dependency is not ok`);
  assert(health?.dependencies?.mediaStorage === 'ok', `${label} mediaStorage dependency is not ok`);
  assert(health?.dependencies?.redis === 'ok', `${label} Redis dependency is not ok`);
  assert(health?.dependencies?.realtime === 'ok', `${label} realtime dependency is not ok`);
}

async function assertStaffSocketHandshake(staffOrigin) {
  const socketUrl = endpoint(
    staffOrigin,
    `/socket.io/?EIO=4&transport=polling&t=${Date.now().toString(36)}`,
  );
  const response = await getResponse(socketUrl);
  const body = await response.text();
  assert(response.status === 200, `Staff Web Socket.IO handshake returned HTTP ${response.status}`);
  assert(body.startsWith('0'), 'Staff Web Socket.IO handshake did not return an open packet');

  let handshake;
  try {
    handshake = JSON.parse(body.slice(1));
  } catch {
    throw new Error('Staff Web Socket.IO handshake returned invalid JSON');
  }
  assert(typeof handshake?.sid === 'string', 'Staff Web Socket.IO handshake has no session id');

  const closeResponse = await getResponse(
    endpoint(
      staffOrigin,
      `/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(handshake.sid)}`,
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=UTF-8' },
      body: '1',
    },
  );
  assert(
    closeResponse.status === 200,
    `Staff Web Socket.IO handshake cleanup returned HTTP ${closeResponse.status}`,
  );
}

function cookieHeaderFrom(response) {
  const fallbackCookie = response.headers.get('set-cookie');
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : fallbackCookie === null
        ? []
        : [fallbackCookie];
  return setCookies
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => cookie.length > 0)
    .join('; ');
}

async function loginForSocketPreflight(staffOrigin, email, password) {
  const response = await getResponse(endpoint(staffOrigin, '/api/v1/auth/staff/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson(response, 'Staff preflight login');
  assert(
    response.status === 200,
    `Staff preflight login returned HTTP ${response.status} (${payload?.code ?? 'unknown'})`,
  );
  const cookieHeader = cookieHeaderFrom(response);
  assert(cookieHeader.length > 0, 'Staff preflight login did not issue a session cookie');
  return cookieHeader;
}

async function assertAuthenticatedStaffNamespace(staffOrigin, email, password) {
  const cookieHeader = await loginForSocketPreflight(staffOrigin, email, password);
  const requireFromStaffWeb = createRequire(
    new URL('../apps/staff-web/package.json', import.meta.url),
  );
  const { io } = requireFromStaffWeb('socket.io-client');
  const socket = io(`${staffOrigin.origin}/staff-realtime`, {
    autoConnect: false,
    forceNew: true,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: REQUEST_TIMEOUT_MS,
    extraHeaders: { Cookie: cookieHeader },
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Authenticated Staff Socket.IO namespace did not become ready in time'));
      }, REQUEST_TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timeout);
        socket.off('staff.realtime.ready', onReady);
        socket.off('connect_error', onConnectError);
        socket.off('disconnect', onDisconnect);
      }

      function onReady() {
        cleanup();
        resolve();
      }

      function onConnectError(error) {
        cleanup();
        reject(new Error(`Authenticated Staff Socket.IO namespace failed: ${error.message}`));
      }

      function onDisconnect(reason) {
        cleanup();
        reject(new Error(`Authenticated Staff Socket.IO namespace disconnected: ${reason}`));
      }

      socket.once('staff.realtime.ready', onReady);
      socket.once('connect_error', onConnectError);
      socket.once('disconnect', onDisconnect);
      socket.connect();
    });
  } finally {
    socket.disconnect();
  }
}

function assertTvUpdateManifest(manifest) {
  assert(typeof manifest?.enabled === 'boolean', 'TV update manifest enabled flag is missing');
  assert(
    manifest.packageName === TV_UPDATE_PACKAGE_NAME,
    `TV update manifest package is ${manifest?.packageName ?? 'missing'}, expected ${TV_UPDATE_PACKAGE_NAME}`,
  );
  if (!manifest.enabled) return;

  assert(
    Number.isInteger(manifest.latestVersionCode) && manifest.latestVersionCode > 0,
    'Enabled TV update manifest has an invalid latestVersionCode',
  );
  assert(
    typeof manifest.latestVersionName === 'string' && manifest.latestVersionName.length > 0,
    'Enabled TV update manifest has no latestVersionName',
  );
  assert(
    typeof manifest.releaseId === 'string' && manifest.releaseId.length > 0,
    'Enabled TV update manifest has no releaseId',
  );

  let apkUrl;
  try {
    apkUrl = new URL(manifest.apkUrl);
  } catch {
    throw new Error('Enabled TV update manifest has an invalid APK URL');
  }
  assert(
    apkUrl.protocol === 'https:' &&
      apkUrl.username.length === 0 &&
      apkUrl.password.length === 0 &&
      apkUrl.search.length === 0 &&
      apkUrl.hash.length === 0 &&
      apkUrl.hostname.length > 0,
    'Enabled TV update manifest APK URL must be stable HTTPS without credentials, query, or fragment',
  );
  assert(
    typeof manifest.sha256 === 'string' && /^[0-9a-f]{64}$/iu.test(manifest.sha256),
    'Enabled TV update manifest has an invalid APK SHA-256',
  );
  assert(
    manifest.certificateSha256 === TV_PRODUCTION_CERTIFICATE_SHA256,
    'Enabled TV update manifest certificate does not match the production signing certificate',
  );
}

async function assertTvUpdateArtifact(manifest) {
  const url = new URL(manifest.apkUrl);
  let response = await getResponse(url, { method: 'HEAD' });
  if (response.status === 405 || response.status === 501) {
    response = await getResponse(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });
  }
  assert(
    response.status >= 200 && response.status < 300,
    `TV update APK returned HTTP ${response.status}; immutable artifact is not reachable`,
  );
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  assert(
    contentLength === 0 || contentLength <= MAX_TV_UPDATE_BYTES,
    'TV update APK is larger than the 250 MiB client safety limit',
  );
}

async function assertUnauthenticatedJson(staffOrigin, path, method, expectedStatus, body) {
  const response = await getResponse(endpoint(staffOrigin, path), {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJson(response, `${method} ${path}`);
  assert(
    response.status === expectedStatus,
    `${method} ${path} returned HTTP ${response.status} (${payload?.code ?? 'no error code'}), expected ${expectedStatus}`,
  );
  assert(
    typeof payload?.requestId === 'string' && payload.requestId.length > 0,
    `${method} ${path} has no requestId`,
  );
  return payload;
}

async function main() {
  const expectedEnvironment = readOption('--environment', 'production');
  const requireTvUpdate = hasFlag('--require-tv-update');
  const staffOrigin = normalizeStaffOrigin(requiredOption('--staff-url'));
  const apiBase = normalizeApiBase(requiredOption('--api-url'));
  const staffEmail = credentialOption('--staff-email', 'PREFLIGHT_STAFF_EMAIL');
  const staffPassword = credentialOption('--staff-password', 'PREFLIGHT_STAFF_PASSWORD');
  if (staffEmail === undefined || staffPassword === undefined) {
    throw new Error(
      'Authenticated Staff preflight credentials are required; set PREFLIGHT_STAFF_EMAIL and PREFLIGHT_STAFF_PASSWORD or pass --staff-email and --staff-password',
    );
  }

  const directHealthResponse = await getResponse(endpoint(apiBase, '/health'));
  const directHealth = await readJson(directHealthResponse, 'Direct API health');
  assert(
    directHealthResponse.status === 200,
    `Direct API health returned HTTP ${directHealthResponse.status}`,
  );
  assertHealth(directHealth, 'Direct API', expectedEnvironment);

  const staffHealthResponse = await getResponse(endpoint(staffOrigin, '/api/v1/health'));
  const staffHealth = await readJson(staffHealthResponse, 'Staff Web /api/v1/health');
  assert(
    staffHealthResponse.status === 200,
    `Staff Web health returned HTTP ${staffHealthResponse.status}`,
  );
  assertHealth(staffHealth, 'Staff Web API proxy', expectedEnvironment);
  assert(
    staffHealth.releaseId === directHealth.releaseId,
    `Staff Web releaseId ${staffHealth.releaseId} does not match API releaseId ${directHealth.releaseId}`,
  );
  const tvUpdateResponse = await getResponse(endpoint(staffOrigin, '/api/v1/tv/update-manifest'));
  const tvUpdateManifest = await readJson(tvUpdateResponse, 'Staff Web TV update manifest');
  assert(
    tvUpdateResponse.status === 200,
    `Staff Web TV update manifest returned HTTP ${tvUpdateResponse.status}`,
  );
  assertTvUpdateManifest(tvUpdateManifest);
  if (requireTvUpdate) {
    assert(
      tvUpdateManifest.enabled,
      'TV update feed is disabled but --require-tv-update was supplied',
    );
    await assertTvUpdateArtifact(tvUpdateManifest);
  }
  await assertStaffSocketHandshake(staffOrigin);
  await assertAuthenticatedStaffNamespace(staffOrigin, staffEmail, staffPassword);

  const sessionPayload = await assertUnauthenticatedJson(
    staffOrigin,
    '/api/v1/auth/me',
    'GET',
    401,
  );
  assert(
    sessionPayload.code === 'UNAUTHORIZED',
    `Unauthenticated session check returned ${sessionPayload.code}`,
  );

  const pairingPayload = await assertUnauthenticatedJson(
    staffOrigin,
    '/api/v1/receptionist/tv-devices/pair',
    'POST',
    401,
    {},
  );
  assert(
    pairingPayload.code === 'UNAUTHORIZED',
    `Unauthenticated pairing check returned ${pairingPayload.code}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment: expectedEnvironment,
        releaseId: directHealth.releaseId,
        staffWeb: staffOrigin.origin,
        api: apiBase.origin,
        checks: [
          'direct-health',
          'same-origin-health',
          requireTvUpdate ? 'tv-update-manifest-and-artifact' : 'tv-update-manifest',
          'staff-socket-handshake',
          'authenticated-staff-namespace',
          'unauthenticated-session',
          'unauthenticated-pairing',
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`Deployment preflight failed: ${error.message}`);
  process.exitCode = 1;
});
