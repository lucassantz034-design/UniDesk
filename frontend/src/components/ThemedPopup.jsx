import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles, HelpCircle, X } from 'lucide-react';

export default function ThemedPopup({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info', // 'success' | 'error' | 'warning' | 'info' | 'confirm'
  confirmText,
  cancelText = 'Cancelar',
  isConfirm = false,
  colors = null,
  institutionName = '',
  showColorBadges = false
}) {
  const [resolvedColors, setResolvedColors] = useState({
    primary: '#1d4ed8',
    secondary: '#0284c7',
    accent: '#f59e0b'
  });

  // Resolve active theme colors (from props, config or CSS root variables)
  useEffect(() => {
    if (colors && (colors.primary || colors.secondary || colors.accent)) {
      setResolvedColors({
        primary: colors.primary || '#1d4ed8',
        secondary: colors.secondary || '#0284c7',
        accent: colors.accent || '#f59e0b'
      });
      return;
    }

    // Read current CSS variables on :root
    if (typeof window !== 'undefined') {
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue('--primary').trim() || '#1d4ed8';
      const secondary = style.getPropertyValue('--secondary').trim() || '#0284c7';
      const accent = style.getPropertyValue('--accent').trim() || '#f59e0b';
      setResolvedColors({ primary, secondary, accent });
    }
  }, [colors, isOpen]);

  // Handle ESC and Enter keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (onConfirm) {
          onConfirm();
        } else {
          onClose?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const { primary, secondary, accent } = resolvedColors;
  const isError = type === 'error';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';
  const isConfirmation = isConfirm || type === 'confirm';

  // Determine modal icon & accent tone
  let IconComponent = Info;
  let iconColor = accent || primary;
  let statusBorderColor = `${primary}66`;
  let statusGlow = `${primary}35`;

  if (isError) {
    IconComponent = AlertCircle;
    iconColor = '#ef4444';
    statusBorderColor = 'rgba(239, 68, 68, 0.6)';
    statusGlow = 'rgba(239, 68, 68, 0.35)';
  } else if (isWarning) {
    IconComponent = AlertTriangle;
    iconColor = '#f59e0b';
    statusBorderColor = 'rgba(245, 158, 11, 0.6)';
    statusGlow = 'rgba(245, 158, 11, 0.3)';
  } else if (isSuccess) {
    IconComponent = CheckCircle2;
    iconColor = '#10b981';
    statusBorderColor = 'rgba(16, 185, 129, 0.6)';
    statusGlow = `${primary}35`;
  } else if (isConfirmation) {
    IconComponent = HelpCircle;
    iconColor = secondary || primary;
    statusBorderColor = `${secondary}80`;
    statusGlow = `${secondary}35`;
  }

  // Default default titles by type if not provided
  const modalTitle = title || (
    isSuccess ? 'Sucesso' :
    isError ? 'Atenção' :
    isWarning ? 'Aviso Importante' :
    isConfirmation ? 'Confirmação Necessária' :
    'Informação'
  );

  const defaultConfirmLabel = confirmText || (isConfirmation ? 'Confirmar' : 'Entendido');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-surface)',
          borderRadius: '18px',
          border: `1px solid ${statusBorderColor}`,
          boxShadow: `0 25px 60px rgba(0,0,0,0.7), 0 0 35px ${statusGlow}`,
          position: 'relative',
          overflow: 'hidden',
          animation: 'modalScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Dynamic Top Stripe Matching Software Palette */}
        <div
          style={{
            height: '5px',
            width: '100%',
            background: isError
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : isWarning
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : `linear-gradient(90deg, ${primary}, ${secondary}, ${accent})`
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #9ca3af)',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s, background 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted, #9ca3af)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={18} />
        </button>

        <div style={{ padding: '1.75rem' }}>
          {/* Header with themed icon and title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: isError
                  ? 'rgba(239, 68, 68, 0.15)'
                  : isWarning
                  ? 'rgba(245, 158, 11, 0.15)'
                  : `radial-gradient(circle, ${primary}35 0%, ${primary}10 100%)`,
                border: `1px solid ${statusBorderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <IconComponent size={24} color={iconColor} />
            </div>

            <div style={{ flex: 1, paddingRight: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
                  {modalTitle}
                </h3>
                {institutionName && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      background: `${accent}25`,
                      color: accent,
                      border: `1px solid ${accent}45`
                    }}
                  >
                    {institutionName}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                {message}
              </div>
            </div>
          </div>

          {/* Color Palette Preview Strip (when testing theme in admin) */}
          {showColorBadges && (
            <div
              style={{
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Paleta Personalizada Aplicada:
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: primary, boxShadow: `0 0 8px ${primary}` }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>Primária: {primary}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: secondary, boxShadow: `0 0 8px ${secondary}` }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>Secundária: {secondary}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>Destaque: {accent}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            {isConfirmation && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'var(--bg-btn-secondary)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem 1.4rem',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#e2e8f0';
                }}
              >
                {cancelText}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onConfirm) {
                  onConfirm();
                } else {
                  onClose?.();
                }
              }}
              style={{
                background: isError
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : isWarning
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : `linear-gradient(135deg, ${primary}, ${secondary})`,
                color: 'var(--text-main)',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 1.6rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isError
                  ? '0 4px 18px rgba(239, 68, 68, 0.4)'
                  : `0 4px 18px ${primary}55`,
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.filter = 'brightness(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.filter = 'none';
              }}
            >
              {isSuccess && <CheckCircle2 size={16} />}
              {defaultConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
