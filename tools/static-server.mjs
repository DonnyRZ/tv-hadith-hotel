/* global Buffer, Headers, URL, console, fetch, process */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const rootDirectory = path.resolve(process.argv[2] ?? 'dist');
const configuredPort = process.env.PORT ?? process.env.STATIC_PORT ?? '4173';
const port = Number(configuredPort);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer; received "${configuredPort}"`);
}

const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const proxyTarget = readProxyTarget();
const proxyBodyLimit = 2 * 1024 * 1024;
const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function readProxyTarget() {
  const configuredTarget = process.env.API_PROXY_TARGET?.trim();
  if (configuredTarget === undefined || configuredTarget.length === 0) return null;

  let target;
  try {
    target = new URL(configuredTarget);
  } catch {
    throw new Error('API_PROXY_TARGET must be a valid http(s) URL');
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('API_PROXY_TARGET must use http or https');
  }
  if (target.username.length > 0 || target.password.length > 0 || target.search.length > 0) {
    throw new Error('API_PROXY_TARGET must not contain credentials or a query string');
  }

  target.pathname = target.pathname.replace(/\/+$/u, '');
  return target;
}

function shouldProxy(requestUrl) {
  if (proxyTarget === null) return false;
  const url = new URL(requestUrl, 'http://static-server.local');
  return url.pathname.startsWith('/api/');
}

function proxyUrl(requestUrl) {
  const url = new URL(requestUrl, 'http://static-server.local');
  const target = new URL(proxyTarget);
  const targetBasePath = proxyTarget.pathname === '/' ? '' : proxyTarget.pathname;
  target.pathname = `${targetBasePath}${url.pathname}`;
  target.search = url.search;
  return target;
}

function proxyRequestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || hopByHopHeaders.has(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }

  const forwardedProtocol = request.headers['x-forwarded-proto'];
  headers.set(
    'x-forwarded-proto',
    Array.isArray(forwardedProtocol)
      ? (forwardedProtocol[0] ?? (proxyTarget.protocol === 'https:' ? 'https' : 'http'))
      : (forwardedProtocol ?? (proxyTarget.protocol === 'https:' ? 'https' : 'http')),
  );
  return headers;
}

async function readProxyBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > proxyBodyLimit) return null;
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function responseHeadersFromProxy(upstream, bodyLength) {
  const headers = {};
  upstream.headers.forEach((value, name) => {
    const normalizedName = name.toLowerCase();
    if (normalizedName === 'set-cookie' || hopByHopHeaders.has(normalizedName)) return;
    headers[name] = value;
  });

  const setCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : upstream.headers.get('set-cookie');
  if (setCookies !== null && setCookies !== undefined && setCookies.length > 0) {
    headers['set-cookie'] = setCookies;
  }
  headers['content-length'] = String(bodyLength);
  return headers;
}

async function proxyApiRequest(request, response) {
  const target = proxyUrl(request.url ?? '/');
  const method = request.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await readProxyBody(request) : undefined;

  if (body === null) {
    response.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Payload Too Large');
    return;
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers: proxyRequestHeaders(request),
      ...(body === undefined || body.length === 0 ? {} : { body, duplex: 'half' }),
      redirect: 'manual',
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, responseHeadersFromProxy(upstream, responseBody.length));
    if (method === 'HEAD') {
      response.end();
      return;
    }
    response.end(responseBody);
  } catch {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        statusCode: 502,
        code: 'API_PROXY_UNAVAILABLE',
        message: 'The API is temporarily unavailable.',
      }),
    );
  }
}

function resolveInsideRoot(relativePath) {
  const candidate = path.resolve(rootDirectory, relativePath);
  const rootWithSeparator = `${rootDirectory}${path.sep}`;

  if (candidate !== rootDirectory && !candidate.startsWith(rootWithSeparator)) {
    return null;
  }

  return candidate;
}

function getRequestedPath(requestUrl) {
  const rawPathname = requestUrl.split(/[?#]/u, 1)[0] || '/';
  let pathname;

  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  if (pathname.includes('\0') || pathname.split(/[\\/]/u).some((segment) => segment === '..')) {
    return null;
  }

  const relativePath = pathname.replace(/^[/\\]+/, '');
  const requestedFile = resolveInsideRoot(relativePath || 'index.html');

  if (requestedFile === null) {
    return null;
  }

  return { pathname, requestedFile };
}

async function resolveFile(pathname, requestedFile) {
  try {
    const requestedStats = await stat(requestedFile);

    if (requestedStats.isFile()) {
      return { filePath: requestedFile, fileStats: requestedStats };
    }

    if (requestedStats.isDirectory()) {
      const indexFile = resolveInsideRoot(path.join(pathname, 'index.html'));
      if (indexFile !== null) {
        const indexStats = await stat(indexFile);
        if (indexStats.isFile()) {
          return { filePath: indexFile, fileStats: indexStats };
        }
      }
    }
  } catch {
    // Fall through to the SPA fallback for client-side routes.
  }

  if (!path.extname(pathname) || pathname.endsWith('/')) {
    const fallbackFile = resolveInsideRoot('index.html');
    if (fallbackFile !== null) {
      try {
        const fallbackStats = await stat(fallbackFile);
        if (fallbackStats.isFile()) {
          return { filePath: fallbackFile, fileStats: fallbackStats };
        }
      } catch {
        // The final 404 response below is more useful than leaking filesystem details.
      }
    }
  }

  return null;
}

function parseRangeHeader(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (match === null) return null;

  const [, startText, endText] = match;
  if (startText === '' && endText === '') return null;

  let start = startText === '' ? Math.max(size - Number(endText), 0) : Number(startText);
  let end = startText === '' ? size - 1 : endText === '' ? size - 1 : Number(endText);

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  end = Math.min(end, size - 1);
  return { start, end };
}

function responseHeaders(filePath, size, pathname) {
  const extension = path.extname(filePath).toLowerCase();
  const isHtml = extension === '.html';
  const isAsset = pathname.startsWith('/assets/');

  return {
    'Accept-Ranges': 'bytes',
    'Cache-Control': isHtml ? 'no-store' : isAsset ? 'public, max-age=3600' : 'public, max-age=300',
    'Content-Length': String(size),
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

const server = createServer(async (request, response) => {
  if (shouldProxy(request.url ?? '/')) {
    await proxyApiRequest(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const requested = getRequestedPath(request.url ?? '/');
  if (requested === null) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad Request');
    return;
  }

  const resolved = await resolveFile(requested.pathname, requested.requestedFile);
  if (resolved === null) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  const { filePath, fileStats } = resolved;
  const headers = responseHeaders(filePath, fileStats.size, requested.pathname);
  const rangeHeader = request.headers.range;

  if (rangeHeader !== undefined) {
    const range = parseRangeHeader(rangeHeader, fileStats.size);
    if (range === null) {
      response.writeHead(416, {
        'Content-Range': `bytes */${fileStats.size}`,
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end('Range Not Satisfiable');
      return;
    }

    const length = range.end - range.start + 1;
    response.writeHead(206, {
      ...headers,
      'Content-Length': String(length),
      'Content-Range': `bytes ${range.start}-${range.end}/${fileStats.size}`,
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    await pipeline(createReadStream(filePath, { start: range.start, end: range.end }), response);
    return;
  }

  response.writeHead(200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  await pipeline(createReadStream(filePath), response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Static server listening on 0.0.0.0:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
