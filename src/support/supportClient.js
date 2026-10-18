import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { heartbeatClient } from '../licensing/heartbeatClient.js';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de contingência local para chamados pendentes
const PENDING_TICKETS_FILE = path.join(__dirname, '..', '..', 'data', 'pending_support_tickets.json');

export class SupportClient {
  constructor() {
    this.centralUrl = process.env.CENTRAL_API_URL || 'https://central.unidesk.edu.br';
  }

  /**
   * =========================================================================
   * CONFORMIDADE LGPD (Lei Federal 13.709/2018) — HIGIENIZAÇÃO DE TELEMETRIA
   * =========================================================================
   */

  /**
   * Mascara endereços de e-mail para impedir vazamento de PII (ex: 'u***@***')
   */
  maskEmail(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, 'u***@***');
  }

  /**
   * Mascara números de CPF (ex: '***.***.***-**')
   */
  maskCpf(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***.***.***-**');
  }

  /**
   * Remove e mascara PIIs de strings livres
   */
  sanitizeText(text) {
    if (typeof text !== 'string') return text;
    return this.maskEmail(this.maskCpf(text));
  }

  /**
   * Higieniza os logs administrativos e operacionais do UniDesk antes da transmissão.
   * Remove rigorosamente nomes completos de alunos, professores e atendentes,
   * bem como CPFs e e-mails pessoais, mantendo apenas metadados técnicos de auditoria.
   */
  sanitizeLogs(logs) {
    if (!Array.isArray(logs)) return [];

    return logs.map((log) => {
      // Obfuscação técnica de IDs (mantém identificador estrutural anônimo sem expor identidade)
      const adminRef = log.admin_id ? `ADM-${String(log.admin_id).slice(-4)}` : undefined;
      const targetRef = log.usuario_alvo_id ? `USR-${String(log.usuario_alvo_id).slice(-4)}` : undefined;

      return {
        id: log.id,
        action: this.sanitizeText(log.acao || log.action || 'SISTEMA_LOG'),
        route: log.route || undefined,
        httpStatus: log.httpStatus || log.status_http || undefined,
        errorCode: log.errorCode || log.error_code || undefined,
        actorType: adminRef ? 'ADMIN_ON_PREMISE' : undefined,
        adminRef,
        targetRef,
        timestamp: log.criado_em || log.timestamp || log.created_at || new Date().toISOString()
      };
    });
  }

  /**
   * Coleta telemetria e diagnóstico do ambiente local para enriquecer o chamado
   * em estrito cumprimento às diretrizes de privacidade da LGPD.
   */
  collectDiagnostics() {
    const mem = process.memoryUsage();
    let dbEngine = 'SQLite (Native DatabaseSync)';
    let totalTickets = 0;
    let totalUsers = 0;

    try {
      const tickets = db.getTickets();
      totalTickets = Array.isArray(tickets) ? tickets.length : 0;
      const users = db.getUsers();
      totalUsers = Array.isArray(users) ? users.length : 0;
    } catch (_) {}

    // Coleta logs recentes do sistema e aplica higienização LGPD
    let sanitizedLogs = [];
    try {
      const rawLogs = db.getLogsAdmin ? db.getLogsAdmin() : [];
      if (Array.isArray(rawLogs)) {
        sanitizedLogs = this.sanitizeLogs(rawLogs.slice(-10));
      }
    } catch (_) {}

    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      dbEngine,
      databaseMetrics: {
        totalTickets,
        totalUsers
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024)
      },
      recentLogs: sanitizedLogs,
      lgpdCompliant: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * =========================================================================
   * FILA DE CONTINGÊNCIA LOCAL (PERSISTÊNCIA DATA/PENDING_SUPPORT_TICKETS.JSON)
   * =========================================================================
   */

  /**
   * Lê a lista de chamados retidos na contingência local
   */
  loadPendingTickets() {
    try {
      if (fs.existsSync(PENDING_TICKETS_FILE)) {
        const raw = fs.readFileSync(PENDING_TICKETS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.warn('[SupportClient] Aviso ao ler fila de chamados pendentes:', err.message);
    }
    return [];
  }

  /**
   * Salva a lista de chamados na contingência local
   */
  savePendingTickets(tickets) {
    try {
      const dataDir = path.dirname(PENDING_TICKETS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(PENDING_TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8');
    } catch (err) {
      console.error('[SupportClient] Erro ao persistir fila de contingência:', err.message);
    }
  }

  /**
   * Enfileira chamado para envio posterior
   */
  enqueuePendingTicket(ticketData) {
    const pending = this.loadPendingTickets();
    const queuedTicket = {
      id: ticketData.id || `sup-loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: ticketData.title,
      description: ticketData.description,
      priority: ticketData.priority || 'MEDIUM',
      category: ticketData.category || 'INCIDENT',
      contactEmail: ticketData.contactEmail,
      diagnostics_payload: ticketData.diagnostics_payload || ticketData.diagnosticsSent,
      created_at: ticketData.created_at || new Date().toISOString(),
      attempts: (ticketData.attempts || 0) + 1,
      lastAttempt: new Date().toISOString(),
      status: 'QUEUED_LOCAL'
    };

    pending.push(queuedTicket);
    this.savePendingTickets(pending);
    return queuedTicket;
  }

  /**
   * Envia uma requisição HTTP/HTTPS direta à Central UniDesk
   */
  async sendTicketToCentral(payloadObj) {
    const licenseState = heartbeatClient.getStatus();
    const payload = JSON.stringify({
      ...payloadObj,
      instance_uuid: licenseState.instanceUuid,
      license_key: licenseState.licenseKey,
      timestamp: payloadObj.timestamp || new Date().toISOString()
    });

    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(`${this.centralUrl}/api/v1/support/tickets`);
        const isHttps = urlObj.protocol === 'https:';
        const clientModule = isHttps ? https : http;

        const req = clientModule.request(
          urlObj,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
              'X-Tenant-License-Key': licenseState.licenseKey,
              'X-Instance-UUID': licenseState.instanceUuid
            },
            timeout: 10000
          },
          (res) => {
            let resData = '';
            res.on('data', (chunk) => {
              resData += chunk;
            });

            res.on('end', () => {
              const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
              try {
                const response = JSON.parse(resData);
                resolve({
                  success: isSuccess,
                  statusCode: res.statusCode,
                  ticket: response.ticket || response,
                  rawResponse: response
                });
              } catch (_) {
                resolve({
                  success: isSuccess,
                  statusCode: res.statusCode,
                  rawResponse: resData
                });
              }
            });
          }
        );

        req.on('error', (err) => {
          resolve({
            success: false,
            offlineMode: true,
            error: err.message
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            offlineMode: true,
            error: 'Timeout na conexão com a Central de Suporte'
          });
        });

        req.write(payload);
        req.end();
      } catch (err) {
        resolve({
          success: false,
          offlineMode: true,
          error: err.message
        });
      }
    });
  }

  /**
   * Reenvia todos os chamados represados na fila local de contingência.
   * Acionado automaticamente após sincronização com sucesso do heartbeat.
   */
  async flushPendingTickets() {
    const pending = this.loadPendingTickets();
    if (!pending || pending.length === 0) {
      return {
        flushed: 0,
        remaining: 0,
        message: 'Fila de contingência de suporte vazia. Nenhum chamado pendente.'
      };
    }

    console.log(`[SupportClient] Iniciando reenvio de ${pending.length} chamado(s) retido(s) na contingência local...`);
    const remaining = [];
    let flushedCount = 0;

    for (const ticket of pending) {
      try {
        const sendResult = await this.sendTicketToCentral({
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          category: ticket.category,
          contactEmail: ticket.contactEmail,
          diagnostics_payload: ticket.diagnostics_payload,
          originalQueuedId: ticket.id,
          created_at: ticket.created_at
        });

        if (sendResult.success) {
          flushedCount++;
          console.log(`[SupportClient] ✅ Chamado de contingência (${ticket.id}) entregue com sucesso à Central.`);
        } else {
          console.warn(`[SupportClient] ⚠️ Chamado (${ticket.id}) não entregue. Mantendo na contingência (${sendResult.error || 'HTTP ' + sendResult.statusCode}).`);
          remaining.push({
            ...ticket,
            attempts: (ticket.attempts || 0) + 1,
            lastAttempt: new Date().toISOString(),
            lastError: sendResult.error || `HTTP ${sendResult.statusCode}`
          });
        }
      } catch (err) {
        remaining.push({
          ...ticket,
          attempts: (ticket.attempts || 0) + 1,
          lastAttempt: new Date().toISOString(),
          lastError: err.message
        });
      }
    }

    this.savePendingTickets(remaining);
    const summary = {
      flushed: flushedCount,
      remaining: remaining.length,
      message: `${flushedCount} chamado(s) reenviado(s) com sucesso. ${remaining.length} chamado(s) remanescente(s) na fila.`
    };
    console.log(`[SupportClient] Concluído flush da fila:`, summary.message);
    return summary;
  }

  /**
   * Despacha o ticket de suporte via outbound HTTPS para a Central.
   * Se a Central estiver indisponível, armazena com segurança na contingência local.
   */
  async submitTicket({ title, description, priority = 'MEDIUM', contactEmail, category = 'INCIDENT' }) {
    const diagnostics = this.collectDiagnostics();

    const payloadObj = {
      title,
      description,
      priority,
      category,
      contactEmail,
      diagnostics_payload: diagnostics
    };

    const sendResult = await this.sendTicketToCentral(payloadObj);

    if (sendResult.success) {
      return {
        success: true,
        statusCode: sendResult.statusCode,
        ticket: sendResult.ticket,
        diagnosticsSent: diagnostics
      };
    }

    // Se falhou (Central offline, timeout ou erro de rede), enfileira na contingência local
    console.warn(`[SupportClient] Central inacessível (${sendResult.error || sendResult.statusCode}). Salvando chamado na fila local.`);
    const queuedTicket = this.enqueuePendingTicket({
      title,
      description,
      priority,
      category,
      contactEmail,
      diagnostics_payload: diagnostics
    });

    return {
      success: true,
      contingencyMode: true,
      message: 'Central de Suporte inacessível no momento. Chamado registrado com segurança na fila de contingência local e será despachado automaticamente no próximo heartbeat com a Central.',
      ticket: queuedTicket,
      diagnosticsSent: diagnostics
    };
  }
}

export const supportClient = new SupportClient();

// Registra hook automático: reenvia chamados da fila local a cada sincronização bem-sucedida do Heartbeat
heartbeatClient.onSyncSuccess(async () => {
  try {
    await supportClient.flushPendingTickets();
  } catch (err) {
    console.error('[SupportClient] Erro no reenvio automático pós-heartbeat:', err.message);
  }
});
