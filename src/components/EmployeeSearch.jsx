import React, { useState, useEffect } from 'react'
import { db, runAutoCheckout } from '../db'
import { useNavigate } from '@tanstack/react-router'
import { Search, User, Clock, ArrowRight, Fingerprint, ShieldCheck, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ThemeToggle } from './ThemeToggle'

export function EmployeeSearch() {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [time, setTime] = useState(new Date())
  const [settings, setSettings] = useState(null)
  const navigate = useNavigate()

  const fetchEmployees = async (query = search, currentSettings = settings) => {
    if (query.trim().length > 0) {
      let results = await db.employees
        .filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
        .toArray()
      
      const activeSettings = currentSettings || await db.settings.get('config')
      if (activeSettings?.demoModeEnabled === false) {
        results = results.filter(e => e.cpf !== '000.000.000-00')
      }
      setEmployees(results)
    } else {
      setEmployees([])
    }
  }

  useEffect(() => {
    runAutoCheckout()
    db.settings.get('config').then(cfg => {
      setSettings(cfg)
    })
    const timer = setInterval(() => setTime(new Date()), 1000)

    const handleSync = () => {
      db.settings.get('config').then(cfg => {
        setSettings(cfg)
        fetchEmployees(search, cfg)
      })
    }
    window.addEventListener('pontoaqui:sync', handleSync)

    return () => {
      clearInterval(timer)
      window.removeEventListener('pontoaqui:sync', handleSync)
    }
  }, [search])

  useEffect(() => {
    fetchEmployees(search, settings)
  }, [search])

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 overflow-hidden bg-slate-50 dark:bg-[#090D16] transition-colors duration-500">
      {/* Top-Right Theme Toggle */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute top-[35%] right-[-5%] w-[350px] h-[350px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md space-y-8 py-8 relative z-10">
        
        {/* Company Logo Section */}
        <div className="flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 duration-700">
          {settings?.companyLogo ? (
            <div className="w-28 h-28 mb-3 relative group">
              <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/30 rounded-3xl blur-2xl group-hover:blur-3xl transition-all" />
              <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-md" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 flex items-center justify-center mb-4 group hover:scale-105 transition-all duration-300">
              <Building2 className="w-9 h-9 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
          )}
        </div>

        {/* Real-time Clock Component - High Definition Display */}
        <div className="glass-panel p-7 rounded-[2.5rem] shadow-2xl relative overflow-hidden group animate-in zoom-in duration-600">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase font-mono">
              {format(time, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ao Vivo</span>
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-6xl sm:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums font-mono drop-shadow-sm">
              {format(time, 'HH:mm')}
              <span className="text-3xl sm:text-4xl text-blue-600 dark:text-blue-400 font-semibold ml-1">
                :{format(time, 'ss')}
              </span>
            </p>
          </div>
        </div>

        {/* Header Title */}
        <div className="text-center space-y-1.5 animate-in fade-in duration-500">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Ponto<span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Aqui</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Localize seu perfil e registre seu ponto com segurança
          </p>
        </div>

        {/* Modern Search Input */}
        <div className="relative group animate-in fade-in duration-500 delay-150">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            className="block w-full py-4 pl-12 pr-4 text-slate-900 dark:text-white bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none backdrop-blur-xl shadow-lg shadow-slate-200/30 dark:shadow-black/30 transition-all font-medium text-base placeholder:text-slate-400"
            placeholder="Digite seu nome para bater o ponto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Employee Cards List */}
        <div className="space-y-3">
          {employees.map((emp, idx) => (
            <div
              key={emp.id}
              className="glass-card flex items-center justify-between p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group animate-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
            >
              <button
                onClick={() => navigate({ to: `/pin/${emp.id}` })}
                className="flex flex-1 items-center space-x-3.5 text-left min-w-0"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden shadow-sm relative group-hover:border-blue-500/50 transition-colors">
                  {emp.photo ? (
                    <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                  {emp.biometricId && (
                    <div className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-tl-md p-0.5 shadow-sm">
                      <Fingerprint className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <p className="text-slate-900 dark:text-white font-bold text-base leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {emp.name}
                    </p>
                    {emp.cpf === '000.000.000-00' && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Demo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                    <span>Tocar para registrar PIN</span>
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2 pl-2">
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
                    className="w-10 h-10 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 flex flex-col items-center justify-center border border-emerald-500/20 transition-all text-emerald-600 dark:text-emerald-400 active:scale-95 shadow-sm"
                    title="Entrar com Biometria"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span className="text-[7px] font-black uppercase mt-0.5">BIO</span>
                  </button>
                )}

                <button 
                  onClick={() => navigate({ to: `/pin/${emp.id}` })}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all text-slate-400 dark:text-slate-400 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          ))}
          
          {search.length > 0 && employees.length === 0 && (
            <div className="glass-panel text-center py-8 rounded-2xl animate-in fade-in">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Nenhum funcionário localizado</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Verifique o nome digitado</p>
            </div>
          )}
        </div>

        {/* Footer Admin Button */}
        <div className="pt-6 text-center animate-in fade-in duration-700 delay-300">
          <button 
            onClick={() => navigate({ to: '/admin' })}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-all hover:shadow-md active:scale-95 backdrop-blur-md group"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110" />
            <span>Acesso Administrativo</span>
          </button>
        </div>
      </div>
    </div>
  )
}
