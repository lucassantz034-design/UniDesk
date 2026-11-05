import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { usePopup } from '../context/PopupContext';
import { MessageSquare, X, Send, Bot, User, CornerDownLeft, Sparkles, CheckCheck, RefreshCw, Archive } from 'lucide-react';

export default function ChatWidget({ config, isOpen, setIsOpen, studentUser }) {
  const { showError, showSuccess } = usePopup();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const studentId = studentUser?.id || 'usr-alu-2';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !session) {
      initSession();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const initSession = async () => {
    try {
      const sess = await api.startChatSession(studentId, 'Geral', studentUser?.name);
      setSession(sess);
      setMessages(sess.messages || []);
    } catch (err) {
      console.error('Erro ao iniciar chat:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !session) return;

    const userText = inputText;
    setInputText('');

    const resolvedSenderName = studentUser?.name || 'Aluno';

    // Optimistic user message
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      sender: 'student',
      senderName: resolvedSenderName,
      text: userText,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);

    try {
      const res = await api.sendChatMessage(session.id, {
        sender: 'student',
        senderName: resolvedSenderName,
        text: userText
      });

      if (res.session) {
        setSession(res.session);
        setMessages(res.session.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEscalate = async () => {
    if (!session) return;
    try {
      const res = await api.escalateChatSession(session.id, 'Suporte de T.I.');
      setSession(res);
      setMessages((prev) => [
        ...prev,
        {
          id: 'esc-' + Date.now(),
          sender: 'bot',
          senderName: 'Sistema',
          text: 'Chamado transferido com sucesso para a fila de atendimento humano!',
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (err) {
      showError('Erro ao transferir: ' + err.message);
    }
  };

  const isClosed = session?.closed || session?.status === 'finalizado';

  const handleCloseChat = async () => {
    if (!session || isClosed) return;
    try {
      const res = await api.closeChatSession(session.id);
      if (res.session) {
        setSession(res.session);
        setMessages(res.session.messages || []);
      }
      showSuccess('Chat finalizado e fechado mantendo registro simples na memória.');
    } catch (err) {
      showError('Erro ao finalizar chat: ' + err.message);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: '#fff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(29, 78, 216, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 9999,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Bot size={28} />
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '14px',
              height: '14px',
              background: '#10b981',
              borderRadius: '50%',
              border: '2px solid var(--bg-surface)'
            }}
          />
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '380px',
            height: '540px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.2), rgba(2, 132, 199, 0.1))',
              borderBottom: '1px solid var(--border-color)',
              padding: '0.85rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  Sophia IA <Sparkles size={14} color="#f59e0b" />
                </div>
                <div style={{ fontSize: '0.7rem', color: isClosed ? '#10b981' : '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isClosed ? '#10b981' : '#38bdf8' }} />
                  {isClosed
                    ? 'Atendimento Finalizado (Fechado)'
                    : session?.status === 'waiting_agent'
                    ? 'Aguardando Atendente Humano'
                    : 'Assistente Virtual Ativa'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {!isClosed && (
                <button
                  type="button"
                  onClick={handleCloseChat}
                  title="Finalizar e fechar chat mantendo registro simples"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '0.22rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'background 0.2s'
                  }}
                >
                  <CheckCheck size={12} /> Encerrar
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Simple Record Info Banner if Finalized */}
          {isClosed && session?.simpleRecord && (
            <div
              style={{
                margin: '0.75rem 0.75rem 0 0.75rem',
                padding: '0.65rem 0.85rem',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '8px',
                fontSize: '0.74rem',
                color: '#34d399',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCheck size={13} /> Registro Simples de Memória Ativo
              </div>
              <div style={{ fontSize: '0.69rem', opacity: 0.9, color: '#e2e8f0' }}>
                Atendimento fechado em {new Date(session.simpleRecord.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Total de {session.simpleRecord.totalMessages} mensagens compactadas para poupar memória do software.
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {messages.map((m) => {
              const isUser = m.sender === 'student' || m.sender === 'aluno';
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    background: isUser ? 'var(--primary)' : 'var(--bg-input)',
                    borderRadius: '12px',
                    padding: '0.75rem 0.95rem',
                    color: isUser ? '#fff' : 'var(--text-main)',
                    fontSize: '0.82rem',
                    lineHeight: '1.4'
                  }}
                >
                  <div style={{ fontSize: '0.68rem', opacity: 0.75, marginBottom: '0.2rem' }}>
                    {isUser ? (studentUser?.name || (m.senderName && m.senderName !== 'Aluno' && m.senderName !== 'Você' ? m.senderName : 'Aluno')) : (m.senderName || 'Sophia')}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                </div>
              );
            })}

            {isTyping && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--bg-input)', borderRadius: '12px', padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Sophia está digitando...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Escalation bar if bot */}
          {session?.status === 'bot' && (
            <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(245, 158, 11, 0.1)', borderTop: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>Prefere suporte humano?</span>
              <button
                onClick={handleEscalate}
                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Falar com Atendente
              </button>
            </div>
          )}

          {/* Input Footer or Closed Summary */}
          {isClosed ? (
            <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.76rem', color: '#10b981', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                <CheckCheck size={15} /> Atendimento finalizado e fechado com sucesso!
              </div>
              <button
                type="button"
                onClick={initSession}
                style={{
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(29, 78, 216, 0.3)'
                }}
              >
                <RefreshCw size={14} /> Iniciar Novo Atendimento
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', background: 'var(--bg-surface)' }}
            >
              <input
                type="text"
                placeholder="Digite sua dúvida..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.8rem',
                  color: isUser ? '#fff' : 'var(--text-main)',
                    fontSize: '0.82rem'
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.55rem 0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send size={15} />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
