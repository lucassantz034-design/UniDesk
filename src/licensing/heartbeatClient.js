import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { licenseVerifier } from './licenseVerifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de cache seguro de licença
const CACHE_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'license_cache.enc');

// Chave e IV derivados da máquina local/ambiente para criptografia AES-256-GCM
const ENCRYPTION_SECRET = process.env.LICENSE_CACHE_SECRET || 'unidesk-offline-license-cache-salt-2026';

export class HeartbeatClient {
  constructor() {
    this.centralUrl = process.env.CENTRAL_API_URL || 'https://central.unidesk.edu.br';
    this.licenseKey = process.env.LICENSE_KEY || 'UNI-HOSTED-2026-BR-ACTIVE';
    this.instanceUuid = process.env.INSTANCE_UUID || this.getOrCreateInstanceId();
    this.heartbeatIntervalMs = 24 * 60 * 60 * 1000; // 24 horas
    this.timer = null;
    this.syncSuccessCallbacks = [];

    // Estado em memória inicial
    this.currentState = {
      status: 'ACTIVE', // 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED'
      lastSync: null,
      validUntil: null,
      graceUntil: null,
      daysInGrace: 0,
      daysRemainingGrace: 15,
      tenantId: null,
      companyName: 'Instituição de Ensino Superior',
      planTier: 'ENTERPRISE',
      token: null,
      invoice: null
    };

    // Tentar carregar cache seguro salvo
    this.loadSecureCache();
  }

