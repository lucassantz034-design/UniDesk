import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import AttendantSidebar from '../components/AttendantSidebar';
import { usePopup } from '../context/PopupContext';
import {
  LayoutGrid,
  Inbox,
  Ticket,
  Clock,
  Sparkles,
  Send,
  Lock,
  CheckCircle,
  AlertTriangle,
  User,
  Star,
  Search,
  Filter,
  CheckCheck,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Calendar,
  ShieldCheck,
  Eye
} from 'lucide-react';

export default function AttendantPortal({ config, attendantUser, onLogout }) {
  const { showSuccess, showError } = usePopup();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [aiContext, setAiContext] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Modular Sidebar Navigation: Apenas 2 seções unificadas (Dashboard e Central de Chamados)
  const [activeSidebarTab, setActiveSidebarTab] = useState('dashboard');
  const [operatorStatus, setOperatorStatus] = useState('online');

  // Identificação do perfil de Gestor de Setor
  const isManagerUser = useMemo(() => Boolean(
    attendantUser?.isGestor ||
    attendantUser?.isManager ||
    attendantUser?.role === 'gestor' ||
    attendantUser?.role === 'gestor_setor' ||
    attendantUser?.role === 'manager' ||
    attendantUser?.role === 'admin' ||
    attendantUser?.role === 'admin_faculdade' ||
    attendantUser?.role === 'admin_software' ||
    attendantUser?.cargo?.toLowerCase()?.includes('gestor') ||
    attendantUser?.cargo?.toLowerCase()?.includes('coordenador') ||
    attendantUser?.cargo?.toLowerCase()?.includes('gerente') ||
    attendantUser?.cargo?.toLowerCase()?.includes('diretor')
  ), [attendantUser]);

  // Modo ativo de Gestor de Setor (permite alternância transparente para teste e supervisão)
  const [isGestorMode, setIsGestorMode] = useState(isManagerUser);

  useEffect(() => {
    setIsGestorMode(isManagerUser);
  }, [isManagerUser]);

  // Modo de visualização dentro da Central Unificada: 'workspace' (mesa 3-colunas) ou 'table' (visão tabular)
  const [viewMode, setViewMode] = useState('workspace');

  // Filtros: 'active' (todos em aberto), 'open', 'in_progress', 'resolved' (apenas gestor), 'all' (apenas gestor)
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply inputs
  const [messageText, setMessageText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Student Evaluation Modal (when finishing ticket)
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evalScore, setEvalScore] = useState(5);
  const [evalComment, setEvalComment] = useState('');

  const attendantId = attendantUser?.id || 'usr-att-1';

  // Cálculos de métricas em tempo real
  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'aberto').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress' || t.status === 'em_atendimento').length;
  const activeTicketsCount = openCount + inProgressCount;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'finalizado').length;
  const totalCount = tickets.length;
  const urgentCount = tickets.filter((t) => t.priority === 'urgent' || t.priority === 'urgente' || t.priority === 'high').length;

  // Barra Lateral Unificada:
  // Removida a 3ª sessão duplicada ("Gestão de Chamados"). Agora temos apenas Dashboard + Central de Atendimento.
  const sidebarItems = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Painel Geral & Métricas',
      icon: LayoutGrid
    },
    {
      id: 'inbox',
      label: isGestorMode ? 'Central de Chamados (Setor)' : 'Fila de Atendimento (Abertos)',
      icon: Inbox,
      badge: activeTicketsCount,
      badgeColor: 'var(--primary-light)'
    }
  ], [isGestorMode, activeTicketsCount]);

  const loadAIContext = useCallback(async (studentId) => {
    if (!studentId) return;
    setIsAiLoading(true);
    try {
      const ctx = await api.getStudentAIContext(studentId);
      setAiContext(ctx);
    } catch (err) {
      console.warn('AI context error:', err);
      setAiContext(null);
    } finally {
      setIsAiLoading(false);
    }
  }, []);

  const selectTicket = useCallback(async (ticket) => {
    if (!ticket) return;
    try {
      const full = await api.getTicketById(ticket.id);
      setSelectedTicket(full);
      loadAIContext(full.studentId);
    } catch (err) {
      setSelectedTicket(ticket);
    }
  }, [loadAIContext]);

  // Helper para abrir chamado direto na mesa de atendimento
  const openTicketInInbox = (ticket) => {
    selectTicket(ticket);
    setViewMode('workspace');
    setActiveSidebarTab('inbox');
  };

  const loadTickets = useCallback(async () => {
    try {
      const data = await api.getTickets();
      setTickets(data);
      setSelectedTicket((prev) => {
        if (!prev && data.length > 0) {
          const firstActive = data.find((t) => t.status === 'open' || t.status === 'aberto' || t.status === 'in_progress');
          const target = firstActive || data[0];
          selectTicket(target);
          return target;
        }
        return prev;
      });
    } catch (err) {
      console.error('Erro ao carregar tickets:', err);
    }
  }, [selectTicket]);

  useEffect(() => {
    loadTickets();

    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'TICKET_UPDATE') {
        loadTickets();
        if (msg.ticket) {
          setSelectedTicket((prev) => (prev && prev.id === msg.ticket.id ? { ...prev, ...msg.ticket } : prev));
        }
      } else if (msg.type === 'CHAT_MESSAGE' && msg.ticketId) {
        setSelectedTicket((prev) => {
          if (!prev || prev.id !== msg.ticketId) return prev;
          const exists = prev.messages?.some((m) => m.id === msg.message?.id);
          if (exists) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), msg.message]
          };
        });
        loadTickets();
      }
    });

    return () => unsubscribe();
  }, [loadTickets]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedTicket) return;

    try {
      await api.addTicketMessage(selectedTicket.id, {
        senderId: attendantId,
        message: messageText,
        isInternalNote
      });
      setMessageText('');
      const updated = await api.getTicketById(selectedTicket.id);
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      showError('Erro ao enviar mensagem: ' + err.message);
    }
  };

  const handleTakeTicket = async () => {
    if (!selectedTicket) return;
    try {
      const updated = await api.updateTicketStatus(selectedTicket.id, 'in_progress');
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      showError('Erro ao assumir chamado: ' + err.message);
    }
  };

  const handleFinishTicket = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      // 1. Submit attendant evaluation of student
      await api.rateSQLAluno({
        chamadoId: selectedTicket.id,
        tecnicoId: attendantId,
        alunoId: selectedTicket.studentId,
        nota: Number(evalScore),
        comentario: evalComment
      });

      // 2. Update status to resolved
      const updated = await api.updateTicketStatus(selectedTicket.id, 'resolved');
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setIsEvalModalOpen(false);

      if (!isGestorMode) {
        showSuccess(
          'Chamado finalizado e transferido para o arquivo da gestão com sucesso. Sua fila foi organizada para os próximos atendimentos!',
          'Chamado Concluído'
        );
      } else {
        showSuccess('Chamado finalizado e avaliação acadêmica registrada com sucesso!', 'Chamado Concluído');
        setSelectedTicket(updated);
      }
    } catch (err) {
      showError('Erro ao finalizar chamado: ' + err.message);
    }
  };

  // FILA FILTRADA COM RESTRIÇÃO ESTRITA:
  // Operadores de atendimento comuns selecionam e visualizam APENAS chamados em aberto (active/open/in_progress).
  // Chamados fechados ficam disponíveis EXCLUSIVAMENTE para Gestores de Setor.
  const filteredQueue = useMemo(() => {
    return tickets.filter((t) => {
      const isResolved = t.status === 'resolved' || t.status === 'finalizado';
      const isOpen = t.status === 'open' || t.status === 'aberto';
      const isInProgress = t.status === 'in_progress' || t.status === 'em_atendimento';
      const isActive = isOpen || isInProgress;

      // REQUISITO: Para quem não é gestor, tickets fechados NUNCA aparecem
      if (!isGestorMode && isResolved) {
        return false;
      }

      const matchesSearch =
        t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.studentName && t.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.ticketNumber && String(t.ticketNumber).toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'active') return isActive;
      if (statusFilter === 'open') return isOpen;
      if (statusFilter === 'in_progress') return isInProgress;
      if (statusFilter === 'resolved') return isResolved && isGestorMode;
      if (statusFilter === 'all') return isGestorMode;

      return isActive;
    });
  }, [tickets, isGestorMode, searchQuery, statusFilter]);

  // Mantém a seleção de ticket consistente com a fila ativa
  useEffect(() => {
    if (selectedTicket) {
      const stillInQueue = filteredQueue.some((t) => t.id === selectedTicket.id);
      if (!stillInQueue) {
        if (filteredQueue.length > 0) {
          selectTicket(filteredQueue[0]);
        } else {
          setSelectedTicket(null);
        }
      }
    } else if (filteredQueue.length > 0) {
      selectTicket(filteredQueue[0]);
    }
  }, [filteredQueue, selectedTicket?.id]);

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 72px)',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Barra Lateral Esquerda Modular Unificada (2 Ícones: Dashboard e Central de Chamados) */}
      <AttendantSidebar
        activeTab={activeSidebarTab}
        onSelectTab={setActiveSidebarTab}
        items={sidebarItems}
        operatorStatus={operatorStatus}
        onToggleStatus={() => setOperatorStatus((prev) => (prev === 'online' ? 'busy' : 'online'))}
        onLogout={onLogout}
      />

      {/* Área Principal de Conteúdo do Atendente / Gestor */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem',
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        {/* 1. VISÃO GERAL & DASHBOARD (Ícone LayoutGrid) */}
        {activeSidebarTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', paddingRight: '0.25rem', height: '100%' }}>
            {/* Header com Boas-vindas e Ação Rápida */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25), rgba(17, 24, 39, 0.8))', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Olá, {attendantUser?.name || 'Mariana Alencar'} 👋
                  </h2>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: isGestorMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: isGestorMode ? '#10b981' : 'var(--primary-light)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    {isGestorMode ? '👔 Gestor de Setor' : '🎧 Operador de Atendimento'}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Central de comando • Departamento: <strong style={{ color: '#e5e7eb' }}>{attendantUser?.department || 'Suporte de T.I.'}</strong>
                  {!isGestorMode && (
                    <span style={{ color: '#38bdf8', marginLeft: '0.5rem' }}>
                      • Visualizando exclusivamente chamados em aberto para máxima organização
                    </span>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Botão de Toggle do Modo Gestor */}
                <button
                  onClick={() => {
                    const nextMode = !isGestorMode;
                    setIsGestorMode(nextMode);
                    if (!nextMode && (statusFilter === 'resolved' || statusFilter === 'all')) {
                      setStatusFilter('active');
                    }
                  }}
                  style={{
                    background: isGestorMode ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                    border: isGestorMode ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                    color: isGestorMode ? '#34d399' : 'var(--text-muted)',
                    borderRadius: '10px',
                    padding: '0.6rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease'
                  }}
                  title="Alternar entre modo operador de fila e modo gestor de setor"
                >
                  <ShieldAlert size={15} color={isGestorMode ? '#10b981' : '#94a3b8'} />
                  {isGestorMode ? 'Modo Gestor Ativo' : 'Alternar p/ Modo Gestor'}
                </button>

                <button
                  onClick={() => {
                    setStatusFilter('active');
                    setActiveSidebarTab('inbox');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(29, 78, 216, 0.35)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <Inbox size={16} /> Ir para Fila de Atendimento ({activeTicketsCount})
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Cards de Métricas em Tempo Real */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
              {/* 1. Em Espera */}
              <div
                onClick={() => {
                  setStatusFilter('open');
                  setActiveSidebarTab('inbox');
                }}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aguardando na Fila</span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-light)' }}>
                    <Inbox size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{openCount}</div>
                <div style={{ fontSize: '0.75rem', color: openCount > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                  {openCount > 0 ? '● Chamados aguardando atendimento' : '✓ Fila zerada no momento'}
                </div>
              </div>

              {/* 2. Em Andamento */}
              <div
                onClick={() => {
                  setStatusFilter('in_progress');
                  setActiveSidebarTab('inbox');
                }}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Em Atendimento</span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                    <Activity size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{inProgressCount}</div>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                  Chamados ativos agora
                </div>
              </div>

              {/* 3. Resolvidos (Acesso restrito para Gestores) */}
              <div
                onClick={() => {
                  if (isGestorMode) {
                    setStatusFilter('resolved');
                    setActiveSidebarTab('inbox');
                  } else {
                    showError(
                      'O histórico de chamados fechados é restrito a Gestores de Setor para manter o foco operacional nos atendimentos em aberto. Alterne para o Modo Gestor para consultar.',
                      'Acesso Exclusivo de Gestores'
                    );
                  }
                }}
                style={{
                  background: 'var(--bg-surface)',
                  border: isGestorMode ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Fechados / Resolvidos
                  </span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <CheckCircle size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{resolvedCount}</div>
                <div style={{ fontSize: '0.75rem', color: isGestorMode ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {isGestorMode ? '✓ Clique para consultar histórico (Gestor)' : '🔒 Histórico arquivado p/ Gestor'}
                </div>
              </div>

              {/* 4. SLA */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Índice de SLA</span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>98.4%</div>
                <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                  Tempo de resposta ideal
                </div>
              </div>
            </div>

            {/* Painel Inferior: Fila Prioritária e Sophia IA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem', minHeight: 0 }}>
              {/* Fila Recente & Prioritária (Apenas chamados abertos / ativos) */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} color="var(--primary-light)" /> Chamados em Aberto / Prioritários
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {tickets.filter((t) => t.status !== 'resolved' && t.status !== 'finalizado').slice(0, 5).length} listados
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
                  {tickets.filter((t) => t.status !== 'resolved' && t.status !== 'finalizado').length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      <CheckCircle size={24} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
                      Nenhum chamado aberto pendente no momento!
                    </div>
                  ) : (
                    tickets
                      .filter((t) => t.status !== 'resolved' && t.status !== 'finalizado')
                      .slice(0, 5)
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => openTicketInInbox(t)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)' }}>#{t.ticketNumber || t.id}</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{t.subject}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Aluno: {t.studentName || 'Aluno'} • Prioridade: <strong style={{ color: t.priority === 'urgent' ? '#ef4444' : '#e5e7eb' }}>{t.priority || 'Normal'}</strong>
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openTicketInInbox(t);
                            }}
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: 'var(--primary-light)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            Atender <ArrowRight size={12} />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Informações Sophia IA e Resumo Operacional */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(17, 24, 39, 0.9))', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '14px', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <Sparkles size={18} color="#60a5fa" />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>Triagem Inteligente (Sophia IA)</h4>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45', marginBottom: '0.75rem' }}>
                    A IA analisa sentimento, histórico financeiro e acadêmico de cada aluno e transfere para a fila com resumo executivo.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      ✓ Análise de Sentimento Ativa
                    </span>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      ✓ Consulta de FAQ Automática
                    </span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.2rem', flex: 1 }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={16} color="var(--primary-light)" /> Status Geral do Atendimento
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Chamados Ativos (Em Aberto)</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{activeTicketsCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Alta Prioridade</span>
                      <span style={{ fontWeight: 700, color: urgentCount > 0 ? '#ef4444' : '#10b981' }}>{urgentCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Chamados Fechados (Arquivo Gestor)</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>{resolvedCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. CENTRAL UNIFICADA DE ATENDIMENTO (Ícone Inbox) */}
        {activeSidebarTab === 'inbox' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* Top Bar: Cabeçalho com Modo do Usuário, Alternador de Gestor e Alternador de Layout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                    <Inbox size={20} color="var(--primary-light)" /> Central de Atendimento ao Aluno
                  </h2>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: isGestorMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      border: isGestorMode ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)',
                      color: isGestorMode ? '#10b981' : 'var(--primary-light)'
                    }}
                  >
                    {isGestorMode ? '👔 Visão: Gestor de Setor' : '🎧 Visão: Operador de Atendimento'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Operador: <strong style={{ color: '#e5e7eb' }}>{attendantUser?.name || 'Mariana Alencar'}</strong> • Departamento: <strong style={{ color: '#e5e7eb' }}>{attendantUser?.department || 'Suporte de T.I.'}</strong>
                  {!isGestorMode ? (
                    <span style={{ marginLeft: '0.5rem', color: '#38bdf8' }}>
                      • Foco operacional: apenas tickets abertos e pendentes
                    </span>
                  ) : (
                    <span style={{ marginLeft: '0.5rem', color: '#10b981' }}>
                      • Acesso com permissão de Gestor de Setor (inclui histórico de chamados fechados)
                    </span>
                  )}
                </div>
              </div>

              {/* Botões do Topo: Alternar Modo Gestor e Alternar Mesa / Tabela */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const nextMode = !isGestorMode;
                    setIsGestorMode(nextMode);
                    if (!nextMode && (statusFilter === 'resolved' || statusFilter === 'all')) {
                      setStatusFilter('active');
                    }
                  }}
                  title="Alternar entre visão operacional de atendente e visão gerencial com chamados fechados"
                  style={{
                    background: isGestorMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: isGestorMode ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                    color: isGestorMode ? '#34d399' : 'var(--text-muted)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ShieldAlert size={14} color={isGestorMode ? '#10b981' : '#94a3b8'} />
                  {isGestorMode ? 'Modo Gestor Ativo' : 'Alternar p/ Modo Gestor'}
                </button>

                {/* Alternador de Layout Unificado */}
                <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => setViewMode('workspace')}
                    title="Mesa de Trabalho em 3 Colunas"
                    style={{
                      background: viewMode === 'workspace' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'workspace' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Layers size={13} /> Mesa
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    title="Tabela de Protocolos e Auditoria"
                    style={{
                      background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                      color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Ticket size={13} /> Tabela
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Queue Filter Buttons & Info Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                {[
                  { id: 'active', label: 'Todos em Aberto', count: activeTicketsCount },
                  { id: 'open', label: 'Aguardando', count: openCount },
                  { id: 'in_progress', label: 'Em Atendimento', count: inProgressCount },
                  ...(isGestorMode ? [
                    { id: 'resolved', label: '🔒 Fechados (Gestor)', count: resolvedCount, isGestorOnly: true },
                    { id: 'all', label: 'Todos (Geral)', count: totalCount, isGestorOnly: true }
                  ] : [])
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    style={{
                      background: statusFilter === tab.id ? (tab.isGestorOnly ? '#059669' : 'var(--primary)') : 'transparent',
                      color: statusFilter === tab.id ? '#fff' : tab.isGestorOnly ? '#34d399' : 'var(--text-muted)',
                      border: tab.isGestorOnly && statusFilter !== tab.id ? '1px dashed rgba(16, 185, 129, 0.4)' : 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span
                        style={{
                          background: statusFilter === tab.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '0.68rem'
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {!isGestorMode && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Lock size={12} color="#f59e0b" /> Chamados fechados arquivados para Gestores ({resolvedCount})
                </div>
              )}
            </div>

            {/* SE VIEWMODE === 'workspace' -> 3-Column Layout */}
            {viewMode === 'workspace' && (
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: '1rem', flex: 1, minHeight: 0 }}>
                {/* Left Column: Tickets Queue */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  {/* Search box */}
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Buscar chamado ou aluno..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '0.4rem 0.6rem 0.4rem 2rem',
                          color: '#fff',
                          fontSize: '0.8rem'
                        }}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    </div>
                  </div>

                  {/* Ticket items */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredQueue.length === 0 ? (
                      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 0.6rem auto', opacity: 0.8 }} />
                        <strong style={{ color: '#e5e7eb', display: 'block', marginBottom: '0.3rem' }}>Fila Limpa & Organizada</strong>
                        <span>
                          {!isGestorMode
                            ? 'Nenhum chamado aberto pendente para atendimento no momento.'
                            : 'Nenhum chamado encontrado para este critério de filtro.'}
                        </span>
                      </div>
                    ) : (
                      filteredQueue.map((t) => {
                        const isSelected = selectedTicket?.id === t.id;
                        const isResolved = t.status === 'resolved' || t.status === 'finalizado';
                        const isProgress = t.status === 'in_progress' || t.status === 'em_atendimento';
                        return (
                          <div
                            key={t.id}
                            onClick={() => selectTicket(t)}
                            style={{
                              background: isSelected ? 'rgba(29, 78, 216, 0.15)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                              borderRadius: '8px',
                              padding: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                #{t.ticketNumber || t.id}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                  background: isResolved ? 'rgba(16, 185, 129, 0.15)' : isProgress ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: isResolved ? '#10b981' : isProgress ? '#f59e0b' : '#3b82f6'
                                }}
                              >
                                {isResolved ? 'Resolvido (Gestor)' : isProgress ? 'Em Atendimento' : 'Aberto'}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.subject}
                            </div>

                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{t.studentName || 'Aluno'}</span>
                              <span>{t.categoryName || 'Suporte de T.I.'}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Center Column: Active Ticket Resolution Workspace */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  {selectedTicket ? (
                    <>
                      {/* Workspace Header */}
                      <div style={{ padding: '0.9rem 1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            Protocolo #{selectedTicket.ticketNumber || selectedTicket.id} • {selectedTicket.categoryName} • Aluno: {selectedTicket.studentName} (RA: {selectedTicket.studentRa || 'N/A'})
                          </div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedTicket.subject}</h3>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {selectedTicket.status === 'open' && (
                            <button
                              onClick={handleTakeTicket}
                              style={{
                                background: 'var(--primary)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.45rem 0.9rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Assumir Chamado
                            </button>
                          )}

                          {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'finalizado' && (
                            <button
                              onClick={() => setIsEvalModalOpen(true)}
                              style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                padding: '0.45rem 0.9rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <CheckCheck size={14} /> Finalizar Chamado
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Info Banner if ticket is resolved/finalized/closed */}
                      {(selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' || selectedTicket.closed) && (
                        <div style={{ margin: '0.75rem 1rem 0 1rem', padding: '0.65rem 0.9rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', fontSize: '0.76rem', color: '#34d399', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <CheckCheck size={15} color="#10b981" />
                            <span>
                              <strong>Atendimento Finalizado & Fechado (Modo Consulta de Gestor):</strong> {selectedTicket.simpleRecord?.summary || 'Registro consolidado no histórico institucional.'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            Fechado em {new Date(selectedTicket.closedAt || selectedTicket.resolvedAt || selectedTicket.updatedAt || Date.now()).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}

                      {/* Messages Thread */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {selectedTicket.messages?.map((msg) => {
                          const isNote = msg.isInternalNote;
                          const isAttendant = msg.senderRole === 'attendant' || msg.senderRole === 'tecnico' || msg.senderId === attendantId;

                          return (
                            <div
                              key={msg.id}
                              style={{
                                alignSelf: isNote ? 'center' : isAttendant ? 'flex-end' : 'flex-start',
                                maxWidth: isNote ? '90%' : '75%',
                                background: isNote
                                  ? 'rgba(245, 158, 11, 0.12)'
                                  : isAttendant
                                  ? 'var(--primary)'
                                  : 'rgba(255, 255, 255, 0.06)',
                                border: isNote ? '1px dashed #f59e0b' : 'none',
                                borderRadius: '10px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.85rem'
                              }}
                            >
                              <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  {isNote && <Lock size={12} color="#f59e0b" />}
                                  <strong>{isNote ? 'Nota Interna da Equipe' : isAttendant ? (msg.senderName || 'Atendente') : (msg.senderName && msg.senderName !== 'Aluno' ? msg.senderName : (selectedTicket.studentName || 'Aluno'))}</strong>
                                </span>
                                <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.message}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Reply Form or Finalized Notice */}
                      {(selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' || selectedTicket.closed) ? (
                        <div style={{ padding: '1.1rem 1rem', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.18)', textAlign: 'center' }}>
                          <div style={{ color: '#10b981', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontWeight: 600 }}>
                            <CheckCheck size={17} /> Este chamado foi finalizado e arquivado
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            Disponível apenas para consulta e auditoria de Gestores de Setor.
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '0.9rem', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setIsInternalNote(false)}
                              style={{
                                background: !isInternalNote ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: !isInternalNote ? 'var(--primary-light)' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Responder ao Aluno
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsInternalNote(true)}
                              style={{
                                background: isInternalNote ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                                color: isInternalNote ? '#f59e0b' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Nota Interna
                            </button>
                          </div>

                          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder={isInternalNote ? 'Escreva uma anotação privada para a equipe técnica...' : 'Digite a resposta para o aluno...'}
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '0.6rem 0.8rem',
                                color: 'var(--text-main)', fontSize: '0.85rem'
                              }}
                            />
                            <button
                              type="submit"
                              style={{
                                background: isInternalNote ? '#f59e0b' : 'var(--primary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0 1rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Send size={16} />
                            </button>
                          </form>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Selecione um chamado da fila lateral para iniciar o atendimento.
                    </div>
                  )}
                </div>

                {/* Right Column: AI Student Context Card */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1rem',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
                    <Sparkles size={18} color="#f59e0b" />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Card de Contexto do Aluno (IA)</h4>
                  </div>

                  {isAiLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
                      Carregando inteligência contextual do aluno...
                    </div>
                  ) : aiContext ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      {/* Sentiment Badge */}
                      <div
                        style={{
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          background: aiContext.sentimentScore === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: `1px solid ${aiContext.sentimentScore === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}
                      >
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Análise de Sentimento:</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: aiContext.sentimentScore === 'warning' ? '#f59e0b' : '#10b981' }}>
                          {aiContext.sentiment}
                        </div>
                      </div>

                      {/* Summary */}
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Resumo Acadêmico:</div>
                        <div style={{ fontSize: '0.8rem', lineHeight: '1.4', color: '#e5e7eb' }}>{aiContext.summary}</div>
                      </div>

                      {/* Points of attention */}
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Pontos de Atenção Críticos:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {aiContext.pointsOfAttention?.map((pt, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: '0.78rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderLeft: '3px solid #f59e0b',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '0 6px 6px 0',
                                color: '#d1d5db'
                              }}
                            >
                              {pt}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recommended action */}
                      <div style={{ background: 'rgba(29, 78, 216, 0.12)', border: '1px solid rgba(29, 78, 216, 0.3)', borderRadius: '8px', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary-light)', fontWeight: 600, marginBottom: '0.2rem' }}>
                          💡 Ação Recomendada pela IA:
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#e5e7eb', lineHeight: '1.4' }}>{aiContext.recommendedAction}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
                      Selecione um chamado para visualizar a síntese de IA.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SE VIEWMODE === 'table' -> Tabela Unificada de Protocolos e Auditoria */}
            {viewMode === 'table' && (
              <div style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Search & Counter Bar */}
                <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Total de <strong>{filteredQueue.length}</strong> {filteredQueue.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Buscar protocolo, aluno ou assunto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.45rem 0.8rem 0.45rem 2rem',
                        color: '#fff',
                        fontSize: '0.82rem',
                        width: '260px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.85rem 1rem' }}>Protocolo</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Aluno</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Assunto</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Prioridade</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Nenhum chamado encontrado para os critérios selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredQueue.map((t) => {
                          const isResolved = t.status === 'resolved' || t.status === 'finalizado';
                          return (
                            <tr
                              key={t.id}
                              style={{
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                transition: 'background 0.15s ease'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                                #{t.ticketNumber || t.id}
                              </td>
                              <td style={{ padding: '0.85rem 1rem', color: 'var(--text-main)' }}>
                                <div style={{ fontWeight: 600 }}>{t.studentName || 'Aluno'}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.department || 'Graduação'}</div>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', color: '#e5e7eb', maxWidth: '300px' }}>
                                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.subject}
                                </div>
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    background:
                                      t.priority === 'urgent'
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : t.priority === 'high'
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : 'rgba(59, 130, 246, 0.15)',
                                    color:
                                      t.priority === 'urgent'
                                        ? '#ef4444'
                                        : t.priority === 'high'
                                        ? '#f59e0b'
                                        : 'var(--primary-light)'
                                  }}
                                >
                                  {t.priority === 'urgent' ? 'Urgente' : t.priority === 'high' ? 'Alta' : 'Normal'}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    background:
                                      isResolved
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : t.status === 'in_progress' || t.status === 'em_atendimento'
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : 'rgba(59, 130, 246, 0.15)',
                                    color:
                                      isResolved
                                        ? '#10b981'
                                        : t.status === 'in_progress' || t.status === 'em_atendimento'
                                        ? '#f59e0b'
                                        : '#3b82f6'
                                  }}
                                >
                                  {isResolved
                                    ? 'Fechado / Resolvido'
                                    : t.status === 'in_progress' || t.status === 'em_atendimento'
                                    ? 'Em Atendimento'
                                    : 'Aberto'}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                <button
                                  onClick={() => openTicketInInbox(t)}
                                  style={{
                                    background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                    border: isResolved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                                    color: isResolved ? '#10b981' : 'var(--primary-light)',
                                    padding: '0.35rem 0.8rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  {isResolved ? (
                                    <>
                                      <Eye size={12} /> Consultar
                                    </>
                                  ) : (
                                    <>
                                      Atender <ArrowRight size={12} />
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evaluation of Student Modal */}
      {isEvalModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '1rem'
          }}
        >
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '1.8rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Finalizar Atendimento & Parecer Técnico</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
              Conforme as diretrizes institucionais, registre uma avaliação confidencial sobre a conduta e clareza do aluno durante este atendimento.
            </p>

            <form onSubmit={handleFinishTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Avaliação do Aluno (1 a 5 estrelas)
                  </label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>
                    Nota: {evalScore} de 5
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const isSelected = evalScore === s;
                    const isFilled = evalScore >= s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEvalScore(s)}
                        style={{
                          background: isSelected
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : isFilled
                            ? 'rgba(16, 185, 129, 0.18)'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: isSelected
                            ? '2px solid #34d399'
                            : isFilled
                            ? '1px solid rgba(16, 185, 129, 0.45)'
                            : '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '0.65rem 0.5rem',
                          color: isSelected ? '#ffffff' : isFilled ? '#10b981' : 'var(--text-muted)',
                          fontSize: '1.05rem',
                          fontWeight: isSelected ? 800 : isFilled ? 600 : 400,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                          boxShadow: isSelected ? '0 0 16px rgba(16, 185, 129, 0.55), 0 4px 12px rgba(0,0,0,0.3)' : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', filter: isSelected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' : 'none' }}>★</span>
                        <span style={{ fontSize: '0.75rem' }}>{s}</span>
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    marginTop: '0.65rem'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                    Classificação: <strong style={{ color: '#10b981' }}>
                      {evalScore === 5 ? '5 Estrelas — Excelente / Exemplar' :
                       evalScore === 4 ? '4 Estrelas — Muito Bom / Colaborativo' :
                       evalScore === 3 ? '3 Estrelas — Regular / Atendeu' :
                       evalScore === 2 ? '2 Estrelas — Abaixo do Esperado' :
                       '1 Estrela — Muito Insatisfatório'}
                    </strong>
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '6px',
                      background: '#10b98125',
                      color: '#10b981'
                    }}
                  >
                    SELECIONADO
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Parecer Interno (Confidencial)</label>
                <textarea
                  rows="3"
                  placeholder="Observações pertinentes para a coordenação ou ouvidoria..."
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEvalModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: '#10b981', border: 'none', color: '#000', padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Concluir & Finalizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
