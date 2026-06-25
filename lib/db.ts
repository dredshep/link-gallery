import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import { config } from "./config";

function initDb(): Database {
  const dir = path.dirname(config.dbPath);
  mkdirSync(dir, { recursive: true });

  const db = new Database(config.dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      stored_filename TEXT NOT NULL UNIQUE,
      original_filename TEXT NOT NULL,
      display_name TEXT NOT NULL,
      ext TEXT NOT NULL,
      mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      sha256 TEXT,
      thumb_filename TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (asset_id, tag_id),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
    CREATE INDEX IF NOT EXISTS idx_assets_display_name ON assets(display_name);
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_assets_sha256 ON assets(sha256);
  `);

  // Migrations for columns added after initial schema
  const cols = db.query("PRAGMA table_info(assets)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("nsfw")) {
    db.exec("ALTER TABLE assets ADD COLUMN nsfw INTEGER NOT NULL DEFAULT 0");
  }

  const atCols = db.query("PRAGMA table_info(asset_tags)").all() as { name: string }[];
  const atColNames = new Set(atCols.map((c) => c.name));
  if (!atColNames.has("sort_order")) {
    db.exec("ALTER TABLE asset_tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    db.exec(`
      UPDATE asset_tags SET sort_order = (
        SELECT COUNT(*) FROM asset_tags at2
        JOIN tags t2 ON t2.id = at2.tag_id
        WHERE at2.asset_id = asset_tags.asset_id
        AND t2.name < (SELECT name FROM tags WHERE id = asset_tags.tag_id)
      )
    `);
  }

  return db;
}

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}

export interface AssetRow {
  id: string;
  stored_filename: string;
  original_filename: string;
  display_name: string;
  ext: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  sha256: string | null;
  thumb_filename: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  nsfw: number;
}

export interface TagRow {
  id: number;
  name: string;
  created_at: string;
}

export function getAssetBySha256(sha256: string): AssetRow | null {
  const db = getDb();
  return db.query("SELECT * FROM assets WHERE sha256 = ? AND deleted_at IS NULL").get(sha256) as AssetRow | null;
}

export function getAssetByFilename(storedFilename: string): AssetRow | null {
  const db = getDb();
  return db.query("SELECT * FROM assets WHERE stored_filename = ? AND deleted_at IS NULL").get(storedFilename) as AssetRow | null;
}

export function insertAsset(asset: Omit<AssetRow, "deleted_at">): void {
  const db = getDb();
  db.query(`
    INSERT INTO assets (id, stored_filename, original_filename, display_name, ext, mime, size_bytes, width, height, sha256, thumb_filename, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    asset.id,
    asset.stored_filename,
    asset.original_filename,
    asset.display_name,
    asset.ext,
    asset.mime,
    asset.size_bytes,
    asset.width,
    asset.height,
    asset.sha256,
    asset.thumb_filename,
    asset.created_at,
    asset.updated_at
  );
}

export function getOrCreateTag(name: string): number {
  const db = getDb();
  const existing = db.query("SELECT id FROM tags WHERE name = ?").get(name) as { id: number } | null;
  if (existing) return existing.id;

  const now = new Date().toISOString();
  db.query("INSERT INTO tags (name, created_at) VALUES (?, ?)").run(name, now);
  const inserted = db.query("SELECT id FROM tags WHERE name = ?").get(name) as { id: number };
  return inserted.id;
}

export function addTagsToAsset(assetId: string, tagIds: number[]): void {
  const db = getDb();
  const maxRow = db.query("SELECT MAX(sort_order) as max_order FROM asset_tags WHERE asset_id = ?").get(assetId) as { max_order: number | null } | null;
  let nextOrder = (maxRow?.max_order ?? -1) + 1;
  const stmt = db.query("INSERT OR IGNORE INTO asset_tags (asset_id, tag_id, sort_order) VALUES (?, ?, ?)");
  for (const tagId of tagIds) {
    stmt.run(assetId, tagId, nextOrder++);
  }
}

export function removeTagsFromAsset(assetId: string, tagIds: number[]): void {
  const db = getDb();
  const stmt = db.query("DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?");
  for (const tagId of tagIds) {
    stmt.run(assetId, tagId);
  }
}

export function setTagsForAsset(assetId: string, tagIds: number[]): void {
  const db = getDb();
  db.query("DELETE FROM asset_tags WHERE asset_id = ?").run(assetId);
  const stmt = db.query("INSERT OR IGNORE INTO asset_tags (asset_id, tag_id, sort_order) VALUES (?, ?, ?)");
  for (let i = 0; i < tagIds.length; i++) {
    stmt.run(assetId, tagIds[i], i);
  }
}

export function getTagsForAsset(assetId: string): string[] {
  const db = getDb();
  const rows = db.query(`
    SELECT t.name FROM tags t
    JOIN asset_tags at ON at.tag_id = t.id
    WHERE at.asset_id = ?
    ORDER BY at.sort_order, t.name
  `).all(assetId) as { name: string }[];
  return rows.map((r) => r.name);
}

export function getAllTagsWithCounts(): { name: string; count: number }[] {
  const db = getDb();
  return db.query(`
    SELECT t.name, COUNT(at.asset_id) as count
    FROM tags t
    LEFT JOIN asset_tags at ON at.tag_id = t.id
    LEFT JOIN assets a ON a.id = at.asset_id AND a.deleted_at IS NULL
    GROUP BY t.id
    HAVING count > 0
    ORDER BY t.name
  `).all() as { name: string; count: number }[];
}

export interface AssetQueryOptions {
  q?: string;
  tag?: string;
  cursor?: string;
  limit: number;
  sort: "newest" | "oldest" | "name";
  hideNsfw?: boolean;
}

const TAG_GROUP_EXPR = `COALESCE((SELECT t_g.name FROM asset_tags at_g JOIN tags t_g ON t_g.id = at_g.tag_id WHERE at_g.asset_id = a.id ORDER BY at_g.sort_order, t_g.name LIMIT 1), '~~~')`;

export function queryAssets(opts: AssetQueryOptions): { assets: AssetRow[]; nextCursor: string | null } {
  const db = getDb();
  const conditions: string[] = ["a.deleted_at IS NULL"];
  const params: (string | number)[] = [];

  if (opts.q) {
    conditions.push(`(
      a.display_name LIKE ? OR a.original_filename LIKE ? OR a.stored_filename LIKE ?
      OR EXISTS (
        SELECT 1 FROM asset_tags at3
        JOIN tags t3 ON t3.id = at3.tag_id
        WHERE at3.asset_id = a.id AND t3.name LIKE ?
      )
    )`);
    const like = `%${opts.q}%`;
    params.push(like, like, like, like);
  }

  if (opts.tag) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM asset_tags at2
        JOIN tags t2 ON t2.id = at2.tag_id
        WHERE at2.asset_id = a.id AND t2.name = ?
      )
    `);
    params.push(opts.tag);
  }

  if (opts.hideNsfw) {
    conditions.push("a.nsfw = 0");
  }

  let secondaryOrder: string;
  let cursorCondition: string;
  switch (opts.sort) {
    case "oldest":
      secondaryOrder = "a.created_at ASC, a.id ASC";
      cursorCondition = `(tag_group > ? OR (tag_group = ? AND (a.created_at > ? OR (a.created_at = ? AND a.id > ?))))`;
      break;
    case "name":
      secondaryOrder = "a.display_name ASC, a.id ASC";
      cursorCondition = `(tag_group > ? OR (tag_group = ? AND (a.display_name > ? OR (a.display_name = ? AND a.id > ?))))`;
      break;
    default:
      secondaryOrder = "a.created_at DESC, a.id DESC";
      cursorCondition = `(tag_group > ? OR (tag_group = ? AND (a.created_at < ? OR (a.created_at = ? AND a.id < ?))))`;
      break;
  }

  const orderBy = `tag_group ASC, ${secondaryOrder}`;

  if (opts.cursor) {
    const parts = opts.cursor.split("|");
    const cursorTag = parts[0];
    const cursorVal = parts[1];
    const cursorId = parts[2];
    conditions.push(cursorCondition);
    params.push(cursorTag, cursorTag, cursorVal, cursorVal, cursorId);
  }

  const where = conditions.join(" AND ");
  const sql = `SELECT a.*, ${TAG_GROUP_EXPR} as tag_group FROM assets a WHERE ${where} ORDER BY ${orderBy} LIMIT ?`;
  params.push(opts.limit + 1);

  const rows = db.query(sql).all(...params) as (AssetRow & { tag_group: string })[];

  let nextCursor: string | null = null;
  if (rows.length > opts.limit) {
    rows.pop();
    const last = rows[rows.length - 1];
    switch (opts.sort) {
      case "oldest":
        nextCursor = `${last.tag_group}|${last.created_at}|${last.id}`;
        break;
      case "name":
        nextCursor = `${last.tag_group}|${last.display_name}|${last.id}`;
        break;
      default:
        nextCursor = `${last.tag_group}|${last.created_at}|${last.id}`;
        break;
    }
  }

  return { assets: rows, nextCursor };
}

export function reorderTagsForAsset(assetId: string, tagNames: string[]): void {
  const db = getDb();
  const stmt = db.query(`
    UPDATE asset_tags SET sort_order = ?
    WHERE asset_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)
  `);
  for (let i = 0; i < tagNames.length; i++) {
    stmt.run(i, assetId, tagNames[i]);
  }
}

export function setNsfwForAssets(assetIds: string[], nsfw: boolean): void {
  const db = getDb();
  const stmt = db.query("UPDATE assets SET nsfw = ?, updated_at = ? WHERE id = ?");
  const now = new Date().toISOString();
  for (const id of assetIds) {
    stmt.run(nsfw ? 1 : 0, now, id);
  }
}
