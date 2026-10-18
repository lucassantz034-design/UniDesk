const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const KEYS_DIR = path.resolve(__dirname, '../../keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'ed25519_private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'ed25519_public.pem');

const CANONICAL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAZ5dhu9LsFuBHukWjqwXWYyGQyF16YhLGZ89Qz4R36Sw=
-----END PUBLIC KEY-----`;

const CANONICAL_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEINMMoYcFVLlCD6E5uTt5Oii1r5rymKTW81w494dkBdWN
-----END PRIVATE KEY-----`;

let privateKeyPem = null;
let publicKeyPem = null;

function ensureKeys() {
  if (process.env.ED25519_PRIVATE_KEY && process.env.ED25519_PUBLIC_KEY) {
    privateKeyPem = process.env.ED25519_PRIVATE_KEY.replace(/\\n/g, '\n').trim() + '\n';
    publicKeyPem = process.env.ED25519_PUBLIC_KEY.replace(/\\n/g, '\n').trim() + '\n';
    return;
  }

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    const existingPub = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8').trim();
    const existingPriv = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8').trim();

    if (existingPub === CANONICAL_PUBLIC_KEY.trim()) {
      privateKeyPem = existingPriv + '\n';
      publicKeyPem = existingPub + '\n';
      return;
    }
    console.warn('[CryptoService] Chave pública divergente detectada no disco. Restaurando par Ed25519 canônico.');
  }

  // Grava o par Ed25519 canônico
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  fs.writeFileSync(PRIVATE_KEY_PATH, CANONICAL_PRIVATE_KEY + '\n');
  fs.writeFileSync(PUBLIC_KEY_PATH, CANONICAL_PUBLIC_KEY + '\n');

  privateKeyPem = CANONICAL_PRIVATE_KEY + '\n';
  publicKeyPem = CANONICAL_PUBLIC_KEY + '\n';
}

function base64UrlEncode(strOrBuffer) {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer);
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Emite token assinado com Ed25519
 * @param {Object} payload 
 * @returns {string} token formato JWT (header.payload.signature)
 */
function issueLicenseToken(payload) {
  ensureKeys();

  const header = {
    alg: 'EdDSA',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const completePayload = {
    iat: now,
    ...payload
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(completePayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.sign(null, Buffer.from(dataToSign), privateKeyPem);
  const encodedSignature = base64UrlEncode(signature);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Valida o token com Ed25519
 * @param {string} token 
 * @returns {Object} payload verificado
 */
function verifyLicenseToken(token) {
  ensureKeys();

  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido ou não fornecido');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token inválido');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlDecode(encodedSignature);

  const isValid = crypto.verify(null, Buffer.from(dataToSign), publicKeyPem, signature);
  if (!isValid) {
    throw new Error('Assinatura Ed25519 inválida ou adulterada');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  return payload;
}

function getPublicKey() {
  ensureKeys();
  return publicKeyPem;
}

module.exports = {
  issueLicenseToken,
  verifyLicenseToken,
  getPublicKey,
  ensureKeys,
  CANONICAL_PUBLIC_KEY,
  CANONICAL_PRIVATE_KEY
};
