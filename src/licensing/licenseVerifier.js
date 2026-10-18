import crypto from 'crypto';

/**
 * Public key da Central Control Plane para verificação matemática Ed25519.
 * Pode ser configurada via variável de ambiente CENTRAL_ED25519_PUBLIC_KEY
 * ou utilizar a chave pública padrão de emissão do ecossistema UniDesk.
 */
const DEFAULT_CENTRAL_PUBLIC_KEY = process.env.CENTRAL_ED25519_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAZ5dhu9LsFuBHukWjqwXWYyGQyF16YhLGZ89Qz4R36Sw=
-----END PUBLIC KEY-----`;

export class LicenseVerifier {
  constructor(publicKeyPem = DEFAULT_CENTRAL_PUBLIC_KEY) {
    this.publicKeyPem = publicKeyPem;
  }

  /**
   * Decodifica string base64url para JSON ou Buffer
   */
  static base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64');
  }

  /**
   * Codifica Buffer ou string para base64url
   */
  static base64UrlEncode(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Valida o token JWT assinado pela Central usando Ed25519
   * @param {string} token - JWT no formato header.payload.signature
   * @returns {{ valid: boolean, payload?: any, error?: string }}
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token de licença não fornecido ou inválido.' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Formato de token JWT inválido (esperado 3 partes).' };
    }

    const [headerB64, payloadB64, sigB64] = parts;

    try {
      // 1. Decodificar header e verificar algoritmo
      const headerStr = LicenseVerifier.base64UrlDecode(headerB64).toString('utf8');
      const header = JSON.parse(headerStr);

      if (header.alg !== 'EdDSA') {
        return { valid: false, error: `Algoritmo não suportado: ${header.alg}. Requer EdDSA (Ed25519).` };
      }

      // 2. Validar assinatura criptográfica Ed25519
      const dataToVerify = Buffer.from(`${headerB64}.${payloadB64}`);
      const signatureBuf = LicenseVerifier.base64UrlDecode(sigB64);

      const isValidSignature = crypto.verify(
        null,
        dataToVerify,
        this.publicKeyPem,
        signatureBuf
      );

      if (!isValidSignature) {
        return { valid: false, error: 'Assinatura matemática Ed25519 inválida ou chave adulterada.' };
      }

      // 3. Decodificar payload
      const payloadStr = LicenseVerifier.base64UrlDecode(payloadB64).toString('utf8');
      const payload = JSON.parse(payloadStr);

      // 4. Validar prazos e status
      const now = new Date();
      const validUntil = payload.valid_until ? new Date(payload.valid_until) : null;
      const graceUntil = payload.grace_until ? new Date(payload.grace_until) : null;

      let calculatedStatus = payload.status || 'ACTIVE';

      if (validUntil && now > validUntil) {
        if (graceUntil && now <= graceUntil) {
          calculatedStatus = 'GRACE_PERIOD';
        } else {
          calculatedStatus = 'LOCKED';
        }
      }

      return {
        valid: true,
        status: calculatedStatus,
        payload: {
          ...payload,
          effective_status: calculatedStatus
        }
      };
    } catch (err) {
      return {
        valid: false,
        error: `Falha na verificação matemática da licença: ${err.message}`
      };
    }
  }
}

export const licenseVerifier = new LicenseVerifier();
