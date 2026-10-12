import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function Header({ config, isWsConnected, currentUser }) {
  return (
    <header className="unidesk-navbar">
      <div className="brand-wrapper">
        <img
          src={config?.logoUrl || '/assets/LOGO_UD.png'}
          alt="Logo"
          className="brand-logo"
          onError={(e) => {
            e.target.src = '/assets/LOGO_UD.png';
          }}
        />
        <div>
          <div className="brand-title">{config?.name || 'UniDesk Helpdesk'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {config?.tagline || 'Central de Atendimento ao Aluno & Suporte Integrado'}
          </div>
        </div>
      </div>



      {/* Status & User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          title={isWsConnected ? 'Conectado em tempo real ao Go Gateway' : 'Conectando ao Go Gateway...'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            padding: '0.3rem 0.65rem',
            borderRadius: '20px',
            background: isWsConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isWsConnected ? '#10b981' : '#ef4444',
            fontWeight: 600,
          }}
        >
          {isWsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isWsConnected ? 'Go Gateway Online' : 'Reconectando'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
            alt="Avatar"
            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
          />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{currentUser?.name || 'Usuário'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{currentUser?.department || currentUser?.course || 'UniDesk'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
