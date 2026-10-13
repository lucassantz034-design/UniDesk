import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
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
  Bot
} from 'lucide-react';

export default function StudentPortal({ config, studentUser, onOpenChatWidget, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [faqList, setFaqList] = useState([]);
  const [faqSearch, setFaqSearch] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected ticket for thread modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');

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

  const studentId = studentUser?.id || 'usr-stu-2';

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
      setSelectedTicket(created);
    } catch (err) {
      alert('Erro ao abrir chamado: ' + err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      await api.addTicketMessage(selectedTicket.id, {
        senderId: studentId,
        message: replyMessage,
        isInternalNote: false
      });
      setReplyMessage('');
      refreshSelectedTicket(selectedTicket.id);
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message);
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
      alert('Obrigado pela sua avaliação!');
      setIsRatingModalOpen(false);
      refreshSelectedTicket(selectedTicket.id);
    } catch (err) {
      alert('Erro ao enviar avaliação: ' + err.message);
    }
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (t.categoryName && t.categoryName.toLowerCase().includes(searchFilter.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'in_progress') return t.status === 'in_progress' || t.status === 'em_atendimento';
    if (statusFilter === 'open') return t.status === 'open' || t.status === 'aberto';
    if (statusFilter === 'resolved') return t.status === 'resolved' || t.status === 'finalizado';
    return true;
  });

  const inProgressCount = tickets.filter((t) => t.status === 'in_progress' || t.status === 'em_atendimento').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'finalizado').length;

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
            <Bot size={18} color="#f59e0b" /> Falar com Sophia (IA)
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
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>{tickets.length}</div>
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
                    onClick={() => setSelectedTicket(t)}
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
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
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
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.categoryName || 'Secretaria Acadêmica'}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff', marginBottom: '0.25rem' }}>{t.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                        <span>Atendente: {t.attendantName || 'Equipe Central'}</span>
                        <span>Mensagens: {t.messages?.length || 0}</span>
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
            {faqList.slice(0, 4).map((faq) => (
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
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.35rem' }}>{faq.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: '1.4' }}>{faq.snippet}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
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
              maxWidth: '750px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Protocolo #{selectedTicket.ticketNumber || selectedTicket.id} • {selectedTicket.categoryName}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{selectedTicket.subject}</div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Messages Thread */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedTicket.messages?.map((msg) => {
                const isStudent = msg.senderRole === 'student' || msg.senderRole === 'aluno' || msg.senderId === studentId;
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isStudent ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: isStudent ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '0.85rem 1.1rem',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', opacity: 0.8, marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <strong>{msg.senderName || (isStudent ? 'Você' : 'Atendente')}</strong>
                      <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.message}</div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer / Message Input */}
            <div style={{ padding: '1.2rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
              {selectedTicket.status === 'resolved' || selectedTicket.status === 'finalizado' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={16} /> Este chamado foi finalizado pela equipe de atendimento.
                  </div>
                  <button
                    onClick={() => setIsRatingModalOpen(true)}
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Star size={15} /> Avaliar Atendimento
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Digite sua mensagem para o atendente..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.65rem 1.2rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 600
                    }}
                  >
                    <Send size={16} /> Enviar
                  </button>
                </form>
              )}
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Abrir Novo Chamado</h3>
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
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem' }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: '#111827' }}>
                      {c.name} (SLA: {c.slaHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Assunto</label>
                <input
                  type="text"
                  placeholder="Ex: Dúvida sobre validação de horas complementares"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Prioridade</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem' }}
                >
                  <option value="low" style={{ background: '#111827' }}>Baixa (Dúvida comum)</option>
                  <option value="medium" style={{ background: '#111827' }}>Média (Padrão)</option>
                  <option value="high" style={{ background: '#111827' }}>Alta (Impacta matrícula/prazo)</option>
                  <option value="urgent" style={{ background: '#111827' }}>Urgente (Prazo vencendo hoje)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Descrição Detalhada</label>
                <textarea
                  rows="4"
                  placeholder="Descreva detalhadamente sua solicitação..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
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
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>Avaliar Atendimento</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
              Como você avalia a agilidade e clareza do suporte prestado para o protocolo #{selectedTicket?.ticketNumber || selectedTicket?.id}?
            </p>

            <form onSubmit={handleRateTechnician} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nota (1 a 5 estrelas)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingScore(star)}
                      style={{
                        background: ratingScore >= star ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.8rem',
                        color: ratingScore >= star ? '#f59e0b' : 'var(--text-muted)',
                        fontSize: '1.1rem',
                        cursor: 'pointer'
                      }}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Comentário adicional</label>
                <textarea
                  rows="3"
                  placeholder="Conte-nos o que achou do atendimento..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRatingModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
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
