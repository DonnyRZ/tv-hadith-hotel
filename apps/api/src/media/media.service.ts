import { createHash, createHmac, randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiException } from '../auth/api-exception';
import { MEDIA_REPOSITORY } from './media.repository';
import type { MediaRepository } from './media.repository';
import type { MediaObjectRecord, UploadedMediaFile } from './media.types';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

interface MediaBlob {
  body: Buffer;
  contentType: string;
}

interface MediaStorage {
  put(objectKey: string, file: MediaBlob): Promise<void>;
  get(objectKey: string): Promise<MediaBlob | null>;
  check(): Promise<void>;
}

interface MinioResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  headers: { get(name: string): string | null };
}

class InMemoryMediaStorage implements MediaStorage {
  private readonly objects = new Map<string, MediaBlob>();

  public async put(objectKey: string, file: MediaBlob): Promise<void> {
    this.objects.set(objectKey, { body: Buffer.from(file.body), contentType: file.contentType });
  }

  public async get(objectKey: string): Promise<MediaBlob | null> {
    const file = this.objects.get(objectKey);
    return file === undefined
      ? null
      : { body: Buffer.from(file.body), contentType: file.contentType };
  }

  public async check(): Promise<void> {
    return Promise.resolve();
  }
}

class MinioMediaStorage implements MediaStorage {
  private readonly endpoint: URL;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  public constructor(config: ConfigService) {
    const endpoint = config.get<string>('MINIO_ENDPOINT')?.trim();
    const accessKey = config.get<string>('MINIO_ROOT_USER')?.trim();
    const secretKey = config.get<string>('MINIO_ROOT_PASSWORD')?.trim();
    const bucket = config.get<string>('MINIO_BUCKET')?.trim();
    if (!endpoint || !accessKey || !secretKey || !bucket) {
      throw new Error(
        'MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, and MINIO_BUCKET are required.',
      );
    }
    this.endpoint = new URL(endpoint);
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.bucket = bucket;
  }

  public async put(objectKey: string, file: MediaBlob): Promise<void> {
    await this.ensureBucket();
    const response = await this.request('PUT', objectKey, file.body, file.contentType);
    if (!response.ok) {
      throw new Error(`MinIO upload failed with status ${response.status}.`);
    }
  }

  public async get(objectKey: string): Promise<MediaBlob | null> {
    await this.ensureBucket();
    const response = await this.request('GET', objectKey);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`MinIO read failed with status ${response.status}.`);
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  public async check(): Promise<void> {
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    this.bucketReady ??= this.createBucket();
    await this.bucketReady;
  }

  private async createBucket(): Promise<void> {
    const response = await this.request('PUT', '', undefined, undefined, { createBucket: true });
    if (!response.ok && response.status !== 409) {
      throw new Error(`MinIO bucket initialization failed with status ${response.status}.`);
    }
  }

  private async request(
    method: 'GET' | 'PUT',
    objectKey: string,
    body?: Buffer,
    contentType?: string,
    options: { createBucket?: boolean } = {},
  ): Promise<MinioResponse> {
    const timestamp = new Date();
    const amzDate = timestamp
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'us-east-1';
    const path = options.createBucket
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
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.secretKey}`, dateStamp), region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const fetcher = globalThis.fetch as unknown as (
      input: URL,
      init: { method: string; headers: Record<string, string>; body?: Buffer },
    ) => Promise<MinioResponse>;
    return fetcher(url, {
      method,
      headers: { ...headers, Authorization: authorization },
      ...(body === undefined ? {} : { body }),
    });
  }
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

@Injectable()
export class MediaService {
  private readonly storage: MediaStorage;
  private readonly publicBasePath = '/api/v1/media';

  public constructor(
    config: ConfigService,
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
  ) {
    const store =
      config.get<string>('AUTH_STORE') ??
      (config.get<string>('NODE_ENV') === 'production' ? 'postgres' : 'memory');
    this.storage =
      store === 'postgres' ? new MinioMediaStorage(config) : new InMemoryMediaStorage();
  }

  public async upload(file: UploadedMediaFile): Promise<MediaObjectRecord & { url: string }> {
    if (!IMAGE_TYPES.has(file.mimetype)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'MEDIA_TYPE_NOT_SUPPORTED',
        message: 'Only JPEG, PNG, WebP, and AVIF images are supported.',
      });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'MEDIA_SIZE_INVALID',
        message: 'Image size must be between 1 byte and 8 MB.',
      });
    }
    const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g, '-').slice(-120) || 'image';
    const id = randomUUID();
    const objectKey = `boutique/${id}${extname(safeName).toLowerCase() || extensionFor(file.mimetype)}`;
    await this.storage.put(objectKey, { body: file.buffer, contentType: file.mimetype });
    const record = await this.repository.create({
      objectKey,
      contentType: file.mimetype,
      fileName: safeName,
      byteSize: file.size,
    });
    return { ...record, url: this.urlFor(record.id) };
  }

  public async read(id: string): Promise<MediaBlob> {
    const record = await this.repository.findById(id);
    if (record === null) throw this.notFound();
    const blob = await this.storage.get(record.objectKey);
    if (blob === null) throw this.notFound();
    return blob;
  }

  public urlFor(id: string): string {
    return `${this.publicBasePath}/${encodeURIComponent(id)}`;
  }

  public async checkStorage(): Promise<void> {
    await this.storage.check();
  }

  private notFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'MEDIA_NOT_FOUND',
      message: 'The requested media does not exist.',
    });
  }
}

function extensionFor(contentType: string): string {
  return contentType === 'image/png'
    ? '.png'
    : contentType === 'image/webp'
      ? '.webp'
      : contentType === 'image/avif'
        ? '.avif'
        : '.jpg';
}
