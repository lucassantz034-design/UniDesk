const crypto = require('node:crypto');

// Secret JWT
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET deve estar obrigatoriamente configurado em produção.');
    }
    return 'unidesk_central_master_dev_jwt_secret_2026_xyz';
  }
  return secret.trim();
}

/**
 * Utilitários Base64URL para JWT RFC 7519 nativo
 */
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
 * Hash de senha com PBKDF2 (SHA-512, 100.000 iterações e salt criptográfico)
 */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  if (!password || typeof password !== 'string') {
    throw new Error('Senha inválida para hashing');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Validação segura de senha com proteção contra timing attacks
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, expectedHash] = storedHash.split(':');
  const actualHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  const actualBuf = Buffer.from(actualHash, 'hex');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Emite token JWT real HS256
 */
function issueMasterJwt(payload, expiresInSeconds = 86400) {
  const secret = getJwtSecret();
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const completePayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(completePayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Valida token JWT HS256
 */
function verifyMasterJwt(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token não fornecido ou inválido');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token JWT inválido');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const secret = getJwtSecret();

  const expectedSignature = crypto.createHmac('sha256', secret).update(dataToSign).digest();
  const actualSignature = base64UrlDecode(encodedSignature);

  if (expectedSignature.length !== actualSignature.length || !crypto.timingSafeEqual(expectedSignature, actualSignature)) {
    throw new Error('Assinatura do token JWT inválida ou adulterada');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('Token JWT expirado');
  }

  return payload;
}

// Configuração do usuário Master Admin
let cachedAdminHash = null;

function getExpectedAdminHash() {
  if (cachedAdminHash) return cachedAdminHash;

  if (process.env.ADMIN_PASSWORD_HASH) {
    cachedAdminHash = process.env.ADMIN_PASSWORD_HASH.trim();
    return cachedAdminHash;
  }

  if (process.env.ADMIN_PASSWORD) {
    cachedAdminHash = hashPassword(process.env.ADMIN_PASSWORD);
    return cachedAdminHash;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_PASSWORD_HASH ou ADMIN_PASSWORD deve ser definido em ambiente de produção.');
  }

  // Em desenvolvimento local apenas, usa hash do padrão admin123
  console.warn('[Segurança] ADMIN_PASSWORD não configurada. Usando hash padrão para desenvolvimento local.');
  cachedAdminHash = hashPassword('admin123');
  return cachedAdminHash;
}

/**
 * Autentica o Master Super Admin
 */
function authenticateMaster(username, password) {
  const expectedUser = (process.env.ADMIN_USERNAME || 'admin').trim();
  if (!username || username.trim() !== expectedUser) {
    return null;
  }

  const storedHash = getExpectedAdminHash();
  const isValid = verifyPassword(password, storedHash);

  if (!isValid) {
    return null;
  }

  const user = {
    id: 'master-super-admin',
    name: 'Master Super Admin',
    username: expectedUser,
    role: 'SUPER_ADMIN'
  };

  const token = issueMasterJwt({
    sub: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  });

  return { token, user };
}

/**
 * Middleware Express para proteger rotas administrativas
 */
function requireMasterAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado: Bearer token ausente' });
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = verifyMasterJwt(token);
    if (!decoded || decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Acesso negado: Requer privilégios SUPER_ADMIN' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada', details: err.message });
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueMasterJwt,
  verifyMasterJwt,
  authenticateMaster,
  requireMasterAuth
};
