const express = require('express');
const router = express.Router();
const db = require('../db');
const licenseController = require('../controllers/licenseController');
const webhookController = require('../controllers/webhookController');
const { getPublicKey } = require('../services/cryptoService');
const { authenticateMaster, requireMasterAuth } = require('../services/authService');

// Rota raiz e saúde da API
router.get('/', (req, res) => {
  res.json({
    name: 'UniDesk Central Control Plane API',
    version: '1.0.0',
    status: 'ONLINE',
    description: 'API Central de Licenciamento, Faturamento Asaas e Suporte N2/N3',
    documentation: {
      health: 'GET /api/v1/health',
      publicKey: 'GET /api/v1/license/public-key',
      activate: 'POST /api/v1/license/activate',
      heartbeat: 'POST /api/v1/license/heartbeat',
      webhooksAsaas: 'POST /api/v1/webhooks/asaas',
      tenants: 'GET /api/v1/tenants',
      invoices: 'GET /api/v1/billing/invoices',
      supportTickets: 'GET /api/v1/support/tickets'
    },
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'unidesk-control-plane-backend',
    timestamp: new Date().toISOString()
  });
});

// Endpoint público para fornecer a chave pública Ed25519 para verificação offline
router.get('/license/public-key', (req, res) => {
  res.json({
    algorithm: 'Ed25519 / EdDSA',
    public_key: getPublicKey()
  });
});

// Endpoints de Licenciamento (usados pelo cliente UniDesk)
router.post('/license/activate', licenseController.activate);
router.post('/license/heartbeat', licenseController.heartbeat);

// Webhooks Asaas (autenticado estritamente via webhookController)
router.post('/webhooks/asaas', webhookController.handleAsaas);

// Auth Master Admin - Autenticação real com hash PBKDF2 e JWT HS256
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const auth = authenticateMaster(username, password);
  if (!auth) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  return res.json({
    success: true,
    token: auth.token,
    user: auth.user
  });
});

