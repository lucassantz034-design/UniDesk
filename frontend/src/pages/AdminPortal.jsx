import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Shield,
  Palette,
  Users,
  FileText,
  Activity,
  Save,
  Key,
  UserX,
  UserPlus,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  Award,
  LifeBuoy,
  Database
} from 'lucide-react';
import AdminSupport from './AdminSupport';
import AdminBackups from './AdminBackups';
import ThemedAlertCard from '../components/ThemedAlertCard';
import { usePopup } from '../context/PopupContext';


export default function AdminPortal({ config, onConfigUpdate }) {
  const { showConfirm, showError } = usePopup();
  const [activeSection, setActiveSection] = useState('metrics'); // 'metrics' | 'branding' | 'users' | 'logs'
  const [metrics, setMetrics] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [logsList, setLogsList] = useState([]);
  const [heartbeatResult, setHeartbeatResult] = useState(null);
  // Custom Themed Alert Card State
  const [alertCardState, setAlertCardState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
    colors: null,
    institutionName: '',
    showColorBadges: true
  });

  const showAlertCard = ({ title, message, type = 'success', colors = null, institutionName = '', showColorBadges = true }) => {
    setAlertCardState({
      isOpen: true,
      title,
      message,
      type,
      colors: colors || {
        primary: formConfig.primaryColor,
        secondary: formConfig.secondaryColor,
        accent: formConfig.accentColor
      },
      institutionName: institutionName || formConfig.name,
      showColorBadges
    });
  };


  // Branding Form State
  const [formConfig, setFormConfig] = useState({
    name: '',
    tagline: '',
    logoUrl: '',
    primaryColor: '#1d4ed8',
    secondaryColor: '#0284c7',
    accentColor: '#f59e0b',
    aiProvider: 'local_heuristic',
    aiModel: 'claude-3-5-sonnet',
    aiCustomInstructions: ''
  });

  // Create User Modal State
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCPF, setNewUserCPF] = useState('');
  const [newUserRole, setNewUserRole] = useState('aluno');
  const [newUserExtra, setNewUserExtra] = useState('');

  useEffect(() => {
    if (config) {
      setFormConfig({
        name: config.name || '',
        tagline: config.tagline || '',
        logoUrl: config.logoUrl || '/assets/LOGO_UD.png',
        primaryColor: config.primaryColor || '#1d4ed8',
        secondaryColor: config.secondaryColor || '#0284c7',
        accentColor: config.accentColor || '#f59e0b',
        aiProvider: config.aiProvider || 'local_heuristic',
        aiModel: config.aiModel || 'claude-3-5-sonnet',
        aiCustomInstructions: config.aiCustomInstructions || ''
      });
    }
    loadData();
  }, [config]);

  const loadData = async () => {
    try {
      const [m, u, l] = await Promise.all([
        api.getAdminMetrics(),
        api.getUsers(),
        api.getSQLLogsAdmin().catch(() => [])
      ]);
      setMetrics(m);
      setUsersList(u);
      setLogsList(l);
    } catch (err) {
      console.error('Erro ao carregar dados admin:', err);
    }
  };

    const handleSaveBranding = async (e) => {
    e.preventDefault();
    try {
      const res = await api.updateConfig(formConfig);
      if (res.success && res.config) {
        onConfigUpdate(res.config);
        showAlertCard({
          title: 'Configurações de Identidade Visual e IA Atualizadas!',
          message: `O tema personalizado da empresa ${formConfig.name || ''} foi gravado e aplicado com sucesso! Todos os cards, botões e telas agora refletem esta paleta exclusiva.`,
          type: 'success',
          colors: {
            primary: formConfig.primaryColor,
            secondary: formConfig.secondaryColor,
            accent: formConfig.accentColor
          },
          institutionName: formConfig.name,
          showColorBadges: true
        });
      }
    } catch (err) {
      showAlertCard({
        title: 'Erro ao Salvar Configurações',
        message: err.message || 'Falha ao salvar configurações.',
        type: 'error',
        showColorBadges: false
      });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const extraPayload = {};
      if (newUserRole === 'aluno') {
        extraPayload.curso = newUserExtra || 'Graduação';
      } else if (newUserRole === 'tecnico') {
        extraPayload.especialidade = newUserExtra || 'Suporte Geral';
      }

      await api.createSQLUser({
        adminId: 'usr-admin',
        nomeCompleto: newUserName,
        email: newUserEmail,
        cpf: newUserCPF,
        role: newUserRole,
        extra: extraPayload
      });

      setIsNewUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserCPF('');
      setNewUserExtra('');
      showAlertCard({ title: 'Usuário Cadastrado com Sucesso!', message: `O usuário ${newUserName} foi registrado no sistema.`, type: 'success', showColorBadges: false });
      loadData();
    } catch (err) {
      showAlertCard({ title: 'Erro ao Criar Usuário', message: err.message, type: 'error', showColorBadges: false });
    }
  };

  const handleResetPassword = async (userId) => {
    const confirmed = await showConfirm(
      'Deseja realmente redefinir a senha deste usuário e invalidar os tokens das sessões ativas?',
      'Redefinição de Senha'
    );
    if (!confirmed) return;
    try {
      await api.resetSQLPassword(userId, { adminId: 'usr-admin' });
      showAlertCard({ title: 'Senha Redefinida!', message: 'A senha do usuário foi resetada com sucesso para o padrão provisório.', type: 'success', showColorBadges: false });
      loadData();
    } catch (err) {
      showAlertCard({ title: 'Falha na Operação', message: err.message, type: 'error', showColorBadges: false });
    }
  };

  const handleInactivateUser = async (userId) => {
    const confirmed = await showConfirm(
      'Deseja inativar o acesso deste usuário?',
      'Inativar Usuário'
    );
    if (!confirmed) return;
    try {
      await api.inactivateSQLUser(userId, { adminId: 'usr-admin' });
      showAlertCard({ title: 'Usuário Inativado', message: 'O acesso do usuário foi suspenso com sucesso.', type: 'info', showColorBadges: false });
      loadData();
    } catch (err) {
      showError('Erro: ' + err.message);
    }
  };

  const handleSendHeartbeat = async () => {
    try {
      const res = await api.sendHeartbeat();
      setHeartbeatResult(res);
    } catch (err) {
      showAlertCard({ title: 'Erro no Heartbeat', message: err.message, type: 'error', showColorBadges: false });
    }
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Admin Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={22} color="var(--primary-light)" /> Console Administrativo & Governança
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Instância Self-Hosted • Licença: {config?.licenseKey || 'UNI-HOSTED-2026-BR'} • Versão: {config?.version || '1.0.0'}
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          {[
            { id: 'metrics', label: 'Métricas & SLAs', icon: <TrendingUp size={15} /> },
            { id: 'branding', label: 'White-Label Branding', icon: <Palette size={15} /> },
            { id: 'users', label: 'Gestão de Usuários', icon: <Users size={15} /> },
            { id: 'logs', label: 'Auditoria & Logs', icon: <FileText size={15} /> },
            { id: 'backups', label: 'Backups & Segurança', icon: <Database size={15} /> },
            { id: 'support', label: 'Suporte Fornecedor', icon: <LifeBuoy size={15} /> }
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              style={{
                background: activeSection === sec.id ? 'var(--primary)' : 'transparent',
                color: activeSection === sec.id ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {sec.icon} {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: METRICS */}
      {activeSection === 'metrics' && (
        <div>
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Total de Chamados</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>{metrics?.totalTickets || 0}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Em Atendimento</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{metrics?.openTickets || 0}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Finalizados</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{metrics?.resolvedTickets || 0}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Cumprimento de SLA</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>{metrics?.slaCompliancePercent || 98.5}%</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>CSAT Médio (Satisfação)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ⭐ {metrics?.averageCsat || '4.9'}
              </div>
            </div>
          </div>

          {/* Category Breakdown & Licensing Heartbeat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>Distribuição por Categoria</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {metrics?.byCategory &&
                  Object.entries(metrics.byCategory).map(([cat, count]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#fff' }}>{cat}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-light)' }}>{count} chamados</span>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Licenciamento & Telemetria Anônima</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
                O servidor valida periodicamente a conformidade da licença via heartbeat criptografado contendo apenas métricas operacionais agregadas (sem dados sensíveis ou PII de alunos).
              </p>
              <button
                onClick={handleSendHeartbeat}
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--primary-light)',
                  border: '1px solid var(--primary)',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '1rem'
                }}
              >
                <Activity size={16} /> Emitir Heartbeat de Licença Agora
              </button>

              {heartbeatResult && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', padding: '0.8rem', fontSize: '0.78rem' }}>
                  <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '0.2rem' }}>✓ {heartbeatResult.message}</div>
                  <pre style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(heartbeatResult.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: WHITE-LABEL BRANDING & LIVE PREVIEW */}
      {activeSection === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
          {/* Settings Form */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.2rem', color: 'var(--text-main)' }}>Identidade Visual & Customização White-Label</h3>

            <form onSubmit={handleSaveBranding} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nome da Faculdade / Instituição</label>
                <input
                  type="text"
                  value={formConfig.name}
                  onChange={(e) => setFormConfig({ ...formConfig, name: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Tagline Institucional</label>
                <input
                  type="text"
                  value={formConfig.tagline}
                  onChange={(e) => setFormConfig({ ...formConfig, tagline: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>URL do Logotipo</label>
                <input
                  type="text"
                  value={formConfig.logoUrl}
                  onChange={(e) => setFormConfig({ ...formConfig, logoUrl: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Color Pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Cor Primária</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="color"
                      value={formConfig.primaryColor}
                      onChange={(e) => setFormConfig({ ...formConfig, primaryColor: e.target.value })}
                      style={{ width: '38px', height: '38px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{formConfig.primaryColor}</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Cor Secundária</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="color"
                      value={formConfig.secondaryColor}
                      onChange={(e) => setFormConfig({ ...formConfig, secondaryColor: e.target.value })}
                      style={{ width: '38px', height: '38px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{formConfig.secondaryColor}</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Cor Destaque</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="color"
                      value={formConfig.accentColor}
                      onChange={(e) => setFormConfig({ ...formConfig, accentColor: e.target.value })}
                      style={{ width: '38px', height: '38px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                    />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{formConfig.accentColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Instruções Customizadas da Sophia (IA)</label>
                <textarea
                  rows="3"
                  value={formConfig.aiCustomInstructions}
                  onChange={(e) => setFormConfig({ ...formConfig, aiCustomInstructions: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.7rem 1.4rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}
              >
                <Save size={18} /> Salvar Identidade Visual
              </button>
            </form>
          </div>

          {/* Live Preview Card */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.2rem', color: 'var(--text-main)' }}>Live Preview em Tempo Real</h3>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.2rem' }}>
                <img
                  src={formConfig.logoUrl || '/assets/LOGO_UD.png'}
                  alt="Preview Logo"
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                  onError={(e) => { e.target.src = '/assets/LOGO_UD.png'; }}
                />
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: formConfig.primaryColor }}>{formConfig.name || 'Nome da Faculdade'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formConfig.tagline || 'Tagline institucional'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <button style={{ background: formConfig.primaryColor, color: '#fff', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem' }}>
                  Botão Primário
                </button>
                <button style={{ background: formConfig.secondaryColor, color: '#fff', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem' }}>
                  Botão Secundário
                </button>
                <button style={{ background: formConfig.accentColor, color: '#000', border: 'none', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}>
                  Destaque
                </button>
              </div>

              
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', borderTop: `3px solid ${formConfig.primaryColor}` }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: formConfig.primaryColor, marginBottom: '0.3rem' }}>
                  Prévia de Pop-ups com a Identidade Visual
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Todos os avisos, confirmações e finalizações de chamados adotam automaticamente as cores definidas aqui.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => showAlertCard({
                      title: 'Chamado Concluído com Sucesso!',
                      message: `Este é o novo modelo de pop-up personalizado do UniDesk integrado à identidade da instituição (${formConfig.name || 'Sua Instituição'}).`,
                      type: 'success',
                      colors: {
                        primary: formConfig.primaryColor,
                        secondary: formConfig.secondaryColor,
                        accent: formConfig.accentColor
                      },
                      institutionName: formConfig.name,
                      showColorBadges: true
                    })}
                    style={{
                      width: '100%',
                      background: `linear-gradient(135deg, ${formConfig.primaryColor}25, ${formConfig.secondaryColor}25)`,
                      border: `1px solid ${formConfig.primaryColor}66`,
                      color: '#fff',
                      padding: '0.55rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Palette size={14} color={formConfig.accentColor} /> Testar Pop-up de Sucesso (Cores Atuais)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertCardState({
                      isOpen: true,
                      title: 'Confirmar Operação Crítica?',
                      message: 'Deseja aplicar as novas diretrizes visuais para todos os departamentos e usuários ativos?',
                      type: 'confirm',
                      isConfirm: true,
                      confirmText: 'Sim, Aplicar',
                      cancelText: 'Cancelar',
                      colors: {
                        primary: formConfig.primaryColor,
                        secondary: formConfig.secondaryColor,
                        accent: formConfig.accentColor
                      },
                      institutionName: formConfig.name,
                      showColorBadges: true
                    })}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#e2e8f0',
                      padding: '0.55rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <CheckCircle2 size={14} color={formConfig.secondaryColor} /> Testar Pop-up de Confirmação Interativa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: USERS MANAGEMENT */}
      {activeSection === 'users' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestão de Usuários da Faculdade</h3>
            <button
              onClick={() => setIsNewUserModalOpen(true)}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <UserPlus size={16} /> Cadastrar Novo Usuário
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Nome / E-mail</th>
                  <th style={{ padding: '0.75rem' }}>CPF</th>
                  <th style={{ padding: '0.75rem' }}>Papel (Role)</th>
                  <th style={{ padding: '0.75rem' }}>Departamento / Curso</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.cpf || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '8px',
                          fontWeight: 600,
                          background:
                            u.role === 'aluno' || u.role === 'student'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : u.role === 'tecnico' || u.role === 'attendant'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            u.role === 'aluno' || u.role === 'student'
                              ? '#3b82f6'
                              : u.role === 'tecnico' || u.role === 'attendant'
                              ? '#10b981'
                              : '#f59e0b'
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{u.department || u.course || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: u.ativo !== false ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.78rem' }}>
                        {u.ativo !== false ? '● Ativo' : '○ Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          title="Redefinir senha (incrementa token_version)"
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '0.35rem 0.6rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Key size={14} />
                        </button>
                        <button
                          onClick={() => handleInactivateUser(u.id)}
                          title="Inativar usuário"
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            borderRadius: '6px',
                            padding: '0.35rem 0.6rem',
                            cursor: 'pointer'
                          }}
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: AUDIT LOGS */}
      {activeSection === 'logs' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.2rem', color: 'var(--text-main)' }}>Registro de Auditoria Administrativa (logs_admin)</h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Data / Hora</th>
                  <th style={{ padding: '0.75rem' }}>Administrador</th>
                  <th style={{ padding: '0.75rem' }}>Ação Executada</th>
                  <th style={{ padding: '0.75rem' }}>Usuário Alvo</th>
                </tr>
              </thead>
              <tbody>
                {logsList.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  logsList.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {log.criado_em ? new Date(log.criado_em).toLocaleString() : 'Recentemente'}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>{log.admin_nome || log.admin_id}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {log.acao}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>{log.usuario_alvo_nome || log.usuario_alvo_id}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: BACKUPS & SEGURANÇA */}
      {activeSection === 'backups' && (
        <AdminBackups />
      )}

      {/* SECTION 6: SUPPORT FORNECEDOR */}
      {activeSection === 'support' && (
        <AdminSupport />
      )}


      {/* Create User Modal */}
      {isNewUserModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '1.8rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.2rem' }}>Cadastrar Novo Usuário</h3>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>E-mail Institucional</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>CPF (11 dígitos)</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={newUserCPF}
                  onChange={(e) => setNewUserCPF(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Perfil (Role)</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                >
                  <option value="aluno" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Aluno</option>
                  <option value="tecnico" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Técnico / Atendente</option>
                  <option value="admin_faculdade" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Administrador da Faculdade</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  {newUserRole === 'aluno' ? 'Curso' : newUserRole === 'tecnico' ? 'Especialidade' : 'Cargo'}
                </label>
                <input
                  type="text"
                  placeholder={newUserRole === 'aluno' ? 'Ex: Engenharia de Software' : 'Ex: Suporte AVA & TI'}
                  value={newUserExtra}
                  onChange={(e) => setNewUserExtra(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    
      {/* Custom Themed Notification Card Modal */}
      <ThemedAlertCard
        isOpen={alertCardState.isOpen}
        onClose={() => setAlertCardState((prev) => ({ ...prev, isOpen: false }))}
        title={alertCardState.title}
        message={alertCardState.message}
        type={alertCardState.type}
        colors={alertCardState.colors || {
          primary: formConfig.primaryColor,
          secondary: formConfig.secondaryColor,
          accent: formConfig.accentColor
        }}
        institutionName={alertCardState.institutionName || formConfig.name}
        showColorBadges={alertCardState.showColorBadges}
      />
    </div>
  );
}