const axios = require('axios');
const db = require('../db');

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '$aact_Y34567890';

const apiClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
  }
});

const asaasService = {
  /**
   * Cria cliente no Asaas
   */
  async createCustomer(customerData) {
    try {
      const response = await apiClient.post('/customers', customerData);
      return response.data;
    } catch (error) {
      console.error('[Asaas] Erro ao criar cliente:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Cria cobrança ou assinatura
   */
  async createSubscription(subscriptionData) {
    try {
      const response = await apiClient.post('/subscriptions', subscriptionData);
      return response.data;
    } catch (error) {
      console.error('[Asaas] Erro ao criar assinatura:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Processa eventos recebidos do Webhook do Asaas
   * Eventos:
   * - PAYMENT_RECEIVED / PAYMENT_CONFIRMED: Ativa/Renova licença por 30 dias
   * - PAYMENT_OVERDUE: Entra em GRACE_PERIOD com 15 dias de tolerância
   * - PAYMENT_DELETED / SUBSCRIPTION_CANCELLED / PAYMENT_REFUNDED: SUSPENDED
   */
  async processWebhookEvent(event, payment) {
    console.log(`[Asaas Webhook] Processando evento: ${event} para cliente ${payment.customer}`);

    const tenant = await db.getTenantByAsaasCustomer(payment.customer);
    if (!tenant) {
      console.warn(`[Asaas Webhook] Tenant não encontrado para asaas_customer_id: ${payment.customer}`);
      return { handled: false, reason: 'TENANT_NOT_FOUND' };
    }

    const license = await db.getLicenseByTenantId(tenant.id);
    if (!license) {
      console.warn(`[Asaas Webhook] Licença não encontrada para tenant: ${tenant.id}`);
      return { handled: false, reason: 'LICENSE_NOT_FOUND' };
    }

    // Registra ou atualiza fatura
    await db.recordInvoice({
      tenant_id: tenant.id,
      asaas_invoice_id: payment.id,
      asaas_subscription_id: payment.subscription || null,
      amount: payment.value,
      status: payment.status,
      due_date: payment.dueDate,
      payment_date: payment.clientPaymentDate || payment.confirmedDate || null,
      billing_type: payment.billingType,
      invoice_url: payment.invoiceUrl || payment.bankSlipUrl || null
    });

    const now = new Date();

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        // Renova licença por 30 dias a partir da data de vencimento ou atual
        const currentValidUntil = new Date(license.valid_until);
        const baseDate = currentValidUntil > now ? currentValidUntil : now;
        const newValidUntil = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        await db.updateLicense(license.license_key, {
          status: 'ACTIVE',
          valid_until: newValidUntil.toISOString(),
          grace_until: null
        });

        console.log(`[Asaas Webhook] Licença ${license.license_key} renovada com sucesso até ${newValidUntil.toISOString()}`);
        return { handled: true, status: 'ACTIVE', valid_until: newValidUntil };
      }

      case 'PAYMENT_OVERDUE': {
        // Tolerância de 15 dias de carência (GRACE_PERIOD)
        const graceUntil = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        await db.updateLicense(license.license_key, {
          status: 'GRACE_PERIOD',
          grace_until: graceUntil.toISOString()
        });

        console.warn(`[Asaas Webhook] Fatura atrasada! Licença ${license.license_key} colocada em GRACE_PERIOD até ${graceUntil.toISOString()}`);
        return { handled: true, status: 'GRACE_PERIOD', grace_until: graceUntil };
      }

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'SUBSCRIPTION_CANCELLED': {
        await db.updateLicense(license.license_key, {
          status: 'SUSPENDED'
        });

        console.warn(`[Asaas Webhook] Evento ${event}: Licença ${license.license_key} SUSPENDED.`);
        return { handled: true, status: 'SUSPENDED' };
      }

      default:
        console.log(`[Asaas Webhook] Evento não crítico ignorado: ${event}`);
        return { handled: true, status: license.status };
    }
  }
};

module.exports = asaasService;
