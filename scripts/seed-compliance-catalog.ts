import 'dotenv/config';
import { db } from '../server/db';
import {
  obligationCatalog,
  tenantObligations,
  obligationDossiers,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────
// SECTION 1: Seed obligation_catalog (~15 obligations)
// ON CONFLICT by code → update name/authority/etc.
// ─────────────────────────────────────────────────────────────

interface CatalogEntry {
  code: string;
  name: string;
  authority: string;
  legalBasis: string;
  periodicity: string;
  description: string;
  appliesToCriteria: Record<string, unknown>;
  evidenceTemplate: Array<{ type: string; name: string }>;
  category: string;
  isVoluntary: boolean;
}

const CATALOG: CatalogEntry[] = [
  {
    code: 'LAU',
    name: 'Licencia Ambiental Única',
    authority: 'SEMARNAT',
    legalBasis: 'LGEEPA Art. 111 Bis, Reglamento LGEEPA en materia de Prevención y Control de la Contaminación de la Atmósfera',
    periodicity: 'one_time',
    description: 'Licencia que integra permisos de emisiones a la atmósfera, generación de residuos peligrosos y descarga de aguas residuales para fuentes fijas de jurisdicción federal.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica', 'manufactura'], jurisdiccion_federal: true },
    evidenceTemplate: [
      { type: 'license', name: 'LAU vigente (resolución SEMARNAT)' },
      { type: 'receipt', name: 'Comprobante de pago de derechos' },
      { type: 'id_card', name: 'Cédula de identificación como fuente fija' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'COA',
    name: 'Cédula de Operación Anual',
    authority: 'SEMARNAT',
    legalBasis: 'LGEEPA Art. 109 Bis, Reglamento del RETC',
    periodicity: 'annual',
    description: 'Reporte anual obligatorio de emisiones y transferencia de contaminantes al aire, agua, suelo y residuos peligrosos generados.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica', 'manufactura'], genera_rp: true },
    evidenceTemplate: [
      { type: 'coa_submitted', name: 'Acuse de recibo COA (plataforma SEMARNAT)' },
      { type: 'emissions_q1', name: 'Datos de emisiones Q1' },
      { type: 'emissions_q2', name: 'Datos de emisiones Q2' },
      { type: 'emissions_q3', name: 'Datos de emisiones Q3' },
      { type: 'emissions_q4', name: 'Datos de emisiones Q4' },
      { type: 'waste_manifest', name: 'Manifiestos de residuos peligrosos del periodo' },
      { type: 'lab_analysis', name: 'Análisis de laboratorio de emisiones' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'REG_GEN_RP',
    name: 'Registro como Generador de Residuos Peligrosos',
    authority: 'SEMARNAT',
    legalBasis: 'LGPGIR Art. 46, Reglamento LGPGIR Art. 72',
    periodicity: 'one_time',
    description: 'Registro ante SEMARNAT como generador de residuos peligrosos. Se obtiene un número de registro (NRA) que identifica al establecimiento.',
    appliesToCriteria: { genera_rp: true },
    evidenceTemplate: [
      { type: 'nra_certificate', name: 'Constancia de registro NRA' },
      { type: 'waste_characterization', name: 'Caracterización de residuos (análisis CRETIB)' },
      { type: 'waste_inventory', name: 'Inventario de residuos peligrosos' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'PLAN_MANEJO_RP',
    name: 'Plan de Manejo de Residuos Peligrosos',
    authority: 'SEMARNAT',
    legalBasis: 'LGPGIR Art. 46 fracción IV, Art. 31-33',
    periodicity: 'biennial',
    description: 'Plan que describe los procedimientos para minimizar, almacenar, transportar y disponer residuos peligrosos generados.',
    appliesToCriteria: { genera_rp: true, gran_generador: true },
    evidenceTemplate: [
      { type: 'plan_document', name: 'Plan de manejo de RP aprobado' },
      { type: 'waste_log', name: 'Bitácora de generación de residuos' },
      { type: 'storage_layout', name: 'Plano de almacén temporal de RP' },
      { type: 'contractor_license', name: 'Licencia del transportista autorizado' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'MANIFIESTOS_RP',
    name: 'Manifiestos Entrega-Transporte-Recepción de RP',
    authority: 'SEMARNAT',
    legalBasis: 'LGPGIR Art. 46 fracción V, Reglamento LGPGIR Art. 75',
    periodicity: 'per_event',
    description: 'Manifiestos que documentan cada movimiento de residuos peligrosos desde la generación hasta la disposición final.',
    appliesToCriteria: { genera_rp: true },
    evidenceTemplate: [
      { type: 'manifest', name: 'Manifiestos de entrega-transporte-recepción' },
      { type: 'disposal_certificate', name: 'Certificado de disposición final' },
      { type: 'transporter_auth', name: 'Autorización del transportista SCT' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'RETC',
    name: 'Registro de Emisiones y Transferencia de Contaminantes',
    authority: 'SEMARNAT',
    legalBasis: 'LGEEPA Art. 109 Bis, Reglamento del RETC',
    periodicity: 'annual',
    description: 'Registro público federal de información sobre emisiones y transferencia de contaminantes al aire, agua, suelo y subsuelo.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica', 'manufactura'], jurisdiccion_federal: true },
    evidenceTemplate: [
      { type: 'retc_submission', name: 'Acuse de presentación RETC' },
      { type: 'emissions_data', name: 'Inventario de emisiones del periodo' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'NOM_FUENTE_FIJA',
    name: 'Monitoreo NOMs Fuente Fija (emisiones/ruido)',
    authority: 'SEMARNAT',
    legalBasis: 'NOM-043-SEMARNAT-1993, NOM-085-SEMARNAT-2011, NOM-081-SEMARNAT-1994',
    periodicity: 'biennial',
    description: 'Monitoreo periódico de emisiones a la atmósfera y niveles de ruido conforme a las NOMs aplicables a fuentes fijas.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica', 'manufactura'], fuente_fija: true },
    evidenceTemplate: [
      { type: 'emissions_study', name: 'Estudio de emisiones (laboratorio acreditado)' },
      { type: 'noise_study', name: 'Estudio de niveles de ruido perimetral' },
      { type: 'lab_accreditation', name: 'Acreditación del laboratorio (EMA)' },
      { type: 'corrective_actions', name: 'Acciones correctivas (si aplica)' },
    ],
    category: 'environmental',
    isVoluntary: false,
  },
  {
    code: 'COFEPRIS_CLASIF',
    name: 'Clasificación de Producto (F08/solventes)',
    authority: 'COFEPRIS',
    legalBasis: 'Ley General de Salud Art. 278, Reglamento de Control Sanitario',
    periodicity: 'one_time',
    description: 'Clasificación sanitaria de productos químicos. Los solventes y productos oleoquímicos se clasifican como sustancias peligrosas (F08) ante COFEPRIS.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica'], productos_quimicos: true },
    evidenceTemplate: [
      { type: 'classification', name: 'Dictamen de clasificación COFEPRIS' },
      { type: 'product_list', name: 'Lista de productos con clasificación' },
      { type: 'sds_set', name: 'Hojas de seguridad (SDS) de productos clasificados' },
    ],
    category: 'chemical',
    isVoluntary: false,
  },
  {
    code: 'COFEPRIS_AVISO',
    name: 'Aviso de Funcionamiento',
    authority: 'COFEPRIS',
    legalBasis: 'Ley General de Salud Art. 200 Bis',
    periodicity: 'one_time',
    description: 'Aviso de funcionamiento ante COFEPRIS para establecimientos que manejan sustancias tóxicas o peligrosas.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica'], sustancias_toxicas: true },
    evidenceTemplate: [
      { type: 'notice_receipt', name: 'Acuse de aviso de funcionamiento' },
      { type: 'responsible_person', name: 'Designación de responsable sanitario' },
    ],
    category: 'chemical',
    isVoluntary: false,
  },
  {
    code: 'SCT_TRANSPORTE_RP',
    name: 'Transporte de Materiales y Residuos Peligrosos',
    authority: 'SCT',
    legalBasis: 'Reglamento para el Transporte Terrestre de Materiales y Residuos Peligrosos, NOM-002-SCT/2011',
    periodicity: 'per_event',
    description: 'Cumplimiento de la normativa SCT para el transporte terrestre de materiales y residuos peligrosos (vehículos autorizados, señalización, documentos de embarque).',
    appliesToCriteria: { genera_rp: true, transporta_materiales_peligrosos: true },
    evidenceTemplate: [
      { type: 'transport_permit', name: 'Permiso SCT del transportista' },
      { type: 'shipping_docs', name: 'Documentos de embarque' },
      { type: 'vehicle_inspection', name: 'Inspección vehicular vigente' },
      { type: 'emergency_card', name: 'Tarjeta de emergencia en transporte' },
    ],
    category: 'transport',
    isVoluntary: false,
  },
  {
    code: 'STPS_SDS',
    name: 'Hojas de Datos de Seguridad (SDS)',
    authority: 'STPS',
    legalBasis: 'NOM-018-STPS-2015, Sistema Globalmente Armonizado (SGA)',
    periodicity: 'per_product',
    description: 'Hojas de datos de seguridad actualizadas para todas las sustancias químicas peligrosas presentes en el centro de trabajo, conforme al SGA.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica'], maneja_quimicos: true },
    evidenceTemplate: [
      { type: 'sds_inventory', name: 'Inventario de SDS vigentes' },
      { type: 'sds_samples', name: 'Muestra de SDS actualizadas (formato SGA 16 secciones)' },
      { type: 'ghs_labels', name: 'Evidencia de etiquetado SGA en contenedores' },
    ],
    category: 'safety',
    isVoluntary: false,
  },
  {
    code: 'STPS_CAPACITACION',
    name: 'Capacitación y Monitoreo Laboral',
    authority: 'STPS',
    legalBasis: 'NOM-005-STPS-1998, NOM-010-STPS-2014, NOM-017-STPS-2008',
    periodicity: 'annual',
    description: 'Capacitación al personal en manejo de sustancias químicas peligrosas, uso de EPP, y monitoreo de exposición laboral a agentes químicos.',
    appliesToCriteria: { giros: ['quimica', 'oleoquimica', 'manufactura'], maneja_quimicos: true },
    evidenceTemplate: [
      { type: 'training_program', name: 'Programa anual de capacitación' },
      { type: 'training_records', name: 'Constancias DC-3 de capacitación' },
      { type: 'exposure_monitoring', name: 'Monitoreo de exposición laboral' },
      { type: 'epp_records', name: 'Registros de entrega de EPP' },
    ],
    category: 'safety',
    isVoluntary: false,
  },
  {
    code: 'ESR',
    name: 'Distintivo Empresa Socialmente Responsable',
    authority: 'CEMEFI',
    legalBasis: 'Programa voluntario CEMEFI — Indicadores ESR',
    periodicity: 'annual',
    description: 'Distintivo otorgado por CEMEFI a empresas que demuestran prácticas de responsabilidad social empresarial en 4 ámbitos: ética, calidad de vida, vinculación comunitaria y medio ambiente.',
    appliesToCriteria: { voluntario: true },
    evidenceTemplate: [
      { type: 'esr_certificate', name: 'Distintivo ESR vigente' },
      { type: 'esr_instrument', name: 'Instrumento de autodiagnóstico contestado' },
      { type: 'social_policies', name: 'Políticas de RSE documentadas' },
      { type: 'community_programs', name: 'Programas de vinculación comunitaria' },
      { type: 'environmental_program', name: 'Programa de gestión ambiental' },
    ],
    category: 'voluntary',
    isVoluntary: true,
  },
  {
    code: 'ISO_14001',
    name: 'ISO 14001 Sistema de Gestión Ambiental',
    authority: 'ISO / Certificadora acreditada',
    legalBasis: 'ISO 14001:2015 — estándar internacional voluntario',
    periodicity: 'triennial',
    description: 'Sistema de gestión ambiental certificado bajo ISO 14001:2015. Requiere auditorías de seguimiento anuales y recertificación cada 3 años.',
    appliesToCriteria: { voluntario: true, giros: ['quimica', 'oleoquimica', 'manufactura'] },
    evidenceTemplate: [
      { type: 'certificate', name: 'Certificado ISO 14001 vigente' },
      { type: 'audit_report', name: 'Último reporte de auditoría' },
      { type: 'sga_manual', name: 'Manual del SGA' },
      { type: 'objectives_targets', name: 'Objetivos y metas ambientales' },
      { type: 'nonconformities', name: 'Registro de no conformidades y acciones correctivas' },
    ],
    category: 'voluntary',
    isVoluntary: true,
  },
  {
    code: 'INDUSTRIA_LIMPIA',
    name: 'Certificado Industria Limpia',
    authority: 'PROFEPA',
    legalBasis: 'Programa Nacional de Auditoría Ambiental (PNAA)',
    periodicity: 'biennial',
    description: 'Certificado de PROFEPA que acredita que la empresa cumple con la normatividad ambiental vigente a través de auditoría ambiental voluntaria.',
    appliesToCriteria: { voluntario: true, giros: ['quimica', 'oleoquimica', 'manufactura'] },
    evidenceTemplate: [
      { type: 'certificate', name: 'Certificado Industria Limpia vigente' },
      { type: 'audit_report', name: 'Reporte de auditoría ambiental' },
      { type: 'action_plan', name: 'Plan de acción correctivo (si aplica)' },
      { type: 'compliance_letter', name: 'Carta de cumplimiento PROFEPA' },
    ],
    category: 'voluntary',
    isVoluntary: true,
  },
];

