import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Key, 
  Copy, 
  Check, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  CalendarPlus, 
  Search, 
  RefreshCw,
  ExternalLink,
  Cpu
} from 'lucide-react';
import api from '../services/api';

export default function TenantsDashboard() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [extendingId, setExtendingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await api.getTenants();
      setTenants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCopyKey = (key, id) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleExtendTolerance = async (tenant) => {
    if (!confirm(`Deseja aplicar extensão de tolerância manual de +15 dias para "${tenant.name}"?`)) {
      return;
    }
    setExtendingId(tenant.id);
    try {
      await api.extendLicense(tenant.id, 15);
      setActionMessage({ type: 'success', text: `Tolerância de 15 dias concedida com sucesso para ${tenant.name}.` });
      
      // Atualiza localmente
      setTenants((prev) =>
        prev.map((t) => {
          if (t.id === tenant.id) {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 15);
            return {
              ...t,
              status: 'ACTIVE',
              expiresAt: newExpiry.toISOString(),
              gracePeriodDays: 0,
            };
          }
          return t;
        })
      );
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Erro ao estender licença: ' + err.message });
    } finally {
      setExtendingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.cnpj.includes(search) ||
      t.licenseKey.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status, graceDays) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Ativo
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Tolerância ({graceDays || 1}/15d)
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" /> Bloqueado (Dia 16+)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="text-blue-500 h-7 w-7" /> Gestão de Empresas & Licenças
          </h1>
          <p className="text-sm text-slate-400">
            Monitoramento de instâncias clientes UniDesk, chaves Ed25519 e tolerâncias
          </p>
        </div>

        <button
          onClick={fetchTenants}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Lista
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs opacity-75 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
            Total de Empresas Ativas
          </div>
          <div className="text-3xl font-extrabold text-white">
            {tenants.filter((t) => t.status === 'ACTIVE').length}
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Heartbeats em dia
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
            Em Tolerância (Aviso 1-15 dias)
          </div>
          <div className="text-3xl font-extrabold text-amber-400">
            {tenants.filter((t) => t.status === 'GRACE_PERIOD').length}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Atraso de pagamento ou renovação pendente
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
            Instâncias Bloqueadas (Dia 16+)
          </div>
          <div className="text-3xl font-extrabold text-rose-400">
            {tenants.filter((t) => t.status === 'BLOCKED').length}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Rotas bloqueadas HTTP 402 no cliente
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente por razão social, CNPJ ou chave de licença..."
          className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Empresa / CNPJ</th>
                <th className="py-3.5 px-4">Plano Contratado</th>
                <th className="py-3.5 px-4">Status da Licença</th>
                <th className="py-3.5 px-4">Chave LICENSE_KEY</th>
                <th className="py-3.5 px-4">Expira em / Heartbeat</th>
                <th className="py-3.5 px-4 text-right">Ações Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Carregando dados dos tenants...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    Nenhuma empresa encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white">{t.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.cnpj}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{t.contactEmail}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-slate-200 font-medium">{t.plan}</div>
                      <div className="text-xs text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.monthlyPrice)} /mês
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(t.status, t.gracePeriodDays)}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs">
                      <div className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded-lg border border-slate-800 max-w-fit">
                        <Key className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-slate-300 truncate max-w-[140px] sm:max-w-[180px]">
                          {t.licenseKey}
                        </span>
                        <button
                          onClick={() => handleCopyKey(t.licenseKey, t.id)}
                          title="Copiar Chave Completa"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition shrink-0"
                        >
                          {copiedKey === t.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <div className="text-slate-300 font-medium">
                        {new Date(t.expiresAt).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <Cpu className="w-3 h-3 text-slate-400" />
                        Ping: {new Date(t.lastHeartbeat).toLocaleTimeString('pt-BR')}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleExtendTolerance(t)}
                        disabled={extendingId === t.id}
                        title="Conceder +15 dias de extensão de licença manualmente"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold rounded-lg border border-blue-500/30 transition duration-150 disabled:opacity-50"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        {extendingId === t.id ? 'Aplicando...' : '+15d Tolerância'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