// Gestão de Tenants (Empresas) - Protegido por requireMasterAuth
router.get('/tenants', requireMasterAuth, async (req, res) => {
  try {
    const tenants = await db.query(`
      SELECT t.*, l.license_key, l.status as license_status, l.valid_until, l.grace_until, l.instance_uuid
      FROM tenants t
      LEFT JOIN licenses l ON t.id = l.tenant_id
      ORDER BY t.created_at DESC
    `);
    
    // Normalização para o frontend
    const formatted = (tenants.rows || []).map(t => {
      const isOverdue = t.valid_until && new Date(t.valid_until) < new Date();
      let graceDays = 0;
      if (isOverdue) {
        graceDays = Math.max(0, Math.ceil((new Date() - new Date(t.valid_until)) / (1000 * 60 * 60 * 24)));
      }
      return {
        id: t.id,
        name: t.name || t.company_name || 'Empresa Sem Nome',
        cnpj: t.cnpj || '00.000.000/0001-00',
        contactEmail: t.contact_email || t.email,
        status: t.license_status || 'ACTIVE',
        licenseKey: t.license_key,
        expiresAt: t.valid_until,
        gracePeriodDays: graceDays,
        plan: t.plan || t.plan_tier || 'Standard (Até 2.000 alunos)',
        monthlyPrice: parseFloat(t.monthly_price || 690.00),
        lastHeartbeat: t.last_heartbeat_at || t.last_heartbeat || t.updated_at
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tenants/:id/extend-license', requireMasterAuth, async (req, res) => {
  const { id } = req.params;
  const days = parseInt(req.body.days || 15, 10);
  try {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    
    await db.query(`
      UPDATE licenses 
      SET valid_until = $1, status = 'ACTIVE' 
      WHERE tenant_id = $2
    `, [newDate.toISOString(), id]);

    res.json({ success: true, message: `Licença estendida em +${days} dias com sucesso.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faturamento / Invoices - Protegido por requireMasterAuth
router.get('/billing/invoices', requireMasterAuth, async (req, res) => {
  try {
    const invoices = await db.query(`
      SELECT i.*, t.name as tenant_name, t.company_name
      FROM invoices i
      JOIN tenants t ON i.tenant_id = t.id
      ORDER BY i.due_date DESC
    `);
    
    const formatted = (invoices.rows || []).map(inv => ({
      id: inv.id || inv.asaas_invoice_id,
      tenantName: inv.tenant_name || inv.company_name || 'Instância UniDesk',
      asaasCustomerId: inv.asaas_customer_id,
      billingType: inv.billing_type || 'PIX',
      value: parseFloat(inv.amount || 0),
      status: inv.status || 'PENDING',
      dueDate: inv.due_date,
      paymentDate: inv.payment_date,
      invoiceUrl: inv.invoice_url || `https://sandbox.asaas.com/i/${inv.id || inv.asaas_invoice_id}`
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Suporte N2/N3 (Tickets) - Listagem e Respostas protegidos por requireMasterAuth
router.get('/support/tickets', requireMasterAuth, async (req, res) => {
  try {
    const tickets = await db.query(`
      SELECT s.*, t.name as tenant_name, t.company_name
      FROM support_tickets s
      LEFT JOIN tenants t ON s.tenant_id = t.id
      ORDER BY s.created_at DESC
    `);
    
    const formatted = (tickets.rows || []).map(tk => {
      let parsedDiag = {};
      try {
        const raw = tk.diagnostics_payload || tk.diagnostics;
        parsedDiag = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      } catch (_) {
        parsedDiag = {};
      }

      const responses = Array.isArray(tk.responses) 
        ? tk.responses 
        : (tk.vendor_response ? [{
            author: 'Master Admin (Central Suporte)',
            date: tk.resolved_at || tk.updated_at || tk.created_at,
            message: tk.vendor_response
          }] : []);

      return {
        id: tk.id,
        tenantId: tk.tenant_id,
        tenantName: tk.tenant_name || tk.company_name || 'Instância UniDesk',
        title: tk.title || tk.subject || 'Chamado de Suporte',
        subject: tk.subject || tk.title || 'Chamado de Suporte',
        description: tk.description || '',
        priority: tk.priority || 'MEDIUM',
        status: tk.status || 'OPEN',
        createdAt: tk.created_at,
        diagnostics: parsedDiag,
        responses,
        vendorResponse: tk.vendor_response,
        resolvedAt: tk.resolved_at
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criação de Ticket de Suporte
// Aceita tanto 'title' quanto 'subject'.
// Lê o header 'X-Tenant-License-Key' para identificar e vincular a empresa (tenant_id) automaticamente.
router.post('/support/tickets', async (req, res) => {
  try {
    const licenseKeyHeader = req.headers['x-tenant-license-key'] || req.headers['x-tenant-license-key'.toLowerCase()];
    const licenseKey = licenseKeyHeader || req.body.license_key;

    let tenantId = req.body.tenant_id;
    let licenseFound = null;

    if (licenseKey) {
      licenseFound = await db.getLicenseByKey(licenseKey);
      if (licenseFound) {
        tenantId = licenseFound.tenant_id;
      } else {
        console.warn(`[Support] Chave de licença '${licenseKey}' não localizada no banco.`);
      }
    }

    // Se não encontrou tenant_id por chave de licença nem veio no body, verifica se há token Master
    if (!tenantId) {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        tenantId = 'anonymous';
      }
    }

    const title = req.body.title || req.body.subject || 'Chamado de Suporte';
    const description = req.body.description || '';
    const priority = req.body.priority || 'MEDIUM';
    const diagnostics = req.body.diagnostics || req.body.diagnostics_payload || req.body.diagnosticsSent || {};
    const ticketId = `TICK-${Date.now().toString(36).toUpperCase()}`;

    await db.query(`
      INSERT INTO support_tickets (id, tenant_id, subject, description, priority, status, diagnostics, created_at)
      VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7)
    `, [
      ticketId,
      tenantId || 'anonymous',
      title,
      description,
      priority,
      JSON.stringify(diagnostics),
      new Date().toISOString()
    ]);

    res.status(201).json({
      success: true,
      ticket_id: ticketId,
      tenant_id: tenantId,
      title,
      message: 'Chamado técnico aberto com sucesso na Central UniDesk'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Responder a chamado - Protegido por requireMasterAuth
router.post('/support/tickets/:id/reply', requireMasterAuth, async (req, res) => {
  const { id } = req.params;
  const vendorResponse = req.body.response || req.body.message;
  const status = req.body.status || 'ANSWERED';
  try {
    await db.query(`
      UPDATE support_tickets 
      SET vendor_response = $1, status = $2, resolved_at = $3
      WHERE id = $4
    `, [
      vendorResponse,
      status,
      status === 'RESOLVED' || status === 'CLOSED' ? new Date().toISOString() : null,
      id
    ]);

    res.json({ success: true, message: 'Chamado respondido e atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fechar / Finalizar chamado - Protegido por requireMasterAuth
router.patch('/support/tickets/:id/close', requireMasterAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`
      UPDATE support_tickets 
      SET status = 'CLOSED', resolved_at = $1
      WHERE id = $2
    `, [new Date().toISOString(), id]);

    res.json({ success: true, message: 'Chamado finalizado e encerrado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
