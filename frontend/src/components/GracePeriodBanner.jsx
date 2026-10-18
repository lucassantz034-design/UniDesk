import React from 'react';
import { AlertTriangle, ExternalLink, CreditCard, Clock, ShieldAlert } from 'lucide-react';

export default function GracePeriodBanner({ licenseState, onOpenPaymentModal }) {
  if (!licenseState || licenseState.status !== 'GRACE_PERIOD') {
    return null;
  }

  const daysIn = licenseState.daysInGrace || 1;
  const daysRemaining = licenseState.daysRemainingGrace !== undefined 
    ? licenseState.daysRemainingGrace 
    : Math.max(0, 15 - daysIn);

  return (
    <div style={{
      background: 'linear-gradient(90deg, #7c2d12 0%, #9a3412 100%)',
      borderBottom: '1px solid #ea580c',
      color: '#fff',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      boxShadow: '0 4px 12px rgba(154, 52, 18, 0.25)',
      position: 'relative',
      zIndex: 40
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '0.5rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <AlertTriangle size={22} color="#fdba74" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Aviso de Faturamento & Tolerância — Dia {daysIn} de 15
            <span style={{
              background: '#ea580c',
              fontSize: '0.7rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#ffedd5', marginTop: '0.15rem' }}>
            A renovação da licença UniDesk está pendente. As operações de alunos e atendentes continuam normais até o 15º dia. Regularize para evitar o bloqueio total no 16º dia.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {licenseState.invoice?.paymentUrl && (
          <a
            href={licenseState.invoice.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            Pagar Fatura Asaas <ExternalLink size={14} />
          </a>
        )}
        <button
          onClick={onOpenPaymentModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#fff',
            color: '#9a3412',
            border: 'none',
            borderRadius: '8px',
            padding: '0.45rem 1rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          <CreditCard size={15} /> Ver Pix / Boleto
        </button>
      </div>
    </div>
  );
}
