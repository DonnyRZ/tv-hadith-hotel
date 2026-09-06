/* global console, process */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const manifestPath = path.join(root, 'tools', 'guest-gallery-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const seenHashes = new Map();
const allHashes = new Map();
const generated = { stay: {}, taste: [], rest: [] };
const stayRoomOrder = ['standard', 'balcony', 'suite', 'junior-suite'];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

async function ensureImage(item, scope = 'global') {
  const provenance = [item.id, item.inputPath, item.sourcePath, item.sourceUrl ?? ''].join(' ');
  if (/president|deluxe/i.test(provenance)) {
    throw new Error(
      `Unsupported room gallery asset ${item.id}: President Suite and Deluxe are excluded`,
    );
  }
  if (!item.sourcePath || !item.outputPath || !item.tvResource) {
    throw new Error(`Gallery asset ${item.id} is missing provenance or output metadata`);
  }
  const inputPath = absolute(item.inputPath);
  const input = await readFile(inputPath);
  const digest = createHash('sha256').update(input).digest('hex');
  const previous = seenHashes.get(`${scope}:${digest}`);
  if (previous !== undefined) {
    throw new Error(`Duplicate gallery asset: ${item.id} duplicates ${previous}`);
  }
  const crossGalleryPrevious = allHashes.get(digest);
  if (crossGalleryPrevious !== undefined && crossGalleryPrevious !== item.id) {
    console.warn(
      `Reused official source bytes across gallery scopes: ${item.id} and ${crossGalleryPrevious}`,
    );
  }
  seenHashes.set(`${scope}:${digest}`, item.id);
  allHashes.set(digest, item.id);

  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const longEdge = Math.max(width, height);
  if (width < 1 || height < 1 || longEdge < 900) {
    throw new Error(`Gallery asset ${item.id} is too small or unreadable (${width}x${height})`);
  }
  if (metadata.format === undefined) {
    throw new Error(`Gallery asset ${item.id} has no detectable image format`);
  }

  const webPath = absolute(item.outputPath);
  const tvPath = absolute(
    path.join(
      'apps',
      'tv-shell',
      'app',
      'src',
      'main',
      'res',
      'drawable-nodpi',
      `${item.tvResource}.webp`,
    ),
  );
  await mkdir(path.dirname(webPath), { recursive: true });
  await mkdir(path.dirname(tvPath), { recursive: true });

  await sharp(input)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84, effort: 5 })
    .toFile(webPath);
  await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(tvPath);

  const webMetadata = await sharp(webPath).metadata();
  const tvMetadata = await sharp(tvPath).metadata();
  if (!webMetadata.width || !webMetadata.height || !tvMetadata.width || !tvMetadata.height) {
    throw new Error(`Generated gallery asset ${item.id} could not be verified`);
  }

  return {
    id: item.id,
    sourcePath: item.sourcePath,
    ...(item.sourceUrl === undefined ? {} : { sourceUrl: item.sourceUrl }),
    optimizedPath: item.outputPath
      .replace('apps/guest-web/public', '')
      .replaceAll('\\', '/')
      .replace(/^\/+/, '/'),
    tvResource: item.tvResource,
    caption: item.caption,
    alt: item.alt,
    ...(item.brand === undefined ? {} : { brand: item.brand }),
  };
}

for (const collection of manifest.collections) {
  if (collection.id === 'stay') {
    if (!Array.isArray(collection.rooms)) {
      throw new Error('The stay collection must use room galleries');
    }
    const actualRoomOrder = collection.rooms.map((room) => room.id);
    if (JSON.stringify(actualRoomOrder) !== JSON.stringify(stayRoomOrder)) {
      throw new Error(`Stay room order must be ${stayRoomOrder.join(', ')}`);
    }
    for (const room of collection.rooms) {
      if (!room.label || ['uz', 'ru', 'en'].some((language) => !room.label[language]?.trim())) {
        throw new Error(`Stay room ${room.id} must have complete labels`);
      }
      if (!Array.isArray(room.items) || room.items.length === 0) {
        throw new Error(`Stay room ${room.id} has no gallery items`);
      }
      if (room.id === 'standard' && room.items.length !== 4) {
        throw new Error('Standard Room must contain exactly 4 photos');
      }
      if (room.id === 'balcony' && room.items.length !== 1) {
        throw new Error('Balcony Room must contain exactly 1 validated photo');
      }
      if (room.id === 'suite' && room.items.length !== 4) {
        throw new Error('Suite must contain exactly 4 photos');
      }
      if (room.id === 'junior-suite' && room.items.length !== 6) {
        throw new Error('Junior Suite must contain exactly 6 photos');
      }
      const items = [];
      for (const item of room.items) items.push(await ensureImage(item, `stay:${room.id}`));
      generated.stay[room.id] = { id: room.id, label: room.label, items };
    }
    continue;
  }

  if (!['taste', 'rest'].includes(collection.id) || !Array.isArray(collection.items)) {
    throw new Error(`Unsupported gallery collection: ${collection.id}`);
  }
  for (const item of collection.items) {
    generated[collection.id].push(await ensureImage(item, collection.id));
  }
}

const generatedFile = `import type { LocalizedText } from '@room-service/translations';

export type GalleryId = 'stay' | 'taste' | 'rest';
export type GalleryBrand = 'saji' | '7oz';
export type StayRoomType = 'standard' | 'balcony' | 'suite' | 'junior-suite';

export interface GalleryItem {
  id: string;
  sourcePath: string;
  sourceUrl?: string;
  optimizedPath: string;
  tvResource: string;
  caption: string;
  alt: string;
  brand?: GalleryBrand;
}

export interface StayRoomGallery {
  id: StayRoomType;
  label: LocalizedText;
  items: readonly GalleryItem[];
}

export type GalleryManifest = Readonly<{
  stay: Readonly<Record<StayRoomType, StayRoomGallery>>;
  taste: readonly GalleryItem[];
  rest: readonly GalleryItem[];
}>;

export const STAY_ROOM_GALLERY_ORDER: readonly StayRoomType[] = ${JSON.stringify(stayRoomOrder)};

export const GALLERY_MANIFEST: GalleryManifest = ${JSON.stringify(generated, null, 2)};

export const GALLERY_BRAND_LABELS: Readonly<Record<GalleryBrand, LocalizedText>> = {
  saji: { uz: 'Saji Nusantara', ru: 'Saji Nusantara', en: 'Saji Nusantara' },
  '7oz': { uz: '7Oz Espresso', ru: '7Oz Espresso', en: '7Oz Espresso' },
};
`;

await writeFile(absolute('apps/guest-web/src/gallery-manifest.ts'), generatedFile, 'utf8');
const generatedCount =
  Object.values(generated.stay).reduce((count, room) => count + room.items.length, 0) +
  generated.taste.length +
  generated.rest.length;
console.log(`Prepared ${generatedCount} gallery assets.`);
