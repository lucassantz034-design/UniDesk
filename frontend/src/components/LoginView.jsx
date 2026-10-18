import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function LoginView({
  config,
  onLoginSuccess
}) {
  // Lista de contas de demonstração organizadas para preenchimento com 1 clique
  const demoAccounts = [
    {
      roleGroup: 'Aluno',
      name: 'Larissa Vianna',
      email: 'larissa.vianna@aluno.metropolitana.edu.br',
      info: 'Medicina (7º Período)',
      badge: '🎓 Aluno',
      badgeColor: '#3b82f6',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80'
    },
    {
      roleGroup: 'Aluno',
      name: 'Enzo Martins',
      email: 'enzo.martins@aluno.metropolitana.edu.br',
      info: 'Engenharia de Software (5º Período)',
      badge: '🎓 Aluno',
      badgeColor: '#3b82f6',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80'
    },
    {
      roleGroup: 'Atendente',
      name: 'Mariana Alencar',
      email: 'mariana.suporte@metropolitana.edu.br',
      info: 'Secretaria Acadêmica',
      badge: '🎧 Atendente',
      badgeColor: '#ec4899',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80'
    },
    {
      roleGroup: 'Atendente',
      name: 'Felipe Castilho',
      email: 'felipe.ti@metropolitana.edu.br',
      info: 'Suporte AVA & TI',
      badge: '🎧 Atendente',
      badgeColor: '#ec4899',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80'
    },
    {
      roleGroup: 'Administrador',
      name: 'Prof. Dr. Roberto Guimarães',
      email: 'admin@metropolitana.edu.br',
      info: 'Diretoria de Tecnologia e Operações',
      badge: '⚙️ Admin',
      badgeColor: '#f59e0b',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80'
    }
  ];

  const [email, setEmail] = useState(demoAccounts[0]?.email || '');
  const [password, setPassword] = useState('123456');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Por favor, informe seu e-mail institucional.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.login({
        email: email.trim(),
        password
      });

      if (res.success && res.user) {
        if (rememberMe) {
          localStorage.setItem('unidesk_saved_email', email.trim());
        }
        localStorage.setItem('unidesk_token', res.token);
        onLoginSuccess(res.user, res.token);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha na autenticação. Verifique seu e-mail.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        minHeight: 'calc(100vh - 120px)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '490px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '2.25rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(16px)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top Accent Glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: '3px',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #f59e0b)',
            borderRadius: '0 0 8px 8px'
          }}
        />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img
            src={config?.logoUrl || '/assets/LOGO_UD.png'}
            alt="Logo"
            style={{ width: '48px', height: '48px', margin: '0 auto 0.75rem auto', display: 'block' }}
          />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
            {config?.name || 'UniDesk Helpdesk'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Portal Único de Acesso Institucional
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: '#fca5a5',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '0.4rem'
              }}
            >
              E-mail Institucional
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@metropolitana.edu.br"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.6rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Senha de Acesso
              </label>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                Padrão demo: 123456
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.6rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              Lembrar meu e-mail neste navegador
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #1d4ed8, #0284c7)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              boxShadow: '0 6px 20px rgba(29, 78, 216, 0.4)',
              transition: 'transform 0.15s, opacity 0.15s',
              marginTop: '0.35rem'
            }}
          >
            <LogIn size={18} />
            {isLoading ? 'Autenticando...' : 'Acessar Sistema'}
          </button>
        </form>

        {/* CONTAS DE DEMONSTRAÇÃO (CLIQUE PARA PREENCHER) */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.1rem' }}>
          <div
            style={{
              fontSize: '0.76rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              letterSpacing: '0.04em'
            }}
          >
            <Sparkles size={13} color="var(--accent)" /> CONTAS DE DEMONSTRAÇÃO (CLIQUE PARA PREENCHER):
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {demoAccounts.map((acc) => {
              const isSelected = email.toLowerCase() === acc.email.toLowerCase();
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setErrorMsg('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? acc.badgeColor : 'var(--border-color)'}`,
                    background: isSelected
                      ? `${acc.badgeColor}22`
                      : 'rgba(0, 0, 0, 0.25)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <img
                      src={acc.avatar}
                      alt={acc.name}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>{acc.name}</span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: `${acc.badgeColor}25`,
                            color: acc.badgeColor
                          }}
                        >
                          {acc.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {acc.info} • {acc.email.split('@')[0]}
                      </div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} color={acc.badgeColor} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
