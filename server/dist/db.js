"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.sql = sql;
// server/db.ts
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL no está definida");
}
exports.pool = new pg_1.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    max: 8,
});
async function sql(q, params) {
    const c = await exports.pool.connect();
    try {
        const r = await c.query(q, params);
        return r;
    }
    finally {
        c.release();
    }
}
