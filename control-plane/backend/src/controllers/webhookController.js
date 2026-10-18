const crypto = require('node:crypto');
const asaasService = require('../services/asaasService');

function isTokenValid(headerToken, secret) {
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    return false;
  }
  if (!headerToken || typeof headerToken !== 'string') {
    return false;
  }
  const bufHeader = Buffer.from(headerToken.trim());
  const bufSecret = Buffer.from(secret.trim());
  if (bufHeader.length !== bufSecret.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufHeader, bufSecret);
}

const webhookController = {
  /**
   * POST /api/v1/webhooks/asaas
   * Recebe notificações de faturas e pagamentos da Asaas
   * Bloqueado por padrão contra requisições sem segredo ou com token divergente.
   */
  async handleAsaas(req, res) {
    try {
      const webhookToken = req.headers['asaas-access-token'];
      const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

      if (!expectedToken || !expectedToken.trim()) {
        console.warn('[Asaas Webhook] Bloqueado por padrão: ASAAS_WEBHOOK_SECRET não está configurado na Central.');
        return res.status(401).json({ error: 'Webhook não autorizado: segredo não configurado' });
      }

      if (!webhookToken || !isTokenValid(webhookToken, expectedToken)) {
        console.warn('[Asaas Webhook] Bloqueado: Token de autenticação do webhook ausente ou inválido');
        return res.status(401).json({ error: 'Webhook não autorizado: token inválido' });
      }

      const { event, payment } = req.body;

      if (!event || !payment) {
        return res.status(400).json({ error: 'Payload de webhook incompleto' });
      }

      console.log(`[Asaas Webhook] Evento: ${event}, ID: ${payment.id}, Valor: ${payment.value}`);

      const result = await asaasService.processWebhookEvent(event, payment);

      return res.status(200).json({
        success: true,
        event,
        result
      });
    } catch (error) {
      console.error('[Asaas Webhook] Erro no processamento:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar webhook'
      });
    }
  }
};

module.exports = webhookController;
