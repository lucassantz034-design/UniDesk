import React, { useState } from 'react';
import { Lock, QrCode, Copy, Check, ExternalLink, RefreshCw, AlertOctagon, HelpCircle } from 'lucide-react';
import { api } from '../services/api';

export default function LicenseLockModal({ isOpen, licenseState, onRefreshStatus, onOpenSupport }) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const invoice = licenseState?.invoice || {
    message: 'Fatura Anual de Licenciamento UniDesk',
    amount: 1499.00,
    paymentUrl: 'https://asaas.com/i/unidesk-licenca',
    pixQrCode: '00020101021226840014br.gov.bcb.pix2562pix.asaas.com/qr/v2/cobv/unidesk-licenca-anual5204000053039865405599.005802BR5925UNIDESK SOLUCOES SAAS LTDA6009SAO PAULO62070503***6304E85C'
  };

  const handleCopyPix = () => {
    if (invoice.pixQrCode) {
      navigator.clipboard.writeText(invoice.pixQrCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleCheckPayment = async () => {
    setIsVerifying(true);
    try {
      if (onRefreshStatus) {
        await onRefreshStatus();
      } else {
        await api.triggerLicenseHeartbeat();
      }
    } catch (err) {
      alert('Erro ao sincronizar com a Central: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 7, 15, 0.92)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #dc2626',
        boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.35)',
        borderRadius: '20px',
        maxWidth: '580px',
        width: '100%',
        color: '#f8fafc',
        padding: '2rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Ícone de Cadeado de Bloqueio */}
        <div style={{
          width: '64px',
          height: '64px',
          background: 'rgba(220, 38, 38, 0.15)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          border: '1px solid rgba(220, 38, 38, 0.4)'
        }}>
          <Lock size={32} color="#ef4444" />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: '#ef444420',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          marginBottom: '0.75rem'
        }}>
          <AlertOctagon size={13} /> PRAZO DE TOLERÂNCIA EXPIRADO (DIA 16+)
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
          Sistema UniDesk Bloqueado
        </h2>

        <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          O período de tolerância de 15 dias da assinatura da sua instituição expirou sem confirmação de pagamento. As requisições operacionais foram suspensas (HTTP 402). Efetue a regularização abaixo via Asaas para reativar o acesso imediatamente.
        </p>

        {/* Card do Pix / Boleto Asaas */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Fatura Asaas (Pix / Boleto)</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
              R$ {invoice.amount ? Number(invoice.amount).toFixed(2).replace('.', ',') : '1.499,00'}
            </span>
          </div>

          {/* QR Code Pix Simulado com SVG */}
          <div style={{
            background: '#ffffff',
            padding: '1rem',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <svg viewBox="0 0 100 100" width="120" height="120">
              <path d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z M40,10 h20 v10 h-20 z M40,30 h10 v30 h-10 z M60,40 h30 v10 h-30 z M40,70 h20 v20 h-20 z M70,70 h20 v10 h-20 z M70,90 h30 v10 h-30 z" fill="#0f172a" />
            </svg>
            <span style={{ color: '#0f172a', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem' }}>
              QR Code Pix Dinâmico Asaas
            </span>
          </div>

          {/* Código Pix Copia e Cola */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            background: '#0f172a',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid #334155',
            alignItems: 'center'
          }}>
            <input
              type="text"
              readOnly
              value={invoice.pixQrCode || '00020101021226840014br.gov.bcb.pix...'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                fontSize: '0.75rem',
                flex: 1,
                outline: 'none',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={handleCopyPix}
              style={{
                background: copiedPix ? '#10b981' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              {copiedPix ? <Check size={13} /> : <Copy size={13} />}
              {copiedPix ? 'Copiado!' : 'Copiar Pix'}
            </button>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleCheckPayment}
              disabled={isVerifying}
              style={{
                flex: 1,
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <RefreshCw size={16} className={isVerifying ? 'animate-spin' : ''} />
              {isVerifying ? 'Verificando com a Central...' : 'Já paguei, verificar agora'}
            </button>

            {invoice.paymentUrl && (
              <a
                href={invoice.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  justifyContent: 'center'
                }}
              >
                Abrir Fatura <ExternalLink size={15} />
              </a>
            )}
          </div>

          {onOpenSupport && (
            <button
              onClick={onOpenSupport}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.3rem'
              }}
            >
              <HelpCircle size={14} /> Dificuldades com a regularização? Abrir chamado com fornecedor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
