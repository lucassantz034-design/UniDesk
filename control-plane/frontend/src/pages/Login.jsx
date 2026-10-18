import React, { useState } from 'react';
import { Lock, ShieldCheck, User, Server } from 'lucide-react';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(username, password);
      onLoginSuccess(res.user || { name: 'Master Super Admin', role: 'SUPER_ADMIN' });
    } catch (err) {
      setError(err.message || 'Falha na autenticação Master. Verifique as credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-4 shadow-inner">
            <Server className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            UniDesk <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 font-medium">CENTRAL MASTER</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Painel de Controle e Licenciamento</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Usuário Master
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="ex: admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Senha Criptográfica
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-lg text-xs text-slate-400">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Acesso Restrito ao Fornecedor
            </div>
            Credenciais padrão locais: <code className="text-blue-300">admin</code> / <code className="text-blue-300">admin123</code>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg hover:shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            ) : null}
            {loading ? 'Autenticando...' : 'Acessar Central Master'}
          </button>
        </form>
      </div>
    </div>
  );
}
