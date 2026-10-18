import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SECRET_FILE = path.join(DATA_DIR, '.session_secret');

/**
 * Carrega ou gera o segredo único e seguro da instância para assinatura de tokens.
 */
function loadOrCreateInstanceSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.INSTANCE_SECRET) {
    return process.env.INSTANCE_SECRET;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SECRET_FILE)) {
      const saved = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (saved && saved.length >= 32) {
        return saved;
      }
    }
    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, newSecret, 'utf8');
    return newSecret;
  } catch (err) {
    console.warn('[Auth] Não foi possível persistir o segredo em disco. Usando segredo em memória.');
    return crypto.randomBytes(32).toString('hex');
  }
}

export const INSTANCE_SECRET = loadOrCreateInstanceSecret();

/**
 * Gera hash criptográfico seguro usando Scrypt com salt aleatório.
 * Formato: scrypt:salt:hash
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('A senha deve ser uma string não vazia para geração do hash.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Validação segura de senha com proteção contra timing attack.
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  try {
    const parts = storedHash.split(':');
    if (parts.length === 3 && parts[0] === 'scrypt') {
      const salt = parts[1];
      const expectedKey = Buffer.from(parts[2], 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      if (expectedKey.length !== derivedKey.length) return false;
      return crypto.timingSafeEqual(expectedKey, derivedKey);
    }

    if (parts.length === 4 && parts[0] === 'pbkdf2') {
      const salt = parts[1];
      const iterations = parseInt(parts[2], 10);
      const expectedKey = Buffer.from(parts[3], 'hex');
      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
      if (expectedKey.length !== derivedKey.length) return false;
      return crypto.timingSafeEqual(expectedKey, derivedKey);
    }

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Gera token de sessão assinado via HMAC-SHA256 (com prefixo institucional udt_).
 */
export function generateSessionToken(user, secret = INSTANCE_SECRET) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias de validade
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  return `udt_${payloadB64}.${signature}`;
}

/**
 * Valida o token de sessão HMAC-SHA256 e sua integridade matemática.
 */
export function verifySessionToken(token, secret = INSTANCE_SECRET) {
  if (!token || typeof token !== 'string') return null;

  const raw = token.startsWith('udt_') ? token.slice(4) : token;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expSigBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expSigBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // Expirado
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware para autenticação e controle de acesso baseado em papéis (RBAC).
 * @param {string[]|string} roles Papéis autorizados (ex: ['admin'], ['admin', 'tecnico'])
 */
export function requireAuth(roles = []) {
  const allowedRoles = Array.isArray(roles) ? roles : (roles ? [roles] : []);

  return async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ error: 'Acesso não autorizado: token de sessão ausente.' });
    }

    const payload = verifySessionToken(token, INSTANCE_SECRET);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Sessão inválida, token forjado ou expirado.' });
    }

    // Carregamento dinâmico do usuário no banco
    let db;
    try {
      const dbModule = await import('../db.js');
      db = dbModule.db;
    } catch (err) {
      return res.status(500).json({ error: 'Erro interno ao validar banco de dados.' });
    }

    const user = db.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário da sessão não encontrado.' });
    }

    if (user.ativo === false) {
      return res.status(401).json({ error: 'Conta de usuário desativada ou suspensa.' });
    }

    req.user = user;
    req.tokenPayload = payload;

    // Verificação de papéis (Role-Based Access Control)
    if (allowedRoles.length > 0) {
      const userRole = (user.role || '').toLowerCase();

      const hasPermission = allowedRoles.some(expectedRole => {
        const r = expectedRole.toLowerCase();
        if (r === userRole) return true;

        // Hierarquia de Administradores
        if (r === 'admin' && (userRole === 'admin' || userRole === 'admin_faculdade' || userRole === 'admin_software')) {
          return true;
        }

        // Técnicos / Atendentes (administradores também possuem acesso a essas rotas)
        if ((r === 'attendant' || r === 'tecnico') && (
          userRole === 'attendant' ||
          userRole === 'tecnico' ||
          userRole === 'admin' ||
          userRole === 'admin_faculdade' ||
          userRole === 'admin_software'
        )) {
          return true;
        }

        // Alunos
        if ((r === 'student' || r === 'aluno') && (userRole === 'student' || userRole === 'aluno')) {
          return true;
        }

        return false;
      });

      if (!hasPermission) {
        return res.status(403).json({ error: 'Acesso negado: privilégios insuficientes para este recurso.' });
      }
    }

    next();
  };
}
