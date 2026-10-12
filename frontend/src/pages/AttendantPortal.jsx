import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Inbox,
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
  CheckCheck
} from 'lucide-react';

export default function AttendantPortal({ config, attendantUser }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [aiContext, setAiContext] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply inputs
  const [messageText, setMessageText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Student Evaluation Modal (when finishing ticket)
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evalScore, setEvalScore] = useState(5);
  const [evalComment, setEvalComment] = useState('');

  const attendantId = attendantUser?.id || 'usr-att-1';

  const loadTickets = async () => {
    try {
      const data = await api.getTickets();
      setTickets(data);
      if (data.length > 0 && !selectedTicket) {
        selectTicket(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar tickets:', err);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const selectTicket = async (ticket) => {
    try {
      const full = await api.getTicketById(ticket.id);
      setSelectedTicket(full);
      loadAIContext(full.studentId);
    } catch (err) {
      setSelectedTicket(ticket);
    }
  };

  const loadAIContext = async (studentId) => {
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
  };

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
      // Reload ticket
      const updated = await api.getTicketById(selectedTicket.id);
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message);
    }
  };

  const handleTakeTicket = async () => {
    if (!selectedTicket) return;
    try {
      const updated = await api.updateTicketStatus(selectedTicket.id, 'in_progress');
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      alert('Erro ao assumir chamado: ' + err.message);
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
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setIsEvalModalOpen(false);
      alert('Chamado finalizado e avaliação acadêmica registrada com sucesso!');
    } catch (err) {
      alert('Erro ao finalizar chamado: ' + err.message);
    }
  };

  // Filtered queue
  const filteredQueue = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.studentName && t.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return t.status === 'open' || t.status === 'aberto';
    if (statusFilter === 'in_progress') return t.status === 'in_progress' || t.status === 'em_atendimento';
    if (statusFilter === 'resolved') return t.status === 'resolved' || t.status === 'finalizado';
    return true;
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Attendant Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Inbox size={20} color="var(--primary-light)" /> Painel de Atendimento ao Aluno
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Operador: {attendantUser?.name || 'Mariana Alencar'} • Departamento: {attendantUser?.department || 'Secretaria Acadêmica'}
          </span>
        </div>

        {/* Quick Queue Filter Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-surface)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'open', label: 'Abertos' },
            { id: 'in_progress', label: 'Em Atendimento' },
            { id: 'resolved', label: 'Resolvidos' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                background: statusFilter === tab.id ? 'var(--primary)' : 'transparent',
                color: statusFilter === tab.id ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Layout: Queue List | Active Chat Workspace | AI Context Card */}
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
            {filteredQueue.map((t) => {
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
                      {isResolved ? 'Resolvido' : isProgress ? 'Em Atendimento' : 'Aberto'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.subject}
                  </div>

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t.studentName || 'Aluno'}</span>
                    <span>{t.categoryName || 'Secretaria'}</span>
                  </div>
                </div>
              );
            })}
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
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{selectedTicket.subject}</h3>
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
                          <strong>{isNote ? 'Nota Interna da Equipe' : msg.senderName || 'Usuário'}</strong>
                        </span>
                        <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.message}</div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
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
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Lock size={12} /> Nota Interna Privada
                  </button>
                </div>

                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.6rem' }}>
                  <input
                    type="text"
                    placeholder={isInternalNote ? 'Escreva uma nota interna sigilosa para os operadores...' : 'Escreva sua resposta para o aluno...'}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    style={{
                      flex: 1,
                      background: isInternalNote ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isInternalNote ? '#f59e0b' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      padding: '0.55rem 0.8rem',
                      color: '#fff',
                      fontSize: '0.82rem'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: isInternalNote ? '#f59e0b' : 'var(--primary)',
                      color: isInternalNote ? '#000' : '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Send size={15} /> Enviar
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
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
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Card de Contexto do Aluno (IA)</h4>
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
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>Finalizar Atendimento & Parecer Técnico</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
              Conforme as diretrizes institucionais, registre uma avaliação confidencial sobre a conduta e clareza do aluno durante este atendimento.
            </p>

            <form onSubmit={handleFinishTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Avaliação do Aluno (1 a 5 estrelas)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEvalScore(s)}
                      style={{
                        background: evalScore >= s ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.8rem',
                        color: evalScore >= s ? '#10b981' : 'var(--text-muted)',
                        fontSize: '1.1rem',
                        cursor: 'pointer'
                      }}
                    >
                      ★ {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Parecer Interno (Confidencial)</label>
                <textarea
                  rows="3"
                  placeholder="Observações pertinentes para a coordenação ou ouvidoria..."
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEvalModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
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
