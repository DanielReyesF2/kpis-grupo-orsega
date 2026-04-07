interface N8nLogisticsPayload {
  event: 'transport_request' | 'shipment_status' | 'collection_order';
  to: string;
  cc?: string;
  subject: string;
  data: Record<string, any>;
  attachment?: { filename: string; contentBase64: string; contentType: string };
}

interface N8nResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function triggerN8nLogistics(payload: N8nLogisticsPayload): Promise<N8nResult> {
  const webhookUrl = process.env.N8N_LOGISTICS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`[N8N Logistics] Simulación (${payload.event}):`, {
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
      console.error(`[N8N Logistics] Error HTTP ${response.status}:`, errorText);
      return { success: false, error: `N8N webhook error: HTTP ${response.status}` };
    }

    const messageId = `n8n-${Date.now()}`;
    console.log(`[N8N Logistics] ${payload.event} enviado a N8N (${messageId}):`, payload.to);
    return { success: true, messageId };
  } catch (err: any) {
    const errorMsg = err.name === 'AbortError'
      ? 'N8N webhook error: timeout (30s)'
      : `N8N webhook error: ${err.message}`;
    console.error(`[N8N Logistics] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
