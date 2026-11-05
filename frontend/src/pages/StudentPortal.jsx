import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { usePopup } from '../context/PopupContext';
import {
  PlusCircle,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Send,
  Star,
  ChevronRight,
  Sparkles,
  Bot,
  Wrench,
  Laptop,
  Key,
  Wifi,
  RefreshCw,
  ShieldCheck,
  ArrowLeft,
  Maximize2,
  Minimize2,
  X,
  User,
  Headphones,
  CheckCheck,
  Info,
  Tag,
  Calendar
} from 'lucide-react';

export default function StudentPortal({ config, studentUser, onOpenChatWidget, onLogout }) {
  const { showSuccess, showError } = usePopup();
  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [faqList, setFaqList] = useState([]);
  const [faqSearch, setFaqSearch] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected ticket for full-screen / expanded workspace
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isChatMaximized, setIsChatMaximized] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (selectedTicket) {
      scrollToBottom('auto');
      const timer = setTimeout(() => {
        chatInputRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (selectedTicket) {
      scrollToBottom('smooth');
    }
  }, [selectedTicket?.messages?.length]);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === 'Escape' && selectedTicket && !isRatingModalOpen) {
        setSelectedTicket(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [selectedTicket, isRatingModalOpen]);

  const handleOpenTicket = (t) => {
    setSelectedTicket(t);
    refreshSelectedTicket(t.id);
  };

  // New ticket modal
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDescription, setNewDescription] = useState('');

  // Rating modal
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const openRatingModal = (ticket = selectedTicket) => {
    if (ticket?.csatScore) {
      setRatingScore(Number(ticket.csatScore) || 5);
      setRatingComment(ticket.ratingComment || '');
    } else {
      setRatingScore(5);
      setRatingComment('');
    }
    setIsRatingModalOpen(true);
  };

  const studentId = studentUser?.id || 'usr-stu-1';
  // Auto-Repair State
  const [activeAutoRepair, setActiveAutoRepair] = useState(null);
  const [isAutoRepairRunning, setIsAutoRepairRunning] = useState(false);
  const [autoRepairResult, setAutoRepairResult] = useState(null);

  const handleTriggerAutoRepair = async (actionType) => {
    setActiveAutoRepair(actionType);
    setIsAutoRepairRunning(true);
    setAutoRepairResult(null);

    try {
      const res = await api.runAutoRepair(actionType, studentId);
      setTimeout(() => {
        setAutoRepairResult(res);
        setIsAutoRepairRunning(false);
      }, 1000);
    } catch (err) {
      setAutoRepairResult({
        success: false,
        title: 'Falha no Auto-Reparo',
        message: err.message || 'Não foi possível completar o reparo automático.',
        steps: ['Falha na comunicação com o servidor de infraestrutura']
      });
      setIsAutoRepairRunning(false);
    }
  };


  const loadData = useCallback(async () => {
    try {
      const [allTickets, cats, faqs] = await Promise.all([
        api.getTickets({ studentId }),
        api.getCategories(),
        api.getFAQ()
      ]);
      setTickets(allTickets);
      setCategories(cats);
      if (cats.length > 0 && !newCategory) {
        setNewCategory(cats[0].id);
      }
      setFaqList(faqs);
    } catch (err) {
      console.error('Erro ao carregar dados do aluno:', err);
    }
  }, [studentId, newCategory]);

  useEffect(() => {
    loadData();

    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'TICKET_UPDATE') {
        loadData();
        if (msg.ticket && selectedTicket && msg.ticket.id === selectedTicket.id) {
          setSelectedTicket((prev) => (prev ? { ...prev, ...msg.ticket } : prev));
        }
      } else if (msg.type === 'CHAT_MESSAGE' && msg.ticketId) {
        if (selectedTicket && selectedTicket.id === msg.ticketId) {
          setSelectedTicket((prev) => {
            if (!prev) return prev;
            const exists = prev.messages?.some((m) => m.id === msg.message?.id);
            if (exists) return prev;
            return {
              ...prev,
              messages: [...(prev.messages || []), msg.message]
            };
          });
        }
        loadData();
      }
    });

    return () => unsubscribe();
  }, [loadData, selectedTicket?.id]);

  // Refresh single ticket if open
  const refreshSelectedTicket = async (ticketId) => {
    try {
      const t = await api.getTicketById(ticketId);
      setSelectedTicket(t);
      // Also update in list
      setTickets((prev) => prev.map((item) => (item.id === t.id ? t : item)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSubject || !newDescription || !newCategory) return;

    try {
      const created = await api.createTicket({
        studentId,
        studentName: studentUser?.name,
        categoryId: newCategory,
        subject: newSubject,
        description: newDescription,
        priority: newPriority,
        origin: 'portal'
      });
      setIsNewTicketModalOpen(false);
      setNewSubject('');
      setNewDescription('');
      loadData();
      handleOpenTicket(created);
      showSuccess('Seu chamado foi registrado com sucesso e já está na fila de atendimento.', 'Chamado Aberto');
    } catch (err) {
      showError('Erro ao abrir chamado: ' + err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    const msgToSend = replyMessage.trim();
    setReplyMessage('');

    try {
      await api.addTicketMessage(selectedTicket.id, {
        senderId: studentId,
        senderName: studentUser?.name || 'Aluno',
        senderRole: 'aluno',
        message: msgToSend,
        isInternalNote: false
      });
      refreshSelectedTicket(selectedTicket.id);
    } catch (err) {
      showError('Erro ao enviar mensagem: ' + err.message);
      setReplyMessage(msgToSend);
    }
  };

  const handleRateTechnician = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      await api.rateSQLTecnico({
        chamadoId: selectedTicket.id,
        alunoId: studentId,
        tecnicoId: selectedTicket.attendantId || 'usr-tec-1',
        nota: Number(ratingScore),
        comentario: ratingComment
      });
      showSuccess('Obrigado pela sua avaliação! Sua opinião ajuda a aprimorar nossos atendimentos.', 'Avaliação Registrada');
      setIsRatingModalOpen(false);
      refreshSelectedTicket(selectedTicket.id);
    } catch (err) {
      showError('Erro ao enviar avaliação: ' + err.message);
    }
  };

  // Filtered tickets
  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const filteredTickets = safeTickets.filter((t) => {
    if (!t) return false;
    const subj = String(t.subject || '').toLowerCase();
    const tid = String(t.id || '').toLowerCase();
    const cat = String(t.categoryName || '').toLowerCase();
    const query = String(searchFilter || '').toLowerCase();

    const matchesSearch = subj.includes(query) || tid.includes(query) || cat.includes(query);
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'in_progress') return t.status === 'in_progress' || t.status === 'em_atendimento';
    if (statusFilter === 'open') return t.status === 'open' || t.status === 'aberto';
    if (statusFilter === 'resolved') return t.status === 'resolved' || t.status === 'finalizado';
    return true;
  });

  const inProgressCount = safeTickets.filter((t) => t?.status === 'in_progress' || t?.status === 'em_atendimento').length;
  const resolvedCount = safeTickets.filter((t) => t?.status === 'resolved' || t?.status === 'finalizado').length;

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Student Welcome Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.12), rgba(2, 132, 199, 0.05))',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🎓</span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              Olá, {studentUser?.name || 'Larissa Vianna Castro'}
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            RA: {studentUser?.ra || '20230512'} • Curso: {studentUser?.course || 'Medicina (7º Período)'} • {config?.name || 'UniDesk'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setIsNewTicketModalOpen(true)}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(29, 78, 216, 0.4)'
            }}
          >
            <PlusCircle size={18} /> Novo Chamado
          </button>

          <button
            onClick={onOpenChatWidget}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border: '1px solid var(--border-color)',
              padding: '0.6rem 1.2rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <Bot size={18} color="#f59e0b" /> Assistente de T.I. & Auto-Reparo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          onClick={() => setStatusFilter('in_progress')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.2rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderLeft: statusFilter === 'in_progress' ? '4px solid #f59e0b' : '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>🟡 Em Atendimento</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{inProgressCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('resolved')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.2rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderLeft: statusFilter === 'resolved' ? '4px solid #10b981' : '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>🟢 Resolvidos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{resolvedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('all')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.2rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderLeft: statusFilter === 'all' ? '4px solid var(--primary)' : '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>📋 Total de Protocolos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>{tickets.length}</div>
        </div>
      </div>


      {/* ⚡ Central de Auto-Reparo Instantâneo de T.I. */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(15, 118, 110, 0.08))',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={20} color="#38bdf8" /> Central de Auto-Reparo de T.I. (Self-Healing)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Resolva problemas comuns imediatamente sem precisar esperar na fila de atendimento:
            </p>
          </div>
          <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.25rem 0.6rem', borderRadius: '20px', fontWeight: 600 }}>
            ⚡ Correção Automática Instantânea
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
          <button
            onClick={() => handleTriggerAutoRepair('unlock_moodle')}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Laptop size={18} color="#38bdf8" />
            <div>
              <div>Destravar Sessão AVA</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>Corrige Erro 403 / Moodle</span>
            </div>
          </button>

          <button
            onClick={() => handleTriggerAutoRepair('reset_password')}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Key size={18} color="#eab308" />
            <div>
              <div>Desbloquear Conta</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>Reset de tentativas de senha</span>
            </div>
          </button>

          <button
            onClick={() => handleTriggerAutoRepair('diagnose_wifi')}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <Wifi size={18} color="#10b981" />
            <div>
              <div>Diagnóstico Wi-Fi</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>Testar Eduroam & Campus</span>
            </div>
          </button>

          <button
            onClick={() => handleTriggerAutoRepair('clear_cache')}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <RefreshCw size={18} color="#a855f7" />
            <div>
              <div>Limpar Sessão Local</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>Remove cache do Portal</span>
            </div>
          </button>

          <button
            onClick={() => handleTriggerAutoRepair('revalidate_license')}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <ShieldCheck size={18} color="#f43f5e" />
            <div>
              <div>Revalidar Licenças</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>Office 365, MATLAB, CAD</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Grid: Tickets & FAQ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Tickets Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="var(--primary-light)" /> Meus Chamados
            </h3>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                placeholder="Buscar por assunto ou nº..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.8rem 0.45rem 2.2rem',
                  color: '#fff',
                  fontSize: '0.82rem'
                }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            </div>
          </div>

          {/* Tickets List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredTickets.length === 0 ? (
              <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhum chamado encontrado com os filtros selecionados.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isResolved = t.status === 'resolved' || t.status === 'finalizado';
                const isProgress = t.status === 'in_progress' || t.status === 'em_atendimento';
                return (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTicket(t)}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.2rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                          #{t.ticketNumber || t.id}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            background: isResolved ? 'rgba(16, 185, 129, 0.15)' : isProgress ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: isResolved ? '#10b981' : isProgress ? '#f59e0b' : '#3b82f6'
                          }}
                        >
                          {isResolved ? 'Resolvido' : isProgress ? 'Em Atendimento' : 'Aberto'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.categoryName || 'Suporte de T.I.'}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{t.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                        <span>Atendente: {t.attendantName || 'Equipe Central'}</span>
                        <span>Mensagens: {Array.isArray(t?.messages) ? t.messages.length : 0}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* FAQ / Knowledge Base Section */}
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} color="#0284c7" /> Dúvidas Frequentes (FAQ)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(Array.isArray(faqList) ? faqList : []).slice(0, 4).map((faq) => (
              <div
                key={faq.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>{faq.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: '1.4' }}>{faq.snippet}</div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Auto-Repair Progress / Result Modal */}
      {activeAutoRepair && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.6rem', borderRadius: '12px' }}>
                <Wrench size={24} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {isAutoRepairRunning ? 'Executando Auto-Reparo de T.I....' : (autoRepairResult?.title || 'Auto-Reparo Concluído')}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Módulo de Resolução Automatizada UniDesk</span>
              </div>
            </div>

            {isAutoRepairRunning ? (
              <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(56,189,248,0.2)',
                  borderTopColor: '#38bdf8',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 1rem auto'
                }} />
                <p style={{ color: '#e2e8f0', fontSize: '0.88rem' }}>Analisando telemetria e aplicando rotinas de correção...</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Comunicando com cluster Moodle / RADIUS / AD...</span>
              </div>
            ) : (
              <div>
                <div style={{
                  background: autoRepairResult?.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid ' + (autoRepairResult?.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                  borderRadius: '10px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: autoRepairResult?.success ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    <CheckCircle2 size={18} /> {autoRepairResult?.title}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#e2e8f0', margin: 0, lineHeight: 1.5 }}>
                    {autoRepairResult?.message}
                  </p>
                  {autoRepairResult?.tempCode && (
                    <div style={{ marginTop: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                      Código Provisório: <strong>{autoRepairResult.tempCode}</strong>
                    </div>
                  )}
                </div>

                {autoRepairResult?.steps && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ETAPAS DO DIAGNÓSTICO:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {autoRepairResult.steps.map((st, idx) => (
                        <div key={idx} style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: '#10b981' }}>✓</span> {st}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      setActiveAutoRepair(null);
                      setAutoRepairResult(null);
                    }}
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 1.25rem',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Concluir & Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Ticket Chat Workspace */}
      {selectedTicket && (
        <div className={isChatMaximized ? "ticket-chat-fullscreen" : "ticket-chat-modal-wrap"}>
          <div
            className={isChatMaximized ? "ticket-chat-inner-full" : "ticket-chat-modal-box"}
            style={isChatMaximized ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}
          >
            {/* Top Workspace Header */}
            <div
              style={{
                padding: '0.9rem 1.5rem',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexShrink: 0
              }}
            >
              {/* Left: Back button + Protocol & Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  title="Voltar aos chamados (Esc)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    padding: '0.5rem 0.95rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Voltar</span>
                </button>

                <div style={{ width: '1px', height: '26px', background: 'var(--border-color)' }} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.08)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      Protocolo #{selectedTicket.ticketNumber || selectedTicket.id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '12px',
                        background:
                          selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : selectedTicket.status === 'in_progress' || selectedTicket.status === 'em_atendimento'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color:
                          selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado'
                            ? '#10b981'
                            : selectedTicket.status === 'in_progress' || selectedTicket.status === 'em_atendimento'
                            ? '#f59e0b'
                            : '#3b82f6',
                        border: `1px solid ${
                          selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado'
                            ? 'rgba(16, 185, 129, 0.3)'
                            : selectedTicket.status === 'in_progress' || selectedTicket.status === 'em_atendimento'
                            ? 'rgba(245, 158, 11, 0.3)'
                            : 'rgba(59, 130, 246, 0.3)'
                        }`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      {selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' ? (
                        <CheckCircle2 size={13} />
                      ) : selectedTicket.status === 'in_progress' || selectedTicket.status === 'em_atendimento' ? (
                        <Clock size={13} />
                      ) : (
                        <AlertCircle size={13} />
                      )}
                      {selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado'
                        ? 'Resolvido'
                        : selectedTicket.status === 'in_progress' || selectedTicket.status === 'em_atendimento'
                        ? 'Em Atendimento'
                        : 'Aberto'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectedTicket.categoryName || 'Suporte'}
                    </span>
                  </div>
                  <h2
                    style={{
                      fontSize: '1.08rem',
                      fontWeight: 700,
                      color: '#fff',
                      marginTop: '0.15rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {selectedTicket.subject}
                  </h2>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setIsChatMaximized((prev) => !prev)}
                  title={isChatMaximized ? 'Restaurar visualização em janela' : 'Expandir para tela cheia'}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {isChatMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  title="Fechar chat (Esc)"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Main Workspace Layout (Chat + Details Sidebar) */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              {/* Left Column: Chat Area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', minWidth: 0 }}>
                {/* Messages Thread */}
                <div
                  style={{
                    padding: '1.5rem 2rem',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.2rem'
                  }}
                >
                  {/* Timeline Opening Badge */}
                  <div style={{ textAlign: 'center', margin: '0.3rem 0 0.8rem 0' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.9rem',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <Clock size={13} />
                      Chamado registrado em {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleString('pt-BR') : 'Data não informada'}
                    </div>
                  </div>

                  {/* Empty Messages State */}
                  {(!selectedTicket.messages || selectedTicket.messages.length === 0) && (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        gap: '0.75rem',
                        padding: '3rem 1rem'
                      }}
                    >
                      <MessageSquare size={42} style={{ opacity: 0.3 }} />
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>Nenhuma mensagem trocada ainda</div>
                      <div style={{ fontSize: '0.82rem', textAlign: 'center', maxWidth: '380px', lineHeight: '1.5' }}>
                        Envie uma mensagem abaixo para falar com a equipe de suporte ou esclarecer dúvidas sobre este atendimento.
                      </div>
                    </div>
                  )}

                  {/* Messages Bubble List */}
                  {selectedTicket.messages?.map((msg) => {
                    const isStudent = msg.senderRole === 'student' || msg.senderRole === 'aluno' || msg.senderId === studentId;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isStudent ? 'flex-end' : 'flex-start',
                          maxWidth: '78%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isStudent ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            background: isStudent ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' : 'rgba(255,255,255,0.06)',
                            border: isStudent ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border-color)',
                            borderRadius: isStudent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            padding: '0.85rem 1.2rem',
                            color: '#fff',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.72rem',
                              opacity: 0.85,
                              marginBottom: '0.35rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1.5rem'
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                              {isStudent ? <User size={13} /> : <Headphones size={13} />}
                              {isStudent
                                ? (studentUser?.name || (msg.senderName && msg.senderName !== 'Aluno' ? msg.senderName : 'Você'))
                                : (msg.senderName || 'Atendente')}
                            </span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.88rem' }}>{msg.message}</div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Resolution Banner in thread */}
                  {(selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' || selectedTicket.closed) && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '1rem 1.25rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <CheckCheck size={20} color="#10b981" />
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#34d399' }}>
                            Atendimento Concluído
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            {selectedTicket.simpleRecord?.summary || 'Chamado finalizado e fechado com registro simplificado em memória.'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => openRatingModal()}
                        style={{
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Star size={15} /> {selectedTicket.csatScore ? `Avaliado (${selectedTicket.csatScore}★) - Alterar` : 'Avaliar Atendimento'}
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Bar Footer */}
                <div
                  style={{
                    padding: '1.25rem 2rem',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)'
                  }}
                >
                  {selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' || selectedTicket.closed ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} /> Este chamado foi finalizado pela equipe de atendimento.
                      </div>
                      <button
                        onClick={() => openRatingModal()}
                        style={{
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          padding: '0.55rem 1.2rem',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <Star size={16} /> {selectedTicket.csatScore ? `Avaliado (${selectedTicket.csatScore}★) - Alterar` : 'Avaliar Atendimento'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <textarea
                          ref={chatInputRef}
                          rows={2}
                          placeholder="Digite sua mensagem para o atendente... (Enter para enviar, Shift+Enter para nova linha)"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e);
                            }
                          }}
                          style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            color: '#fff',
                            fontSize: '0.88rem',
                            resize: 'none',
                            fontFamily: 'inherit',
                            lineHeight: '1.45',
                            outline: 'none'
                          }}
                          onFocus={(e) => (e.target.style.borderColor = 'var(--primary-light)')}
                          onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!replyMessage.trim()}
                        style={{
                          background: replyMessage.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                          color: replyMessage.trim() ? '#fff' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '0 1.4rem',
                          cursor: replyMessage.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          height: '52px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <Send size={16} /> Enviar
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Right Column: Ticket Context Sidebar */}
              <div
                className="ticket-chat-sidebar"
                style={{
                  width: '350px',
                  borderLeft: '1px solid var(--border-color)',
                  background: 'var(--bg-surface)',
                  padding: '1.5rem',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <Info size={18} color="var(--primary-light)" />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>Detalhes do Chamado</h3>
                </div>

                {/* Original Description */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Descrição Inicial do Aluno
                  </div>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderLeft: '3px solid var(--primary-light)',
                      borderRadius: '0 8px 8px 0',
                      padding: '0.75rem 0.9rem',
                      fontSize: '0.82rem',
                      color: '#d1d5db',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '160px',
                      overflowY: 'auto'
                    }}
                  >
                    {selectedTicket.description || 'Nenhuma descrição detalhada informada.'}
                  </div>
                </div>

                {/* Metadata Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Tag size={13} /> Categoria
                    </span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedTicket.categoryName || 'Suporte Geral'}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={13} /> Prioridade
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background:
                          selectedTicket.priority === 'urgent'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : selectedTicket.priority === 'high'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(59, 130, 246, 0.2)',
                        color:
                          selectedTicket.priority === 'urgent'
                            ? '#ef4444'
                            : selectedTicket.priority === 'high'
                            ? '#f59e0b'
                            : '#3b82f6'
                      }}
                    >
                      {selectedTicket.priority === 'urgent'
                        ? 'Urgente'
                        : selectedTicket.priority === 'high'
                        ? 'Alta'
                        : selectedTicket.priority === 'low'
                        ? 'Baixa'
                        : 'Média'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Headphones size={13} /> Atendente
                    </span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                      {selectedTicket.attendantName || selectedTicket.assignedToName || 'Fila Geral'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={13} /> Criado em
                    </span>
                    <span style={{ color: 'var(--text-main)' }}>
                      {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Evaluation Card if closed */}
                {(selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' || selectedTicket.closed) && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '0.9rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Star size={15} /> Avaliação do Suporte
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                      {selectedTicket.csatScore
                        ? `Você avaliou este atendimento com nota ${selectedTicket.csatScore} de 5.`
                        : 'Ajude a melhorar o serviço de atendimento avaliando como foi seu suporte.'}
                    </p>
                    <button
                      onClick={() => openRatingModal()}
                      style={{
                        width: '100%',
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#f59e0b',
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Star size={14} /> {selectedTicket.csatScore ? 'Alterar Avaliação' : 'Avaliar agora'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isNewTicketModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              padding: '1.8rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Abrir Novo Chamado de T.I.</h3>
              <button onClick={() => setIsNewTicketModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Categoria / Setor</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                >
                  {(Array.isArray(categories) ? categories : []).map((c) => (
                    <option key={c.id} value={c.id} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
                      {c.name} (SLA: {c.slaHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Assunto</label>
                <input
                  type="text"
                  placeholder="Ex: Problema com acesso ao Portal / Moodle / Wi-Fi"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  required
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Prioridade</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                >
                  <option value="low" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Baixa (Dúvida comum)</option>
                  <option value="medium" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Média (Padrão)</option>
                  <option value="high" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Alta (Impacta matrícula/prazo)</option>
                  <option value="urgent" style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>Urgente (Prazo vencendo hoje)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Descrição Detalhada</label>
                <textarea
                  rows="4"
                  placeholder="Descreva o problema de T.I., mensagens de erro na tela, local do campus ou laboratório..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Confirmar Abertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technician Rating Modal */}
      {isRatingModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
        >
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '1.8rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Avaliar Atendimento</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
              Como você avalia a agilidade e clareza do suporte prestado para o protocolo #{selectedTicket?.ticketNumber || selectedTicket?.id}?
            </p>

            <form onSubmit={handleRateTechnician} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Nota de Atendimento (1 a 5 estrelas)
                  </label>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b' }}>
                    Nota: {ratingScore} de 5
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isSelected = ratingScore === star;
                    const isFilled = ratingScore >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        style={{
                          background: isSelected
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : isFilled
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: isSelected
                            ? '2px solid #fbbf24'
                            : isFilled
                            ? '1px solid rgba(245, 158, 11, 0.45)'
                            : '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '0.65rem 0.5rem',
                          color: isSelected ? '#ffffff' : isFilled ? '#f59e0b' : 'var(--text-muted)',
                          fontSize: '1.05rem',
                          fontWeight: isSelected ? 800 : isFilled ? 600 : 400,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                          boxShadow: isSelected ? '0 0 16px rgba(245, 158, 11, 0.55), 0 4px 12px rgba(0,0,0,0.3)' : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', filter: isSelected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' : 'none' }}>★</span>
                        <span style={{ fontSize: '0.75rem' }}>{star}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    marginTop: '0.65rem'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                    Avaliação: <strong style={{ color: '#f59e0b' }}>
                      {ratingScore === 5 ? '5 Estrelas — Atendimento Excelente' :
                       ratingScore === 4 ? '4 Estrelas — Muito Bom' :
                       ratingScore === 3 ? '3 Estrelas — Regular' :
                       ratingScore === 2 ? '2 Estrelas — Abaixo do Esperado' :
                       '1 Estrela — Insatisfatório'}
                    </strong>
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '6px',
                      background: '#f59e0b25',
                      color: '#f59e0b'
                    }}
                  >
                    SELECIONADO
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Comentário adicional</label>
                <textarea
                  rows="3"
                  placeholder="Conte-nos o que achou do atendimento..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRatingModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Enviar Avaliação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
