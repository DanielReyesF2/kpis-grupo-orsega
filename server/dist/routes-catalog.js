"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const db_logistics_js_1 = require("./db-logistics.js");
const logistics_schema_js_1 = require("../shared/logistics-schema.js");
exports.catalogRouter = (0, express_1.Router)();
// CLIENTS
exports.catalogRouter.get('/clients', async (req, res) => {
    try {
        const result = await (0, db_logistics_js_1.sql)(`
      SELECT id, name, rfc, email, phone, billing_addr, shipping_addr, is_active, created_at, updated_at 
      FROM client 
      WHERE is_active = TRUE 
      ORDER BY name
    `);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});
exports.catalogRouter.post('/clients', async (req, res) => {
    try {
        const validated = logistics_schema_js_1.createClientSchema.parse(req.body);
        const id = (0, node_crypto_1.randomUUID)();
        const result = await (0, db_logistics_js_1.sql)(`
      INSERT INTO client (id, name, rfc, email, phone, billing_addr, shipping_addr, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.name, validated.rfc, validated.email, validated.phone, validated.billingAddr, validated.shippingAddr, validated.isActive]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating client:', error);
        res.status(400).json({ error: 'Failed to create client' });
    }
});
exports.catalogRouter.patch('/clients/:id', async (req, res) => {
    try {
        const validated = logistics_schema_js_1.updateClientSchema.parse({ ...req.body, id: req.params.id });
        const fields = [];
        const values = [];
        let index = 1;
        Object.entries(validated).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                const dbField = key === 'billingAddr' ? 'billing_addr' :
                    key === 'shippingAddr' ? 'shipping_addr' :
                        key === 'isActive' ? 'is_active' : key;
                fields.push(`${dbField} = $${index}`);
                values.push(value);
                index++;
            }
        });
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(req.params.id);
        const result = await (0, db_logistics_js_1.sql)(`
      UPDATE client SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating client:', error);
        res.status(400).json({ error: 'Failed to update client' });
    }
});
// PROVIDERS
exports.catalogRouter.get('/providers', async (req, res) => {
    try {
        const result = await (0, db_logistics_js_1.sql)(`
      SELECT p.*, 
        array_agg(
          json_build_object(
            'id', pc.id,
            'type', pc.type,
            'value', pc.value,
            'isDefault', pc.is_default
          )
        ) FILTER (WHERE pc.id IS NOT NULL) as channels
      FROM provider p
      LEFT JOIN provider_channel pc ON p.id = pc.provider_id
      WHERE p.is_active = TRUE
      GROUP BY p.id
      ORDER BY p.name
    `);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching providers:', error);
        res.status(500).json({ error: 'Failed to fetch providers' });
    }
});
exports.catalogRouter.post('/providers', async (req, res) => {
    try {
        const validated = logistics_schema_js_1.createProviderSchema.parse(req.body);
        const id = (0, node_crypto_1.randomUUID)();
        const result = await (0, db_logistics_js_1.sql)(`
      INSERT INTO provider (id, name, email, phone, contact_name, notes, rating, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.name, validated.email, validated.phone, validated.contactName, validated.notes, validated.rating, validated.isActive]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating provider:', error);
        res.status(400).json({ error: 'Failed to create provider' });
    }
});
exports.catalogRouter.patch('/providers/:id', async (req, res) => {
    try {
        const validated = logistics_schema_js_1.updateProviderSchema.parse({ ...req.body, id: req.params.id });
        const fields = [];
        const values = [];
        let index = 1;
        Object.entries(validated).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                const dbField = key === 'contactName' ? 'contact_name' :
                    key === 'isActive' ? 'is_active' : key;
                fields.push(`${dbField} = $${index}`);
                values.push(value);
                index++;
            }
        });
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(req.params.id);
        const result = await (0, db_logistics_js_1.sql)(`
      UPDATE provider SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating provider:', error);
        res.status(400).json({ error: 'Failed to update provider' });
    }
});
// PROVIDER CHANNELS
exports.catalogRouter.post('/providers/:id/channels', async (req, res) => {
    try {
        const validated = logistics_schema_js_1.createProviderChannelSchema.parse({ ...req.body, providerId: req.params.id });
        const id = (0, node_crypto_1.randomUUID)();
        const result = await (0, db_logistics_js_1.sql)(`
      INSERT INTO provider_channel (id, provider_id, type, value, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, validated.providerId, validated.type, validated.value, validated.isDefault]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating provider channel:', error);
        res.status(400).json({ error: 'Failed to create provider channel' });
    }
});
