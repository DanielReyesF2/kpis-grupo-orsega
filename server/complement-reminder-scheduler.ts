import cron from 'node-cron';
import { db } from './db';
import { eq, and, lte, sql } from 'drizzle-orm';
import { paymentVouchers, clients, emailOutbox } from '@shared/schema';
import { emailService } from './email-service';

const SYSTEM_USER_ID = 23;

/** Reminder tiers: days since voucher entered pendiente_complemento */
const REMINDER_TIERS = [
  { minDays: 14, label: '3er recordatorio (urgente)', ordinal: 3 },
  { minDays: 7, label: '2do recordatorio', ordinal: 2 },
  { minDays: 3, label: '1er recordatorio', ordinal: 1 },
] as const;

/**
 * Scan vouchers in pendiente_complemento and send reminders at 3, 7, 14 days.
 * Idempotent: checks email_outbox to avoid duplicate sends on the same day.
 */
export async function runComplementReminders() {
  console.log('🔔 [Complement Reminder] Iniciando escaneo de vouchers pendientes...');

  try {
    // Get all vouchers in pendiente_complemento where updatedAt > 3 days ago
    // (updatedAt reflects when the voucher entered this status)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const pendingVouchers = await db
      .select({
        id: paymentVouchers.id,
        clientId: paymentVouchers.clientId,
        companyId: paymentVouchers.companyId,
        updatedAt: paymentVouchers.updatedAt,
      })
      .from(paymentVouchers)
      .where(
        and(
          eq(paymentVouchers.status, 'pendiente_complemento'),
          lte(paymentVouchers.updatedAt, threeDaysAgo)
        )
      );

    if (pendingVouchers.length === 0) {
      console.log('✅ [Complement Reminder] No hay vouchers pendientes de complemento con > 3 días.');
      return;
    }

    console.log(`📋 [Complement Reminder] ${pendingVouchers.length} voucher(s) pendientes de complemento.`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const voucher of pendingVouchers) {
      if (!voucher.clientId) {
        continue;
      }

      // Calculate age in days since status changed (updatedAt)
      const statusDate = voucher.updatedAt ? new Date(voucher.updatedAt) : new Date();
      const ageDays = Math.floor((Date.now() - statusDate.getTime()) / (1000 * 60 * 60 * 24));

      // Determine which reminder tier applies
      const tier = REMINDER_TIERS.find(t => ageDays >= t.minDays);
      if (!tier) continue;

      // Check if we already sent a reminder today for this voucher (idempotency)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const alreadySent = await db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(
          and(
            eq(emailOutbox.voucherId, voucher.id),
            sql`${emailOutbox.createdAt} >= ${today}`,
            sql`${emailOutbox.subject} ILIKE '%recordatorio%' OR ${emailOutbox.subject} ILIKE '%complemento de pago pendiente%'`
          )
        )
        .limit(1);

      if (alreadySent.length > 0) {
        skippedCount++;
        continue;
      }

      // Get client info
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, voucher.clientId)
      });

      if (!client?.email) {
        continue;
      }

      // Send reminder via Resend
      const result = await emailService.sendComplementRequest(
        client.email,
        client.name,
        String(voucher.id)
      );

      // Log to email_outbox
      const subject = `${tier.label} — Complemento de Pago Pendiente — ${client.name}`;
      await db.insert(emailOutbox).values({
        voucherId: voucher.id,
        emailTo: [client.email],
        emailCc: [],
        subject,
        htmlContent: `Recordatorio automático #${tier.ordinal} enviado (${ageDays} días). Resultado: ${result.success ? 'enviado' : result.error}`,
        status: result.success ? 'sent' : 'failed',
        messageId: result.messageId || null,
        errorMessage: result.error || null,
        sentAt: result.success ? new Date() : null,
      });

      if (result.success) {
        sentCount++;
        console.log(`📧 [Complement Reminder] ${tier.label} enviado a ${client.email} (voucher #${voucher.id}, ${ageDays} días)`);
      } else {
        console.error(`❌ [Complement Reminder] Error enviando a ${client.email}: ${result.error}`);
      }
    }

    console.log(`✅ [Complement Reminder] Escaneo completo: ${sentCount} enviados, ${skippedCount} omitidos (ya enviados hoy).`);
  } catch (error) {
    console.error('❌ [Complement Reminder] Error en escaneo:', error);
  }
}

/**
 * Initialize the complement reminder cron job.
 * Runs at 10:00 AM Mexico City time, Monday–Friday.
 */
export function initializeComplementReminderScheduler() {
  cron.schedule('0 10 * * 1-5', async () => {
    console.log('⏰ [Complement Reminder] Ejecutando escaneo diario 10:00 AM (Hora de México)');
    await runComplementReminders();
  }, {
    timezone: 'America/Mexico_City'
  });

  console.log('📅 [Complement Reminder] Scheduler inicializado');
  console.log('⏰ Recordatorios programados: 10:00 AM (Hora de México) - Solo días hábiles (Lun-Vie)');
}
