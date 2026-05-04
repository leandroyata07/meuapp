import React, { useState, useEffect } from 'react'
import { db, runAutoCheckout } from '../db'
import { useNavigate } from '@tanstack/react-router'
import { Search, User, Clock, ArrowRight, Fingerprint, ShieldCheck, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function EmployeeSearch() {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [time, setTime] = useState(new Date())
  const [settings, setSettings] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    runAutoCheckout()
    db.settings.get('config').then(setSettings)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchEmployees = async () => {
      if (search.length > 0) {
        let results = await db.employees
          .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
          .toArray()
        
        if (settings?.demoModeEnabled === false) {
          results = results.filter(e => e.cpf !== '000.000.000-00')
        }
        setEmployees(results)
      } else {
        setEmployees([])
      }
    }
    fetchEmployees()
  }, [search])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-slate-50 dark:from-slate-950 via-slate-100 dark:via-slate-900 to-blue-50 dark:to-blue-950 transition-all duration-1000">
      <div className="w-full max-w-md space-y-10 py-12">
        
        {/* Company Logo Section */}
        <div className="flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-8 duration-1000 fill-mode-both">
          {settings?.companyLogo ? (
            <div className="w-32 h-32 mb-4 relative group">
              <div className="absolute inset-0 bg-blue-500/20 rounded-[2.5rem] blur-2xl group-hover:blur-3xl transition-all" />
              <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain relative z-10" />
            </div>
          ) : (
            <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-black/5 dark:border-white/10 shadow-2xl flex items-center justify-center mb-6 group hover:scale-110 transition-transform duration-500">
              <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors" />
            </div>
          )}
        </div>

        {/* Real-time Clock Component */}
        <div className="flex flex-col items-center justify-center p-8 bg-white/40 dark:bg-white/5 border border-white dark:border-white/10 rounded-[3rem] shadow-2xl backdrop-blur-2xl relative overflow-hidden group animate-in zoom-in duration-700 delay-150 fill-mode-both">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-emerald-500/5 to-blue-600/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
          <p className="text-[11px] font-black text-blue-500/60 dark:text-blue-400 uppercase tracking-[0.4em] mb-2">
            {format(time, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-7xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums drop-shadow-2xl">
            {format(time, 'HH:mm:ss')}
          </p>
          <div className="absolute bottom-3 right-4 flex items-center space-x-1.5 opacity-30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] text-slate-900 dark:text-white uppercase tracking-[0.2em] font-black">Ao Vivo</span>
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
            <div
              key={emp.id}
              className="w-full flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/5 hover:border-blue-500/50 rounded-2xl transition-all group animate-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              <button
                onClick={() => navigate({ to: `/pin/${emp.id}` })}
                className="flex flex-1 items-center space-x-4 text-left"
              >
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
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight tracking-tight">
                    {emp.name}
                    {emp.cpf === '000.000.000-00' && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black bg-orange-500 text-white uppercase tracking-tighter animate-pulse">Demo</span>}
                  </p>
                  <p className="text-[10px] uppercase font-black tracking-widest mt-0.5 text-blue-400">Tocar para entrar com PIN</p>
                </div>
              </button>

              {emp.biometricId && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.PublicKeyCredential) {
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
                        }
                      } catch (err) {
                        console.warn('Biometria falhou:', err);
                        alert('Falha na biometria. Use sua senha.');
                      }
                    }
                  }}
                  className="ml-2 w-12 h-12 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 flex flex-col items-center justify-center border border-emerald-500/20 transition-all text-emerald-500 active:scale-90"
                  title="Entrar com Biometria"
                >
                  <Fingerprint className="w-5 h-5" />
                  <span className="text-[7px] font-black uppercase mt-1">BIO</span>
                </button>
              )}

              {!emp.biometricId && (
                <button 
                  onClick={() => navigate({ to: `/pin/${emp.id}` })}
                  className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-500 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:text-white transition-colors" />
                </button>
              )}
            </div>
          ))}
          
          {search.length > 0 && employees.length === 0 && (
            <div className="text-center py-8 animate-in fade-in">
              <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum perfil encontrado</p>
            </div>
          )}
        </div>

        <div className="pt-12 text-center animate-in fade-in duration-1000 delay-700 fill-mode-both">
          <button 
            onClick={() => navigate({ to: '/admin' })}
            className="inline-flex items-center space-x-3 px-10 py-5 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-[1.5rem] text-[10px] font-black tracking-[0.3em] uppercase text-slate-500 hover:text-blue-600 dark:text-slate-400 hover:dark:text-blue-400 transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 shadow-sm group"
          >
            <ShieldCheck className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>Acesso Administrativo</span>
          </button>
        </div>
      </div>
    </div>
  )
}
