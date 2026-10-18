import React, { useState, useEffect } from 'react';
import { 
  Headphones, 
  Terminal, 
  Send, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Database, 
  Server, 
  Cpu, 
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import api from '../services/api';

export default function SupportDashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await api.getSupportTickets();
      setTickets(data);
      if (data.length > 0 && !selectedTicket) {
        setSelectedTicket(data[0]);
      } else if (selectedTicket) {
        // Atualiza a seleção mantendo os dados novos
        const updated = data.find((t) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    setSubmittingReply(true);
    try {
      await api.replySupportTicket(selectedTicket.id, replyMessage, 'ANSWERED');
      
      const newResponse = {
        author: 'Master Admin (Central Suporte)',
        date: new Date().toISOString(),
        message: replyMessage,
      };

      const updatedTicket = {
        ...selectedTicket,
        status: 'ANSWERED',
        responses: [...(selectedTicket.responses || []), newResponse],
      };

      setSelectedTicket(updatedTicket);
      setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
      setReplyMessage('');
    } catch (err) {
      alert('Erro ao enviar resposta: ' + err.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!confirm(`Deseja encerrar e finalizar o ticket ${selectedTicket.id}?`)) return;

    try {
      await api.closeSupportTicket(selectedTicket.id);
      const closed = { ...selectedTicket, status: 'CLOSED' };
      setSelectedTicket(closed);
      setTickets((prev) => prev.map((t) => (t.id === closed.id ? closed : t)));
    } catch (err) {
      alert('Erro ao fechar ticket: ' + err.message);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'HIGH':
        return <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">ALTA</span>;
      case 'MEDIUM':
        return <span className="text-amber-400 font-medium text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">MÉDIA</span>;
      default:
        return <span className="text-slate-400 text-xs bg-slate-800 px-2 py-0.5 rounded">BAIXA</span>;
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
            <Clock className="w-3 h-3" /> Aberto
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            <Clock className="w-3 h-3" /> Em Análise
          </span>
        );
      case 'ANSWERED':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-blue-400 font-semibold bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
            <MessageSquare className="w-3 h-3" /> Respondido
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> Finalizado
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{s}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Headphones className="text-blue-500 h-7 w-7" /> Central de Suporte Técnico N2 / N3
          </h1>
          <p className="text-sm text-slate-400">
            Atendimento aos administradores de instâncias UniDesk com telemetria diagnóstica
          </p>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Chamados
        </button>
      </div>

      {/* Main Grid: List on Left, Detail & Reply on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Ticket List (Left 5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Chamados Recebidos ({filteredTickets.length})
            </span>
            <div className="flex gap-1">
              {['ALL', 'OPEN', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    filterStatus === st ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {st === 'ALL' ? 'Todos' : st === 'OPEN' ? 'Abertos' : 'Fechados'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                Carregando chamados...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum chamado neste status.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected ? 'bg-blue-600/10 border-l-4 border-blue-500' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-blue-400 font-semibold">{t.id}</span>
                      <div className="flex items-center gap-1.5">
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-100 text-sm truncate">{t.title}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                      <span className="truncate max-w-[200px]">{t.tenantName}</span>
                      <span>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Detail, Diagnostics & Thread (Right 7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
              {/* Ticket Head */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-blue-400 font-bold">{selectedTicket.id}</span>
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                  <h2 className="text-lg font-bold text-white">{selectedTicket.title}</h2>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Cliente: <strong className="text-slate-200">{selectedTicket.tenantName}</strong> • Aberto em {new Date(selectedTicket.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>

                {selectedTicket.status !== 'CLOSED' && (
                  <button
                    onClick={handleCloseTicket}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Fechar Chamado
                  </button>
                )}
              </div>

              {/* Initial Customer Message */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Descrição do Problema pelo Cliente
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Technical Diagnostics Box (CAP-4: runtime telemetry, version, db, logs) */}
              {selectedTicket.diagnostics && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold mb-3">
                    <Terminal className="w-4 h-4" />
                    <span>Telemetria Diagnóstica Coletada da Instância</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3 text-slate-300">
                    <div>
                      <span className="text-slate-500">Versão UniDesk:</span> {selectedTicket.diagnostics.appVersion}
                    </div>
                    <div>
                      <span className="text-slate-500">Node.js:</span> {selectedTicket.diagnostics.nodeVersion}
                    </div>
                    <div>
                      <span className="text-slate-500">Banco Local:</span> {selectedTicket.diagnostics.dbEngine}
                    </div>
                    <div>
                      <span className="text-slate-500">Memória / SO:</span> {selectedTicket.diagnostics.memoryUsage}
                    </div>
                  </div>

                  <div className="text-slate-500 mb-1">Últimos Logs de Erro / Buffer:</div>
                  <pre className="p-3 bg-black/50 border border-slate-800/80 rounded-lg text-[11px] text-amber-300/90 overflow-x-auto whitespace-pre-wrap">
                    {selectedTicket.diagnostics.recentErrorLogs}
                  </pre>
                </div>
              )}

              {/* Conversation History / Responses */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Histórico de Respostas ({selectedTicket.responses?.length || 0})
                </div>

                {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                  selectedTicket.responses.map((resp, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-blue-400">{resp.author}</span>
                        <span className="text-slate-500">{new Date(resp.date).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {resp.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    Nenhuma resposta enviada ainda.
                  </div>
                )}
              </div>

              {/* Reply Box */}
              {selectedTicket.status !== 'CLOSED' ? (
                <form onSubmit={handleSendReply} className="space-y-3 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Responder ao Administrador do Cliente
                  </label>
                  <textarea
                    rows={3}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Instruções técnicas, orientações para correção de configuração ou nota de resolução..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingReply || !replyMessage.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submittingReply ? 'Enviando...' : 'Enviar Resposta Técnica'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-xl text-emerald-400 text-xs text-center font-medium">
                  Este chamado foi finalizado e arquivado.
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 p-8 text-center text-sm">
              Selecione um chamado na lista à esquerda para analisar diagnósticos e responder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
