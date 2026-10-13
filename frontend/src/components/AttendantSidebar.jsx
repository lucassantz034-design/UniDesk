import React, { useState } from 'react';
import { LogOut } from 'lucide-react';

/**
 * AttendantSidebar - Barra lateral esquerda modular do Painel de Atendente
 * Permite alternar entre diferentes visões/funcionalidades conforme os ícones são adicionados.
 */
export default function AttendantSidebar({
  activeTab,
  onSelectTab,
  items = [],
  operatorStatus = 'online',
  onToggleStatus,
  onLogout
}) {
  const [hoveredTab, setHoveredTab] = useState(null);

  return (
    <aside
      style={{
        width: '72px',
        minWidth: '72px',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem 0.5rem',
        justifyContent: 'space-between',
        zIndex: 40,
        userSelect: 'none',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Top Section: Nav Items */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0.65rem' }}>
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const isHovered = hoveredTab === item.id;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}
              onMouseEnter={() => setHoveredTab(item.id)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              {/* Active Indicator Bar on the Left */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: '-8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '4px',
                    height: '26px',
                    borderRadius: '0 4px 4px 0',
                    background: 'linear-gradient(180deg, #ec4899, #8b5cf6)',
                    boxShadow: '0 0 12px rgba(168, 85, 247, 0.6)'
                  }}
                />
              )}

              {/* Sidebar Action Button */}
              <button
                onClick={() => onSelectTab(item.id)}
                aria-label={item.label}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  border: isActive
                    ? '1px solid rgba(255, 255, 255, 0.16)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'rgba(255, 255, 255, 0.08)'
                    : isHovered
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'transparent',
                  color: isActive
                    ? '#ffffff'
                    : isHovered
                    ? '#ffffff'
                    : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive
                    ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                    : 'none',
                  transform: isHovered && !isActive ? 'scale(1.04)' : 'scale(1)'
                }}
              >
                {Icon && <Icon size={22} strokeWidth={isActive ? 2 : 1.75} />}

                {/* Badge Notification Counter */}
                {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '9px',
                      background: item.badgeColor || 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      border: '2px solid var(--bg-surface)'
                    }}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>

              {/* Floating Tooltip */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    left: 'calc(100% + 12px)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#1f2937',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                    pointerEvents: 'none',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      style={{
                        background: 'rgba(59, 130, 246, 0.3)',
                        color: 'var(--primary-light)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                  {/* Tooltip arrow */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%) rotate(45deg)',
                      width: '8px',
                      height: '8px',
                      background: '#1f2937',
                      borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Section: Operator Status Toggle Switch */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          width: '100%',
          position: 'relative'
        }}
        onMouseEnter={() => setHoveredTab('status-toggle')}
        onMouseLeave={() => setHoveredTab(null)}
      >
        <button
          type="button"
          onClick={onToggleStatus}
          aria-label={operatorStatus === 'online' ? 'Alternar para Pausa/Ausente' : 'Alternar para Online/Disponível'}
          style={{
            width: '46px',
            height: '24px',
            borderRadius: '9999px',
            background: operatorStatus === 'online' ? '#10b981' : '#374151',
            border: operatorStatus === 'online' ? '1px solid #059669' : '1px solid rgba(255, 255, 255, 0.15)',
            position: 'relative',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: operatorStatus === 'online' ? '0 0 12px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            outline: 'none'
          }}
        >
          {/* Sliding thumb */}
          <span
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              transform: operatorStatus === 'online' ? 'translateX(22px)' : 'translateX(0px)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: operatorStatus === 'online' ? '#10b981' : '#9ca3af'
              }}
            />
          </span>
        </button>

        {/* Status text */}
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: operatorStatus === 'online' ? '#10b981' : 'var(--text-muted)',
            transition: 'color 0.2s ease'
          }}
        >
          {operatorStatus === 'online' ? 'Online' : 'Pausa'}
        </span>

        {/* Floating Tooltip */}
        {hoveredTab === 'status-toggle' && (
          <div
            style={{
              position: 'absolute',
              left: 'calc(100% + 12px)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#1f2937',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
              pointerEvents: 'none',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              animation: 'fadeIn 0.15s ease'
            }}
          >
            <span>Status: <strong>{operatorStatus === 'online' ? 'Disponível (Online)' : 'Ausente (Em Pausa)'}</strong></span>
            {/* Tooltip arrow */}
            <div
              style={{
                position: 'absolute',
                left: '-5px',
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                background: '#1f2937',
                borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
              }}
            />
          </div>
        )}

        {/* Logout / Switch Attendant Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Sair / Trocar Atendente"
            aria-label="Sair / Trocar Atendente"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid transparent',
              background: 'transparent',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '0.4rem',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
