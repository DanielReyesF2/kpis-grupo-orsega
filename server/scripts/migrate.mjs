import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sqlDir = path.resolve(__dirname, '../sql')

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')

const dbUrl = connectionString.includes('sslmode=') 
  ? connectionString 
  : connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=require'

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const f of files) {
      const sql = fs.readFileSync(path.join(sqlDir, f), 'utf8')
      console.log('→', f)
      await client.query(sql)
    }
    await client.query('COMMIT')
    console.log('OK: migraciones aplicadas')
  } catch (e) {
    await client.query('ROLLBACK'); console.error('ERROR:', e.message); process.exit(1)
  } finally {
    client.release(); await pool.end()
  }
}
run()