  getOrCreateInstanceId() {
    try {
      const dataDir = path.join(__dirname, '..', '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const idPath = path.join(dataDir, 'instance_id.txt');
      if (fs.existsSync(idPath)) {
        return fs.readFileSync(idPath, 'utf8').trim();
      }
      const newId = `inst-${crypto.randomUUID()}`;
      fs.writeFileSync(idPath, newId, 'utf8');
      return newId;
    } catch (_) {
      return 'inst-local-unidesk';
    }
  }

  /**
   * Criptografa os dados com AES-256-GCM antes de persistir
   */
  encryptPayload(plainText) {
    const key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      tag: authTag
    });
  }

  /**
   * Decriptografa com AES-256-GCM
   */
  decryptPayload(encryptedJson) {
    try {
      const { iv, data, tag } = JSON.parse(encryptedJson);
      const key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[HeartbeatClient] Falha ao decriptografar cache seguro:', err.message);
      return null;
    }
  }

  saveSecureCache() {
    try {
      const dataDir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const raw = JSON.stringify(this.currentState);
      const encrypted = this.encryptPayload(raw);
      fs.writeFileSync(CACHE_FILE_PATH, encrypted, 'utf8');
    } catch (err) {
      console.error('[HeartbeatClient] Erro ao salvar cache de licença:', err);
    }
  }

  loadSecureCache() {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const fileContent = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
        const decrypted = this.decryptPayload(fileContent);
        if (decrypted) {
          const cached = JSON.parse(decrypted);
          this.currentState = {
            ...this.currentState,
            ...cached
          };
          // Re-avaliar prazos baseados no relógio atual
          this.recalculateStatus();
        }
      }
    } catch (err) {
      console.warn('[HeartbeatClient] Cache seguro ausente ou inválido. Usando estado padrão.');
    }
  }

  recalculateStatus() {
    const now = new Date();
    if (this.currentState.validUntil) {
      const validUntil = new Date(this.currentState.validUntil);
      const graceUntil = this.currentState.graceUntil ? new Date(this.currentState.graceUntil) : null;

      if (now > validUntil) {
        if (graceUntil && now <= graceUntil) {
          this.currentState.status = 'GRACE_PERIOD';
          const diffMs = now.getTime() - validUntil.getTime();
          const daysIn = Math.min(15, Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24))));
          this.currentState.daysInGrace = daysIn;
          this.currentState.daysRemainingGrace = Math.max(0, 15 - daysIn);
        } else {
          this.currentState.status = 'LOCKED';
          this.currentState.daysInGrace = 16;
          this.currentState.daysRemainingGrace = 0;
        }
      } else if (this.currentState.status !== 'LOCKED') {
        this.currentState.status = 'ACTIVE';
        this.currentState.daysInGrace = 0;
        this.currentState.daysRemainingGrace = 15;
      }
    }
  }

  /**
   * Executa requisição outbound HTTPS para a Central
   */
  async sendHeartbeat(telemetry = {}) {
    const payload = JSON.stringify({
      instance_uuid: this.instanceUuid,
      license_key: this.licenseKey,
      timestamp: new Date().toISOString(),
      telemetry: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        ...telemetry
      }
    });

    return new Promise((resolve) => {
      try {
        const urlObj = new URL(`${this.centralUrl}/api/v1/license/heartbeat`);
        const isHttps = urlObj.protocol === 'https:';
        const clientModule = isHttps ? https : http;

        const req = clientModule.request(
          urlObj,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
              'X-Tenant-License-Key': this.licenseKey,
              'X-Instance-UUID': this.instanceUuid
            },
            timeout: 10000 // 10 segundos timeout
          },
          (res) => {
            let resData = '';
            res.on('data', (chunk) => {
              resData += chunk;
            });

            res.on('end', () => {
              try {
                const response = JSON.parse(resData);
                if (response.token) {
                  // Validar matematicamente o token recebido da Central
                  const verification = licenseVerifier.verifyToken(response.token);
                  if (verification.valid) {
                    this.currentState.status = verification.status;
                    this.currentState.token = response.token;
                    this.currentState.validUntil = verification.payload.valid_until;
                    this.currentState.graceUntil = verification.payload.grace_until;
                    this.currentState.tenantId = verification.payload.tenant_id;
                    this.currentState.companyName = verification.payload.company_name || this.currentState.companyName;
                    this.currentState.planTier = verification.payload.plan_tier || this.currentState.planTier;
                    this.currentState.invoice = response.invoice || null;
                    this.currentState.lastSync = new Date().toISOString();

                    this.recalculateStatus();
                    this.saveSecureCache();
                    this.notifySyncSuccess();

                    return resolve({
                      success: true,
                      status: this.currentState.status,
                      verified: true,
                      data: this.currentState
                    });
                  } else {
                    console.error('[HeartbeatClient] Assinatura do token rejeitada:', verification.error);
                  }
                } else if (response.success || response.verified) {
                  this.currentState.lastSync = new Date().toISOString();
                  this.recalculateStatus();
                  this.saveSecureCache();
                  this.notifySyncSuccess();

                  return resolve({
                    success: true,
                    status: this.currentState.status,
                    verified: true,
                    data: this.currentState
                  });
                }

                // Se respondeu mas sem token válido
                this.recalculateStatus();
                resolve({
                  success: false,
                  status: this.currentState.status,
                  error: 'Token da Central não pôde ser verificado criptograficamente'
                });
              } catch (e) {
                this.recalculateStatus();
                resolve({
                  success: false,
                  status: this.currentState.status,
                  error: `Resposta da Central inválida: ${e.message}`
                });
              }
            });
          }
        );

        req.on('error', (err) => {
          // Operação Offline tolerante
          console.warn(`[HeartbeatClient] Central inacessível (${err.message}). Operando com cache local seguro.`);
          this.recalculateStatus();
          this.saveSecureCache();
          resolve({
            success: false,
            offlineMode: true,
            status: this.currentState.status,
            data: this.currentState
          });
        });

        req.on('timeout', () => {
          req.destroy();
          console.warn('[HeartbeatClient] Timeout ao contatar Central. Operando com cache local.');
          this.recalculateStatus();
          resolve({
            success: false,
            offlineMode: true,
            status: this.currentState.status,
            data: this.currentState
          });
        });

        req.write(payload);
        req.end();
      } catch (err) {
        this.recalculateStatus();
        resolve({
          success: false,
          status: this.currentState.status,
          error: err.message
        });
      }
    });
  }

  startPeriodicSync() {
    if (this.timer) clearInterval(this.timer);

    // Executar imediatamente na inicialização
    this.sendHeartbeat().catch((err) => console.error('[HeartbeatClient] Erro no sync inicial:', err));

    // Agendar a cada 24 horas
    this.timer = setInterval(() => {
      this.sendHeartbeat().catch((err) => console.error('[HeartbeatClient] Erro no sync periódico:', err));
    }, this.heartbeatIntervalMs);
  }

  stopPeriodicSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus() {
    this.recalculateStatus();
    return {
      ...this.currentState,
      instanceUuid: this.instanceUuid,
      licenseKey: this.licenseKey
    };
  }

  onSyncSuccess(callback) {
    if (typeof callback === 'function') {
      this.syncSuccessCallbacks.push(callback);
    }
  }

  notifySyncSuccess() {
    for (const callback of this.syncSuccessCallbacks) {
      try {
        callback(this.currentState);
      } catch (err) {
        console.error('[HeartbeatClient] Erro ao executar callback de sincronização:', err);
      }
    }
  }

  // Método administrativo para simular ou forçar estado (útil para testes de QA e demonstrações)
  forceState(state) {
    this.currentState = {
      ...this.currentState,
      ...state
    };
    this.saveSecureCache();
    return this.getStatus();
  }
}

export const heartbeatClient = new HeartbeatClient();
