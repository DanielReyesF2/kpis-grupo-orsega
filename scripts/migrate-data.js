// Este script migra los datos de la memoria a la base de datos
// Para ejecutarlo, asegúrate de que la base de datos esté configurada correctamente
// y que las tablas estén creadas (ejecuta scripts/init-db.js primero).

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Necesitamos crear una versión temporal de storage.ts para usar MemStorage
// ya que el storage.ts actual está usando DatabaseStorage
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar clases temporalmente
import { MemStorage } from '../server/storage';
import { DatabaseStorage } from '../server/DatabaseStorage';

async function migrateData() {
  console.log('Iniciando migración de datos de memoria a base de datos...');
  
  // Crear instancias de ambos almacenamientos
  const memStorage = new MemStorage();
  const dbStorage = new DatabaseStorage();
  
  try {
    // 1. Migrar compañías
    console.log('Migrando compañías...');
    const companies = await memStorage.getCompanies();
    for (const company of companies) {
      const { id, ...companyData } = company;
      await dbStorage.createCompany(companyData);
      console.log(`  - Compañía migrada: ${company.name}`);
    }
    
    // 2. Migrar áreas
    console.log('Migrando áreas...');
    const areas = await memStorage.getAreas();
    for (const area of areas) {
      const { id, ...areaData } = area;
      await dbStorage.createArea(areaData);
      console.log(`  - Área migrada: ${area.name}`);
    }
    
    // 3. Migrar KPIs
    console.log('Migrando KPIs...');
    const kpis = await memStorage.getKpis();
    for (const kpi of kpis) {
      const { id, ...kpiData } = kpi;
      await dbStorage.createKpi(kpiData);
      console.log(`  - KPI migrado: ${kpi.name}`);
    }
    
    // 4. Migrar valores de KPI
    console.log('Migrando valores de KPI...');
    const kpiValues = await memStorage.getKpiValues();
    for (const value of kpiValues) {
      const { id, ...valueData } = value;
      await dbStorage.createKpiValue(valueData);
      console.log(`  - Valor de KPI migrado para KPI ID: ${value.kpiId}`);
    }
    
    // 5. Migrar planes de acción
    console.log('Migrando planes de acción...');
    try {
      const actionPlans = await memStorage.getActionPlans();
      for (const plan of actionPlans) {
        const { id, ...planData } = plan;
        await dbStorage.createActionPlan(planData);
        console.log(`  - Plan de acción migrado para KPI ID: ${plan.kpiId}`);
      }
    } catch (error) {
      console.log('No hay planes de acción para migrar o no están implementados');
    }
    
    // 6. Migrar usuarios
    console.log('Migrando usuarios...');
    const users = await memStorage.getUsers();
    for (const user of users) {
      const { id, ...userData } = user;
      try {
        await dbStorage.createUser(userData);
        console.log(`  - Usuario migrado: ${user.name}`);
      } catch (error) {
        console.error(`  - Error al migrar usuario ${user.name}: ${error.message}`);
      }
    }
    
    console.log('Migración completada con éxito!');
  } catch (error) {
    console.error('Error durante la migración:', error);
  }
}

migrateData();