// Script para verificar áreas de usuarios
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variables de entorno no configuradas');
  console.log('Necesitas VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserAreas() {
  console.log('🔍 Verificando áreas de usuarios...\n');
  
  // Obtener usuarios Omar y Thalia
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, area_id, company_id')
    .or('name.ilike.%omar%,name.ilike.%thalia%')
    .order('name');
  
  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError);
    return;
  }
  
  console.log('📊 Usuarios encontrados:');
  users.forEach(user => {
    console.log(`  - ${user.name} (${user.email}):`);
    console.log(`    - area_id: ${user.area_id}`);
    console.log(`    - company_id: ${user.company_id}`);
  });
  
  // Obtener áreas
  const { data: areas, error: areasError } = await supabase
    .from('areas')
    .select('id, name, company_id')
    .order('company_id, id');
  
  if (areasError) {
    console.error('❌ Error obteniendo áreas:', areasError);
    return;
  }
  
  console.log('\n📋 Áreas disponibles:');
  areas.forEach(area => {
    console.log(`  - ${area.name} (id: ${area.id}, company_id: ${area.company_id})`);
  });
  
  // Obtener KPIs de Ventas y Logística
  const { data: kpis, error: kpisError } = await supabase
    .from('kpis')
    .select('id, name, area_id, company_id, responsible')
    .order('company_id, area_id');
  
  if (kpisError) {
    console.error('❌ Error obteniendo KPIs:', kpisError);
    return;
  }
  
  console.log('\n📊 KPIs por área:');
  const kpisByArea = {};
  kpis.forEach(kpi => {
    const areaName = areas.find(a => a.id === kpi.area_id)?.name || 'Sin área';
    const key = `${areaName} (company: ${kpi.company_id})`;
    if (!kpisByArea[key]) kpisByArea[key] = [];
    kpisByArea[key].push({
      id: kpi.id,
      name: kpi.name,
      area_id: kpi.area_id,
      responsible: kpi.responsible
    });
  });
  
  Object.entries(kpisByArea).forEach(([areaName, areaKpis]) => {
    console.log(`\n  ${areaName}:`);
    areaKpis.forEach(kpi => {
      console.log(`    - ${kpi.name} (id: ${kpi.id}, responsible: ${kpi.responsible || 'N/A'})`);
    });
  });
}

checkUserAreas().catch(console.error);
