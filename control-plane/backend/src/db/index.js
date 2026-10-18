const { Pool } = require('pg');

// 6. Persistência da Central: Em produção, recusar iniciar sem DATABASE_URL configurado
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
    const errorMsg = 'DATABASE_URL é obrigatória em ambiente de produção (NODE_ENV=production) para prevenir perda de dados em memória.';
    console.error(`❌ [FATAL] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

let pool = null;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
}

// In-Memory Fallback Store (permite rodar sem DB conectado durante desenvolvimento local / testes)
const memoryStore = {
  tenants: new Map(),
  licenses: new Map(),
  invoices: new Map(),
  support_tickets: new Map()
};

// Seed de teste para ambiente local/desenvolvimento
const defaultTenant = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Supermercado Central Ltda',
  company_name: 'Supermercado Central Ltda',
  trade_name: 'Central Supermercados',
  cnpj: '12.345.678/0001-90',
  email: 'financeiro@supercentral.com.br',
  contact_email: 'financeiro@supercentral.com.br',
  contact_phone: '+55 11 99999-8888',
  plan: 'Standard (Até 2.000 alunos)',
  monthly_price: 690.00,
  asaas_customer_id: 'cus_000005829101',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
memoryStore.tenants.set(defaultTenant.id, defaultTenant);

const defaultLicense = {
  id: 'b0000000-0000-0000-0000-000000000001',
  tenant_id: defaultTenant.id,
  license_key: 'UNIDESK-TEST-KEY-2026',
  status: 'ACTIVE',
  plan_tier: 'ENTERPRISE',
  max_devices: 100,
  instance_uuid: null,
  activated_at: null,
  last_heartbeat_at: null,
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  grace_until: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
memoryStore.licenses.set(defaultLicense.license_key, defaultLicense);

const defaultInvoice = {
  id: 'pay_000000000001',
  tenant_id: defaultTenant.id,
  tenant_name: defaultTenant.company_name,
  asaas_invoice_id: 'pay_000000000001',
  asaas_customer_id: defaultTenant.asaas_customer_id,
  amount: 690.00,
  billing_type: 'PIX',
  status: 'RECEIVED',
  due_date: new Date().toISOString().split('T')[0],
  payment_date: new Date().toISOString(),
  invoice_url: 'https://sandbox.asaas.com/i/pay_000000000001',
  created_at: new Date().toISOString()
};
memoryStore.invoices.set(defaultInvoice.id, defaultInvoice);

const defaultTicket = {
  id: 'TICK-INIT-001',
  tenant_id: defaultTenant.id,
  tenant_name: defaultTenant.company_name,
  title: 'Telemetria e Licenciamento Inicial',
  subject: 'Telemetria e Licenciamento Inicial',
  description: 'Instância conectada com sucesso ao Control Plane.',
  priority: 'LOW',
  status: 'OPEN',
  diagnostics: { appVersion: 'v2.4.0', nodeVersion: process.version, os: process.platform },
  diagnostics_payload: { appVersion: 'v2.4.0', nodeVersion: process.version, os: process.platform },
  vendor_response: null,
  created_at: new Date().toISOString()
};
memoryStore.support_tickets.set(defaultTicket.id, defaultTicket);

const db = {
  isConfigured: () => !!pool,
  
  query: async (text, params = []) => {
    if (pool) {
      return pool.query(text, params);
    }

    // Em modo desenvolvimento/teste sem Postgres, o memoryStore atende as consultas
    const normalized = text.trim().toLowerCase();

    if (normalized.startsWith('select') && normalized.includes('from tenants')) {
      const rows = [];
      for (const tenant of memoryStore.tenants.values()) {
        const license = Array.from(memoryStore.licenses.values()).find(l => l.tenant_id === tenant.id);
        rows.push({
          ...tenant,
          license_key: license ? license.license_key : null,
          license_status: license ? license.status : null,
          valid_until: license ? license.valid_until : null,
          grace_until: license ? license.grace_until : null,
          instance_uuid: license ? license.instance_uuid : null
        });
      }
      return { rows };
    }

    if (normalized.startsWith('update licenses')) {
      const validUntil = params[0];
      const tenantId = params[1];
      for (const lic of memoryStore.licenses.values()) {
        if (lic.tenant_id === tenantId) {
          lic.valid_until = validUntil;
          lic.status = 'ACTIVE';
        }
      }
      return { rowCount: 1, rows: [] };
    }

    if (normalized.startsWith('select') && normalized.includes('from invoices')) {
      const rows = Array.from(memoryStore.invoices.values()).map(inv => {
        const tenant = memoryStore.tenants.get(inv.tenant_id);
        return {
          ...inv,
          tenant_name: tenant ? (tenant.company_name || tenant.name) : 'Instância UniDesk'
        };
      });
      return { rows };
    }

    if (normalized.startsWith('select') && normalized.includes('from support_tickets')) {
      const rows = Array.from(memoryStore.support_tickets.values()).map(tk => {
        const tenant = memoryStore.tenants.get(tk.tenant_id);
        return {
          ...tk,
          tenant_name: tenant ? (tenant.company_name || tenant.name) : (tk.tenant_name || 'Instância UniDesk')
        };
      });
      return { rows };
    }

    if (normalized.startsWith('insert into support_tickets')) {
      const [id, tenant_id, subject, description, priority, diagnosticsStr, created_at] = params;
      const tenant = memoryStore.tenants.get(tenant_id);
      const parsedDiag = typeof diagnosticsStr === 'string' ? JSON.parse(diagnosticsStr || '{}') : (diagnosticsStr || {});
      const ticket = {
        id,
        tenant_id,
        tenant_name: tenant ? (tenant.company_name || tenant.name) : 'Instância UniDesk',
        subject,
        title: subject,
        description,
        priority,
        status: 'OPEN',
        diagnostics: parsedDiag,
        diagnostics_payload: parsedDiag,
        vendor_response: null,
        created_at
      };
      memoryStore.support_tickets.set(id, ticket);
      return { rowCount: 1, rows: [ticket] };
    }

    if (normalized.startsWith('update support_tickets')) {
      const [vendorResponse, status, resolvedAt, id] = params;
      const ticket = memoryStore.support_tickets.get(id);
      if (ticket) {
        ticket.vendor_response = vendorResponse;
        ticket.status = status;
        ticket.resolved_at = resolvedAt;
      }
      return { rowCount: 1, rows: [ticket] };
    }

    throw new Error('PostgreSQL DATABASE_URL não configurada.');
  },

  // Helpers de compatibilidade híbrida (DB real ou Memory fallback)
  async getLicenseByKey(licenseKey) {
    if (pool) {
      const res = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [licenseKey]);
      return res.rows[0] || null;
    }
    return memoryStore.licenses.get(licenseKey) || null;
  },

  async getLicenseByInstance(instanceUuid) {
    if (pool) {
      const res = await pool.query('SELECT * FROM licenses WHERE instance_uuid = $1', [instanceUuid]);
      return res.rows[0] || null;
    }
    for (const lic of memoryStore.licenses.values()) {
      if (lic.instance_uuid === instanceUuid) return lic;
    }
    return null;
  },

  async getLicenseByTenantId(tenantId) {
    if (pool) {
      const res = await pool.query('SELECT * FROM licenses WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', [tenantId]);
      return res.rows[0] || null;
    }
    for (const lic of memoryStore.licenses.values()) {
      if (lic.tenant_id === tenantId) return lic;
    }
    return null;
  },

  async updateLicense(licenseKey, updates) {
    if (pool) {
      const fields = Object.keys(updates);
      const setClause = fields.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
      const values = [licenseKey, ...Object.values(updates)];
      const res = await pool.query(`UPDATE licenses SET ${setClause}, updated_at = NOW() WHERE license_key = $1 RETURNING *`, values);
      return res.rows[0];
    }
    const lic = memoryStore.licenses.get(licenseKey);
    if (!lic) return null;
    Object.assign(lic, updates, { updated_at: new Date().toISOString() });
    return lic;
  },

  async getTenantById(tenantId) {
    if (pool) {
      const res = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
      return res.rows[0] || null;
    }
    return memoryStore.tenants.get(tenantId) || null;
  },

  async getTenantByAsaasCustomer(customerId) {
    if (pool) {
      const res = await pool.query('SELECT * FROM tenants WHERE asaas_customer_id = $1', [customerId]);
      return res.rows[0] || null;
    }
    for (const tenant of memoryStore.tenants.values()) {
      if (tenant.asaas_customer_id === customerId) return tenant;
    }
    return null;
  },

  async recordInvoice(invoiceData) {
    if (pool) {
      const query = `
        INSERT INTO invoices (tenant_id, asaas_invoice_id, asaas_subscription_id, amount, status, due_date, payment_date, billing_type, invoice_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (asaas_invoice_id) DO UPDATE SET
          status = EXCLUDED.status,
          payment_date = EXCLUDED.payment_date,
          updated_at = NOW()
        RETURNING *;
      `;
      const res = await pool.query(query, [
        invoiceData.tenant_id,
        invoiceData.asaas_invoice_id,
        invoiceData.asaas_subscription_id,
        invoiceData.amount,
        invoiceData.status,
        invoiceData.due_date,
        invoiceData.payment_date,
        invoiceData.billing_type,
        invoiceData.invoice_url
      ]);
      return res.rows[0];
    }
    const record = {
      id: 'inv_' + Date.now(),
      ...invoiceData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.invoices.set(invoiceData.asaas_invoice_id, record);
    return record;
  },

  getMemoryStore: () => memoryStore
};

module.exports = db;