// ─────────────────────────────────────────────────────────────
// SECTION 2: Assign obligations to Orsega (2) and Dura (1)
// ─────────────────────────────────────────────────────────────

// Due dates for annual/biennial obligations (reasonable defaults)
const DUE_DATES: Record<string, string> = {
  COA: '2027-04-30',        // COA vence 30 abril
  RETC: '2027-03-31',       // RETC vence 31 marzo
  STPS_CAPACITACION: '2026-12-31', // anual, fin de año
  ESR: '2027-03-15',        // CEMEFI convocatoria Q1
  NOM_FUENTE_FIJA: '2027-06-30',  // bienal
  PLAN_MANEJO_RP: '2027-06-30',   // bienal
  ISO_14001: '2028-12-31',  // trienal
  INDUSTRIA_LIMPIA: '2027-12-31', // bienal
};

const COMPANY_IDS = [1, 2]; // 1 = Dura International, 2 = Grupo Orsega

async function seedCatalog(): Promise<Map<string, number>> {
  console.log('--- SECTION 1: Seeding obligation_catalog ---\n');
  const codeToId = new Map<string, number>();

  for (const entry of CATALOG) {
    // Check if exists
    const existing = await db
      .select({ id: obligationCatalog.id })
      .from(obligationCatalog)
      .where(eq(obligationCatalog.code, entry.code))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  [skip] ${entry.code} already exists (id=${existing[0].id})`);
      codeToId.set(entry.code, existing[0].id);
      continue;
    }

    const [inserted] = await db
      .insert(obligationCatalog)
      .values({
        code: entry.code,
        name: entry.name,
        authority: entry.authority,
        legalBasis: entry.legalBasis,
        periodicity: entry.periodicity,
        description: entry.description,
        appliesToCriteria: entry.appliesToCriteria,
        evidenceTemplate: entry.evidenceTemplate,
        category: entry.category,
        isVoluntary: entry.isVoluntary,
      })
      .returning({ id: obligationCatalog.id });

    codeToId.set(entry.code, inserted.id);
    console.log(`  [created] ${entry.code} → id=${inserted.id}`);
  }

  console.log(`\n  Total in catalog: ${codeToId.size}\n`);
  return codeToId;
}

async function seedTenantObligations(codeToId: Map<string, number>): Promise<void> {
  console.log('--- SECTION 2: Assigning obligations to companies ---\n');

  for (const companyId of COMPANY_IDS) {
    const companyName = companyId === 1 ? 'Dura International' : 'Grupo Orsega';
    console.log(`  Company: ${companyName} (id=${companyId})`);

    let created = 0;
    let skipped = 0;

    for (const [code, catalogId] of codeToId) {
      // Check if already assigned
      const existing = await db
        .select({ id: tenantObligations.id })
        .from(tenantObligations)
        .where(
          and(
            eq(tenantObligations.companyId, companyId),
            eq(tenantObligations.obligationCatalogId, catalogId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        // Still ensure dossier exists
        await ensureDossier(existing[0].id, code);
        continue;
      }

      // ESR is compliant for Orsega (they have active ESR)
      const status =
        code === 'ESR' && companyId === 2 ? 'compliant' : 'pending';

      const dueDate = DUE_DATES[code] ?? null;

      const [inserted] = await db
        .insert(tenantObligations)
        .values({
          companyId,
          obligationCatalogId: catalogId,
          status,
          currentDueDate: dueDate,
          autoDiagnosed: true,
        })
        .returning({ id: tenantObligations.id });

      created++;
      console.log(`    [assigned] ${code} → obligation_id=${inserted.id}, status=${status}`);

      // Create 2026 dossier
      await ensureDossier(inserted.id, code);
    }

    console.log(`    Result: ${created} created, ${skipped} already existed\n`);
  }
}

async function ensureDossier(tenantObligationId: number, code: string): Promise<void> {
  const period = '2026';

  const existing = await db
    .select({ id: obligationDossiers.id })
    .from(obligationDossiers)
    .where(
      and(
        eq(obligationDossiers.tenantObligationId, tenantObligationId),
        eq(obligationDossiers.period, period),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return; // dossier already exists
  }

  const [dossier] = await db
    .insert(obligationDossiers)
    .values({
      tenantObligationId,
      period,
      status: 'not_started',
      progressPct: 0,
    })
    .returning({ id: obligationDossiers.id });

  console.log(`      [dossier] ${code} period=${period} → dossier_id=${dossier.id}`);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Compliance Catalog Seed ===\n');

  try {
    const codeToId = await seedCatalog();
    await seedTenantObligations(codeToId);

    // Verification queries
    console.log('--- Verification ---\n');

    const catalogCount = await db
      .select({ id: obligationCatalog.id })
      .from(obligationCatalog);
    console.log(`  obligation_catalog: ${catalogCount.length} rows`);

    const obligationCount = await db
      .select({ id: tenantObligations.id })
      .from(tenantObligations);
    console.log(`  tenant_obligations: ${obligationCount.length} rows`);

    const dossierCount = await db
      .select({ id: obligationDossiers.id })
      .from(obligationDossiers);
    console.log(`  obligation_dossiers: ${dossierCount.length} rows`);

    console.log('\n=== Done ===');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
