/**
 * localDb.ts
 * ==========
 * Local SQLite database via tauri-plugin-sql.
 * Mirrors the server's schema for the tables the branch owns or caches.
 *
 * Install:  cargo add tauri-plugin-sql --features sqlite
 *           pnpm add @tauri-apps/plugin-sql
 *
 * Tauri v2 src-tauri/lib.rs — register the plugin:
 *   .plugin(tauri_plugin_sql::Builder::new()
 *     .add_migrations("sqlite:laso.db", migrations)
 *     .build())
 */

import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:laso.db";
let _db: Database | null = null;

/** Get (or lazily open) the local database connection. */
export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load(DB_PATH);
  await runMigrations(_db);
  return _db;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA MIGRATIONS
// Each migration runs exactly once, tracked by user_version pragma.
// ─────────────────────────────────────────────────────────────────────────────

async function runMigrations(db: Database): Promise<void> {
  // SQLite user_version is a simple integer we use as schema version
  const [{ user_version }] = await db.select<{ user_version: number }[]>(
    "PRAGMA user_version"
  );

  if (user_version < 1) await migrate_v1(db);
  if (user_version < 2) await migrate_v2(db);
}

async function migrate_v1(db: Database): Promise<void> {
  // ── Org-level tables (pull-only, never written locally except reads) ──

  await db.execute(`
    CREATE TABLE IF NOT EXISTS drugs (
      id                TEXT PRIMARY KEY,
      organization_id   TEXT NOT NULL,
      name              TEXT NOT NULL,
      generic_name      TEXT,
      brand_name        TEXT,
      sku               TEXT,
      barcode           TEXT,
      category_id       TEXT,
      drug_type         TEXT NOT NULL DEFAULT 'otc',
      dosage_form       TEXT,
      strength          TEXT,
      manufacturer      TEXT,
      supplier          TEXT,
      requires_prescription INTEGER NOT NULL DEFAULT 0,
      unit_price        REAL NOT NULL,
      cost_price        REAL,
      tax_rate          REAL NOT NULL DEFAULT 0,
      reorder_level     INTEGER NOT NULL DEFAULT 10,
      reorder_quantity  INTEGER NOT NULL DEFAULT 50,
      unit_of_measure   TEXT NOT NULL DEFAULT 'unit',
      description       TEXT,
      usage_instructions TEXT,
      side_effects      TEXT,
      storage_conditions TEXT,
      is_active         INTEGER NOT NULL DEFAULT 1,
      is_deleted        INTEGER NOT NULL DEFAULT 0,
      sync_status       TEXT NOT NULL DEFAULT 'synced',
      sync_version      INTEGER NOT NULL DEFAULT 1,
      synced_at         TEXT,
      updated_at        TEXT NOT NULL,
      created_at        TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS drug_categories (
      id              TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      parent_id       TEXT,
      path            TEXT,
      level           INTEGER NOT NULL DEFAULT 0,
      is_deleted      INTEGER NOT NULL DEFAULT 0,
      sync_status     TEXT NOT NULL DEFAULT 'synced',
      sync_version    INTEGER NOT NULL DEFAULT 1,
      synced_at       TEXT,
      updated_at      TEXT NOT NULL,
      created_at      TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS price_contracts (
      id                        TEXT PRIMARY KEY,
      organization_id           TEXT NOT NULL,
      contract_code             TEXT NOT NULL,
      contract_name             TEXT NOT NULL,
      contract_type             TEXT NOT NULL,
      is_default_contract       INTEGER NOT NULL DEFAULT 0,
      discount_type             TEXT NOT NULL DEFAULT 'percentage',
      discount_percentage       REAL NOT NULL DEFAULT 0,
      applies_to_prescription_only INTEGER NOT NULL DEFAULT 0,
      applies_to_otc            INTEGER NOT NULL DEFAULT 1,
      applies_to_all_branches   INTEGER NOT NULL DEFAULT 1,
      applicable_branch_ids     TEXT NOT NULL DEFAULT '[]',
      effective_from            TEXT NOT NULL,
      effective_to              TEXT,
      status                    TEXT NOT NULL DEFAULT 'active',
      is_active                 INTEGER NOT NULL DEFAULT 1,
      copay_amount              REAL,
      copay_percentage          REAL,
      is_deleted                INTEGER NOT NULL DEFAULT 0,
      sync_status               TEXT NOT NULL DEFAULT 'synced',
      sync_version              INTEGER NOT NULL DEFAULT 1,
      synced_at                 TEXT,
      updated_at                TEXT NOT NULL,
      created_at                TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id                      TEXT PRIMARY KEY,
      organization_id         TEXT NOT NULL,
      customer_type           TEXT NOT NULL DEFAULT 'walk_in',
      first_name              TEXT,
      last_name               TEXT,
      phone                   TEXT,
      email                   TEXT,
      date_of_birth           TEXT,
      loyalty_points          INTEGER NOT NULL DEFAULT 0,
      loyalty_tier            TEXT NOT NULL DEFAULT 'bronze',
      insurance_provider_id   TEXT,
      insurance_member_id     TEXT,
      preferred_contract_id   TEXT,
      is_active               INTEGER NOT NULL DEFAULT 1,
      is_deleted              INTEGER NOT NULL DEFAULT 0,
      -- Pending = created offline, not yet pushed
      sync_status             TEXT NOT NULL DEFAULT 'synced',
      sync_version            INTEGER NOT NULL DEFAULT 1,
      synced_at               TEXT,
      updated_at              TEXT NOT NULL,
      created_at              TEXT NOT NULL
    )
  `);

  // ── Branch-level tables (read/write locally, pushed to server) ────────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS branch_inventory (
      id                TEXT PRIMARY KEY,
      branch_id         TEXT NOT NULL,
      drug_id           TEXT NOT NULL,
      quantity          INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      location          TEXT,
      sync_status       TEXT NOT NULL DEFAULT 'synced',
      sync_version      INTEGER NOT NULL DEFAULT 1,
      synced_at         TEXT,
      updated_at        TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      UNIQUE(branch_id, drug_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS drug_batches (
      id                  TEXT PRIMARY KEY,
      branch_id           TEXT NOT NULL,
      drug_id             TEXT NOT NULL,
      batch_number        TEXT NOT NULL,
      quantity            INTEGER NOT NULL,
      remaining_quantity  INTEGER NOT NULL,
      manufacturing_date  TEXT,
      expiry_date         TEXT NOT NULL,
      cost_price          REAL,
      selling_price       REAL,
      supplier            TEXT,
      purchase_order_id   TEXT,
      sync_status         TEXT NOT NULL DEFAULT 'synced',
      sync_version        INTEGER NOT NULL DEFAULT 1,
      synced_at           TEXT,
      updated_at          TEXT NOT NULL,
      created_at          TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id                            TEXT PRIMARY KEY,
      organization_id               TEXT NOT NULL,
      branch_id                     TEXT NOT NULL,
      sale_number                   TEXT NOT NULL,
      customer_id                   TEXT,
      customer_name                 TEXT,
      subtotal                      REAL NOT NULL,
      contract_discount_amount      REAL NOT NULL DEFAULT 0,
      additional_discount_amount    REAL NOT NULL DEFAULT 0,
      total_discount_amount         REAL NOT NULL DEFAULT 0,
      tax_amount                    REAL NOT NULL DEFAULT 0,
      total_amount                  REAL NOT NULL,
      price_contract_id             TEXT,
      contract_name                 TEXT,
      contract_type                 TEXT,
      contract_discount_percentage  REAL,
      payment_method                TEXT NOT NULL DEFAULT 'cash',
      payment_status                TEXT NOT NULL DEFAULT 'completed',
      amount_paid                   REAL,
      change_amount                 REAL NOT NULL DEFAULT 0,
      payment_reference             TEXT,
      prescription_id               TEXT,
      notes                         TEXT,
      cashier_id                    TEXT NOT NULL,
      cashier_name                  TEXT,
      pharmacist_id                 TEXT,
      pharmacist_name               TEXT,
      manager_approval_user_id      TEXT,
      insurance_claim_number        TEXT,
      insurance_preauth_number      TEXT,
      patient_copay_amount          REAL,
      insurance_covered_amount      REAL,
      insurance_verified            INTEGER NOT NULL DEFAULT 0,
      insurance_verified_at         TEXT,
      insurance_verified_by         TEXT,
      status                        TEXT NOT NULL DEFAULT 'completed',
      cancelled_at                  TEXT,
      cancelled_by                  TEXT,
      cancellation_reason           TEXT,
      refund_amount                 REAL,
      refunded_at                   TEXT,
      refunded_by                   TEXT,
      sync_status                   TEXT NOT NULL DEFAULT 'pending',
      sync_version                  INTEGER NOT NULL DEFAULT 1,
      synced_at                     TEXT,
      updated_at                    TEXT NOT NULL,
      created_at                    TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id                    TEXT PRIMARY KEY,
      organization_id       TEXT NOT NULL,
      branch_id             TEXT NOT NULL,
      po_number             TEXT NOT NULL,
      supplier_id           TEXT NOT NULL,
      subtotal              REAL NOT NULL DEFAULT 0,
      tax_amount            REAL NOT NULL DEFAULT 0,
      shipping_cost         REAL NOT NULL DEFAULT 0,
      total_amount          REAL NOT NULL DEFAULT 0,
      status                TEXT NOT NULL DEFAULT 'draft',
      ordered_by            TEXT NOT NULL,
      approved_by           TEXT,
      approved_at           TEXT,
      expected_delivery_date TEXT,
      received_date         TEXT,
      notes                 TEXT,
      items_json            TEXT NOT NULL DEFAULT '[]',
      sync_status           TEXT NOT NULL DEFAULT 'pending',
      sync_version          INTEGER NOT NULL DEFAULT 1,
      synced_at             TEXT,
      updated_at            TEXT NOT NULL,
      created_at            TEXT NOT NULL
    )
  `);

  // ── Sync queue — tracks pending push operations ───────────────────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name      TEXT NOT NULL,
      record_id       TEXT NOT NULL,
      operation       TEXT NOT NULL DEFAULT 'create',
      sync_version    INTEGER NOT NULL DEFAULT 1,
      payload_json    TEXT NOT NULL,
      created_offline_at TEXT NOT NULL,
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      error           TEXT,
      UNIQUE(table_name, record_id)
    )
  `);

  // ── Sync metadata ─────────────────────────────────────────────────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // ── Indexes ───────────────────────────────────────────────────────

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_drugs_org      ON drugs(organization_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_drugs_active   ON drugs(is_active)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_drugs_type     ON drugs(drug_type)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_inv_branch     ON branch_inventory(branch_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_batch_branch   ON drug_batches(branch_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_batch_expiry   ON drug_batches(expiry_date)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_branch   ON sales(branch_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_status   ON sales(sync_status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_queue_table    ON sync_queue(table_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_customer_phone ON customers(phone)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_customer_email ON customers(email)`);

  await db.execute("PRAGMA user_version = 1");
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION V2 — expand sales table to match server SaleResponse
// Runs once on existing installs that have the old narrower schema.
// ─────────────────────────────────────────────────────────────────────────────

async function migrate_v2(db: Database): Promise<void> {
  // SQLite only supports ADD COLUMN — we add every missing column individually.
  // If a column already exists (fresh install that ran migrate_v1 with the new
  // schema) SQLite will error; we ignore those errors so the migration is safe
  // to run on both old and new installs.
  const addColumn = async (col: string) => {
    try { await db.execute(`ALTER TABLE sales ADD COLUMN ${col}`); }
    catch { /* already exists — safe to ignore */ }
  };

  await addColumn("contract_discount_amount      REAL NOT NULL DEFAULT 0");
  await addColumn("additional_discount_amount    REAL NOT NULL DEFAULT 0");
  await addColumn("total_discount_amount         REAL NOT NULL DEFAULT 0");
  await addColumn("contract_name                 TEXT");
  await addColumn("contract_type                 TEXT");
  await addColumn("contract_discount_percentage  REAL");
  await addColumn("payment_reference             TEXT");
  await addColumn("prescription_id               TEXT");
  await addColumn("cashier_name                  TEXT");
  await addColumn("pharmacist_id                 TEXT");
  await addColumn("pharmacist_name               TEXT");
  await addColumn("manager_approval_user_id      TEXT");
  await addColumn("insurance_claim_number        TEXT");
  await addColumn("insurance_preauth_number      TEXT");
  await addColumn("patient_copay_amount          REAL");
  await addColumn("insurance_covered_amount      REAL");
  await addColumn("insurance_verified_at         TEXT");
  await addColumn("insurance_verified_by         TEXT");
  await addColumn("cancelled_at                  TEXT");
  await addColumn("cancelled_by                  TEXT");
  await addColumn("cancellation_reason           TEXT");
  await addColumn("refund_amount                 REAL");
  await addColumn("refunded_at                   TEXT");
  await addColumn("refunded_by                   TEXT");

  // items_json is no longer used — sale items come via SaleWithDetails endpoint,
  // not through the sync pull. Drop the NOT NULL constraint by recreating would
  // require a full table rebuild; instead just leave any existing column in place
  // and stop writing to it. The upsert column list no longer includes it.

  await db.execute("PRAGMA user_version = 2");
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC METADATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getLastSyncAt(table?: string): Promise<string | null> {
  const db = await getDb();
  const key = table ? `last_sync_at:${table}` : "last_sync_at";
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM sync_meta WHERE key = $1",
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setLastSyncAt(timestamp: string, table?: string): Promise<void> {
  const db = await getDb();
  const key = table ? `last_sync_at:${table}` : "last_sync_at";
  await db.execute(
    "INSERT INTO sync_meta(key, value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
    [key, timestamp]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC QUEUE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface QueuedRecord {
  id: number;
  table_name: string;
  record_id: string;
  operation: "create" | "update" | "delete";
  sync_version: number;
  payload_json: string;
  created_offline_at: string;
  attempts: number;
  error: string | null;
}

/** Add or replace a record in the push queue. */
export async function enqueue(
  tableName: string,
  recordId: string,
  operation: "create" | "update" | "delete",
  syncVersion: number,
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO sync_queue
       (table_name, record_id, operation, sync_version, payload_json, created_offline_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(table_name, record_id) DO UPDATE SET
       operation    = excluded.operation,
       sync_version = excluded.sync_version,
       payload_json = excluded.payload_json,
       attempts     = 0,
       error        = NULL`,
    [tableName, recordId, operation, syncVersion, JSON.stringify(payload), new Date().toISOString()]
  );
}

/** Get all records pending push, oldest first. */
export async function getPendingQueue(limit = 500): Promise<QueuedRecord[]> {
  const db = await getDb();
  return db.select<QueuedRecord[]>(
    "SELECT * FROM sync_queue ORDER BY id ASC LIMIT $1",
    [limit]
  );
}

/** Mark a queued record as successfully synced (remove it). */
export async function dequeue(tableName: string, recordId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM sync_queue WHERE table_name = $1 AND record_id = $2",
    [tableName, recordId]
  );
}

/** Record a failed push attempt. */
export async function markQueueError(
  tableName: string,
  recordId: string,
  error: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE sync_queue
     SET attempts = attempts + 1, last_attempt_at = $1, error = $2
     WHERE table_name = $3 AND record_id = $4`,
    [new Date().toISOString(), error, tableName, recordId]
  );
}

/** Total number of records waiting to be pushed. */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM sync_queue"
  );
  return row?.count ?? 0;
}