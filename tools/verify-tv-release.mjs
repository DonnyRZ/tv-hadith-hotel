/* global AbortSignal, console, fetch, process, URL */

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TV_UPDATE_BYTES = 250 * 1024 * 1024;
const TV_UPDATE_PACKAGE_NAME = 'com.roomservice.tv';
const TV_PRODUCTION_CERTIFICATE_SHA256 =
  '50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904';

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

function normalizeUrl(value, option, expectedPath = undefined) {
  const url = new URL(value);
  const environment = readOption('--environment', 'production');
  if (environment === 'production' && url.protocol !== 'https:') {
    throw new Error(`${option} must use HTTPS in production`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${option} must not contain credentials, query parameters, or fragments`);
  }
  if (expectedPath !== undefined && url.pathname.replace(/\/+$/u, '') !== expectedPath) {
    throw new Error(`${option} must end with ${expectedPath}`);
  }
  url.pathname = url.pathname.replace(/\/+$/u, '');
  return url;
}

function normalizeApiBase(value) {
  const url = normalizeUrl(value, '--api-url');
  const path = url.pathname || '';
  if (path !== '' && path !== '/api/v1') {
    throw new Error('--api-url must be an API origin or an origin ending in /api/v1');
  }
  url.pathname = '/api/v1';
  return url;
}

function endpoint(base, path) {
  const url = new URL(base);
  const relative = new URL(path, 'http://preflight.local');
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}${relative.pathname}`;
  url.search = relative.search;
  return url;
}

async function request(url, init = {}) {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${init.method ?? 'GET'} ${url} could not be reached: ${error.message}`, {
      cause: error,
    });
  }
}

async function readJson(response, label) {
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      `${label} returned HTTP ${response.status} with ${contentType || 'no'} content type; expected JSON`,
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHealth(payload, label, expectedEnvironment) {
  assert(payload?.status === 'ok', `${label} health status is not ok`);
  assert(payload?.service === 'room-service-api', `${label} is not the room-service API`);
  assert(
    payload?.environment === expectedEnvironment,
    `${label} environment is ${payload?.environment ?? 'missing'}, expected ${expectedEnvironment}`,
  );
  assert(
    typeof payload?.releaseId === 'string' && payload.releaseId.length > 0,
    `${label} releaseId is missing`,
  );
  for (const dependency of ['database', 'mediaStorage', 'redis', 'realtime']) {
    assert(
      payload?.dependencies?.[dependency] === 'ok',
      `${label} dependency ${dependency} is not ok`,
    );
  }
}

async function checkHealth(base, label, expectedEnvironment) {
  const response = await request(endpoint(base, '/health'));
  const payload = await readJson(response, `${label} health`);
  assert(response.status === 200, `${label} health returned HTTP ${response.status}`);
  assertHealth(payload, label, expectedEnvironment);
  return payload;
}

function assertStableApkUrl(value) {
  const url = new URL(value);
  assert(url.protocol === 'https:', 'TV update APK URL must use HTTPS');
  assert(!url.username && !url.password, 'TV update APK URL must not contain credentials');
  assert(
    !url.search && !url.hash,
    'TV update APK URL must not contain query parameters or fragments',
  );
  assert(url.hostname.length > 0, 'TV update APK URL must have a hostname');
  return url;
}

function assertManifest(manifest, expected) {
  assert(manifest?.enabled === true, 'TV update feed is disabled');
  assert(
    manifest.packageName === TV_UPDATE_PACKAGE_NAME,
    `TV update package is ${manifest?.packageName ?? 'missing'}, expected ${TV_UPDATE_PACKAGE_NAME}`,
  );
  assert(
    manifest.latestVersionCode === expected.versionCode,
    'TV update version code does not match artifact',
  );
  assert(
    manifest.latestVersionName === expected.versionName,
    'TV update version name does not match artifact',
  );
  assert(manifest.releaseId === expected.releaseId, 'TV update release ID does not match artifact');
  assert(manifest.apkUrl === expected.apkUrl, 'TV update APK URL does not match artifact');
  assert(
    String(manifest.sha256).toLowerCase() === expected.sha256.toLowerCase(),
    'TV update SHA-256 does not match artifact',
  );
  assert(
    String(manifest.certificateSha256).toLowerCase() === expected.certificate.toLowerCase(),
    'TV update certificate does not match artifact',
  );
  assert(
    String(manifest.certificateSha256).toLowerCase() === TV_PRODUCTION_CERTIFICATE_SHA256,
    'TV update certificate is not the retained production certificate',
  );
  assertStableApkUrl(manifest.apkUrl);
}

async function checkManifest(base, label, expected) {
  const response = await request(endpoint(base, '/tv/update-manifest'));
  const manifest = await readJson(response, `${label} TV update manifest`);
  assert(response.status === 200, `${label} TV update manifest returned HTTP ${response.status}`);
  const cacheControl = (response.headers.get('cache-control') ?? '').toLowerCase();
  assert(cacheControl.includes('no-store'), `${label} TV update manifest is cacheable`);
  assertManifest(manifest, expected);
  return manifest;
}

async function checkArtifact(apkUrl) {
  let response = await request(apkUrl, { method: 'HEAD' });
  if (response.status === 405 || response.status === 501) {
    response = await request(apkUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });
    await response.arrayBuffer();
  }
  assert(
    response.status === 200 || response.status === 206,
    `TV update APK returned HTTP ${response.status}; no redirect or successful artifact response`,
  );
  assert(!response.headers.has('location'), 'TV update APK endpoint redirected');
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  assert(
    contentLength === 0 || contentLength <= MAX_TV_UPDATE_BYTES,
    'TV update APK is larger than the 250 MiB client safety limit',
  );
}

async function checkSocketHandshake(staffOrigin) {
  const handshakeUrl = endpoint(
    staffOrigin,
    `/socket.io/?EIO=4&transport=polling&t=${Date.now().toString(36)}`,
  );
  const response = await request(handshakeUrl);
  const body = await response.text();
  assert(response.status === 200, `Staff Web Socket.IO handshake returned HTTP ${response.status}`);
  assert(body.startsWith('0'), 'Staff Web Socket.IO handshake did not return an open packet');
  let packet;
  try {
    packet = JSON.parse(body.slice(1));
  } catch {
    throw new Error('Staff Web Socket.IO handshake returned invalid JSON');
  }
  assert(typeof packet?.sid === 'string', 'Staff Web Socket.IO handshake has no session ID');

  const closeResponse = await request(
    endpoint(
      staffOrigin,
      `/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(packet.sid)}`,
    ),
    {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=UTF-8' },
      body: '1',
    },
  );
  assert(
    closeResponse.status === 200,
    `Socket.IO handshake cleanup returned HTTP ${closeResponse.status}`,
  );
}

async function main() {
  const environment = readOption('--environment', 'production');
  const expected = {
    versionCode: Number(requiredOption('--version-code')),
    versionName: requiredOption('--version-name'),
    releaseId: requiredOption('--release-id'),
    apkUrl: requiredOption('--apk-url'),
    sha256: requiredOption('--sha256'),
    certificate: requiredOption('--certificate'),
  };
  assert(
    Number.isSafeInteger(expected.versionCode) && expected.versionCode > 0,
    'version code is invalid',
  );
  assert(/^[a-f0-9]{64}$/iu.test(expected.sha256), 'artifact SHA-256 is invalid');
  assert(/^[a-f0-9]{64}$/iu.test(expected.certificate), 'artifact certificate is invalid');
  assert(
    expected.certificate.toLowerCase() === TV_PRODUCTION_CERTIFICATE_SHA256,
    'artifact certificate is not the retained production certificate',
  );
  assertStableApkUrl(expected.apkUrl);

  const apiBase = normalizeApiBase(requiredOption('--api-url'));
  const staffOrigin = normalizeUrl(requiredOption('--staff-url'), '--staff-url');
  const guestOrigin = normalizeUrl(requiredOption('--guest-url'), '--guest-url');
  const directHealth = await checkHealth(apiBase, 'Direct API', environment);
  const staffHealth = await checkHealth(
    endpoint(staffOrigin, '/api/v1'),
    'Staff Web API proxy',
    environment,
  );
  const guestHealth = await checkHealth(
    endpoint(guestOrigin, '/api/v1'),
    'Guest Web API proxy',
    environment,
  );
  assert(
    staffHealth.releaseId === directHealth.releaseId,
    'Staff Web proxy points at a different API release',
  );
  assert(
    guestHealth.releaseId === directHealth.releaseId,
    'Guest Web proxy points at a different API release',
  );

  await checkManifest(apiBase, 'Direct API', expected);
  await checkManifest(endpoint(staffOrigin, '/api/v1'), 'Staff Web API proxy', expected);
  await checkManifest(endpoint(guestOrigin, '/api/v1'), 'Guest Web API proxy', expected);
  await checkArtifact(expected.apkUrl);
  await checkSocketHandshake(staffOrigin);

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment,
        releaseId: expected.releaseId,
        versionCode: expected.versionCode,
        packageName: TV_UPDATE_PACKAGE_NAME,
        apkUrl: expected.apkUrl,
        sha256: expected.sha256.toLowerCase(),
        certificateSha256: expected.certificate.toLowerCase(),
        checks: [
          'api-health',
          'staff-proxy',
          'guest-proxy',
          'exact-manifest',
          'apk-url',
          'socket-io',
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`TV release verification failed: ${error.message}`);
  process.exitCode = 1;
});
