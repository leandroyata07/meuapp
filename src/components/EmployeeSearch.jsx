import React, { useState, useEffect } from 'react'
import { db, runAutoCheckout } from '../db'
import { useNavigate } from '@tanstack/react-router'
import { Search, User, Clock, ArrowRight, Fingerprint } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function EmployeeSearch() {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [time, setTime] = useState(new Date())
  const navigate = useNavigate()

  useEffect(() => {
    runAutoCheckout()
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchEmployees = async () => {
      if (search.length > 0) {
        const results = await db.employees
          .where('name')
          .startsWithIgnoreCase(search)
          .toArray()
        setEmployees(results)
      } else {
        setEmployees([])
      }
    }
    fetchEmployees()
  }, [search])

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-6 pt-12 bg-gradient-to-br from-slate-50 dark:from-slate-950 via-slate-100 dark:via-slate-900 to-blue-50 dark:to-blue-950">
      <div className="w-full max-w-md space-y-8">
        
        {/* Real-time Clock Component */}
        <div className="flex flex-col items-center justify-center p-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-xl relative overflow-hidden group animate-in slide-in-from-top-4 duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-emerald-500/10 to-blue-600/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">
            {format(time, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            {format(time, 'HH:mm:ss')}
          </p>
          <div className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-40">
            <Clock className="w-3 h-3 text-slate-900 dark:text-white" />
            <span className="text-[8px] text-slate-900 dark:text-white uppercase tracking-widest font-bold">Ao Vivo</span>
          </div>
        </div>

        <div className="text-center space-y-2 animate-in fade-in duration-500 delay-150 fill-mode-both">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-md">
            Ponto<span className="text-blue-500">Aqui</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Registre seu ponto com rapidez e segurança.</p>
        </div>

        <div className="relative group animate-in fade-in zoom-in duration-500 delay-300 fill-mode-both">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full p-4 pl-12 text-slate-900 dark:text-white bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none backdrop-blur-md transition-all font-medium text-lg placeholder:text-slate-600"
            placeholder="Digite seu nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          {employees.map((emp, idx) => (
            <button
              key={emp.id}
              onClick={async () => {
                if (emp.biometricId && window.PublicKeyCredential) {
                  try {
                    const assertion = await navigator.credentials.get({
                      publicKey: {
                        challenge: new Uint8Array(32),
                        rpId: window.location.hostname,
                        allowCredentials: [{
                          type: 'public-key',
                          id: Uint8Array.from(atob(emp.biometricId), c => c.charCodeAt(0))
                        }],
                        userVerification: 'required',
                        timeout: 60000
                      }
                    });
                    if (assertion) {
                      sessionStorage.setItem('biometricVerified', emp.id);
                      navigate({ to: `/pin/${emp.id}` });
                      return;
                    }
                  } catch (err) {
                    console.warn('Biometria falhou ou foi cancelada. Solicitando PIN.', err);
                  }
                }
                navigate({ to: `/pin/${emp.id}` });
              }}
              className="w-full flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/5 hover:border-blue-500/50 rounded-2xl transition-all group active:scale-[0.98] animate-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 overflow-hidden shadow-inner relative">
                  {emp.photo ? (
                    <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-blue-400" />
                  )}
                  {emp.biometricId && (
                    <div className="absolute bottom-0 right-0 bg-emerald-500 rounded-tl-lg p-0.5 shadow-lg">
                      <Fingerprint className="w-3 h-3 text-slate-900 dark:text-white" />
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight tracking-tight">{emp.name}</p>
                  <p className={`text-[10px] uppercase font-black tracking-widest mt-0.5 ${emp.biometricId ? 'text-emerald-400' : 'text-blue-400'}`}>{emp.biometricId ? 'Biometria Ativa' : 'Acesso via PIN'}</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                {emp.biometricId ? <Fingerprint className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:text-white transition-colors" /> : <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:text-white transition-colors" />}
              </div>
            </button>
          ))}
          
          {search.length > 0 && employees.length === 0 && (
            <div className="text-center py-8 animate-in fade-in">
              <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum perfil encontrado</p>
            </div>
          )}
        </div>

        <div className="pt-8 text-center animate-in fade-in duration-1000 delay-500 fill-mode-both">
          <button 
            onClick={() => navigate({ to: '/admin' })}
            className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-600 hover:text-slate-900 dark:text-white transition-colors"
          >
            Acesso Administrativo
          </button>
        </div>
      </div>
    </div>
  )
}
