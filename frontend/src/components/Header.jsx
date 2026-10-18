import React from 'react';
import { Wifi, WifiOff, LogOut, Shield, Headphones } from 'lucide-react';

export default function Header({
  config,
  isWsConnected,
  currentUser,
  onLogout,
  isLoggedIn,
  activeTab,
  onTabChange
}) {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'admin_faculdade';

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

      {/* Se for Administrador, permite alternar entre Console Admin e Mesa de Atendimento */}
      {isLoggedIn && isAdmin && onTabChange && (
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '0.25rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            gap: '0.35rem'
          }}
        >
          <button
            type="button"
            onClick={() => onTabChange('admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'admin' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'transparent',
              color: activeTab === 'admin' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Shield size={14} /> Console Admin
          </button>

          <button
            type="button"
            onClick={() => onTabChange('atendente')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'atendente' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'transparent',
              color: activeTab === 'atendente' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Headphones size={14} /> Mesa de Atendimento
          </button>
        </div>
      )}

      {/* Status & User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          title={isWsConnected ? 'Conectado em tempo real ao Gateway' : 'Conectando ao Gateway...'}
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
          <span>{isWsConnected ? 'Gateway Online' : 'Reconectando'}</span>
        </div>

        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
              alt="Avatar"
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{currentUser?.name || 'Usuário'}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {currentUser?.email ? currentUser.email : (currentUser?.department || currentUser?.course || 'UniDesk')}
              </div>
            </div>

            {isLoggedIn && onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sair / Trocar de Conta"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  marginLeft: '0.25rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
