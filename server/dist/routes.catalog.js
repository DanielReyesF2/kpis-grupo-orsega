"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const db_1 = require("./db");
const node_crypto_1 = require("node:crypto");
exports.catalogRouter = (0, express_1.Router)();
// CLIENTES
exports.catalogRouter.get("/clients", async (req, res) => {
    const q = req.query.q?.trim();
    const params = q ? [`%${q}%`] : [];
    const r = q
        ? await (0, db_1.sql)("SELECT * FROM client WHERE is_active = TRUE AND (name ILIKE $1 OR email ILIKE $1) ORDER BY name LIMIT 200", params)
        : await (0, db_1.sql)("SELECT * FROM client WHERE is_active = TRUE ORDER BY name LIMIT 200");
    res.json({ items: r.rows });
});
exports.catalogRouter.post("/clients", async (req, res) => {
    const { name, rfc, email, phone, billingAddr, shippingAddr } = req.body || {};
    if (!name)
        return res.status(400).json({ error: "name requerido" });
    const id = (0, node_crypto_1.randomUUID)();
    await (0, db_1.sql)(`INSERT INTO client (id,name,rfc,email,phone,billing_addr,shipping_addr,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)`, [id, name, rfc ?? null, email ?? null, phone ?? null, billingAddr ?? null, shippingAddr ?? null]);
    res.status(201).json({ id });
});
// PROVEEDORES
exports.catalogRouter.get("/providers", async (req, res) => {
    const q = req.query.q?.trim();
    const params = q ? [`%${q}%`] : [];
    const r = q
        ? await (0, db_1.sql)("SELECT * FROM provider WHERE is_active = TRUE AND (name ILIKE $1 OR email ILIKE $1) ORDER BY name LIMIT 200", params)
        : await (0, db_1.sql)("SELECT * FROM provider WHERE is_active = TRUE ORDER BY name LIMIT 200");
    res.json({ items: r.rows });
});
exports.catalogRouter.post("/providers", async (req, res) => {
    const { name, email, phone, contactName, notes, rating } = req.body || {};
    if (!name)
        return res.status(400).json({ error: "name requerido" });
    const id = (0, node_crypto_1.randomUUID)();
    await (0, db_1.sql)(`INSERT INTO provider (id,name,email,phone,contact_name,notes,rating,is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)`, [id, name, email ?? null, phone ?? null, contactName ?? null, notes ?? null, rating ?? null]);
    res.status(201).json({ id });
});
