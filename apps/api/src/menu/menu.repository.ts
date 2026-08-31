import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { UNIT_CODES, type UnitCode } from '../rbac/rbac.types';
import { INITIAL_MENU_SEEDS, type MenuSeedItem } from './menu-seed';
import type {
  CreateMenuItemRecordInput,
  LocalizedText,
  MenuItemListFilter,
  MenuItemListResult,
  MenuItemRecord,
  UpdateMenuItemRecordInput,
} from './menu.types';
import type { MenuItemKind } from './menu.types';

export const MENU_REPOSITORY = Symbol('MENU_REPOSITORY');

export class MenuItemNameConflictError extends Error {
  public constructor() {
    super('A menu item with this name already exists in the unit.');
    this.name = 'MenuItemNameConflictError';
  }
}

export interface MenuRepository {
  listItems(filter: MenuItemListFilter): Promise<MenuItemListResult>;
  findItemById(id: string): Promise<MenuItemRecord | null>;
  createItem(input: CreateMenuItemRecordInput): Promise<MenuItemRecord>;
  updateItem(id: string, input: UpdateMenuItemRecordInput): Promise<MenuItemRecord | null>;
  setItemActive(id: string, active: boolean): Promise<MenuItemRecord | null>;
}

const MENU_ITEM_KINDS = ['PRODUCT', 'SERVICE'] as const;

function isUnitCode(value: string): value is UnitCode {
  return (UNIT_CODES as readonly string[]).includes(value);
}

