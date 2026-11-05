import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, LogOut, Shield, Headphones, Sun, Moon, Monitor } from 'lucide-react';

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

  // Theme mode: 'auto' (de acordo com o navegador), 'light', ou 'dark'
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('unidesk_theme') || 'auto';
    } catch (_) {
      return 'auto';
    }
  });

  const [browserPrefersDark, setBrowserPrefersDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Ouve alterações no modo claro/escuro do navegador em tempo real
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updatePref = (e) => setBrowserPrefersDark(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePref);
      return () => mediaQuery.removeEventListener('change', updatePref);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(updatePref);
      return () => mediaQuery.removeListener(updatePref);
    }
  }, []);

  // Aplica o tema correspondente no elemento raiz <html>
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'light') {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('unidesk_theme', 'light');
    } else if (themeMode === 'dark') {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('unidesk_theme', 'dark');
    } else {
      // 'auto': Segue estritamente a preferência do navegador via CSS media queries
      root.removeAttribute('data-theme');
      localStorage.setItem('unidesk_theme', 'auto');
    }
  }, [themeMode]);

  // Alterna: Automático (Navegador) -> Claro -> Escuro -> Automático
  const cycleTheme = () => {
    setThemeMode((prev) => {
      if (prev === 'auto') return 'light';
      if (prev === 'light') return 'dark';
      return 'auto';
    });
  };

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
            background: 'var(--bg-input)',
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

      {/* Status, Seletor de Tema & Usuário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Seletor de Tema Claro/Escuro (Automático de acordo com o navegador por padrão) */}
        <button
          type="button"
          onClick={cycleTheme}
          title={
            themeMode === 'auto'
              ? `Tema: Automático (Navegador: ${browserPrefersDark ? 'Modo Escuro' : 'Modo Claro'}) - Clique para fixar Claro ou Escuro`
              : themeMode === 'light'
              ? 'Tema: Modo Claro fixado - Clique para alternar'
              : 'Tema: Modo Escuro fixado - Clique para alternar'
          }
          aria-label="Alternar tema claro / escuro de acordo com o navegador"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '999px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '0.74rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          {themeMode === 'auto' ? (
            <>
              <Monitor size={14} color="var(--primary-light)" />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Auto ({browserPrefersDark ? 'Escuro' : 'Claro'})
              </span>
            </>
          ) : themeMode === 'light' ? (
            <>
              <Sun size={14} color="#f59e0b" />
              <span style={{ fontSize: '0.72rem' }}>Claro</span>
            </>
          ) : (
            <>
              <Moon size={14} color="#818cf8" />
              <span style={{ fontSize: '0.72rem' }}>Escuro</span>
            </>
          )}
        </button>

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
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{currentUser?.name || 'Usuário'}</div>
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
                  background: 'var(--bg-input)',
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
                  e.currentTarget.style.background = 'var(--bg-input)';
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
