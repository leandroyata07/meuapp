import React, { useState } from 'react'
import { db } from '../db'
import { useNavigate } from '@tanstack/react-router'
import { Lock, ArrowLeft } from 'lucide-react'

export function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    const settings = await db.settings.get('config')
    const correctPassword = settings?.adminPassword || 'killer'
    if (password === correctPassword) {
      sessionStorage.setItem('isAdmin', 'true')
      navigate({ to: '/admin/dashboard' })
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 overflow-hidden bg-slate-50 dark:bg-[#090D16] transition-colors duration-500">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[120px]" />

      <div className="w-full max-w-sm space-y-6 relative z-10 animate-in zoom-in duration-500">
        <button 
          onClick={() => navigate({ to: '/' })}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Início</span>
        </button>

        <div className="glass-panel p-8 rounded-3xl shadow-2xl space-y-6 border border-slate-200/80 dark:border-white/10">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Painel Administrativo
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
              Insira sua senha de administrador para acessar os relatórios e cadastros.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <input
                type="password"
                className="block w-full py-3.5 px-4 text-slate-900 dark:text-white bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all font-medium placeholder:text-slate-400 text-sm"
                placeholder="Senha mestra"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            
            {error && (
              <p className="text-red-500 text-xs font-semibold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20 animate-in fade-in">
                Senha incorreta! Tente novamente.
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95 text-sm"
            >
              Acessar Painel
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
