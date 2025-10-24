// server/db-logistics.ts
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')

// Ensure SSL mode if not present
const dbUrl = connectionString.includes('sslmode=') 
  ? connectionString 
  : connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=require'

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  max: 8,
})

export async function sql<T extends Record<string, any> = any>(q: string, params?: any[]) {
  const c = await pool.connect()
  try { 
    return await c.query<T>(q, params) 
  } finally { 
    c.release() 
  }
}