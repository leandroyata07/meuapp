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
    if (password === settings.adminPassword) {
      sessionStorage.setItem('isAdmin', 'true')
      navigate({ to: '/admin/dashboard' })
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-8">
        <button 
          onClick={() => navigate({ to: '/' })}
          className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <Lock className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Painel Administrativo</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Insira a senha de administrador para continuar.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              className="block w-full p-4 text-slate-900 dark:text-white bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">Senha incorreta!</p>}
          <button
            type="submit"
            className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-950/50 active:scale-95"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
