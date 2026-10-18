import { heartbeatClient } from './heartbeatClient.js';

/**
 * Rotas que são sempre permitidas, mesmo quando o sistema está com status LOCKED.
 * Permite que o administrador consulte o status da licença, force a sincronização,
 * veja dados da fatura para pagamento e acesse suporte.
 */
const ALLOWED_LOCKED_ROUTES = [
  '/api/health',
  '/api/config',
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/licensing/status',
  '/api/licensing/heartbeat',
  '/api/licensing/invoice',
  '/api/licensing/simulate',
  '/api/admin/support/ticket'
];

/**
 * Middleware Express para verificação contínua do estado da licença
 */
export function licenseGuardMiddleware(req, res, next) {
  const licenseState = heartbeatClient.getStatus();
  const fullPath = (req.baseUrl || '') + req.path;
  const path = req.path;

  // Anexa headers informativos em todas as requisições
  res.setHeader('X-License-Status', licenseState.status);
  res.setHeader('X-License-Grace-Days', licenseState.daysInGrace || 0);

  // Se o status for LOCKED (dia 16+), bloquear requisições operacionais
  if (licenseState.status === 'LOCKED') {
    const isAllowed = ALLOWED_LOCKED_ROUTES.some(allowed => fullPath.startsWith(allowed) || path.startsWith(allowed));

    if (!isAllowed) {
      return res.status(402).json({
        error: 'Payment Required: A licença do software UniDesk encontra-se bloqueada por inadimplência.',
        code: 'LICENSE_LOCKED',
        status: 'LOCKED',
        daysInGrace: licenseState.daysInGrace || 16,
        invoice: licenseState.invoice || {
          message: 'Efetue a regularização da fatura Asaas via Pix ou Boleto para desbloquear o sistema imediatamente.',
          paymentUrl: 'https://asaas.com/i/unidesk-licenca',
          pixQrCode: '00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/cobv/unidesk-licenca-anual5204000053039865405599.005802BR5925UNIDESK SOLUCOES SAAS LTDA6009SAO PAULO62070503***6304E85C'
        }
      });
    }
  }

  // Se o status for GRACE_PERIOD (dias 1 a 15), permite a requisição mas adiciona flag
  if (licenseState.status === 'GRACE_PERIOD') {
    req.licenseWarning = {
      status: 'GRACE_PERIOD',
      daysInGrace: licenseState.daysInGrace || 1,
      daysRemaining: licenseState.daysRemainingGrace !== undefined ? licenseState.daysRemainingGrace : (15 - (licenseState.daysInGrace || 1)),
      invoice: licenseState.invoice
    };
    res.setHeader('X-License-Warning', 'GRACE_PERIOD_ACTIVE');
  }

  next();
}
