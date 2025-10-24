import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL no está definida')

const dbUrl = connectionString.includes('sslmode=') 
  ? connectionString 
  : connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=require'

const pool = new Pool({ 
  connectionString: dbUrl, 
  ssl: { rejectUnauthorized: false } 
})

async function run() {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    
    const c1 = randomUUID(), c2 = randomUUID()
    const p1 = randomUUID(), p2 = randomUUID()
    const sh = randomUUID()
    
    await c.query(`INSERT INTO client (id,name,email,is_active) VALUES ($1,'DIGO','ops@digo.mx',TRUE) ON CONFLICT DO NOTHING`, [c1])
    await c.query(`INSERT INTO client (id,name,email,is_active) VALUES ($1,'ACME','logistics@acme.com',TRUE) ON CONFLICT DO NOTHING`, [c2])
    
    await c.query(`INSERT INTO provider (id,name,email,is_active) VALUES ($1,'TransLog','ops@translog.mx',TRUE) ON CONFLICT DO NOTHING`, [p1])
    await c.query(`INSERT INTO provider (id,name,email,is_active) VALUES ($1,'ExpressMX','coord@expressmx.com',TRUE) ON CONFLICT DO NOTHING`, [p2])
    
    await c.query(`INSERT INTO provider_channel (id,provider_id,type,value,is_default) VALUES ($1,$2,'email','ops@translog.mx',TRUE) ON CONFLICT DO NOTHING`, [randomUUID(), p1])
    
    await c.query(`INSERT INTO shipment (id,reference,client_id,origin,destination,status) VALUES ($1,'REF-TEST-001',$2,'Monterrey','CDMX','pendiente') ON CONFLICT DO NOTHING`, [sh, c1])
    
    await c.query('COMMIT')
    console.log('Seeds OK')
  } catch(e) { 
    await c.query('ROLLBACK') 
    throw e 
  } finally { 
    c.release()
    await pool.end() 
  }
}

run().catch(e => { 
  console.error(e) 
  process.exit(1) 
})