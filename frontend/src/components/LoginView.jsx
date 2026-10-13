import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle, Sparkles, CheckCircle2, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export default function LoginView({
  config,
  role = 'aluno', // 'aluno' | 'atendente'
  onLoginSuccess,
  onSwitchPortal
}) {
  const isStudent = role === 'aluno';
  const portalName = isStudent ? 'Portal do Aluno' : 'Painel do Atendente';
  const portalIcon = isStudent ? '🎓' : '🎧';

  // Demo presets for 1-click test
  const demoAccounts = isStudent
    ? [
        {
          name: 'Larissa Vianna',
          email: 'larissa.vianna@aluno.metropolitana.edu.br',
          course: 'Medicina (7º Período)',
          ra: '20230512',
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80'
        },
        {
          name: 'Enzo Martins',
          email: 'enzo.martins@aluno.metropolitana.edu.br',
          course: 'Engenharia de Software (5º Período)',
          ra: '20240189',
          avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=80'
        },
        {
          name: 'Rodrigo Sanches',
          email: 'rodrigo.sanches@aluno.metropolitana.edu.br',
          course: 'Direito (9º Período)',
          ra: '20220891',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80'
        }
      ]
    : [
        {
          name: 'Mariana Alencar',
          email: 'mariana.suporte@metropolitana.edu.br',
          dept: 'Secretaria Acadêmica',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80'
        },
        {
          name: 'Felipe Castilho',
          email: 'felipe.ti@metropolitana.edu.br',
          dept: 'Suporte AVA & TI',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80'
        },
        {
          name: 'Carla Esteves',
          email: 'carla.financeiro@metropolitana.edu.br',
          dept: 'Financeiro & Bolsas',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80'
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
        password,
        role: isStudent ? 'student' : 'attendant'
      });

      if (res.success && res.user) {
        if (rememberMe) {
          localStorage.setItem(`unidesk_saved_email_${role}`, email.trim());
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

  const handleSelectDemo = (demoEmail) => {
    setEmail(demoEmail);
    setErrorMsg('');
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
          maxWidth: '480px',
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
        {/* Decorative Top Accent Glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: '3px',
            background: isStudent
              ? 'linear-gradient(90deg, #3b82f6, #06b6d4)'
              : 'linear-gradient(90deg, #ec4899, #8b5cf6)',
            borderRadius: '0 0 8px 8px'
          }}
        />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img
            src={config?.logoUrl || '/assets/LOGO_UD.png'}
            alt="Logo"
            style={{ height: '48px', objectFit: 'contain', marginBottom: '0.75rem' }}
            onError={(e) => {
              e.target.src = '/assets/LOGO_UD.png';
            }}
          />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.25rem', color: '#ffffff' }}>
            {config?.name || 'UniDesk Helpdesk'}
          </h2>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: isStudent ? 'rgba(59, 130, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
              color: isStudent ? '#60a5fa' : '#f472b6',
              marginTop: '0.35rem',
              border: isStudent ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(236, 72, 153, 0.3)'
            }}
          >
            <span>{portalIcon}</span>
            <span>Acesso ao {portalName}</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              color: '#fca5a5',
              fontSize: '0.84rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              lineHeight: 1.4
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Email field */}
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
                placeholder={isStudent ? 'aluno@aluno.metropolitana.edu.br' : 'atendente@metropolitana.edu.br'}
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

          {/* Password field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Senha de Acesso
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Demo: qualquer senha
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

          {/* Remember Me */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              background: isStudent
                ? 'linear-gradient(135deg, #1d4ed8, #0284c7)'
                : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              boxShadow: isStudent
                ? '0 6px 20px rgba(29, 78, 216, 0.4)'
                : '0 6px 20px rgba(236, 72, 153, 0.4)',
              transition: 'transform 0.15s, opacity 0.15s',
              marginTop: '0.35rem'
            }}
          >
            <LogIn size={18} />
            {isLoading ? 'Autenticando...' : `Entrar no ${portalName}`}
          </button>
        </form>

        {/* 1-Click Fast Login Demo Profiles */}
        <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div
            style={{
              fontSize: '0.76rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-muted)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Sparkles size={14} color="#f59e0b" />
            Contas de Demonstração (Clique para preencher):
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {demoAccounts.map((acc) => {
              const isSelected = email === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectDemo(acc.email)}
                  style={{
                    background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '0.55rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <img
                      src={acc.avatar}
                      alt={acc.name}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>{acc.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {acc.course || acc.dept} • {acc.email.split('@')[0]}
                      </div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} color="var(--primary)" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Switch Portal Footer */}
        {onSwitchPortal && (
          <div
            style={{
              marginTop: '1.25rem',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}
          >
            {isStudent ? 'É da equipe de suporte/atendimento?' : 'É estudante da universidade?'}{' '}
            <button
              type="button"
              onClick={onSwitchPortal}
              style={{
                background: 'none',
                border: 'none',
                color: isStudent ? '#f472b6' : '#60a5fa',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Ir para {isStudent ? 'Painel do Atendente' : 'Portal do Aluno'} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
