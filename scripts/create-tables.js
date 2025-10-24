// Script para crear las tablas en la base de datos de forma programática
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Configurar WebSocket para la conexión a Neon
neonConfig.webSocketConstructor = ws;

// Configurar la conexión a la base de datos
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear tablas manualmente mediante SQL directo
async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Creando tablas en la base de datos...');
    
    // Crear tabla de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        company_id INTEGER,
        last_login TIMESTAMP
      );
    `);
    console.log('- Tabla users creada');
    
    // Crear tabla de compañías
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        sector TEXT,
        logo TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- Tabla companies creada');
    
    // Crear tabla de áreas
    await client.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        company_id INTEGER NOT NULL
      );
    `);
    console.log('- Tabla areas creada');
    
    // Crear tabla de KPIs
    await client.query(`
      CREATE TABLE IF NOT EXISTS kpis (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        area_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        unit TEXT NOT NULL,
        target TEXT NOT NULL,
        frequency TEXT NOT NULL,
        calculation_method TEXT,
        responsible TEXT,
        inverted_metric BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('- Tabla kpis creada');
    
    // Crear tabla de valores de KPI
    await client.query(`
      CREATE TABLE IF NOT EXISTS kpi_values (
        id SERIAL PRIMARY KEY,
        kpi_id INTEGER NOT NULL,
        value TEXT NOT NULL,
        date TIMESTAMP DEFAULT NOW(),
        period TEXT NOT NULL,
        compliance_percentage TEXT,
        status TEXT,
        comments TEXT
      );
    `);
    console.log('- Tabla kpi_values creada');
    
    // Crear tabla de planes de acción
    await client.query(`
      CREATE TABLE IF NOT EXISTS action_plans (
        id SERIAL PRIMARY KEY,
        kpi_id INTEGER NOT NULL,
        problem_description TEXT NOT NULL,
        corrective_actions TEXT NOT NULL,
        responsible TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status TEXT NOT NULL,
        results TEXT
      );
    `);
    console.log('- Tabla action_plans creada');
    
    // Crear enum para estado de envío si no existe
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
          CREATE TYPE shipment_status AS ENUM (
            'pending', 'in_transit', 'delayed', 'delivered', 'cancelled'
          );
        END IF;
      END
      $$;
    `);
    
    // Crear tabla de envíos
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id SERIAL PRIMARY KEY,
        tracking_code TEXT NOT NULL UNIQUE,
        company_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        customer_phone TEXT,
        destination TEXT NOT NULL,
        origin TEXT NOT NULL,
        product TEXT NOT NULL,
        quantity TEXT NOT NULL,
        unit TEXT NOT NULL,
        departure_date TIMESTAMP,
        estimated_delivery_date TIMESTAMP,
        actual_delivery_date TIMESTAMP,
        status shipment_status NOT NULL DEFAULT 'pending',
        carrier TEXT,
        vehicle_info TEXT,
        vehicle_type TEXT,
        fuel_type TEXT,
        distance TEXT,
        carbon_footprint TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        comments TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- Tabla shipments creada');
    
    // Crear tabla de actualizaciones de envío
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipment_updates (
        id SERIAL PRIMARY KEY,
        shipment_id INTEGER NOT NULL,
        status shipment_status NOT NULL,
        location TEXT,
        comments TEXT,
        updated_by INTEGER,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- Tabla shipment_updates creada');
    
    // Crear tabla de sesiones para express-session
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    console.log('- Tabla session creada');
    
    console.log('Todas las tablas han sido creadas con éxito!');
  } catch (error) {
    console.error('Error al crear las tablas:', error);
  } finally {
    client.release();
  }
}

createTables()
  .then(() => {
    console.log('Proceso de creación de tablas completado');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error en el proceso principal:', err);
    process.exit(1);
  });