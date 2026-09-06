import { createHash, createHmac } from 'node:crypto';

const REGION = 'us-east-1';

export interface TvUpdateObjectResponse {
  status: number;
  contentType: string | null;
  contentLength: string | null;
  contentRange: string | null;
  body: ReadableStream<Uint8Array> | null;
}

/**
 * Private MinIO storage for signed TV update artifacts.
 *
 * The API is the only public download surface. This keeps the MinIO API and
 * console private while still allowing a GitHub release workflow to publish
 * immutable objects through the API upload endpoint.
 */
export class TvUpdateStorage {
  private readonly endpoint: URL;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  public constructor(config: { get<T = unknown>(propertyPath: string): T | undefined }) {
    const endpoint = config.get<string>('MINIO_ENDPOINT')?.trim();
    const accessKey = config.get<string>('MINIO_ROOT_USER')?.trim();
    const secretKey = config.get<string>('MINIO_ROOT_PASSWORD')?.trim();
    const bucket = config.get<string>('TV_UPDATE_STORAGE_BUCKET')?.trim() || 'egi-tv-updates';
    if (!endpoint || !accessKey || !secretKey || !bucket) {
      throw new Error(
        'MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, and TV_UPDATE_STORAGE_BUCKET are required for TV updates.',
      );
    }
    this.endpoint = new URL(endpoint);
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.bucket = bucket;
  }

  public async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    const response = await this.request('PUT', objectKey, body, contentType);
    if (!response.ok) {
      throw new Error(`MinIO TV update upload failed with status ${response.status}.`);
    }
  }

  public async get(objectKey: string, range: string | undefined): Promise<TvUpdateObjectResponse> {
    await this.ensureBucket();
    const response = await this.request('GET', objectKey, undefined, undefined, range);
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      contentRange: response.headers.get('content-range'),
      body: response.body,
    };
  }

  private async ensureBucket(): Promise<void> {
    this.bucketReady ??= this.createBucket();
    await this.bucketReady;
  }

  private async createBucket(): Promise<void> {
    const response = await this.request('PUT', '', undefined, undefined, undefined, true);
    if (!response.ok && response.status !== 409) {
      throw new Error(
        `MinIO TV update bucket initialization failed with status ${response.status}.`,
      );
    }
  }

  private async request(
    method: 'GET' | 'PUT',
    objectKey: string,
    body?: Buffer,
    contentType?: string,
    range?: string,
    createBucket = false,
  ): Promise<Response> {
    const timestamp = new Date();
    const amzDate = timestamp
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
    const dateStamp = amzDate.slice(0, 8);
    const path = createBucket
      ? `/${encodeURIComponent(this.bucket)}`
      : `/${encodeURIComponent(this.bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
    const url = new URL(path, this.endpoint);
    const payloadHash = createHash('sha256')
      .update(body ?? Buffer.alloc(0))
      .digest('hex');
    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType !== undefined) headers['content-type'] = contentType;
    if (range !== undefined) headers.range = range;
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name]?.trim()}\n`)
      .join('');
    const canonicalRequest = [
      method,
      url.pathname,
      url.search.slice(1),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${REGION}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.secretKey}`, dateStamp), REGION), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return fetch(url, {
      method,
      headers: { ...headers, Authorization: authorization },
      ...(body === undefined ? {} : { body }),
    });
  }
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}