function isMenuItemKind(value: string): value is MenuItemKind {
  return (MENU_ITEM_KINDS as readonly string[]).includes(value);
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function now(): string {
  return new Date().toISOString();
}

function cloneItem(item: MenuItemRecord): MenuItemRecord {
  return {
    ...item,
    localizedName: { ...item.localizedName },
    localizedDescription:
      item.localizedDescription === null ? null : { ...item.localizedDescription },
  };
}

@Injectable()
export class InMemoryMenuRepository implements MenuRepository {
  private readonly items = new Map<string, MenuItemRecord>();

  private initialization?: Promise<void>;

  public async listItems(filter: MenuItemListFilter): Promise<MenuItemListResult> {
    await this.ensureInitialized();
    const allowedUnits = new Set(filter.units);
    const filtered = [...this.items.values()]
      .filter(
        (item) =>
          allowedUnits.has(item.unit) &&
          (filter.includeInactive || item.active) &&
          (!filter.availableOnly || item.available),
      )
      .sort((left, right) => this.compareItems(left, right));
    const offset = (filter.page - 1) * filter.pageSize;

    return {
      items: filtered.slice(offset, offset + filter.pageSize).map(cloneItem),
      total: filtered.length,
    };
  }

  public async findItemById(id: string): Promise<MenuItemRecord | null> {
    await this.ensureInitialized();
    const item = this.items.get(id);
    return item === undefined ? null : cloneItem(item);
  }

  public async createItem(input: CreateMenuItemRecordInput): Promise<MenuItemRecord> {
    await this.ensureInitialized();
    if (
      [...this.items.values()].some(
        (item) =>
          item.unit === input.unit &&
          normalizedName(item.name) === normalizedName(input.localizedName.uz),
      )
    ) {
      throw new MenuItemNameConflictError();
    }

    const timestamp = now();
    const item: MenuItemRecord = {
      id: randomUUID(),
      unit: input.unit,
      kind: input.kind,
      name: input.localizedName.uz.trim(),
      localizedName: cloneLocalizedText(input.localizedName),
      description: input.localizedDescription?.uz ?? null,
      localizedDescription:
        input.localizedDescription === null ? null : cloneLocalizedText(input.localizedDescription),
      price: input.price,
      currency: input.currency,
      durationMinutes: input.durationMinutes,
      imageMediaId: input.imageMediaId,
      active: true,
      available: input.available,
      quantityAllowed: input.quantityAllowed,
      sortOrder: input.sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.items.set(item.id, item);
    return cloneItem(item);
  }

  public async updateItem(
    id: string,
    input: UpdateMenuItemRecordInput,
  ): Promise<MenuItemRecord | null> {
    await this.ensureInitialized();
    const item = this.items.get(id);
    if (item === undefined) return null;

    const nextName = input.localizedName?.uz ?? item.name;
    if (
      [...this.items.values()].some(
        (candidate) =>
          candidate.id !== id &&
          candidate.unit === item.unit &&
          normalizedName(candidate.name) === normalizedName(nextName),
      )
    ) {
      throw new MenuItemNameConflictError();
    }

    if (input.localizedName !== undefined) {
      item.name = input.localizedName.uz.trim();
      item.localizedName = cloneLocalizedText(input.localizedName);
    }
    if (input.localizedDescription !== undefined) {
      item.description = input.localizedDescription?.uz ?? null;
      item.localizedDescription =
        input.localizedDescription === null ? null : cloneLocalizedText(input.localizedDescription);
    }
    if (input.price !== undefined) item.price = input.price;
    if (input.currency !== undefined) item.currency = input.currency;
    if (input.durationMinutes !== undefined) item.durationMinutes = input.durationMinutes;
    if (input.imageMediaId !== undefined) item.imageMediaId = input.imageMediaId;
    if (input.available !== undefined) item.available = input.available;
    if (input.quantityAllowed !== undefined) item.quantityAllowed = input.quantityAllowed;
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
    if (input.active !== undefined) item.active = input.active;
    item.updatedAt = now();
    return cloneItem(item);
  }

  public async setItemActive(id: string, active: boolean): Promise<MenuItemRecord | null> {
    return this.updateItem(id, { active });
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    for (const [unit, seedItems] of Object.entries(INITIAL_MENU_SEEDS) as [
      UnitCode,
      readonly MenuSeedItem[],
    ][]) {
      for (const [sortOrder, seedItem] of seedItems.entries()) {
        const timestamp = now();
        const item: MenuItemRecord = {
          id: randomUUID(),
          unit,
          kind: seedItem.kind,
          name: seedItem.name,
          localizedName: cloneLocalizedText(seedItem.localizedName),
          description: null,
          localizedDescription: null,
          price: null,
          currency: null,
          durationMinutes: null,
          imageMediaId: null,
          active: true,
          available: true,
          quantityAllowed: seedItem.kind === 'PRODUCT',
          sortOrder,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        this.items.set(item.id, item);
      }
    }
  }

  private compareItems(left: MenuItemRecord, right: MenuItemRecord): number {
    return (
      left.unit.localeCompare(right.unit) ||
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name)
    );
  }
}

function cloneLocalizedText(value: LocalizedText): LocalizedText {
  return { uz: value.uz, ru: value.ru, en: value.en };
}

interface MenuItemRow {
  id: string;
  unit: string;
  kind: string;
  name: string;
  name_uz: string | null;
  name_ru: string | null;
  name_en: string | null;
  description: string | null;
  description_uz: string | null;
  description_ru: string | null;
  description_en: string | null;
  price: number | string | null;
  currency: string | null;
  duration_minutes: number | null;
  image_media_id: string | null;
  active: boolean;
  available: boolean;
  quantity_allowed: boolean;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: number | string;
}

@Injectable()
export class PostgresMenuRepository implements MenuRepository, OnModuleDestroy {
  private readonly pool: Pool;

  private initialization?: Promise<void>;

  public constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
  }

  public async listItems(filter: MenuItemListFilter): Promise<MenuItemListResult> {
    await this.ensureInitialized();
    const result = await this.pool.query<MenuItemRow>(
      `
        SELECT
          id, unit, kind, name, name_uz, name_ru, name_en,
          description, description_uz, description_ru, description_en,
          price, currency, duration_minutes,
          image_media_id, active, available, quantity_allowed, sort_order,
          created_at, updated_at, COUNT(*) OVER() AS total_count
        FROM menu_items
        WHERE unit = ANY($1::text[])
          AND ($2::boolean OR active = true)
          AND ($3::boolean OR available = true)
        ORDER BY unit ASC, sort_order ASC, name ASC
        LIMIT $4 OFFSET $5
      `,
      [
        filter.units,
        filter.includeInactive,
        filter.availableOnly ?? false,
        filter.pageSize,
        (filter.page - 1) * filter.pageSize,
      ],
    );
    return {
      items: result.rows.map((row) => this.toItem(row)),
      total: result.rows[0] === undefined ? 0 : Number(result.rows[0].total_count ?? 0),
    };
  }

  public async findItemById(id: string): Promise<MenuItemRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<MenuItemRow>(
      `
        SELECT id, unit, kind, name, name_uz, name_ru, name_en,
               description, description_uz, description_ru, description_en,
               price, currency, duration_minutes,
               image_media_id, active, available, quantity_allowed, sort_order,
               created_at, updated_at
        FROM menu_items
        WHERE id::text = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] === undefined ? null : this.toItem(result.rows[0]);
  }

  public async createItem(input: CreateMenuItemRecordInput): Promise<MenuItemRecord> {
    await this.ensureInitialized();
    const result = await this.pool.query<MenuItemRow>(
      `
        INSERT INTO menu_items
          (id, unit, kind, name, name_uz, name_ru, name_en,
           description, description_uz, description_ru, description_en,
           price, currency, duration_minutes,
           image_media_id, active, available, quantity_allowed, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, $16, $17, $18)
        RETURNING id, unit, kind, name, name_uz, name_ru, name_en,
                  description, description_uz, description_ru, description_en,
                  price, currency, duration_minutes,
                  image_media_id, active, available, quantity_allowed, sort_order,
                  created_at, updated_at
      `,
      [
        randomUUID(),
        input.unit,
        input.kind,
        input.localizedName.uz.trim(),
        input.localizedName.uz.trim(),
        input.localizedName.ru.trim(),
        input.localizedName.en.trim(),
        input.localizedDescription?.uz ?? null,
        input.localizedDescription?.uz ?? null,
        input.localizedDescription?.ru ?? null,
        input.localizedDescription?.en ?? null,
        input.price,
        input.currency,
        input.durationMinutes,
        input.imageMediaId,
        input.available,
        input.quantityAllowed,
        input.sortOrder,
      ],
    );
    return this.toItem(result.rows[0] as MenuItemRow);
  }

  public async updateItem(
    id: string,
    input: UpdateMenuItemRecordInput,
  ): Promise<MenuItemRecord | null> {
    await this.ensureInitialized();
    const current = await this.findItemById(id);
    if (current === null) return null;
    const result = await this.pool.query<MenuItemRow>(
      `
        UPDATE menu_items
        SET name = $2,
            name_uz = $3,
            name_ru = $4,
            name_en = $5,
            description = $6,
            description_uz = $7,
            description_ru = $8,
            description_en = $9,
            price = $10,
            currency = $11,
            duration_minutes = $12,
            image_media_id = $13,
            active = $14,
            available = $15,
            quantity_allowed = $16,
            sort_order = $17,
            updated_at = now()
        WHERE id::text = $1
        RETURNING id, unit, kind, name, name_uz, name_ru, name_en,
                  description, description_uz, description_ru, description_en,
                  price, currency, duration_minutes,
                  image_media_id, active, available, quantity_allowed, sort_order,
                  created_at, updated_at
      `,
      [
        id,
        input.localizedName?.uz.trim() ?? current.name,
        input.localizedName?.uz.trim() ?? current.localizedName.uz,
        input.localizedName?.ru.trim() ?? current.localizedName.ru,
        input.localizedName?.en.trim() ?? current.localizedName.en,
        input.localizedDescription === undefined
          ? current.description
          : (input.localizedDescription?.uz ?? null),
        input.localizedDescription === undefined
          ? (current.localizedDescription?.uz ?? current.description)
          : (input.localizedDescription?.uz ?? null),
        input.localizedDescription === undefined
          ? (current.localizedDescription?.ru ?? current.description)
          : (input.localizedDescription?.ru ?? null),
        input.localizedDescription === undefined
          ? (current.localizedDescription?.en ?? current.description)
          : (input.localizedDescription?.en ?? null),
        input.price === undefined ? current.price : input.price,
        input.currency === undefined ? current.currency : input.currency,
        input.durationMinutes === undefined ? current.durationMinutes : input.durationMinutes,
        input.imageMediaId === undefined ? current.imageMediaId : input.imageMediaId,
        input.active ?? current.active,
        input.available ?? current.available,
        input.quantityAllowed ?? current.quantityAllowed,
        input.sortOrder ?? current.sortOrder,
      ],
    );
    return result.rows[0] === undefined ? null : this.toItem(result.rows[0]);
  }

  public async setItemActive(id: string, active: boolean): Promise<MenuItemRecord | null> {
    return this.updateItem(id, { active });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    await this.migrateLegacySchema();
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id uuid PRIMARY KEY,
        unit text NOT NULL,
        kind text NOT NULL,
        name text NOT NULL,
        name_uz text,
        name_ru text,
        name_en text,
        description text,
        description_uz text,
        description_ru text,
        description_en text,
        price numeric,
        currency text,
        duration_minutes integer,
        image_media_id uuid,
        active boolean NOT NULL DEFAULT true,
        available boolean NOT NULL DEFAULT true,
        quantity_allowed boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (unit, name)
      )
    `);
    await this.pool.query(`
      ALTER TABLE menu_items
        ADD COLUMN IF NOT EXISTS name_uz text,
        ADD COLUMN IF NOT EXISTS name_ru text,
        ADD COLUMN IF NOT EXISTS name_en text,
        ADD COLUMN IF NOT EXISTS description_uz text,
        ADD COLUMN IF NOT EXISTS description_ru text,
        ADD COLUMN IF NOT EXISTS description_en text
    `);
    await this.pool.query(`
      UPDATE menu_items
      SET name_uz = COALESCE(name_uz, name),
          name_ru = COALESCE(name_ru, name),
          name_en = COALESCE(name_en, name),
          description_uz = COALESCE(description_uz, description),
          description_ru = COALESCE(description_ru, description),
          description_en = COALESCE(description_en, description)
      WHERE name_uz IS NULL OR name_ru IS NULL OR name_en IS NULL
         OR (description IS NOT NULL AND
             (description_uz IS NULL OR description_ru IS NULL OR description_en IS NULL))
    `);
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS menu_items_unit_name_lower_idx ON menu_items (unit, lower(name))',
    );

    for (const [unit, seedItems] of Object.entries(INITIAL_MENU_SEEDS) as [
      UnitCode,
      readonly MenuSeedItem[],
    ][]) {
      for (const [sortOrder, seedItem] of seedItems.entries()) {
        await this.pool.query(
          `
            INSERT INTO menu_items
              (id, unit, kind, name, name_uz, name_ru, name_en,
               active, available, quantity_allowed, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, $8, $9)
            ON CONFLICT DO NOTHING
          `,
          [
            randomUUID(),
            unit,
            seedItem.kind,
            seedItem.name,
            seedItem.localizedName.uz,
            seedItem.localizedName.ru,
            seedItem.localizedName.en,
            seedItem.kind === 'PRODUCT',
            sortOrder,
          ],
        );
      }
    }
  }

  private async migrateLegacySchema(): Promise<void> {
    const legacyColumn = await this.pool.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'menu_items'
            AND column_name = 'category_id'
        ) AS exists
      `,
    );
    if (legacyColumn.rows[0]?.exists === true) {
      await this.pool.query('ALTER TABLE menu_items DROP COLUMN category_id CASCADE');
    }
    await this.pool.query('DROP TABLE IF EXISTS menu_categories CASCADE');
  }

  private toItem(row: MenuItemRow): MenuItemRecord {
    if (!isUnitCode(row.unit)) throw new Error(`Menu item ${row.id} contains an invalid unit`);
    if (!isMenuItemKind(row.kind)) throw new Error(`Menu item ${row.id} contains an invalid kind`);
    const price = row.price === null ? null : Number(row.price);
    if (price !== null && !Number.isFinite(price)) {
      throw new Error(`Menu item ${row.id} contains an invalid price`);
    }
    return {
      id: row.id,
      unit: row.unit,
      kind: row.kind,
      name: row.name,
      localizedName: {
        uz: row.name_uz ?? row.name,
        ru: row.name_ru ?? row.name,
        en: row.name_en ?? row.name,
      },
      description: row.description,
      localizedDescription:
        row.description_uz === null && row.description_ru === null && row.description_en === null
          ? null
          : {
              uz: row.description_uz ?? row.description ?? '',
              ru: row.description_ru ?? row.description ?? '',
              en: row.description_en ?? row.description ?? '',
            },
      price,
      currency: row.currency,
      durationMinutes: row.duration_minutes,
      imageMediaId: row.image_media_id,
      active: row.active,
      available: row.available,
      quantityAllowed: row.quantity_allowed,
      sortOrder: row.sort_order,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
