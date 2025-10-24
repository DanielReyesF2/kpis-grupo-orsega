#!/usr/bin/env tsx
import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';

async function processClientExcel() {
  const files = [
    {
      path: 'attached_assets/Clientes - Todos los Clientes_20250923 DI (1)_1759191878221.xlsx',
      companyId: 1,
      companyName: 'Dura International'
    },
    {
      path: 'attached_assets/Clientes - Todos los Clientes_20250923 GO (1)_1759191878225.xlsx',
      companyId: 2,
      companyName: 'Grupo Orsega'
    }
  ];

  let sqlInserts: string[] = [];
  let allClients: any[] = [];

  for (const file of files) {
    console.log(`\n📂 Procesando: ${file.companyName}...`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.worksheets[0];
    
    // Leer headers
    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers.push(cell.value?.toString() || `col_${colNumber}`);
    });
    
    console.log(`📋 Columnas encontradas: ${headers.join(', ')}`);
    
    // Procesar filas
    let clientCount = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      const client: any = { companyId: file.companyId };
      
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        client[header] = cell.value;
      });
      
      allClients.push(client);
      clientCount++;
    });
    
    console.log(`✅ ${clientCount} clientes de ${file.companyName}`);
  }

  console.log(`\n📊 Total de clientes: ${allClients.length}`);
  
  // Generar SQL
  console.log('\n🔨 Generando SQL...');
  
  // Necesito ver la estructura de los datos primero
  console.log('\n📝 Muestra de datos (primer cliente):');
  console.log(JSON.stringify(allClients[0], null, 2));
  
  // Guardar datos como JSON para inspección
  writeFileSync('scripts/clients-data.json', JSON.stringify(allClients, null, 2));
  console.log('\n💾 Datos guardados en: scripts/clients-data.json');
  
  return allClients;
}

processClientExcel().catch(console.error);
