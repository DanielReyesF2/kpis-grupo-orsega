import { pool } from "./db";

const ALTER_TABLE_QUERIES = [
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id);`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS hydral_file_url TEXT;`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS hydral_file_name TEXT;`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS approved_by INTEGER;`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS payment_scheduled_at TIMESTAMP;`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;`,
  `ALTER TABLE scheduled_payments
   ADD COLUMN IF NOT EXISTS voucher_id INTEGER REFERENCES payment_vouchers(id);`,
  `ALTER TABLE scheduled_payments
   ALTER COLUMN status SET DEFAULT 'idrall_imported';`,
];

const CREATE_INDEX_QUERIES = [
  `CREATE INDEX IF NOT EXISTS idx_scheduled_payments_supplier_id ON scheduled_payments(supplier_id);`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_payments_source_type ON scheduled_payments(source_type);`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_payments_voucher_id ON scheduled_payments(voucher_id);`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due_date ON scheduled_payments(due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_payments_payment_date ON scheduled_payments(payment_date);`,
];

export async function ensureTreasurySchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const query of ALTER_TABLE_QUERIES) {
      await client.query(query);
    }

    for (const query of CREATE_INDEX_QUERIES) {
      await client.query(query);
    }

    await client.query("COMMIT");
    console.log("✅ Treasury schema verified (scheduled_payments columns/indexes ok)");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to ensure treasury schema:", error);
    throw error;
  } finally {
    client.release();
  }
}





