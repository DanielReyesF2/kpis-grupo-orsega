#!/usr/bin/env tsx
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

async function testWithPool() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('🔗 Usando Pool en lugar de neon()...\n');
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const result = await pool.query('SELECT COUNT(*)::int as count FROM kpis_dura');
    console.log(`✅ ÉXITO - kpis_dura existe y tiene ${result.rows[0].count} registros`);
    
    const result2 = await pool.query('SELECT COUNT(*)::int as count FROM kpis_orsega');
    console.log(`✅ ÉXITO - kpis_orsega existe y tiene ${result2.rows[0].count} registros`);
    
    pool.end();
  } catch (e: any) {
    console.log(`❌ ERROR: ${e.message}`);
    pool.end();
  }
}

testWithPool();

