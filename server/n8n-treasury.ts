interface N8nTreasuryPayload {
  event: 'purchase_request' | 'payment_receipt' | 'complement_reminder' | 'receipt_send';
  to: string | string[];
  subject: string;
  data: Record<string, any>;
  attachments?: Array<{ filename: string; contentBase64: string; contentType: string }>;
}

interface N8nResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function triggerN8nTreasury(payload: N8nTreasuryPayload): Promise<N8nResult> {
  const webhookUrl = process.env.N8N_TREASURY_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`[N8N Treasury] Simulación (${payload.event}):`, {
      to: payload.to,
      subject: payload.subject,
    });
    return { success: true, messageId: `n8n-simulated-${Date.now()}` };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[N8N Treasury] Error HTTP ${response.status}:`, errorText);
      return { success: false, error: `N8N webhook error: HTTP ${response.status}` };
    }

    const messageId = `n8n-${Date.now()}`;
    console.log(`[N8N Treasury] ${payload.event} enviado a N8N (${messageId}):`, payload.to);
    return { success: true, messageId };
  } catch (err: any) {
    const errorMsg = err.name === 'AbortError'
      ? 'N8N webhook error: timeout (30s)'
      : `N8N webhook error: ${err.message}`;
    console.error(`[N8N Treasury] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
