"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsRouter = void 0;
const express_1 = require("express");
const db_1 = require("./db");
const node_crypto_1 = require("node:crypto");
exports.logisticsRouter = (0, express_1.Router)();
// LISTA envíos con filtros básicos
exports.logisticsRouter.get("/shipments", async (req, res) => {
    const { status, q, clientId, providerId } = req.query;
    const parts = [];
    const vals = [];
    let i = 1;
    if (status) {
        parts.push(`status = $${i++}`);
        vals.push(status);
    }
    if (clientId) {
        parts.push(`client_id = $${i++}`);
        vals.push(clientId);
    }
    if (providerId) {
        parts.push(`provider_id = $${i++}`);
        vals.push(providerId);
    }
    if (q) {
        parts.push(`(reference ILIKE $${i} OR origin ILIKE $${i} OR destination ILIKE $${i})`);
        vals.push(`%${q}%`);
        i++;
    }
    const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
    const r = await (0, db_1.sql)(`SELECT * FROM shipment ${where} ORDER BY created_at DESC LIMIT 200`, vals);
    res.json({ items: r.rows });
});
// CREAR envío
exports.logisticsRouter.post("/shipments", async (req, res) => {
    const { reference, clientId, origin, destination, incoterm, etd, eta, providerId } = req.body || {};
    if (!reference || !clientId || !origin || !destination) {
        return res.status(400).json({ error: "reference, clientId, origin, destination son obligatorios" });
    }
    const id = (0, node_crypto_1.randomUUID)();
    await (0, db_1.sql)(`INSERT INTO shipment (id,reference,client_id,provider_id,origin,destination,incoterm,status,etd,eta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente',$8,$9)`, [id, reference, clientId, providerId ?? null, origin, destination, incoterm ?? null, etd ?? null, eta ?? null]);
    res.status(201).json({ id, status: "pendiente" });
});
// CREAR evento (ej. pickup/delivery)
exports.logisticsRouter.post("/shipments/:id/events", async (req, res) => {
    const { id } = req.params;
    const { type, at, lat, lng, notes } = req.body || {};
    if (!type || !at)
        return res.status(400).json({ error: "type y at requeridos" });
    const eventId = (0, node_crypto_1.randomUUID)();
    await (0, db_1.sql)(`INSERT INTO shipment_event (id,shipment_id,type,at,lat,lng,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`, [eventId, id, type, at, lat ?? null, lng ?? null, notes ?? null]);
    // Cambios de estado automáticos mínimos
    if (type === "pickup") {
        await (0, db_1.sql)(`UPDATE shipment SET status='en_camino', updated_at=NOW() WHERE id=$1`, [id]);
    }
    if (type === "delivery") {
        await (0, db_1.sql)(`UPDATE shipment SET status='entregado', updated_at=NOW() WHERE id=$1`, [id]);
    }
    res.status(201).json({ id: eventId });
});
