"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.sql = sql;
// server/db-logistics.ts
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
    throw new Error('DATABASE_URL no está definida');
// Ensure SSL mode if not present
const dbUrl = connectionString.includes('sslmode=')
    ? connectionString
    : connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=require';
exports.pool = new pg_1.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    max: 8,
});
async function sql(q, params) {
    const c = await exports.pool.connect();
    try {
        return await c.query(q, params);
    }
    finally {
        c.release();
    }
}
