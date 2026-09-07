import React, { useState, useEffect } from 'react'
import { db } from '../db'
import { useNavigate } from '@tanstack/react-router'
import { 
  Users, 
  Settings, 
  FileText, 
  LogOut, 
  Plus, 
  Camera, 
  Trash2,
  Calendar,
  Clock,
  Download,
  Upload,
  Database,
  Cloud,
  ShieldAlert,
  HardDrive,
  Trash,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Filter,
  X,
  FileWarning,
  FileSearch,
  ArrowRight,
  ChevronRight,
  Activity,
  Coffee,
  UserCheck,
  UserX,
  PieChart,
  MapPin,
  Printer,
  Fingerprint,
  Moon,
  Sun,
  Monitor,
  Building2,
  Bell,
  ShieldCheck,
  Search,
  Menu,
  ChevronLeft,
  MoreVertical,
  Edit,
  Wifi,
  BarChart3,
  Globe,
  MessageCircle,
  Info,
  ExternalLink,
  BookOpen,
  Mail,
  Briefcase,
  Timer,
  Check,
  Zap,
  Scale,
  Utensils,
  Layers,
  History
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { 
  SHIFT_PRESETS, 
  DAYS_OF_WEEK, 
  calculateNetShiftTime, 
  checkEmployeeWorkDay, 
  formatWorkDaysSummary 
} from '../utils/shiftUtils'
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  isFirebaseConfigured,
  testFirebaseConnection,
  startRealtimeSync,
  stopRealtimeSync,
  pushDocToFirestore,
  deleteDocFromFirestore,
  syncAllLocalToFirestore,
  compressImage
} from '../firebase'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, subMonths, isBefore, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const RECORD_TYPES = {
  check_in: { label: 'ENTRADA', color: 'bg-emerald-500/10 text-emerald-500' },
  lunch_out: { label: 'ALMOÇO (SAÍDA)', color: 'bg-orange-500/10 text-orange-500' },
  lunch_in: { label: 'ALMOÇO (RETORNO)', color: 'bg-blue-500/10 text-blue-500' },
  check_out: { label: 'SAÍDA DEFINITIVA', color: 'bg-red-500/10 text-red-500' },
  other_out: { label: 'SAÍDA EXTRA', color: 'bg-purple-500/10 text-purple-500' },
  other_in: { label: 'RETORNO EXTRA', color: 'bg-indigo-500/10 text-indigo-500' },
  system_auto_checkout: { label: 'SAÍDA AUTOMÁTICA', color: 'bg-red-500/10 text-red-500' },
  admin_absence: { label: 'FALTA NÃO JUSTIFICADA', color: 'bg-red-900/30 text-red-400 border border-red-500/30' },
  admin_excused: { label: 'ATESTADO MÉDICO/FÉRIAS', color: 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' },
  admin_adjustment: { label: 'AJUSTE MANUAL', color: 'bg-blue-600/20 text-blue-500 border border-blue-500/30' },
  superseded: { label: 'SUBSTITUÍDO (AJUSTADO)', color: 'bg-slate-500/10 text-slate-400 opacity-50 line-through' }
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [pendingCount, setPendingCount] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const navigate = useNavigate()

  useEffect(() => {
    if (!sessionStorage.getItem('isAdmin')) {
      navigate({ to: '/admin' })
    }
    loadPendingCount()
    loadNotifications()
    loadData()

    const handleSync = () => {
      loadPendingCount()
      loadNotifications()
      loadData()
    }
    window.addEventListener('pontoaqui:sync', handleSync)

    const dataTimer = setInterval(() => {
      loadPendingCount()
      loadNotifications()
      loadData()
    }, 30000)

    const clockTimer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(dataTimer)
      clearInterval(clockTimer)
      window.removeEventListener('pontoaqui:sync', handleSync)
    }
  }, [])

  const loadData = async () => {
    const [depts, emps] = await Promise.all([
      db.departments.toArray(),
      db.employees.toArray()
    ])
    setDepartments(depts)
    setEmployees(emps)
  }

  const loadPendingCount = async () => {
    const count = await db.records.where('status').equals('pending').count()
    setPendingCount(count)
  }

  const loadNotifications = async () => {
    const all = await db.notifications.orderBy('timestamp').reverse().toArray()
    const adminItems = all.filter(n => (!n.target || n.target === 'admin') && !['request_approved', 'request_rejected'].includes(n.type))
    setNotifications(adminItems.slice(0, 10))
  }

  const markNotificationRead = async (id) => {
    await db.notifications.update(id, { read: true })
    const notif = await db.notifications.get(id)
    if (notif) await pushDocToFirestore('notifications', id, notif)
    loadNotifications()
  }

  const clearAllNotifications = async () => {
    const all = await db.notifications.toArray()
    const adminNotifs = all.filter(n => (!n.target || n.target === 'admin') && !['request_approved', 'request_rejected'].includes(n.type))
    for (const n of adminNotifs) {
      await db.notifications.delete(n.id)
      await deleteDocFromFirestore('notifications', n.id)
    }
    loadNotifications()
  }

  const logout = () => {
    sessionStorage.removeItem('isAdmin')
    navigate({ to: '/' })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#090D16] overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header className="h-20 glass-panel border-b border-slate-200/80 dark:border-white/10 px-6 lg:px-10 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="lg:hidden p-2.5 bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-800 dark:text-white"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:flex items-center space-x-3 mr-8 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
            <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Fingerprint className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                Ponto<span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Aqui</span>
              </h1>
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1">Portal Administrativo</p>
            </div>
          </div>
          <h1 className="lg:hidden text-lg font-black text-slate-900 dark:text-white">Admin</h1>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Quick Theme Toggle in Admin Header */}
          <ThemeToggle />

          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-3 transition-all rounded-2xl relative border ${showNotifications ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'glass-card border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-blue-600'}`}
              title="Notificações"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                {/* Global backdrop click-outside overlay for both mobile and desktop */}
                <div 
                  className="fixed inset-0 z-[90] bg-black/20 sm:bg-transparent"
                  onClick={() => setShowNotifications(false)} 
                />
                <div className="fixed left-3 right-3 top-20 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96 max-w-lg mx-auto bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl z-[100] p-5 space-y-4 animate-in slide-in-from-top-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-white/10">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Avisos do Sistema</h3>
                    <button onClick={clearAllNotifications} className="text-[10px] font-bold text-blue-600 hover:text-red-500 uppercase tracking-widest transition-colors">Limpar Tudo</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 opacity-60">
                        <Bell className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-40" />
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Nenhum aviso pendente</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${n.read ? 'bg-slate-100 dark:bg-white/5 border-slate-200/50 dark:border-transparent opacity-60' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm'}`}
                        >
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0 ${
                              n.type === 'medical' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                              n.type === 'esquecimento' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                              n.type === 'retroactive' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' :
                              n.type === 'late' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                              n.type === 'geofence' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                              'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            }`}>
                              {n.type === 'medical' ? 'Atestado' :
                               n.type === 'esquecimento' ? 'Esquecimento' :
                               n.type === 'retroactive' ? 'Dia Anterior' :
                               n.type === 'late' ? 'Atraso' :
                               n.type === 'geofence' ? 'Localização' : 'Sistema'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono shrink-0">{n.timestamp ? format(new Date(n.timestamp), 'dd/MM HH:mm') : ''}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug break-words group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={logout} 
            className="p-3 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all glass-card border-slate-200/80 dark:border-white/10 rounded-2xl hover:bg-red-500/10 active:scale-95"
            title="Sair do painel"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop escuro para fechar o menu no mobile ao clicar fora */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[65] lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        <nav className={`
          fixed top-0 bottom-0 left-0 w-80 max-w-[85vw] z-[70] lg:static lg:w-72 lg:z-0 lg:flex flex-col 
          bg-white dark:bg-[#0c111d] border-r border-slate-200 dark:border-white/10 shadow-2xl lg:shadow-none 
          transition-transform duration-300 ease-in-out
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Header específico do drawer no mobile para fechar e identificar */}
          <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between lg:hidden">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 dark:text-white leading-none">
                  Ponto<span className="text-blue-600">Aqui</span>
                </h1>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Menu de Gestão</p>
              </div>
            </div>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white active:scale-95"
              title="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-3 mb-4 hidden lg:block">Menu de Gestão</p>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity, color: 'text-blue-500' },
              { id: 'approvals', label: 'Aprovações', icon: ShieldCheck, color: 'text-emerald-500', badge: pendingCount },
              { id: 'employees', label: 'Colaboradores', icon: Users, color: 'text-purple-500' },
              { id: 'reports', label: 'Relatórios', icon: FileText, color: 'text-orange-500' },
              { id: 'settings', label: 'Preferências', icon: Settings, color: 'text-slate-400' },
              { id: 'about', label: 'Sobre o Sistema', icon: Info, color: 'text-blue-600' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                className={`w-full flex items-center space-x-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 relative group font-bold text-sm ${activeTab === tab.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <tab.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
                <span className="tracking-tight">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 flex items-center justify-center rounded-full font-black shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <div className="p-6 border-t border-slate-100 dark:border-white/5 space-y-4">
            <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-200/60 dark:border-white/5">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Servidor Local</span>
              </div>
              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Banco de dados IndexedDB sincronizado.</p>
            </div>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0a0c10] transition-colors duration-500">
          <main className="max-w-7xl mx-auto p-6 lg:p-14 space-y-12 pb-32">
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
              {activeTab === 'dashboard' && <OverviewManager employees={employees} />}
              {activeTab === 'approvals' && <ApprovalsManager onAction={() => { loadPendingCount(); loadData(); }} />}
              {activeTab === 'employees' && <EmployeeManager employees={employees} departments={departments} onDataChange={loadData} />}
              {activeTab === 'reports' && <ReportsManager employees={employees} departments={departments} onDataChange={loadData} />}
              {activeTab === 'settings' && <SettingsManager />}
              {activeTab === 'about' && <AboutManager />}
            </div>
          </main>
        </div>
      </div>
      <footer className="h-10 bg-white dark:bg-slate-900 border-t border-black/5 dark:border-white/10 px-6 lg:px-10 flex items-center justify-between shrink-0 z-[60]">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Servidor Ativo</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 lg:space-x-8">
          <div className="hidden sm:flex items-center space-x-2 text-slate-400">
            <Calendar className="w-3 h-3" />
            <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest">{format(currentTime, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center space-x-2 text-blue-500">
            <Clock className="w-3 h-3" />
            <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-[0.3em] tabular-nums">{format(currentTime, 'HH:mm:ss')}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function OverviewManager() {
  const [stats, setStats] = useState({ present: 0, lunch: 0, absent: 0, finished: 0, total: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    loadDashboard()
    const timer = setInterval(loadDashboard, 60000)
    return () => clearInterval(timer)
  }, [])

  const loadDashboard = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const startOfDay = new Date(`${todayStr}T00:00:00`)
    const endOfDay = new Date(`${todayStr}T23:59:59.999`)

    const allEmps = await db.employees.toArray()
    const allRecordsToday = await db.records
      .filter(r => {
        const d = new Date(r.timestamp)
        return d >= startOfDay && d <= endOfDay
      })
      .toArray()

    let present = 0, lunch = 0, finished = 0, absent = 0
    allEmps.forEach(emp => {
      const empRecords = allRecordsToday.filter(r => r.employeeId === emp.id).sort((a,b) => b.timestamp - a.timestamp)
      if (empRecords.length === 0) absent++
      else {
        const last = empRecords[0].type
        if (['check_in', 'lunch_in', 'other_in'].includes(last)) present++
        else if (['lunch_out', 'other_out'].includes(last)) lunch++
        else if (['check_out', 'system_auto_checkout'].includes(last)) finished++
      }
    })

    setStats({ present, lunch, absent, finished, total: allEmps.length })
    
    // Recent activity
    const recent = allRecordsToday.sort((a,b) => b.timestamp - a.timestamp).slice(0, 5)
    setRecentActivity(recent.map(r => ({ ...r, empName: allEmps.find(e => e.id === r.employeeId)?.name || '?' })))

    // Weekly Chart Data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return format(d, 'yyyy-MM-dd')
    })

    const weekStats = await Promise.all(last7Days.map(async day => {
      const dayStart = new Date(`${day}T00:00:00`).getTime()
      const dayEnd = new Date(`${day}T23:59:59`).getTime()
      const recs = await db.records.where('timestamp').between(dayStart, dayEnd).toArray()
      const uniqueEmps = new Set(recs.map(r => r.employeeId)).size
      return { day: format(new Date(dayStart), 'dd/MM'), presencas: uniqueEmps }
    }))
    setChartData(weekStats)
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
            <Activity className="w-8 h-8 mr-3 text-blue-600" />
            Painel de Controle
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Acompanhamento em tempo real da equipe hoje.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-black/5 dark:border-white/5">
          <div className="px-4 py-2 text-[10px] font-black text-blue-500 uppercase tracking-widest">Status Geral</div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-3" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {[
          { label: 'Presentes', value: stats.present, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', glow: 'shadow-emerald-500/10' },
          { label: 'Em Pausa', value: stats.lunch, icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', glow: 'shadow-orange-500/10' },
          { label: 'Finalizado', value: stats.finished, icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', glow: 'shadow-blue-500/10' },
          { label: 'Ausentes', value: stats.absent, icon: UserX, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', glow: 'shadow-red-500/10' }
        ].map((item, i) => (
          <div key={i} className={`glass-card p-5 lg:p-6 rounded-3xl border shadow-sm hover:shadow-lg transition-all duration-300 group`}>
            <div className={`w-12 h-12 ${item.bg} border rounded-2xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
              Frequência Semanal
            </h3>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos 7 dias</div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#888'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', background: '#fff', padding: '12px 20px' }}
                  itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="presencas" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorFreq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-black/5 dark:border-white/5 flex flex-col items-center justify-center text-center group">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-600/40 mb-6 group-hover:scale-110 transition-transform duration-500">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Total da Equipe</h3>
          <p className="text-5xl font-black text-blue-600 mt-4 tracking-tighter">{stats.total}</p>
          <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">Funcionários Ativos</p>
          <div className="mt-8 w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${(stats.present/stats.total)*100 || 0}%` }} />
          </div>
          <p className="text-[10px] font-black text-slate-400 mt-3 uppercase tracking-tighter">Taxa de Presença: {Math.round((stats.present/stats.total)*100) || 0}%</p>
        </div>
      </div>
    </div>
  )
}

function EmployeeManager({ employees, departments, onDataChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [editingDeptId, setEditingDeptId] = useState(null)
  const [editingDeptName, setEditingDeptName] = useState('')
  const [deletingDept, setDeletingDept] = useState(null)

  const handleCreateDept = async () => {
    const trimmed = newDeptName.trim()
    if (!trimmed) return
    const exists = departments.some(d => d.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      alert('Já existe um setor cadastrado com este nome.')
      return
    }
    const id = await db.departments.add({ name: trimmed })
    await pushDocToFirestore('departments', id, { id, name: trimmed })
    setNewDeptName('')
    setNewEmp(prev => ({ ...prev, departmentId: String(id) }))
    onDataChange()
  }

  const handleSaveEditDept = async (deptId) => {
    const trimmed = editingDeptName.trim()
    if (!trimmed) return
    const exists = departments.some(d => d.id !== deptId && d.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      alert('Já existe outro setor com este nome.')
      return
    }
    await db.departments.update(deptId, { name: trimmed })
    await pushDocToFirestore('departments', deptId, { id: deptId, name: trimmed })
    setEditingDeptId(null)
    setEditingDeptName('')
    onDataChange()
  }

  const handleConfirmDeleteDept = async (dept) => {
    if (!dept) return
    const linkedEmployees = employees.filter(e => String(e.departmentId) === String(dept.id))
    for (const emp of linkedEmployees) {
      await db.employees.update(emp.id, { departmentId: '' })
      await pushDocToFirestore('employees', emp.id, { ...emp, departmentId: '' })
    }
    if (String(newEmp.departmentId) === String(dept.id)) {
      setNewEmp(prev => ({ ...prev, departmentId: '' }))
    }
    if (String(deptFilter) === String(dept.id)) {
      setDeptFilter('')
    }
    await db.departments.delete(dept.id)
    await deleteDocFromFirestore('departments', dept.id)
    setDeletingDept(null)
    onDataChange()
  }
  const defaultEmpState = { 
    name: '', 
    pin: '', 
    startDate: format(new Date(), 'yyyy-MM-dd'), 
    photo: '', 
    email: '',
    cpf: '',
    biometricId: '',
    workRegime: 'clt_5x2_44',
    weeklyHours: 44,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '17:48',
    breakMinutes: 60,
    scaleStartDate: format(new Date(), 'yyyy-MM-dd'),
    toleranceMin: 10,
    departmentId: '',
    allowRetroactive: false,
    retroactiveStart: '',
    retroactiveEnd: ''
  }

  const [newEmp, setNewEmp] = useState(defaultEmpState)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAll, setShowAll] = useState(false)

  const shiftInfo = calculateNetShiftTime(newEmp.shiftStart, newEmp.lunchStart, newEmp.lunchEnd, newEmp.shiftEnd)
  const currentPreset = SHIFT_PRESETS.find(p => p.id === (newEmp.workRegime || 'clt_5x2_44')) || SHIFT_PRESETS[0]
  const todayScaleStatus = checkEmployeeWorkDay(newEmp, new Date())

  useEffect(() => { onDataChange() }, [])

  const formatCPF = (value) => {
    const raw = value.replace(/\D/g, '')
    return raw
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1')
  }

  const applyPreset = (preset) => {
    setNewEmp(prev => ({
      ...prev,
      workRegime: preset.id,
      weeklyHours: preset.weeklyHours,
      workDays: [...preset.workDays],
      shiftStart: preset.shiftStart,
      lunchStart: preset.lunchStart,
      lunchEnd: preset.lunchEnd,
      shiftEnd: preset.shiftEnd,
      breakMinutes: preset.breakMinutes,
      scaleStartDate: prev.scaleStartDate || format(new Date(), 'yyyy-MM-dd')
    }))
  }

  const toggleWorkDay = (dayId) => {
    const current = Array.isArray(newEmp.workDays) ? newEmp.workDays : [1, 2, 3, 4, 5]
    if (current.includes(dayId)) {
      if (current.length === 1) return // manter pelo menos 1 dia
      setNewEmp({ ...newEmp, workDays: current.filter(d => d !== dayId) })
    } else {
      setNewEmp({ ...newEmp, workDays: [...current, dayId].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)) })
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newEmp.name || !newEmp.pin) return
    
    let targetId = editingId
    if (editingId) {
      await db.employees.update(editingId, newEmp)
    } else {
      targetId = await db.employees.add(newEmp)
    }

    // Sincroniza com Firebase (as fotos ficam preservadas exclusivamente no cache local)
    await pushDocToFirestore('employees', targetId, { ...newEmp, id: targetId })

    setNewEmp(defaultEmpState)
    setShowAdd(false)
    setEditingId(null)
    onDataChange()
  }

  const handleEdit = (emp) => {
    setNewEmp({
      ...defaultEmpState,
      ...emp,
      workRegime: emp.workRegime || 'clt_5x2_44',
      weeklyHours: emp.weeklyHours ?? 44,
      workDays: Array.isArray(emp.workDays) ? emp.workDays : (emp.workRegime?.startsWith('scale_') ? [] : [1, 2, 3, 4, 5]),
      shiftStart: emp.shiftStart || '08:00',
      lunchStart: emp.lunchStart || '12:00',
      lunchEnd: emp.lunchEnd || '13:00',
      shiftEnd: emp.shiftEnd || '17:48',
      breakMinutes: emp.breakMinutes ?? 60,
      scaleStartDate: emp.scaleStartDate || emp.startDate || format(new Date(), 'yyyy-MM-dd'),
      toleranceMin: emp.toleranceMin ?? 10
    })
    setEditingId(emp.id)
    setShowAdd(true)
  }

  const handleDelete = async (id) => {
    const targetEmp = employees.find(e => e.id === id)
    if (targetEmp && (targetEmp.cpf === '000.000.000-00' || targetEmp.isDemo || targetEmp.name?.toUpperCase().includes('TESTE (DEMO)'))) {
      alert('O perfil de teste é nativo do sistema e está protegido contra exclusão. Você pode ocultá-lo desativando o Modo Demonstração nas Configurações.')
      return
    }

    if (confirm('Deseja excluir este funcionário?')) {
      await db.employees.delete(id)
      await deleteDocFromFirestore('employees', id)
      onDataChange()
    }
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result, 180, 180, 0.75)
          setNewEmp(prev => ({ ...prev, photo: compressed }))
        } catch (err) {
          setNewEmp(prev => ({ ...prev, photo: reader.result }))
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const registerBiometrics = async (emp) => {
    if (!window.PublicKeyCredential) {
      alert('Seu navegador ou dispositivo não suporta biometria (WebAuthn).');
      return;
    }
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "PontoAqui", id: window.location.hostname },
          user: {
            id: userId,
            name: emp.name.replace(/\s+/g, '').toLowerCase(),
            displayName: emp.name
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000,
          attestation: "none"
        }
      });

      const rawIdBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(credential.rawId)));
      await db.employees.update(emp.id, { biometricId: rawIdBase64 });
      const updatedEmp = await db.employees.get(emp.id);
      if (updatedEmp) await pushDocToFirestore('employees', emp.id, updatedEmp);
      alert('Biometria cadastrada com sucesso!');
      load();
    } catch (err) {
      console.error(err);
      alert('Falha ao cadastrar biometria. Verifique as permissões do navegador ou se cancelou a operação.');
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
            <Users className="w-8 h-8 mr-3 text-blue-600" />
            Gestão da Equipe
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Gerencie os acessos e informações dos colaboradores.</p>
        </div>
        <button 
          onClick={() => {
            if (showAdd && editingId) {
              setEditingId(null)
              setNewEmp(defaultEmpState)
            }
            setShowAdd(!showAdd)
          }} 
          className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl text-white font-black flex items-center justify-center space-x-3 shadow-xl shadow-blue-600/20 transition-all active:scale-95 group shrink-0"
        >
          {showAdd ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />}
          <span className="uppercase tracking-widest text-[10px]">{showAdd ? 'Cancelar' : 'Novo Funcionário'}</span>
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="max-w-4xl mx-auto p-8 lg:p-12 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-[3rem] shadow-2xl space-y-10 animate-in zoom-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            <div className="relative group shrink-0">
              <div className="w-40 h-40 rounded-[2.5rem] bg-slate-50 dark:bg-black/40 border-4 border-black/5 dark:border-white/5 flex items-center justify-center overflow-hidden shadow-2xl transition-all group-hover:border-blue-500/50 group-hover:rotate-2">
                {newEmp.photo ? <img src={newEmp.photo} alt="Preview" className="w-full h-full object-cover" /> : <Camera className="w-12 h-12 text-slate-300" />}
              </div>
              <label className="absolute -bottom-2 -right-2 p-4 bg-blue-600 rounded-2xl cursor-pointer hover:bg-blue-500 shadow-2xl transition-transform hover:scale-110 active:scale-95 border-4 border-white dark:border-slate-900">
                <Upload className="w-5 h-5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
            
            <div className="flex-1 w-full space-y-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{editingId ? 'Editar Colaborador' : 'Novas Credenciais'}</h3>
                <p className="text-sm text-slate-500 font-medium">Os campos marcados são essenciais para o acesso.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 mb-1 block">Nome Completo</label>
                  <input type="text" placeholder="Ex: João da Silva" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold placeholder:font-normal" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 mb-1 block">E-mail</label>
                  <input type="email" placeholder="email@empresa.com" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold placeholder:font-normal" value={newEmp.email || ''} onChange={e => setNewEmp({...newEmp, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 ml-1 mb-1 block">CPF</label>
                  <input type="text" placeholder="000.000.000-00" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold placeholder:font-normal" value={newEmp.cpf || ''} onChange={e => setNewEmp({...newEmp, cpf: formatCPF(e.target.value)})} />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO JORNADA, ESCALAS & TURNOS (CLT) */}
          <div className="pt-10 border-t border-black/5 dark:border-white/5 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Jornada, Escala & Turno de Trabalho
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Regimes de trabalho, horários de 4 batidas e folgas em conformidade com a legislação trabalhista vigente (CLT).
                </p>
              </div>
              <span className="self-start sm:self-auto text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {currentPreset.badge}
              </span>
            </div>

            {/* Modelos e Escalas Prontas (Presets Legais) */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block flex items-center justify-between">
                <span>Modelos de Trabalho Pré-Definidos (CLT & Legislação)</span>
                <span className="text-slate-400 font-normal">Clique para aplicar</span>
              </label>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {SHIFT_PRESETS.map((preset) => {
                  const isSelected = (newEmp.workRegime || 'clt_5x2_44') === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`p-3.5 rounded-2xl text-left transition-all border relative flex flex-col justify-between group ${
                        isSelected 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/25 ring-2 ring-blue-500/50 scale-[1.02]' 
                          : 'bg-slate-50 dark:bg-black/40 border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200 hover:border-blue-500/40 hover:bg-slate-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[11px] font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {preset.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                        </div>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected 
                            ? 'bg-white/20 text-white' 
                            : 'bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}>
                          {preset.lawRef}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-2 line-clamp-2 leading-relaxed ${
                        isSelected ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {preset.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Configuração Específica de Escalas de Revezamento (12x36, 24x72, 4x2) */}
            {currentPreset.isScale ? (
              <div className="p-5 rounded-3xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Escala com Ciclo de Revezamento Contínuo
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {currentPreset.scaleType === '24x72' && 'Jornada de 24h consecutivas seguidas por 72h (3 dias inteiros) de folga ininterrupta.'}
                        {currentPreset.scaleType === '12x36' && 'Jornada de 12h seguidas por 36h de descanso ininterrupto (Dia sim, dia não). CLT Art. 59-A.'}
                        {currentPreset.scaleType === '4x2' && 'Jornada de 4 dias consecutivos trabalhados seguidos por 2 dias de folga contínua.'}
                      </p>
                    </div>
                  </div>

                  <div className="sm:w-56">
                    <label className="text-[9px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest block mb-1">
                      Data de Início da Escala (Marco Zero)
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-3 bg-white dark:bg-black/40 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-slate-900 dark:text-white text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newEmp.scaleStartDate || format(new Date(), 'yyyy-MM-dd')}
                      onChange={e => setNewEmp({ ...newEmp, scaleStartDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Live Preview do Status Hoje */}
                <div className="pt-3 border-t border-indigo-200/50 dark:border-indigo-800/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Status no Dia de Hoje ({format(new Date(), 'dd/MM/yyyy')}):
                    </span>
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      todayScaleStatus.type === 'work'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-1.5 ${todayScaleStatus.type === 'work' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {todayScaleStatus.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 italic">
                    O espelho de ponto ajusta faltas e folgas automaticamente com base nesta escala.
                  </span>
                </div>
              </div>
            ) : (
              /* Seletor de Dias da Semana */
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Dias da Semana Trabalhados
                  </label>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {(newEmp.workDays || []).length} dia(s) configurado(s) por semana
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isDayActive = (newEmp.workDays || []).includes(day.id)
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleWorkDay(day.id)}
                        className={`px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center space-x-1.5 border ${
                          isDayActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                            : 'bg-slate-50 dark:bg-black/40 border-black/5 dark:border-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                        title={day.fullName}
                      >
                        {isDayActive && <Check className="w-3 h-3 text-white shrink-0" />}
                        <span>{day.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Grade de 4 Batidas: Entrada, Saída Almoço, Retorno Almoço, Saída Definitiva */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block">
                Horários de Turno (4 Batidas Regulamentares)
              </label>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Entrada Principal */}
                <div className="p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl space-y-1.5 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    1. Entrada Principal
                  </span>
                  <input 
                    type="time" 
                    className="w-full bg-transparent text-slate-900 dark:text-white font-black text-lg outline-none cursor-pointer"
                    value={newEmp.shiftStart || '08:00'} 
                    onChange={e => setNewEmp({ ...newEmp, shiftStart: e.target.value })} 
                  />
                  <p className="text-[9px] text-slate-400">Início da jornada</p>
                </div>

                {/* 2. Saída Almoço */}
                <div className="p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl space-y-1.5 focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
                  <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Utensils className="w-3 h-3" />
                    2. Saída Almoço
                  </span>
                  <input 
                    type="time" 
                    className="w-full bg-transparent text-slate-900 dark:text-white font-black text-lg outline-none cursor-pointer"
                    value={newEmp.lunchStart || '12:00'} 
                    onChange={e => setNewEmp({ ...newEmp, lunchStart: e.target.value })} 
                  />
                  <p className="text-[9px] text-slate-400">Início do almoço</p>
                </div>

                {/* 3. Retorno Almoço */}
                <div className="p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl space-y-1.5 focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
                  <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Utensils className="w-3 h-3" />
                    3. Retorno Almoço
                  </span>
                  <input 
                    type="time" 
                    className="w-full bg-transparent text-slate-900 dark:text-white font-black text-lg outline-none cursor-pointer"
                    value={newEmp.lunchEnd || '13:00'} 
                    onChange={e => setNewEmp({ ...newEmp, lunchEnd: e.target.value })} 
                  />
                  <p className="text-[9px] text-slate-400">Retorno do almoço</p>
                </div>

                {/* 4. Saída Definitiva */}
                <div className="p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl space-y-1.5 focus-within:border-red-500/50 focus-within:ring-2 focus-within:ring-red-500/20 transition-all">
                  <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    4. Saída Definitiva
                  </span>
                  <input 
                    type="time" 
                    className="w-full bg-transparent text-slate-900 dark:text-white font-black text-lg outline-none cursor-pointer"
                    value={newEmp.shiftEnd || '17:48'} 
                    onChange={e => setNewEmp({ ...newEmp, shiftEnd: e.target.value })} 
                  />
                  <p className="text-[9px] text-slate-400">Fim do expediente</p>
                </div>
              </div>
            </div>

            {/* Barra de Resumo Dinâmico da Jornada & Recomendações CLT */}
            <div className="p-5 bg-slate-100/80 dark:bg-black/30 border border-black/5 dark:border-white/5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Jornada Diária Líquida</span>
                <span className="text-base font-black text-slate-900 dark:text-white">{shiftInfo.netText}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Intervalo Almoço</span>
                <span className="text-base font-black text-slate-900 dark:text-white">{shiftInfo.breakText}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Carga Semanal (h)</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <input 
                    type="number" 
                    min="1" 
                    max="60"
                    className="w-16 p-1.5 bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-lg text-sm font-black text-slate-900 dark:text-white text-center outline-none focus:ring-1 focus:ring-blue-500"
                    value={newEmp.weeklyHours ?? 44}
                    onChange={e => setNewEmp({ ...newEmp, weeklyHours: Number(e.target.value) })}
                  />
                  <span className="text-xs font-bold text-slate-500">horas</span>
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tolerância CLT (Art. 58)</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <input 
                    type="number" 
                    min="0" 
                    max="30"
                    className="w-16 p-1.5 bg-white dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-lg text-sm font-black text-slate-900 dark:text-white text-center outline-none focus:ring-1 focus:ring-blue-500"
                    value={newEmp.toleranceMin ?? 10}
                    onChange={e => setNewEmp({ ...newEmp, toleranceMin: Number(e.target.value) })}
                  />
                  <span className="text-xs font-bold text-slate-500">min/dia</span>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO SETOR & SEGURANÇA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-black/5 dark:border-white/5">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] ml-1">Lotação e Setor</h4>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">Setor / Departamento</label>
                <div className="flex items-center space-x-2">
                  <select 
                    className="flex-1 p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold"
                    value={String(newEmp.departmentId || '')}
                    onChange={e => setNewEmp({...newEmp, departmentId: e.target.value})}
                  >
                    <option value="">Nenhum Setor</option>
                    {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => {
                      setDeletingDept(null)
                      setEditingDeptId(null)
                      setShowDeptModal(true)
                    }} 
                    title="Gerenciar Setores (Cadastrar, Editar, Excluir)"
                    className="p-4 bg-blue-600/10 text-blue-500 rounded-2xl hover:bg-blue-600 hover:text-white transition-all border border-blue-500/20"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] ml-1">Segurança do Tablet</h4>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">PIN de Acesso (4 dígitos)</label>
                <input type="text" placeholder="0000" maxLength="4" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-black tracking-[1.5em] text-2xl" value={newEmp.pin} onChange={e => setNewEmp({...newEmp, pin: e.target.value})} required />
              </div>
              
              {editingId && newEmp.biometricId && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <Fingerprint className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Biometria Ativa</span>
                  </div>
                  <button type="button" onClick={() => confirm('Deseja remover a biometria?') && setNewEmp({...newEmp, biometricId: ''})} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-[2.5rem] border border-indigo-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Inclusão de Dias Anteriores</h4>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">Permissão para lançar pontos retroativos</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setNewEmp({ ...newEmp, allowRetroactive: !newEmp.allowRetroactive })}
                className={`w-12 h-6 rounded-full transition-all relative ${newEmp.allowRetroactive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${newEmp.allowRetroactive ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {newEmp.allowRetroactive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-in zoom-in duration-300">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Inicial Permitida</label>
                  <input 
                    type="date" 
                    className="w-full p-4 bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={newEmp.retroactiveStart || ''} 
                    onChange={e => setNewEmp({ ...newEmp, retroactiveStart: e.target.value })} 
                    required={newEmp.allowRetroactive}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Final Permitida</label>
                  <input 
                    type="date" 
                    className="w-full p-4 bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={newEmp.retroactiveEnd || ''} 
                    onChange={e => setNewEmp({ ...newEmp, retroactiveEnd: e.target.value })} 
                    required={newEmp.allowRetroactive}
                  />
                </div>
                <p className="sm:col-span-2 text-[10px] text-slate-500 font-medium italic">
                  O colaborador terá permissão de lançar os pontos desse período pelo terminal, e as batidas irão para a Central de Aprovações do Administrador.
                </p>
              </div>
            )}
          </div>

          <button type="submit" className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl shadow-2xl shadow-blue-600/40 transition-all active:scale-[0.98] text-lg uppercase tracking-[0.3em]">{editingId ? 'Salvar Alterações' : 'Finalizar Cadastro'}</button>
        </form>
      )}

      {!showAdd && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-3 rounded-[2rem] shadow-sm border border-black/5 dark:border-white/5">
            <div className="flex-1 relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
              <input type="text" placeholder="Pesquisar colaborador por nome..." className="w-full p-5 pl-14 bg-transparent text-slate-900 dark:text-white outline-none font-bold placeholder:font-normal text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="w-px bg-black/5 dark:bg-white/5 hidden md:block my-2" />
            <div className="flex items-center space-x-2 md:w-80">
              <select className="flex-1 p-5 bg-transparent text-slate-900 dark:text-white outline-none font-black text-xs uppercase tracking-widest appearance-none cursor-pointer" value={String(deptFilter)} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">Todos os Setores</option>
                {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
              <button 
                type="button" 
                onClick={() => {
                  setDeletingDept(null)
                  setEditingDeptId(null)
                  setShowDeptModal(true)
                }} 
                title="Gerenciar Setores (Cadastrar, Editar, Excluir)"
                className="p-3 mr-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 dark:bg-white/5 dark:hover:bg-blue-900/20 dark:text-slate-300 dark:hover:text-blue-400 rounded-2xl transition-all border border-slate-200/80 dark:border-white/10 shrink-0"
              >
                <Building2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!searchTerm && !showAll && !deptFilter ? (
            <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-black/10 dark:border-white/10 shadow-sm animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-slate-50 dark:bg-black/40 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Users className="w-12 h-12 text-slate-200 dark:text-slate-800" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Lista Preservada</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-xs mx-auto">Sua lista de funcionários está oculta para melhor organização. Use a busca ou clique abaixo.</p>
              <button onClick={() => setShowAll(true)} className="mt-10 px-12 py-5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-500 shadow-2xl shadow-blue-600/30 transition-all active:scale-95">Exibir Todos ({employees.length})</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-6 duration-700">
              {employees
                .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .filter(e => !deptFilter || String(e.departmentId) === String(deptFilter))
                .map(emp => {
                  const empPreset = SHIFT_PRESETS.find(p => p.id === emp.workRegime) || SHIFT_PRESETS[0]
                  const empDayStatus = checkEmployeeWorkDay(emp, new Date())
                  const empNetTime = calculateNetShiftTime(emp.shiftStart || '08:00', emp.lunchStart || '12:00', emp.lunchEnd || '13:00', emp.shiftEnd || '17:00')
                  const workDaysSummary = formatWorkDaysSummary(emp)

                  return (
                    <div key={emp.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-black/5 dark:border-white/5 hover:border-blue-500/40 transition-all duration-500 group shadow-sm hover:shadow-2xl relative overflow-hidden flex flex-col">
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-black/40 border border-black/5 dark:border-white/5 overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-500 shrink-0">
                          {emp.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-slate-300 mx-auto mt-6" />}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-600/10 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">ID: {emp.id}</span>
                            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-500/20">
                              {empPreset.badge}
                            </span>
                          </div>
                          {emp.departmentId && (
                            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-full uppercase tracking-widest border border-black/5 dark:border-white/5">
                              {departments.find(d => String(d.id) === String(emp.departmentId))?.name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 mb-6">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate group-hover:text-blue-600 transition-colors">{emp.name}</h3>
                        
                        <div className="flex items-center space-x-2 mt-2">
                          <ShieldAlert className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acesso PIN: <span className="text-slate-900 dark:text-white">{emp.pin}</span></span>
                        </div>

                        {/* Bloco de Jornada e Turno */}
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-black/40 rounded-2xl border border-black/5 dark:border-white/5 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{emp.shiftStart || '08:00'} - {emp.shiftEnd || '17:00'}</span>
                            </span>
                            <span className="text-[10px] font-black text-slate-400">
                              {empNetTime.netText}/dia
                            </span>
                          </div>

                          {emp.lunchStart && emp.lunchEnd && (
                            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                              <span className="flex items-center gap-1.5">
                                <Utensils className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Almoço: {emp.lunchStart} às {emp.lunchEnd}</span>
                              </span>
                              <span className="font-semibold">({empNetTime.breakText})</span>
                            </div>
                          )}

                          <div className="pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                            {empPreset.isScale ? (
                              <div className="flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${empDayStatus.type === 'work' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className={`text-[9px] font-black uppercase tracking-wider ${
                                  empDayStatus.type === 'work' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                  Hoje: {empDayStatus.shortLabel || empDayStatus.label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                Dias: <span className="font-bold text-slate-700 dark:text-slate-300">{workDaysSummary}</span>
                              </span>
                            )}
                            <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                              {emp.weeklyHours ?? 44}h/sem
                            </span>
                          </div>
                        </div>

                        {emp.allowRetroactive && emp.retroactiveStart && emp.retroactiveEnd && (
                          <div className="mt-3 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>Retroativo: {format(new Date(emp.retroactiveStart + 'T12:00:00'), 'dd/MM')} a {format(new Date(emp.retroactiveEnd + 'T12:00:00'), 'dd/MM')}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 pt-6 border-t border-black/5 dark:border-white/5 mt-auto">
                        <button onClick={() => handleEdit(emp)} className="flex-1 py-3.5 bg-blue-600/5 hover:bg-blue-600 text-blue-600 hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2"><Edit className="w-3 h-3" /><span>Editar</span></button>
                        <button onClick={() => registerBiometrics(emp)} className={`p-3.5 rounded-2xl transition-all ${emp.biometricId ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-blue-600 hover:text-white'}`} title="Configurar Biometria"><Fingerprint className="w-4 h-4" /></button>
                        {emp.cpf === '000.000.000-00' || emp.isDemo ? (
                          <div className="p-3.5 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-2xl cursor-not-allowed flex items-center justify-center" title="Perfil de Teste Protegido (não pode ser excluído)">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          </div>
                        ) : (
                          <button onClick={() => handleDelete(emp.id)} className="p-3.5 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all" title="Remover"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Gerenciamento de Setores (Inclusão, Edição, Exclusão com aviso de quantidade e Salvamento) */}
      {showDeptModal && (
        <div 
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setShowDeptModal(false)
            setEditingDeptId(null)
            setDeletingDept(null)
          }}
        >
          <div 
            className="relative max-w-xl w-full bg-white dark:bg-[#0c1322] rounded-[2.5rem] p-7 md:p-9 border border-slate-200 dark:border-white/10 shadow-2xl space-y-6 animate-in zoom-in duration-200 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shadow-inner">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Gerenciamento de Setores</h3>
                  <p className="text-xs text-slate-400 font-medium">Cadastre, edite ou remova departamentos da empresa</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowDeptModal(false)
                  setEditingDeptId(null)
                  setDeletingDept(null)
                }} 
                className="p-2.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inclusão de Novo Setor */}
            <div className="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Criar Novo Setor</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ex: Financeiro, Operacional, RH, Comercial..." 
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs" 
                  value={newDeptName} 
                  onChange={e => setNewDeptName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      await handleCreateDept()
                    }
                  }}
                />
                <button 
                  type="button" 
                  onClick={handleCreateDept} 
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center space-x-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Confirmação de Exclusão com Aviso de Quantidade de Funcionários */}
            {deletingDept && (
              <div className="p-5 bg-red-50 dark:bg-red-950/40 border-2 border-red-500/40 rounded-2xl space-y-3 animate-in zoom-in duration-200 shadow-lg shadow-red-500/10">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/30">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-red-600 dark:text-red-400">
                      Confirmar exclusão do setor "{deletingDept.name}"?
                    </h4>
                    {(() => {
                      const count = employees.filter(e => String(e.departmentId) === String(deletingDept.id)).length
                      return count > 0 ? (
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                          ⚠️ <span className="text-red-600 dark:text-red-400 underline font-black">Atenção:</span> Existem <strong className="text-red-600 dark:text-red-400 font-black">{count} colaborador(es)</strong> vinculados a este setor. Ao excluir, o vínculo deles será desfeito e passarão para <span className="italic">"Nenhum Setor"</span>.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Nenhum colaborador está vinculado a este setor no momento.
                        </p>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-red-200 dark:border-red-500/20">
                  <button 
                    type="button" 
                    onClick={() => setDeletingDept(null)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-100 border border-slate-200 dark:border-white/10"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleConfirmDeleteDept(deletingDept)}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-red-600/30 transition-all active:scale-95 flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Excluir Setor</span>
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Setores */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[160px]">
              <div className="flex justify-between items-center px-1 pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Setores Cadastrados ({departments.length})
                </span>
              </div>

              {departments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                  <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">Nenhum setor cadastrado ainda.</p>
                </div>
              ) : (
                departments.map(dept => {
                  const count = employees.filter(e => String(e.departmentId) === String(dept.id)).length
                  const isEditing = editingDeptId === dept.id

                  return (
                    <div 
                      key={dept.id} 
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isEditing 
                          ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500/50 shadow-sm' 
                          : 'bg-white dark:bg-white/5 border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="text" 
                            className="flex-1 bg-white dark:bg-slate-900 border border-blue-400 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                            value={editingDeptName} 
                            onChange={e => setEditingDeptName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                await handleSaveEditDept(dept.id)
                              } else if (e.key === 'Escape') {
                                setEditingDeptId(null)
                              }
                            }}
                            autoFocus
                          />
                          <button 
                            type="button" 
                            onClick={() => handleSaveEditDept(dept.id)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1 shadow-sm shrink-0"
                            title="Salvar alteração"
                          >
                            <Check className="w-4 h-4" />
                            <span>Salvar</span>
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setEditingDeptId(null)}
                            className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 rounded-xl transition-all shrink-0"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 font-black text-xs">
                              <Building2 className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                                {dept.name}
                              </h4>
                              <span className={`text-[10px] font-bold ${count > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                👥 {count} {count === 1 ? 'colaborador' : 'colaboradores'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button 
                              type="button"
                              onClick={() => {
                                setDeletingDept(null)
                                setEditingDeptId(dept.id)
                                setEditingDeptName(dept.name)
                              }}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                              title="Editar nome do setor"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                setEditingDeptId(null)
                                setDeletingDept(dept)
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                              title="Excluir setor"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Rodapé */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end">
              <button 
                type="button" 
                onClick={() => {
                  setShowDeptModal(false)
                  setEditingDeptId(null)
                  setDeletingDept(null)
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsManager({ employees, departments, onDataChange }) {
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState({ employeeId: '', period: 'day', date: format(new Date(), 'yyyy-MM-dd'), month: format(new Date(), 'yyyy-MM') })
  const [calculatedHours, setCalculatedHours] = useState(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllAll, setShowAllAll] = useState(false)
  const [deptFilter, setDeptFilter] = useState('')
  const [config, setConfig] = useState(null)
  const [manualEntryData, setManualEntryData] = useState({
    employeeId: '',
    type: 'admin_excused',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    comment: ''
  })
  const [adjustmentData, setAdjustmentData] = useState({
    record: null,
    newTime: '',
    reason: ''
  })

  useEffect(() => {
    db.settings.get('config').then(setConfig)
    onDataChange()
    loadRecords()
  }, [filter])

  const calculateTotalTime = (empRecords) => {
    const sorted = [...empRecords].filter(r => r.status !== 'rejected').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp))
    let totalMs = 0
    let isWorking = false
    let lastStart = null

    sorted.forEach(r => {
      if (['check_in', 'lunch_in', 'other_in'].includes(r.type)) {
        if (!isWorking) {
          isWorking = true
          lastStart = new Date(r.timestamp)
        }
      } else if (['lunch_out', 'other_out', 'check_out', 'system_auto_checkout', 'admin_adjustment'].includes(r.type)) {
        if (isWorking) {
          isWorking = false
          totalMs += (new Date(r.timestamp) - lastStart)
        }
      }
    })

    if (isWorking && filter.date === format(new Date(), 'yyyy-MM-dd')) {
      totalMs += (new Date() - lastStart)
    }

    const hours = Math.floor(totalMs / 3600000)
    const minutes = Math.floor((totalMs % 3600000) / 60000)
    return { hours, minutes, isWorking }
  }

  const loadRecords = async () => {
    let all = await db.records.orderBy('timestamp').reverse().toArray()
    
    let start, end;
    if (filter.period === 'day') {
      start = new Date(`${filter.date}T00:00:00`)
      end = new Date(`${filter.date}T23:59:59.999`)
    } else {
      const parts = filter.month.split('-')
      start = startOfMonth(new Date(parts[0], parts[1] - 1, 1))
      end = endOfMonth(new Date(parts[0], parts[1] - 1, 1))
    }

    const filtered = all.filter(r => {
      const rDate = new Date(r.timestamp)
      const sameDay = rDate >= start && rDate <= end
      const sameEmp = !filter.employeeId || r.employeeId === Number(filter.employeeId)
      return sameDay && sameEmp
    })
    
    const emps = await db.employees.toArray()
    setRecords(filtered.map(r => {
      const emp = emps.find(e => e.id === r.employeeId)
      return { 
        ...r, 
        employeeName: emp?.name || 'Excluído',
        employeeCpf: emp?.cpf || '' 
      }
    }))

    if (filter.employeeId && filtered.length > 0) {
      setCalculatedHours(calculateTotalTime(filtered))
    } else {
      setCalculatedHours(null)
    }
  }

  const exportPDF = async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' })
      const config = await db.settings.get('config')
      const emp = employees.find(e => e.id === Number(filter.employeeId))
      const monthDate = new Date(filter.month + '-01T12:00:00')
      const periodLabel = format(monthDate, 'MMMM / yyyy', { locale: ptBR }).toUpperCase()

      // Logo handling
      let headerX = 14
      if (config?.companyLogo) {
        try {
          doc.addImage(config.companyLogo, 'PNG', 14, 10, 25, 15)
          headerX = 42 // Push text to the right
        } catch (e) { console.error('Erro ao carregar logo no PDF', e) }
      }

      // Header Premium
      doc.setFontSize(20)
      doc.setTextColor(30, 41, 59)
      doc.setFont(undefined, 'bold')
      doc.text(config?.companyName?.toUpperCase() || 'PONTOAQUI', headerX, 20)
      
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text('ESPELHO DE PONTO - RELATÓRIO MENSAL DE FREQUÊNCIA', headerX, 26)
      
      doc.setDrawColor(226, 232, 240)
      doc.line(14, 32, 282, 32)

      // Employee Info
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      doc.text(`COLABORADOR: ${emp?.name?.toUpperCase() || 'N/A'}`, 14, 40)
      doc.text(`CPF: ${emp?.cpf || 'N/A'}`, 14, 45)
      doc.text(`SETOR: ${departments.find(d => d.id === emp?.departmentId)?.name?.toUpperCase() || 'N/A'}`, 100, 45)
      doc.text(`PERÍODO: ${periodLabel}`, 200, 45)

      // Group records by day and calculate balances
      const daysInMonth = endOfMonth(monthDate).getDate()
      const dailyData = {}
      let totalExpectedMin = 0
      let totalWorkedMin = 0
      
      const holidays = await db.holidays.toArray()
      const netShift = calculateNetShiftTime(emp?.shiftStart || '08:00', emp?.lunchStart || '12:00', emp?.lunchEnd || '13:00', emp?.shiftEnd || '17:00')
      const dailyExpectedMin = netShift.dailyMin || 480

      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), i)
        const dateISO = format(d, 'yyyy-MM-dd')
        const holiday = holidays.find(h => h.date === dateISO)
        const workDayStatus = checkEmployeeWorkDay(emp, d)
        const isWorkDay = workDayStatus.isWorkDay && !holiday
        const dayStr = `${i.toString().padStart(2, '0')}/${format(monthDate, 'MM/yyyy')}`
        
        dailyData[dayStr] = {
          in: '-',
          lunchOut: '-',
          lunchIn: '-',
          out: '-',
          extras: [],
          obs: [],
          workedMin: 0,
          expectedMin: isWorkDay ? dailyExpectedMin : 0,
          isHoliday: !!holiday,
          holidayName: holiday?.name || '',
          isWorkDay
        }
        
        if (holiday) dailyData[dayStr].obs.push(`FERIADO: ${holiday.name.toUpperCase()}`)
        else if (!workDayStatus.isWorkDay) dailyData[dayStr].obs.push(workDayStatus.label.toUpperCase())

        if (isWorkDay) totalExpectedMin += dailyExpectedMin
      }

      records.filter(r => r.status !== 'rejected').forEach(r => {
        const date = format(new Date(r.timestamp), 'dd/MM/yyyy')
        if (dailyData[date]) {
          const time = format(new Date(r.timestamp), 'HH:mm')
          if (r.type === 'check_in') dailyData[date].in = time
          else if (r.type === 'lunch_out') dailyData[date].lunchOut = time
          else if (r.type === 'lunch_in') dailyData[date].lunchIn = time
          else if (r.type === 'check_out' || r.type === 'system_auto_checkout' || r.type === 'admin_adjustment') dailyData[date].out = time
          
          if (r.type === 'other_out' || r.type === 'other_in') {
            const reason = r.comment ? `(${r.comment.toUpperCase()})` : ''
            dailyData[date].extras.push(`${time}${reason}`)
          }
          if (r.comment && !dailyData[date].obs.includes(r.comment.toUpperCase())) {
            dailyData[date].obs.push(r.comment.toUpperCase())
          }
        }
      })

      const tableRows = Object.entries(dailyData).map(([date, data]) => {
        let dailyTotalStr = '-'
        let multiplier = 1.0
        
        if (data.isHoliday || data.isSunday) {
          multiplier = 2.0
        }

        if (data.in !== '-' && data.out !== '-') {
          const [h1, m1] = data.in.split(':').map(Number)
          const [h2, m2] = data.out.split(':').map(Number)
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
          if (data.lunchOut !== '-' && data.lunchIn !== '-') {
            const [lh1, lm1] = data.lunchOut.split(':').map(Number)
            const [lh2, lm2] = data.lunchIn.split(':').map(Number)
            diff -= (lh2 * 60 + lm2) - (lh1 * 60 + lm1)
          }
          if (diff > 0) {
            // Apply the multiplier for the final balance
            const weightedDiff = Math.round(diff * multiplier)
            data.workedMin = weightedDiff
            totalWorkedMin += weightedDiff
            
            const hrs = Math.floor(diff / 60)
            const mins = diff % 60
            dailyTotalStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
            if (multiplier > 1) dailyTotalStr += ` (x${multiplier})`
          }
        }

        return [
          date,
          data.in,
          data.lunchOut,
          data.lunchIn,
          data.extras.length > 0 ? data.extras.join(' | ') : '-',
          data.out,
          dailyTotalStr,
          data.obs.length > 0 ? data.obs.join('; ') : '-'
        ]
      })

      autoTable(doc, {
        startY: 55,
        head: [['DATA', 'ENTRADA', 'ALMOÇO (S)', 'ALMOÇO (R)', 'PAUSAS EXTRAS', 'SAÍDA FINAL', 'TOTAL', 'OBSERVAÇÕES']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', textColor: [51, 65, 85] },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'center', cellWidth: 25 },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { fontSize: 6.5, halign: 'left', cellWidth: 55 }, 
          5: { halign: 'center' },
          6: { fontStyle: 'bold', textColor: [59, 130, 246], halign: 'center', cellWidth: 20 },
          7: { fontSize: 6.5, halign: 'left' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      })

      const finalY = (doc).lastAutoTable.finalY || 180
      
      // Detailed Balance Footer
      const overtimeMin = Math.max(0, totalWorkedMin - totalExpectedMin)
      const missingMin = Math.max(0, totalExpectedMin - totalWorkedMin)
      const balanceMin = totalWorkedMin - totalExpectedMin

      const formatMin = (m) => {
        const abs = Math.abs(m)
        const h = Math.floor(abs / 60)
        const min = abs % 60
        return `${m < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      }

      doc.setDrawColor(30, 41, 59)
      doc.setLineWidth(0.5)
      doc.line(14, finalY + 5, 282, finalY + 5)

      doc.setFontSize(9)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(30, 41, 59)
      
      const footerY = finalY + 12
      doc.text(`CARGA PREVISTA: ${formatMin(totalExpectedMin)}`, 14, footerY)
      doc.text(`TOTAL TRABALHADO: ${formatMin(totalWorkedMin)}`, 80, footerY)
      doc.setTextColor(16, 185, 129)
      doc.text(`EXTRAS: ${formatMin(overtimeMin)}`, 150, footerY)
      doc.setTextColor(239, 68, 68)
      doc.text(`FALTAS: ${formatMin(missingMin)}`, 200, footerY)
      doc.setTextColor(balanceMin >= 0 ? 59 : 239, balanceMin >= 0 ? 130 : 68, balanceMin >= 0 ? 246 : 68)
      doc.text(`SALDO FINAL: ${formatMin(balanceMin)}`, 250, footerY)

      doc.setFontSize(7)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(`GERADO EM ${format(new Date(), 'dd/MM/yyyy HH:mm')} - PONTOAQUI`, 14, doc.internal.pageSize.height - 8)

      doc.save(`ESPELHO_PONTO_${emp?.name.replace(/\s+/g, '_').toUpperCase()}_${filter.month}.pdf`)
    } catch (err) {
      console.error('ERRO PDF:', err)
      alert('ERRO AO GERAR PDF: ' + err.message)
    }
  }


  const exportCSV = () => {
    if (records.length === 0) return
    const headers = ['Funcionário', 'Data', 'Hora', 'Tipo', 'Localização (GPS)', 'Justificativa']
    const rows = records.map(r => [
      r.employeeName, 
      format(new Date(r.timestamp), 'dd/MM/yyyy'), 
      format(new Date(r.timestamp), 'HH:mm'), 
      RECORD_TYPES[r.type]?.label || '?', 
      r.location ? `https://www.google.com/maps?q=${r.location.lat},${r.location.lng}` : 'N/A',
      r.comment || ''
    ])
    
    const empsInRecords = [...new Set(records.map(r => r.employeeId))]
    rows.push(['', '', '', '', ''])
    rows.push(['RESUMO DE HORAS POR FUNCIONÁRIO', '', '', '', ''])
    empsInRecords.forEach(empId => {
      const empRecords = records.filter(r => r.employeeId === empId)
      const empName = empRecords[0].employeeName
      const { hours, minutes } = calculateTotalTime(empRecords)
      rows.push([empName, filter.date, `${hours}h ${minutes}m`, 'Total Trabalhado', '', ''])
    })

    const csvContent = "data:text/csv;charset=utf-8,\ufeff" + headers.join(';') + "\n" + rows.map(e => e.join(';')).join("\n")
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `ponto_${filter.period === 'day' ? filter.date : filter.month}.csv`); link.click()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleManualEntry = async () => {
    if (!manualEntryData.employeeId || !manualEntryData.comment) {
      alert('Preencha o funcionário e a justificativa.')
      return
    }
    const start = new Date(`${manualEntryData.startDate}T08:00:00`)
    const end = new Date(`${manualEntryData.endDate}T08:00:00`)
    const days = differenceInDays(end, start)
    
    if (days < 0) {
      alert('A data final deve ser maior ou igual a inicial.')
      return
    }

    const newRecords = []
    for (let i = 0; i <= days; i++) {
      const currentDate = addDays(start, i)
      newRecords.push({
        employeeId: Number(manualEntryData.employeeId),
        timestamp: currentDate.toISOString(),
        type: manualEntryData.type,
        comment: manualEntryData.comment
      })
    }

    await db.records.bulkAdd(newRecords)
    for (const r of newRecords) {
      const docId = String(r.id || `${r.employeeId}_${new Date(r.timestamp).getTime()}`)
      await pushDocToFirestore('records', docId, r)
    }
    setShowManualEntry(false)
    setManualEntryData({...manualEntryData, comment: ''})
    loadRecords()
    alert(`${newRecords.length} registro(s) inserido(s) com sucesso.`)
  }

  const handleAdjustSubmit = async () => {
    if (!adjustmentData.newTime || !adjustmentData.reason) {
      alert('Preencha o novo horário e o motivo.')
      return
    }

    const original = adjustmentData.record
    const dateStr = format(new Date(original.timestamp), 'yyyy-MM-dd')
    const newTimestamp = new Date(`${dateStr}T${adjustmentData.newTime}`).toISOString()

    // 1. Mark original as superseded
    await db.records.update(original.id, { 
      type: 'superseded',
      comment: `Original: ${format(new Date(original.timestamp), 'HH:mm')} | Ajustado por admin.`
    })
    const updatedOrig = await db.records.get(original.id)
    if (updatedOrig) await pushDocToFirestore('records', original.id, updatedOrig)

    // 2. Create new adjustment record
    const newRecId = await db.records.add({
      employeeId: original.employeeId,
      timestamp: newTimestamp,
      type: 'admin_adjustment',
      comment: `AJUSTE: ${adjustmentData.reason} (Original era ${format(new Date(original.timestamp), 'HH:mm')})`,
      status: 'approved'
    })
    const createdRec = await db.records.get(newRecId)
    if (createdRec) await pushDocToFirestore('records', newRecId, createdRec)

    setAdjustmentData({ record: null, newTime: '', reason: '' })
    loadRecords()
    alert('Ajuste realizado com sucesso e registrado na trilha de auditoria.')
  }

  if (isPrinting) {
    const empName = employees.find(e => e.id === Number(filter.employeeId))?.name || 'Todos'
    return (
      <div id="print-section" className="bg-white text-black p-8 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center border-b-2 border-black pb-4 mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-widest">Espelho de Ponto Oficial</h1>
            <p className="text-sm mt-2">Competência: {filter.month}</p>
            <p className="text-lg font-bold mt-2">Funcionário: {empName}</p>
          </div>
          <table className="w-full text-sm border-collapse border border-black">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-2 text-left">Data</th>
                <th className="border border-black p-2 text-left">Hora</th>
                <th className="border border-black p-2 text-left">Registro</th>
                <th className="border border-black p-2 text-left">Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {[...records].reverse().map(r => (
                <tr key={r.id}>
                  <td className="border border-black p-2 font-medium">{format(new Date(r.timestamp), 'dd/MM/yyyy')}</td>
                  <td className="border border-black p-2 font-mono">{format(new Date(r.timestamp), 'HH:mm')}</td>
                  <td className="border border-black p-2">{RECORD_TYPES[r.type]?.label || '?'}</td>
                  <td className="border border-black p-2 text-xs italic">{r.comment || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {calculatedHours && (
            <div className="text-right mt-6 font-bold text-lg">
              Total de Horas Trabalhadas: {calculatedHours.hours}h {calculatedHours.minutes}m
            </div>
          )}
          <div className="mt-32 flex justify-between px-10">
            <div className="text-center w-64">
              <div className="border-t border-black pt-2">Assinatura do Funcionário</div>
            </div>
            <div className="text-center w-64">
              <div className="border-t border-black pt-2">Assinatura do Gestor Responsável</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
            <FileText className="w-8 h-8 mr-3 text-blue-600" />
            Relatórios Históricos
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Consulte e exporte os registros de ponto da equipe.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button onClick={() => setShowManualEntry(!showManualEntry)} className="px-5 py-3.5 bg-blue-600/10 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Lançar Falta/Atestado</span>
          </button>
          
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-2xl border border-black/5 dark:border-white/10 p-1 shadow-sm">
            <button onClick={exportPDF} disabled={records.length === 0 || !filter.employeeId || filter.period !== 'month'} className="p-2.5 text-slate-400 hover:text-purple-600 disabled:opacity-20 transition-all" title="Gerar PDF Espelho de Ponto">
              <FileText className="w-5 h-5" />
            </button>
            <button onClick={handlePrint} disabled={records.length === 0 || !filter.employeeId || filter.period !== 'month'} className="p-2.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-all" title="Imprimir Relatório">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={exportCSV} disabled={records.length === 0} className="p-2.5 text-slate-400 hover:text-emerald-600 disabled:opacity-20 transition-all" title="Exportar CSV">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showManualEntry && (
        <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-slate-900 border border-blue-500/20 rounded-[2.5rem] shadow-2xl space-y-6 animate-in zoom-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Ajuste Manual de Ponto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Colaborador</label>
              <select className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={manualEntryData.employeeId} onChange={e => setManualEntryData({...manualEntryData, employeeId: e.target.value})}>
                <option value="">Selecionar...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Registro</label>
              <select className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={manualEntryData.type} onChange={e => setManualEntryData({...manualEntryData, type: e.target.value})}>
                <option value="admin_excused">Atestado Médico / Férias</option>
                <option value="admin_absence">Falta Injustificada</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Inicial</label>
              <input type="date" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={manualEntryData.startDate} onChange={e => setManualEntryData({...manualEntryData, startDate: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Final</label>
              <input type="date" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={manualEntryData.endDate} onChange={e => setManualEntryData({...manualEntryData, endDate: e.target.value})} />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justificativa / Descrição</label>
              <input type="text" placeholder="Ex: Apresentou atestado CID..." className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={manualEntryData.comment} onChange={e => setManualEntryData({...manualEntryData, comment: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleManualEntry} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 uppercase tracking-widest text-xs transition-all active:scale-[0.98]">Confirmar Lançamento</button>
            <button onClick={() => setShowManualEntry(false)} className="px-10 py-5 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-xs transition-all">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input type="text" placeholder="Pesquisar registros por funcionário..." className="w-full p-5 pl-14 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold placeholder:font-normal" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="md:w-64 p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black text-xs uppercase tracking-widest appearance-none cursor-pointer" value={String(deptFilter)} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">Todos os Setores</option>
            {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <select className="w-full p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={filter.employeeId} onChange={e => { setFilter({...filter, employeeId: e.target.value}); setShowAllAll(false); }}><option value="">Todos os Colaboradores</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          </div>
          <div className="md:col-span-2 flex gap-4">
            <select className="w-1/3 p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black text-xs uppercase tracking-widest" value={filter.period} onChange={e => setFilter({...filter, period: e.target.value})}>
              <option value="day">Diário</option>
              <option value="month">Mensal</option>
            </select>
            {filter.period === 'day' ? (
              <input type="date" className="flex-1 p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={filter.date} onChange={e => setFilter({...filter, date: e.target.value})} />
            ) : (
              <input type="month" className="flex-1 p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})} />
            )}
          </div>
        </div>
      </div>

      {calculatedHours && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-[3rem] shadow-xl shadow-blue-600/20 flex flex-col md:flex-row justify-between items-center text-white gap-6 animate-in zoom-in duration-500">
          <div className="flex items-center space-x-6 text-center md:text-left">
            <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Calculado</p>
              <p className="text-4xl font-black">{calculatedHours.hours}<span className="text-xl opacity-60 ml-1">h</span> {calculatedHours.minutes}<span className="text-xl opacity-60 ml-1">m</span></p>
            </div>
          </div>
          {calculatedHours.isWorking && (
            <div className="px-6 py-3 bg-emerald-400 text-slate-900 text-[10px] font-black uppercase rounded-full animate-pulse tracking-widest shadow-lg">
              Trabalho em Andamento
            </div>
          )}
        </div>
      )}

      <div className="space-y-4 pb-20">
        {!filter.employeeId && !searchTerm && !showAllAll ? (
          <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-black/10 dark:border-white/10 shadow-sm animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-slate-50 dark:bg-black/40 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <FileSearch className="w-10 h-10 text-slate-200 dark:text-slate-800" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Histórico Oculto</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-sm mx-auto">Para otimizar o carregamento, os registros são exibidos apenas sob demanda ou através dos filtros acima.</p>
            <button onClick={() => setShowAllAll(true)} className="mt-10 px-12 py-5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-500 shadow-2xl shadow-blue-600/30 transition-all active:scale-95">Visualizar Tudo ({records.length})</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-6 duration-700">
            {records
              .filter(r => {
                if (!deptFilter) return true
                const emp = employees.find(e => e.id === r.employeeId)
                return String(emp?.departmentId) === String(deptFilter)
              })
              .filter(r => r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(r => {
                const config = RECORD_TYPES[r.type] || { label: '?', color: 'bg-slate-500' }
                return (
                  <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-black/5 dark:border-white/5 hover:border-blue-500/30 transition-all group shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-5">
                      <div className={`w-12 h-12 ${config.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                          {r.employeeName}
                          {r.photo && (
                            <button onClick={() => setViewingPhoto(viewingPhoto === r.id ? null : r.id)} className={`p-1 rounded-lg transition-colors ${viewingPhoto === r.id ? 'bg-purple-600 text-white' : 'text-purple-400 hover:bg-purple-600/10'}`}><Camera className="w-3.5 h-3.5" /></button>
                          )}
                          {r.location && (
                            <a href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600"><MapPin className="w-3.5 h-3.5" /></a>
                          )}
                        </h4>
                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 font-mono">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(r.timestamp), 'dd/MM/yyyy')}</span>
                          <span className="flex items-center gap-1 text-blue-500"><Clock className="w-3 h-3" /> {format(new Date(r.timestamp), 'HH:mm')}</span>
                          {r.employeeCpf === '000.000.000-00' && <span className="ml-2 text-[7px] bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">Demonstração</span>}
                        </div>
                        {r.comment && <p className="text-[10px] text-slate-500 italic mt-2 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg w-fit">"{r.comment}"</p>}
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-2 shrink-0">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase text-white ${config.color.split(' ')[0]}`}>{config.label}</span>
                      {r.type !== 'superseded' && r.type !== 'admin_adjustment' && r.type !== 'admin_absence' && r.type !== 'admin_excused' && (
                        <button 
                          onClick={() => setAdjustmentData({ record: r, newTime: format(new Date(r.timestamp), 'HH:mm'), reason: '' })}
                          className="p-1.5 bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                          title="Ajustar horário deste registro"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {r.photo && viewingPhoto === r.id && (
                      <div className="md:absolute md:right-40 mt-4 md:mt-0 z-50 animate-in zoom-in">
                        <img src={r.photo} alt="Ponto" className="w-32 h-32 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-2xl" />
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        )}
      </div>
      {adjustmentData.record && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-orange-500/20 rounded-[3rem] shadow-2xl p-8 lg:p-12 space-y-8 animate-in zoom-in duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Ajustar Registro</h3>
              <button onClick={() => setAdjustmentData({ record: null, newTime: '', reason: '' })} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="flex items-center space-x-4 p-6 bg-orange-500/5 rounded-3xl border border-orange-500/10">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Original: {adjustmentData.record.employeeName}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{format(new Date(adjustmentData.record.timestamp), "HH:mm")} ({RECORD_TYPES[adjustmentData.record.type]?.label})</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Novo Horário Corrigido</label>
                <input type="time" className="w-full p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 font-black text-xl" value={adjustmentData.newTime} onChange={e => setAdjustmentData({...adjustmentData, newTime: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Justificativa do Ajuste (Obrigatório)</label>
                <textarea placeholder="Ex: Esqueceu de bater o ponto na saída. Confirmado via câmera..." className="w-full p-5 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 min-h-[120px] font-medium" value={adjustmentData.reason} onChange={e => setAdjustmentData({...adjustmentData, reason: e.target.value})} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={handleAdjustSubmit} className="flex-1 py-6 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-3xl shadow-2xl shadow-orange-500/30 uppercase tracking-[0.2em] text-xs transition-all active:scale-[0.98]">Confirmar e Registrar Auditoria</button>
              <button onClick={() => setAdjustmentData({ record: null, newTime: "", reason: "" })} className="px-10 py-6 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-3xl uppercase tracking-[0.2em] text-xs transition-all hover:bg-slate-200 dark:hover:bg-white/10">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
    {/* Hidden Official Printable Report */}
    <div id="printable-report-content" className="hidden print:block fixed inset-0 bg-white z-[9999] p-4 text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 1cm; }
          body * { visibility: hidden; }
          #printable-report-content, #printable-report-content * { visibility: visible; }
          #printable-report-content { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
        }
      ` }} />
      
      <div className="flex justify-between items-start mb-6 border-b pb-4 text-black">
        <div className="flex items-center gap-4">
          {config?.companyLogo && <img src={config.companyLogo} className="w-16 h-10 object-contain" />}
          <div>
            <h1 className="text-xl font-bold uppercase">{config?.companyName || 'PONTOAQUI'}</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Espelho de Ponto - Relatório Mensal de Frequência</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase">Período: {format(new Date(filter.month + '-01T12:00:00'), 'MMMM / yyyy', { locale: ptBR }).toUpperCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-6 text-[10px] font-bold uppercase text-black">
        <div>
          <p>Colaborador: {employees.find(e => e.id === Number(filter.employeeId))?.name || 'N/A'}</p>
          <p>CPF: {employees.find(e => e.id === Number(filter.employeeId))?.cpf || 'N/A'}</p>
        </div>
        <div className="text-right">
          <p>Setor: {departments.find(d => d.id === employees.find(e => e.id === Number(filter.employeeId))?.departmentId)?.name || 'N/A'}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-[8px] mb-8 text-black">
        <thead>
          <tr className="bg-slate-100 text-black uppercase font-bold">
            <th className="border border-black p-1">Data</th>
            <th className="border border-black p-1">Entrada</th>
            <th className="border border-black p-1">Almoço (S)</th>
            <th className="border border-black p-1">Almoço (R)</th>
            <th className="border border-black p-1">Pausas Extras</th>
            <th className="border border-black p-1">Saída Final</th>
            <th className="border border-black p-1">Total</th>
            <th className="border border-black p-1">Observações</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(
            (() => {
              const monthDate = new Date(filter.month + '-01T12:00:00')
              const daysInMonth = endOfMonth(monthDate).getDate()
              const daily = {}
              for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), i)
                const dayStr = `${i.toString().padStart(2, '0')}/${format(monthDate, 'MM/yyyy')}`
                daily[dayStr] = { in: '-', lunchOut: '-', lunchIn: '-', out: '-', extras: [], obs: [], multiplier: (d.getDay() === 0) ? 2 : 1 }
                if (d.getDay() === 0) daily[dayStr].obs.push('DOMINGO')
                else if (d.getDay() === 6) daily[dayStr].obs.push('SÁBADO')
              }
              records.forEach(r => {
                const date = format(new Date(r.timestamp), 'dd/MM/yyyy')
                if (daily[date]) {
                  const time = format(new Date(r.timestamp), 'HH:mm')
                  if (r.type === 'check_in') daily[date].in = time
                  else if (r.type === 'lunch_out') daily[date].lunchOut = time
                  else if (r.type === 'lunch_in') daily[date].lunchIn = time
                  else if (r.type === 'check_out' || r.type === 'system_auto_checkout' || r.type === 'admin_adjustment') daily[date].out = time
                  if (r.type === 'other_out' || r.type === 'other_in') daily[date].extras.push(`${time}${r.comment ? `(${r.comment.toUpperCase()})` : ''}`)
                  if (r.comment && !daily[date].obs.includes(r.comment.toUpperCase())) daily[date].obs.push(r.comment.toUpperCase())
                }
              })
              return daily
            })()
          ).map(([date, data], idx) => {
            let dailyTotalStr = '-'
            if (data.in !== '-' && data.out !== '-') {
              const [h1, m1] = data.in.split(':').map(Number); const [h2, m2] = data.out.split(':').map(Number)
              let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
              if (data.lunchOut !== '-' && data.lunchIn !== '-') {
                const [lh1, lm1] = data.lunchOut.split(':').map(Number); const [lh2, lm2] = data.lunchIn.split(':').map(Number)
                diff -= (lh2 * 60 + lm2) - (lh1 * 60 + lm1)
              }
              if (diff > 0) dailyTotalStr = `${Math.floor(diff/60).toString().padStart(2,'0')}:${(diff%60).toString().padStart(2,'0')}${data.multiplier > 1 ? ` (x${data.multiplier})` : ''}`
            }
            return (
              <tr key={idx} className="bg-white">
                <td className="border border-black p-1 font-bold text-center">{date}</td>
                <td className="border border-black p-1 text-center">{data.in}</td>
                <td className="border border-black p-1 text-center">{data.lunchOut}</td>
                <td className="border border-black p-1 text-center">{data.lunchIn}</td>
                <td className="border border-black p-1 text-left text-[7px]">{data.extras.join(' | ') || '-'}</td>
                <td className="border border-black p-1 text-center">{data.out}</td>
                <td className="border border-black p-1 text-center font-bold">{dailyTotalStr}</td>
                <td className="border border-black p-1 text-left text-[7px]">{data.obs.join('; ') || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex justify-between border-t border-black pt-4 font-bold text-[10px] uppercase text-black">
        <p>Total Acumulado no Período: {calculatedHours ? `${calculatedHours.hours}h ${calculatedHours.minutes}m` : '00:00'}</p>
        <p className="text-[7px] text-gray-400 italic">Relatório Oficial Gerado Eletronicamente via PontoAqui</p>
      </div>

      <div className="mt-24 flex justify-around text-[9px] font-bold uppercase text-black">
        <div className="text-center border-t border-black pt-2 w-64">Assinatura do Colaborador</div>
        <div className="text-center border-t border-black pt-2 w-64">Assinatura do Gestor</div>
      </div>
    </div>
    </>
  )
}

function SettingsManager() {
  const [settings, setSettings] = useState({ companyName: '', workingHours: '', adminPassword: '' })
  const [stats, setStats] = useState({ employees: 0, records: 0, dbSize: '...' })
  const [employees, setEmployees] = useState([])
  const [activeSubTab, setActiveSubTab] = useState('general')
  const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'light')
  
  const handleThemeChange = (newTheme) => {
    setThemeMode(newTheme)
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  // Advanced Flow States
  const [showPreview, setShowPreview] = useState(false)
  const [previewRecords, setPreviewRecords] = useState([])
  const [confirmModal, setConfirmModal] = useState({ show: false, password: '' })
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  // Firebase Realtime Config States
  const [fbConfig, setFbConfig] = useState(() => getFirebaseConfig() || {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  })
  const [fbRawInput, setFbRawInput] = useState('')
  const [fbStatus, setFbStatus] = useState({
    testing: false,
    msg: '',
    isConfigured: isFirebaseConfigured(),
    success: null
  })
  const [syncingAll, setSyncingAll] = useState(false)

  const parseRawFirebaseConfig = (text) => {
    if (!text) return null
    try {
      const parsed = JSON.parse(text)
      if (parsed.apiKey && parsed.projectId) return parsed
    } catch (e) {}

    const extract = (key) => {
      const match = text.match(new RegExp(`${key}["']?\\s*:\\s*["']([^"']+)["']`))
      return match ? match[1] : ''
    }

    const apiKey = extract('apiKey')
    const projectId = extract('projectId')
    if (!apiKey && !projectId) return null

    return {
      apiKey: apiKey || '',
      authDomain: extract('authDomain') || '',
      projectId: projectId || '',
      storageBucket: extract('storageBucket') || '',
      messagingSenderId: extract('messagingSenderId') || '',
      appId: extract('appId') || ''
    }
  }

  const handleApplyRawConfig = () => {
    if (!fbRawInput.trim()) return
    const parsed = parseRawFirebaseConfig(fbRawInput)
    if (parsed) {
      setFbConfig(parsed)
      alert('Credenciais extraídas com sucesso! Clique em "Salvar e Iniciar Sincronização" para ativar.')
    } else {
      alert('Não foi possível extrair os dados. Verifique se copiou o código ou JSON do Firebase Console.')
    }
  }

  const handleTestFirebase = async () => {
    setFbStatus({ testing: true, msg: 'Testando conexão com o Firestore...', success: null, isConfigured: fbStatus.isConfigured })
    const res = await testFirebaseConnection(fbConfig)
    setFbStatus({
      testing: false,
      msg: res.message,
      success: res.success,
      isConfigured: res.success ? true : fbStatus.isConfigured
    })
  }

  const handleSaveFirebase = async () => {
    if (!fbConfig.apiKey || !fbConfig.projectId) {
      alert('Preencha ao menos a apiKey e o projectId do Firebase.')
      return
    }
    setFbStatus({ testing: true, msg: 'Validando credenciais e iniciando sincronização...', success: null, isConfigured: fbStatus.isConfigured })
    const testRes = await testFirebaseConnection(fbConfig)
    if (!testRes.success) {
      setFbStatus({ testing: false, msg: `Falha ao conectar: ${testRes.message}`, success: false, isConfigured: false })
      alert(`Não foi possível salvar: ${testRes.message}`)
      return
    }
    saveFirebaseConfig(fbConfig)
    startRealtimeSync(() => {
      db.employees.toArray().then(setEmployees)
      updateStats()
    })
    setFbStatus({ testing: false, msg: 'Firebase Firestore conectado e sincronização bidirecional ativa!', success: true, isConfigured: true })
    alert('Configurações salvas com sucesso! O PontoAqui agora está sincronizando em tempo real com o Firebase Firestore.')
  }

  const handleDisconnectFirebase = () => {
    if (confirm('Deseja realmente desconectar o Firebase deste dispositivo? O sistema continuará operando no modo local.')) {
      saveFirebaseConfig(null)
      stopRealtimeSync()
      setFbConfig({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' })
      setFbRawInput('')
      setFbStatus({ testing: false, msg: 'Firebase desconectado.', success: null, isConfigured: false })
      alert('Firebase desconectado com sucesso.')
    }
  }

  const handleExportAllToFirebase = async () => {
    if (!isFirebaseConfigured()) {
      alert('Por favor, configure e salve as credenciais do Firebase antes de sincronizar a base local.')
      return
    }
    if (!confirm('Deseja exportar todos os dados deste dispositivo para o Firebase Firestore? (Nota: Fotos e logo permanecem estritamente em cache local deste dispositivo)')) {
      return
    }
    setSyncingAll(true)
    try {
      const res = await syncAllLocalToFirestore()
      alert(`Sincronização concluída com sucesso! ${res.count} documentos locais enviados para o Firebase Firestore.`)
    } catch (err) {
      console.error(err)
      alert(`Erro ao sincronizar base local: ${err.message}`)
    } finally {
      setSyncingAll(false)
    }
  }
  
  const [delFilter, setDelFilter] = useState({
    employeeId: '',
    scope: 'records',
    period: 'custom',
    date: format(new Date(), 'yyyy-MM-dd'),
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    db.settings.get('config').then(val => { if (val) setSettings(val) })
    db.employees.toArray().then(setEmployees)
    updateStats()
  }, [])

  const toggleDemoMode = async () => {
    setIsDemoLoading(true)
    const newStatus = !settings.demoModeEnabled
    
    if (newStatus) {
      // Activate: Create Test Employee if not exists
      const testEmp = employees.find(e => e.cpf === '000.000.000-00')
      if (!testEmp) {
        const testEmpId = await db.employees.add({
          name: 'TESTE (DEMO) - FUNCIONÁRIO',
          pin: '0000',
          cpf: '000.000.000-00',
          email: 'teste@exemplo.com',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          photo: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        })
        await pushDocToFirestore('employees', testEmpId, {
          id: testEmpId,
          name: 'TESTE (DEMO) - FUNCIONÁRIO',
          pin: '0000',
          cpf: '000.000.000-00',
          email: 'teste@exemplo.com',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          photo: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        })
      }
    } else {
      // Deactivate: Optional cleanup or just keep it there but hidden?
      // User said "explicitamente marcando como funcionário teste"
      // We'll keep it but the system will hide it if demoModeEnabled is false
    }

    const updatedSettings = { ...settings, demoModeEnabled: newStatus }
    await db.settings.put(updatedSettings)
    await pushDocToFirestore('settings', 'config', updatedSettings)
    setSettings(updatedSettings)
    updateStats()
    db.employees.toArray().then(setEmployees)
    setIsDemoLoading(false)
    alert(`Modo Demonstração ${newStatus ? 'ATIVADO' : 'DESATIVADO'}`)
  }

  const updateStats = async () => {
    const eCount = await db.employees.count()
    const rCount = await db.records.count()
    setStats({ employees: eCount, records: rCount, dbSize: '~' + (eCount * 0.5 + rCount * 0.1).toFixed(1) + ' KB' })
  }

  const handleBackup = async () => {
    const data = { employees: await db.employees.toArray(), records: await db.records.toArray(), settings: await db.settings.toArray() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`; link.click()
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        if (confirm('Mesclar dados do backup com os atuais?')) {
          if (data.employees) await db.employees.bulkPut(data.employees)
          if (data.records) await db.records.bulkPut(data.records)
          if (data.settings) await db.settings.bulkPut(data.settings)
          alert('Sucesso!'); window.location.reload()
        }
      } catch (err) { alert('Arquivo inválido.') }
    }
    reader.readAsText(file)
  }

  const handleRunPreview = async () => {
    const { employeeId, period, date, startDate, endDate } = delFilter
    let start, end
    
    if (period === 'day') {
      const d = date.substring(0, 10)
      start = new Date(`${d}T00:00:00`); end = new Date(`${d}T23:59:59.999`)
    } else if (period === 'month') {
      const yyyyMm = date.substring(0, 7)
      start = startOfMonth(new Date(`${yyyyMm}-01T00:00:00`)); end = endOfMonth(new Date(`${yyyyMm}-01T00:00:00`))
    } else if (period === 'year') {
      const yyyy = date.substring(0, 4)
      start = startOfYear(new Date(`${yyyy}-01-01T00:00:00`)); end = endOfYear(new Date(`${yyyy}-01-01T00:00:00`))
    } else {
      const s = startDate.substring(0, 10)
      const e = endDate.substring(0, 10)
      start = new Date(`${s}T00:00:00`); end = new Date(`${e}T23:59:59.999`)
    }

    const records = await db.records.filter(r => {
      const rDate = new Date(r.timestamp)
      const inRange = rDate >= start && rDate <= end
      const isEmp = !employeeId || r.employeeId === Number(employeeId)
      return inRange && isEmp
    }).toArray()

    const emps = await db.employees.toArray()
    setPreviewRecords(records.map(r => ({ ...r, empName: emps.find(e => e.id === r.employeeId)?.name || '?' })))
    setShowPreview(true)
  }

  const runDeletion = async () => {
    const adminPass = settings.adminPassword || 'killer'
    if (confirmModal.password !== adminPass) { alert('Senha incorreta!'); return }

    if (delFilter.scope === 'employee' && delFilter.employeeId) {
      const targetEmp = employees.find(e => e.id === Number(delFilter.employeeId))
      if (targetEmp && (targetEmp.cpf === '000.000.000-00' || targetEmp.isDemo || targetEmp.name?.toUpperCase().includes('TESTE (DEMO)'))) {
        alert('O perfil de teste é nativo do sistema e está protegido contra exclusão.')
        return
      }
      await db.employees.delete(Number(delFilter.employeeId))
      await deleteDocFromFirestore('employees', delFilter.employeeId)
    }

    await db.records.bulkDelete(previewRecords.map(r => r.id))
    for (const r of previewRecords) {
      await deleteDocFromFirestore('records', r.id)
    }

    alert('Operação concluída!'); window.location.reload()
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
            <Settings className="w-8 h-8 mr-3 text-blue-600" />
            Configurações do Sistema
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Gerencie as preferências, segurança e dados da plataforma.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2.5 p-2 glass-panel rounded-[2rem] border border-slate-200/80 dark:border-white/10 shadow-sm">
        {[
          { 
            id: 'general', 
            label: 'Geral', 
            icon: Settings, 
            activeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/30 text-white',
            border: 'border-blue-500/30 hover:border-blue-500/70',
            activeBorder: 'border-blue-400',
            inactiveColor: 'text-blue-500',
            inactiveBg: 'hover:bg-blue-500/10'
          },
          { 
            id: 'security', 
            label: 'Segurança', 
            icon: ShieldCheck, 
            activeBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/30 text-white',
            border: 'border-emerald-500/30 hover:border-emerald-500/70',
            activeBorder: 'border-emerald-400',
            inactiveColor: 'text-emerald-500',
            inactiveBg: 'hover:bg-emerald-500/10'
          },
          { 
            id: 'holidays', 
            label: 'Feriados', 
            icon: Calendar, 
            activeBg: 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-600/30 text-white',
            border: 'border-purple-500/30 hover:border-purple-500/70',
            activeBorder: 'border-purple-400',
            inactiveColor: 'text-purple-500',
            inactiveBg: 'hover:bg-purple-500/10'
          },
          { 
            id: 'data', 
            label: 'Dados', 
            icon: Database, 
            activeBg: 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30 text-white',
            border: 'border-amber-500/30 hover:border-amber-500/70',
            activeBorder: 'border-amber-400',
            inactiveColor: 'text-amber-500',
            inactiveBg: 'hover:bg-amber-500/10'
          },
          { 
            id: 'cloud', 
            label: 'Nuvem', 
            icon: Cloud, 
            activeBg: 'bg-gradient-to-r from-sky-500 to-cyan-600 shadow-sky-500/30 text-white',
            border: 'border-sky-500/30 hover:border-sky-500/70',
            activeBorder: 'border-sky-400',
            inactiveColor: 'text-sky-500',
            inactiveBg: 'hover:bg-sky-500/10'
          }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveSubTab(tab.id)} 
            className={`flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded-2xl border-2 transition-all font-bold text-xs uppercase tracking-wider text-center lg:min-w-[150px] flex-1 sm:flex-initial active:scale-95 group ${
              activeSubTab === tab.id 
                ? `${tab.activeBg} ${tab.activeBorder} shadow-lg` 
                : `${tab.border} ${tab.inactiveBg} text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-white/5`
            }`}
          >
            <tab.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${activeSubTab === tab.id ? 'text-white' : tab.inactiveColor}`} />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeSubTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-500">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-black/5 dark:border-white/10 shadow-sm space-y-10">
            <div className="space-y-8">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
                <div className="w-2 h-6 bg-blue-600 rounded-full mr-3" />
                Preferências Gerais
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Instituição</label>
                  <input className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha Mestra Admin</label>
                  <input type="password" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={settings.adminPassword} onChange={e => setSettings({...settings, adminPassword: e.target.value})} />
                </div>
              </div>

              <div className="p-8 bg-blue-600/5 border border-blue-600/20 rounded-[2.5rem] flex items-center justify-between group">
                <div className="flex items-center space-x-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${settings.demoModeEnabled ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                    <Monitor className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Modo de Demonstração</h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">Ativa um funcionário fictício para apresentações.</p>
                  </div>
                </div>
                <button 
                  onClick={toggleDemoMode}
                  disabled={isDemoLoading}
                  className={`w-16 h-8 rounded-full transition-all relative shadow-inner ${settings.demoModeEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${settings.demoModeEnabled ? 'left-9' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-4 p-8 bg-slate-50 dark:bg-black/20 rounded-[2.5rem] border border-black/5 dark:border-white/5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Logomarca da Empresa</label>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-40 h-40 bg-white dark:bg-slate-900 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {settings.companyLogo ? (
                      <>
                        <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain p-4" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => setSettings({...settings, companyLogo: ''})} className="p-3 bg-red-600 text-white rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center opacity-30">
                        <Building2 className="w-12 h-12 mb-2" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Sem Logo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">A logomarca será exibida na tela principal de batida de ponto, acima do relógio. Recomendamos imagens PNG ou SVG com fundo transparente.</p>
                    <input 
                      type="file" 
                      id="logo-upload" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={e => {
                        const file = e.target.files[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = async (evt) => {
                            try {
                              const compressed = await compressImage(evt.target.result, 240, 240, 0.8)
                              setSettings(prev => ({ ...prev, companyLogo: compressed }))
                            } catch (err) {
                              setSettings(prev => ({ ...prev, companyLogo: evt.target.result }))
                            }
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                    <label htmlFor="logo-upload" className="inline-flex items-center space-x-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl cursor-pointer transition-all shadow-lg shadow-blue-600/20 text-[10px] font-black uppercase tracking-widest active:scale-95">
                      <Upload className="w-4 h-4" />
                      <span>{settings.companyLogo ? 'Alterar Logomarca' : 'Selecionar Imagem'}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Aparência do Painel</label>
                <div className="grid grid-cols-3 gap-3">
                  {[ 
                    { id: 'light', icon: Sun, label: 'Modo Claro' }, 
                    { id: 'dark', icon: Moon, label: 'Modo Escuro' }, 
                    { id: 'system', icon: Monitor, label: 'Automático' } 
                  ].map(t => (
                    <button key={t.id} onClick={() => handleThemeChange(t.id)} className={`py-5 rounded-2xl flex flex-col items-center justify-center border transition-all ${themeMode === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-50 dark:bg-white/5 border-black/5 dark:border-white/10 text-slate-500 hover:border-blue-500/50'}`}>
                      <t.icon className="w-6 h-6 mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={async () => { const cfg = {...settings, id: 'config'}; await db.settings.put(cfg); await pushDocToFirestore('settings', 'config', cfg); alert('Configurações Salvas!') }} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl shadow-2xl shadow-blue-600/40 transition-all active:scale-[0.98] text-lg uppercase tracking-[0.3em]">Salvar Alterações</button>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Métricas Globais</h3>
            <div className="grid grid-cols-1 gap-4">
              {[ 
                { label: 'Colaboradores Ativos', val: stats.employees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-600/10' }, 
                { label: 'Registros de Ponto', val: stats.records, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-600/10' }, 
                { label: 'Volume em Disco', val: stats.dbSize, icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-600/10' } 
              ].map((s, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-black/5 dark:border-white/10 shadow-sm flex items-center space-x-5">
                  <div className={`w-14 h-14 ${s.bg} rounded-2xl flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-7 h-7 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{s.val}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-black/5 dark:border-white/10 shadow-sm space-y-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
                  <MapPin className="w-6 h-6 mr-3 text-emerald-500" />
                  Cerca Virtual (Geofencing)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Restringir o registro de ponto a uma área física específica.</p>
              </div>
              <button 
                onClick={() => setSettings({...settings, geofenceEnabled: !settings.geofenceEnabled})}
                className={`w-16 h-8 rounded-full transition-all relative shadow-inner ${settings.geofenceEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${settings.geofenceEnabled ? 'left-9' : 'left-1'}`} />
              </button>
            </div>

            {settings.geofenceEnabled && (
              <div className="space-y-8 pt-8 border-t border-black/5 dark:border-white/5 animate-in slide-in-from-top-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Latitude Central</label>
                    <input type="number" step="any" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={settings.geofenceLat || ''} onChange={e => setSettings({...settings, geofenceLat: e.target.value})} placeholder="-23.550520" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Longitude Central</label>
                    <input type="number" step="any" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={settings.geofenceLng || ''} onChange={e => setSettings({...settings, geofenceLng: e.target.value})} placeholder="-46.633308" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Raio Permitido (Metros)</label>
                  <input type="number" className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-black" value={settings.geofenceRadius || ''} onChange={e => setSettings({...settings, geofenceRadius: e.target.value})} placeholder="50" />
                </div>
                <button onClick={() => navigator.geolocation.getCurrentPosition(pos => setSettings({...settings, geofenceLat: pos.coords.latitude, geofenceLng: pos.coords.longitude}))} className="w-full py-4 text-[10px] font-black text-blue-600 bg-blue-600/10 hover:bg-blue-600 hover:text-white rounded-2xl uppercase tracking-widest transition-all border border-blue-600/20">Obter Localização Atual</button>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-12 border-t border-black/5 dark:border-white/5">
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
                  <Wifi className="w-6 h-6 mr-3 text-blue-500" />
                  Rede Wi-Fi Corporativa
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Restringir o uso do aplicativo a uma rede Wi-Fi específica.</p>
              </div>
              <button 
                onClick={() => setSettings({...settings, wifiGeofenceEnabled: !settings.wifiGeofenceEnabled})}
                className={`w-16 h-8 rounded-full transition-all relative shadow-inner ${settings.wifiGeofenceEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${settings.wifiGeofenceEnabled ? 'left-9' : 'left-1'}`} />
              </button>
            </div>

            {settings.wifiGeofenceEnabled && (
              <div className="space-y-2 pt-8 border-t border-black/5 dark:border-white/5 animate-in slide-in-from-top-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SSID Permitido</label>
                <input className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={settings.allowedSSID || ''} onChange={e => setSettings({...settings, allowedSSID: e.target.value})} placeholder="Ex: Escritorio_WiFi" />
              </div>
            )}

            <button onClick={async () => { const cfg = {...settings, id: 'config'}; await db.settings.put(cfg); await pushDocToFirestore('settings', 'config', cfg); alert('Configurações Salvas!') }} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl shadow-2xl shadow-blue-600/40 transition-all active:scale-[0.98] text-lg uppercase tracking-[0.3em]">Salvar Segurança</button>
          </div>
        </div>
      )}

      {activeSubTab === 'data' && (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-black/5 dark:border-white/10 shadow-sm space-y-10">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
              <div className="w-2 h-6 bg-emerald-500 rounded-full mr-3" />
              Salvaguarda e Restauração
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={handleBackup} className="p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] flex flex-col items-center group hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                <Download className="w-10 h-10 text-emerald-500 mb-4 group-hover:-translate-y-2 group-hover:text-white transition-all" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 group-hover:text-white transition-colors">Exportar Base (JSON)</span>
              </button>
              <label className="p-8 bg-blue-600/10 border border-blue-600/20 rounded-[2.5rem] flex flex-col items-center group hover:bg-blue-600 hover:text-white transition-all shadow-sm cursor-pointer">
                <Upload className="w-10 h-10 text-blue-600 mb-4 group-hover:-translate-y-2 group-hover:text-white transition-all" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 group-hover:text-white transition-colors">Importar Backup</span>
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 p-8 lg:p-12 rounded-[3rem] border border-red-200 dark:border-red-900/20 shadow-sm space-y-10">
            <h3 className="text-xl font-black text-red-600 tracking-tight flex items-center">
              <div className="w-2 h-6 bg-red-600 rounded-full mr-3" />
              Zona de Exclusão Crítica
            </h3>
            <div className="space-y-6">
              <p className="text-sm text-red-700/70 font-medium px-1">Selecione os filtros abaixo para realizar uma limpeza seletiva ou total.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <select className="p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/20 rounded-2xl text-slate-900 dark:text-white text-xs font-bold outline-none" value={delFilter.employeeId} onChange={e => setDelFilter({...delFilter, employeeId: e.target.value})}><option value="">Todos os Colaboradores</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                <select className="p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/20 rounded-2xl text-slate-900 dark:text-white text-xs font-bold outline-none" value={delFilter.scope} onChange={e => setDelFilter({...delFilter, scope: e.target.value})}><option value="records">Apenas Histórico</option><option value="employee">Perfil + Pontos</option></select>
                <select className="p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/20 rounded-2xl text-slate-900 dark:text-white text-xs font-bold outline-none" value={delFilter.period} onChange={e => setDelFilter({...delFilter, period: e.target.value})}><option value="day">Diário</option><option value="month">Mensal</option><option value="year">Anual</option><option value="custom">Custom</option></select>
                {delFilter.period !== 'custom' ? (
                  <input type={delFilter.period === 'day' ? 'date' : delFilter.period === 'month' ? 'month' : 'number'} className="p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/20 rounded-2xl text-slate-900 dark:text-white text-xs font-black outline-none" value={delFilter.date} onChange={e => setDelFilter({...delFilter, date: e.target.value})} />
                ) : (
                  <div className="col-span-1 md:col-span-2 lg:col-span-1 grid grid-cols-2 gap-2">
                    <input type="date" className="p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/20 rounded-2xl text-slate-900 dark:text-white text-[10px] font-black outline-none" value={delFilter.startDate} onChange={e => setDelFilter({...delFilter, startDate: e.target.value})} />
                    <input type="date" className="p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/20 rounded-2xl text-slate-900 dark:text-white text-[10px] font-black outline-none" value={delFilter.endDate} onChange={e => setDelFilter({...delFilter, endDate: e.target.value})} />
                  </div>
                )}
              </div>
              <button onClick={handleRunPreview} className="w-full py-5 bg-red-600 text-white font-black text-xs rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] uppercase tracking-[0.2em]">
                <Trash2 className="w-5 h-5" />
                <span>Revisar e Excluir Dados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'holidays' && <HolidaysManager />}
      {activeSubTab === 'cloud' && (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
          {/* Header & Status Card */}
          <div className="bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-black/5 dark:border-white/10 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-black/5 dark:border-white/5">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
                      Firebase Firestore em Tempo Real
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Sincronização bidirecional em tempo real de registros, colaboradores, setores e feriados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {fbStatus.isConfigured ? (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-2" />
                    Tempo Real Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2" />
                    Modo Local Offline
                  </span>
                )}
              </div>
            </div>

            {/* Architecture Guarantees Pills */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center space-x-2 text-blue-500 font-black text-xs uppercase tracking-wide">
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>Nuvem em Tempo Real</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Batidas de ponto e cadastros sincronizam instantaneamente entre todos os dispositivos.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 space-y-2">
                <div className="flex items-center space-x-2 text-purple-500 font-black text-xs uppercase tracking-wide">
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Fotos em Cache Local</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Fotos e logomarca ficam salvas estritamente no cache local deste dispositivo, economizando cota.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-500 font-black text-xs uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Perfis Protegidos</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Administrador (senha: killer) e Perfil de Teste têm garantia permanente contra exclusão.
                </p>
              </div>
            </div>

            {/* Quick snippet importer */}
            <div className="p-6 bg-slate-50 dark:bg-black/40 rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Colar Código / JSON do Firebase Console
                </label>
                <span className="text-[10px] text-blue-500 font-bold">Detecção Automática</span>
              </div>
              <textarea
                rows={3}
                value={fbRawInput}
                onChange={e => setFbRawInput(e.target.value)}
                placeholder='Cole aqui o trecho do Firebase Console: const firebaseConfig = { apiKey: "...", projectId: "..." };'
                className="w-full p-3 font-mono text-xs bg-white dark:bg-slate-950 border border-black/10 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleApplyRawConfig}
                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-all flex items-center space-x-2 active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Preencher Campos Automaticamente</span>
              </button>
            </div>

            {/* Explicit config inputs */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Parâmetros do Projeto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">API Key *</label>
                  <input
                    type="text"
                    value={fbConfig.apiKey || ''}
                    onChange={e => setFbConfig({ ...fbConfig, apiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Project ID *</label>
                  <input
                    type="text"
                    value={fbConfig.projectId || ''}
                    onChange={e => setFbConfig({ ...fbConfig, projectId: e.target.value })}
                    placeholder="meu-ponto-aqui"
                    className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Auth Domain</label>
                  <input
                    type="text"
                    value={fbConfig.authDomain || ''}
                    onChange={e => setFbConfig({ ...fbConfig, authDomain: e.target.value })}
                    placeholder="meu-ponto-aqui.firebaseapp.com"
                    className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Storage Bucket</label>
                  <input
                    type="text"
                    value={fbConfig.storageBucket || ''}
                    onChange={e => setFbConfig({ ...fbConfig, storageBucket: e.target.value })}
                    placeholder="meu-ponto-aqui.appspot.com"
                    className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Messaging Sender ID</label>
                  <input
                    type="text"
                    value={fbConfig.messagingSenderId || ''}
                    onChange={e => setFbConfig({ ...fbConfig, messagingSenderId: e.target.value })}
                    placeholder="1234567890"
                    className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">App ID</label>
                  <input
                    type="text"
                    value={fbConfig.appId || ''}
                    onChange={e => setFbConfig({ ...fbConfig, appId: e.target.value })}
                    placeholder="1:1234567890:web:abcdef"
                    className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Status Message Box */}
            {fbStatus.msg && (
              <div className={`p-4 rounded-2xl flex items-center space-x-3 text-xs font-bold ${
                fbStatus.success === true 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                  : fbStatus.success === false
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}>
                {fbStatus.testing ? (
                  <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
                ) : fbStatus.success === true ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                <span>{fbStatus.msg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                disabled={fbStatus.testing}
                onClick={handleTestFirebase}
                className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
              >
                <Activity className="w-4 h-4 text-blue-500" />
                <span>{fbStatus.testing ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <button
                type="button"
                disabled={fbStatus.testing}
                onClick={handleSaveFirebase}
                className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/30 hover:opacity-95 transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar e Sincronizar</span>
              </button>

              <button
                type="button"
                disabled={syncingAll}
                onClick={handleExportAllToFirebase}
                className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/30 hover:opacity-95 transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
              >
                {syncingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>{syncingAll ? 'Exportando...' : 'Exportar Base Local'}</span>
              </button>
            </div>

            {fbStatus.isConfigured && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleDisconnectFirebase}
                  className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wider transition-colors flex items-center space-x-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Desconectar Firebase Deste Dispositivo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL SCREEN PREVIEW OVERLAY */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="p-8 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl shrink-0">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
                <FileWarning className="w-8 h-8 text-red-500 mr-4" />
                Relatório de Limpeza Estrutural
              </h3>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em] mt-1">Revise os registros afetados antes de confirmar a remoção definitiva</p>
            </div>
            <button onClick={() => setShowPreview(false)} className="p-4 bg-slate-100 dark:bg-white/5 rounded-full text-slate-500 hover:text-red-500 transition-all"><X className="w-8 h-8" /></button>
          </header>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-red-600 p-8 rounded-[3rem] shadow-2xl shadow-red-600/20 text-white">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Total de Registros</p>
                <p className="text-5xl font-black leading-none">{previewRecords.length}</p>
              </div>
              <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-8 rounded-[3rem] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Escopo da Operação</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{delFilter.scope === 'records' ? 'Apenas Histórico de Pontos' : 'Perfis Completos + Histórico'}</p>
                </div>
                <Database className="w-12 h-12 text-slate-200 dark:text-white/5" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {previewRecords.map((r, i) => (
                <div key={i} className="p-6 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-[2rem] flex items-center justify-between hover:border-red-500/30 transition-all animate-in fade-in" style={{ animationDelay: `${Math.min(i * 10, 400)}ms` }}>
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${RECORD_TYPES[r.type]?.color || 'bg-slate-500/10 text-slate-500'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-white font-black text-xs uppercase tracking-tight">{r.empName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{format(new Date(r.timestamp), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full opacity-60">{RECORD_TYPES[r.type]?.label}</div>
                </div>
              ))}
            </div>
          </div>

          <footer className="p-10 bg-slate-50 dark:bg-slate-900/90 border-t border-black/5 dark:border-white/10 backdrop-blur-2xl">
            <button onClick={() => setConfirmModal({ show: true, password: '' })} className="w-full py-8 bg-red-600 hover:bg-red-500 text-white font-black rounded-[2.5rem] shadow-2xl shadow-red-900/50 flex items-center justify-center space-x-4 transition-all active:scale-[0.98] text-xl uppercase tracking-[0.3em]">
              <Trash2 className="w-6 h-6" />
              <span>Confirmar Destruição</span>
              <ChevronRight className="w-6 h-6" />
            </button>
          </footer>
        </div>
      )}

      {/* PASSWORD CHALLENGE MODAL */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3.5rem] p-12 space-y-10 shadow-2xl relative border border-white/10 overflow-hidden">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-red-600/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20 shadow-inner">
                <ShieldAlert className="w-12 h-12 text-red-600 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Autorização Final</h3>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em]">Insira a Senha Mestra do Administrador</p>
              </div>
            </div>
            
            <div className="relative group">
              <input 
                type="password" 
                placeholder="••••" 
                className="w-full p-8 bg-slate-50 dark:bg-black/50 border border-black/5 dark:border-white/5 rounded-3xl text-slate-900 dark:text-white text-center text-6xl tracking-[0.4em] font-black outline-none focus:ring-4 focus:ring-red-600/20 focus:border-red-600 transition-all placeholder:text-slate-200 dark:placeholder:text-white/5" 
                value={confirmModal.password} 
                onChange={e => setConfirmModal({...confirmModal, password: e.target.value})} 
                autoFocus 
              />
            </div>

            <div className="flex flex-col space-y-4">
              <button onClick={runDeletion} className="w-full py-6 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-xl shadow-red-900/30 transition-all active:scale-[0.98] uppercase tracking-[0.2em]">Executar Limpeza</button>
              <button onClick={() => setConfirmModal({ show: false, password: '' })} className="w-full py-4 text-[10px] font-black text-slate-500 uppercase hover:text-slate-900 dark:hover:text-white tracking-[0.3em] transition-colors">Abortar Missão</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ApprovalsManager({ onAction }) {
  const [pendencies, setPendencies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending' or 'all'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all', 'esquecimento', 'retroactive_day', 'medico'
  const [pendingCount, setPendingCount] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  const [rejectModal, setRejectModal] = useState({ show: false, record: null, reason: '' })
  const [approveModal, setApproveModal] = useState({ show: false, record: null })

  useEffect(() => {
    loadPendencies()
  }, [filter, categoryFilter])

  const loadPendencies = async () => {
    try {
      setIsLoading(true)
      const allRecords = await db.records.toArray()
      const totalPending = allRecords.filter(r => 
        r.status === 'pending' && ['medico', 'esquecimento', 'retroactive_day'].includes(r.category)
      ).length
      setPendingCount(totalPending)
      
      let relevant = allRecords.filter(r => 
        ['pending', 'approved', 'rejected'].includes(r.status) &&
        ['medico', 'esquecimento', 'retroactive_day'].includes(r.category)
      )

      if (filter === 'pending') {
        relevant = relevant.filter(r => r.status === 'pending')
      }

      if (categoryFilter !== 'all') {
        relevant = relevant.filter(r => r.category === categoryFilter)
      }
        
      const emps = await db.employees.toArray()
      setPendencies(relevant.map(r => ({
        ...r,
        employeeName: emps.find(e => e.id === r.employeeId)?.name || 'Desconhecido'
      })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)))
    } catch (err) {
      console.error('Failed to load approvals', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async (record, status, reason = '') => {
    if (status === 'approved') {
      if (record.category === 'esquecimento' && record.declaredTime) {
        const [h, m] = record.declaredTime.split(':').map(Number)
        const targetDate = new Date(record.systemTimestamp || record.timestamp)
        targetDate.setHours(h, m, 0, 0)
        await db.records.update(record.id, { 
          status: 'approved',
          timestamp: targetDate.toISOString(),
          approvedAt: new Date().toISOString(),
          approvedBy: 'admin'
        })
      } else {
        await db.records.update(record.id, { 
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: 'admin'
        })
      }

      // Notifica o funcionário sobre a aprovação
      try {
        const notif = {
          employeeId: record.employeeId,
          target: 'employee',
          recordId: record.id,
          type: 'request_approved',
          title: 'Solicitação Deferida (Aprovada)',
          message: `Sua solicitação de ponto para ${format(new Date(record.timestamp), "dd/MM/yyyy 'às' HH:mm")} foi DEFERIDA e integrada ao seu espelho de ponto.`,
          timestamp: new Date().toISOString(),
          read: false
        }
        const notifId = await db.notifications.add(notif)
        await pushDocToFirestore('notifications', notifId, { ...notif, id: notifId })
      } catch (err) {
        console.warn('Erro ao notificar funcionário:', err)
      }
    } else {
      const finalReason = reason.trim() || 'Solicitação indeferida pela gestão.'
      await db.records.update(record.id, { 
        status: 'rejected',
        rejectionReason: finalReason,
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin'
      })

      // Notifica o funcionário sobre o indeferimento com orientação para procurar o RH
      try {
        const notif = {
          employeeId: record.employeeId,
          target: 'employee',
          recordId: record.id,
          type: 'request_rejected',
          title: 'Solicitação Indeferida (Recusada)',
          message: `Sua solicitação de ponto para ${format(new Date(record.timestamp), "dd/MM/yyyy 'às' HH:mm")} foi INDEFERIDA pela gestão. Motivo: "${finalReason}". Por favor, procure o setor de Recursos Humanos (RH) para esclarecimentos e regularização.`,
          rejectionReason: finalReason,
          timestamp: new Date().toISOString(),
          read: false
        }
        const notifId = await db.notifications.add(notif)
        await pushDocToFirestore('notifications', notifId, { ...notif, id: notifId })
      } catch (err) {
        console.warn('Erro ao notificar funcionário:', err)
      }
    }

    const updated = await db.records.get(record.id)
    if (updated) await pushDocToFirestore('records', record.id, updated)
    loadPendencies()
    onAction()
  }

  if (isLoading) return <div className="flex justify-center p-10"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2 border-b border-black/5 dark:border-white/5">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
            <ShieldCheck className="w-8 h-8 mr-3 text-blue-600 shrink-0" />
            <span>Central de Aprovações</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-sm">
            Valide solicitações de pontos esquecidos, inclusões de dias anteriores e atestados médicos.
          </p>
        </div>
        
        {/* Barra de Ações e Filtros Moderna e Alinhada */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Filtro de Status (Pendentes vs Histórico) */}
          <div className="inline-flex p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm">
            <button 
              type="button"
              onClick={() => setFilter('pending')}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filter === 'pending' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-amber-300" />
              <span>Pendentes</span>
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none ${
                  filter === 'pending' ? 'bg-white text-blue-600' : 'bg-red-500 text-white animate-pulse'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button 
              type="button"
              onClick={() => setFilter('all')}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

          {/* Filtro de Categorias (Todos, Esquecidos, Dias Anteriores, Atestados) */}
          <div className="inline-flex p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm overflow-x-auto custom-scrollbar">
            {[
              { id: 'all', label: 'Todos', icon: Layers, activeColor: 'bg-indigo-600 shadow-indigo-600/20' },
              { id: 'esquecimento', label: 'Esquecidos', icon: Clock, activeColor: 'bg-orange-600 shadow-orange-600/20' },
              { id: 'retroactive_day', label: 'Dias Anteriores', icon: Calendar, activeColor: 'bg-purple-600 shadow-purple-600/20' },
              { id: 'medico', label: 'Atestados', icon: FileText, activeColor: 'bg-emerald-600 shadow-emerald-600/20' }
            ].map(cat => {
              const IconComp = cat.icon
              const isActive = categoryFilter === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                    isActive 
                      ? `${cat.activeColor} text-white shadow-lg` 
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {pendencies.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-[3rem] p-24 text-center space-y-6 shadow-sm">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Tudo em dia!</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">Não há solicitações pendentes de aprovação no momento.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {pendencies.map((p, i) => (
            <div key={p.id} className={`bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-sm hover:shadow-xl transition-all animate-in fade-in slide-in-from-bottom-4 ${p.status === 'rejected' ? 'opacity-60 grayscale-[0.2]' : ''}`} style={{ animationDelay: `${i * 50}ms` }}>
              
              {/* Header with Type & Status */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                    p.category === 'esquecimento' ? 'bg-orange-500/10 text-orange-500' :
                    p.category === 'retroactive_day' ? 'bg-indigo-500/10 text-indigo-500' :
                    'bg-purple-500/10 text-purple-500'
                  }`}>
                    {p.category === 'esquecimento' ? <Clock className="w-7 h-7" /> :
                     p.category === 'retroactive_day' ? <Calendar className="w-7 h-7" /> :
                     <Activity className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-tight">{p.employeeName}</h3>
                    <span className={`inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      p.category === 'esquecimento' ? 'bg-orange-500/10 text-orange-600' :
                      p.category === 'retroactive_day' ? 'bg-indigo-500/10 text-indigo-600' :
                      'bg-purple-500/10 text-purple-600'
                    }`}>
                      {p.category === 'esquecimento' ? 'Esquecimento de Ponto' :
                       p.category === 'retroactive_day' ? 'Ponto de Dia Anterior' :
                       'Atestado Médico'}
                    </span>
                  </div>
                </div>

                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${
                  p.status === 'pending' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' :
                  p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                  'bg-red-500/10 text-red-600 border border-red-500/30'
                }`}>
                  {p.status === 'pending' ? 'Pendente' : p.status === 'approved' ? 'Deferido' : 'Indeferido'}
                </span>
              </div>

              {/* Specific Content for Esquecimento (Comparison Box) */}
              {p.category === 'esquecimento' && (
                <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-500/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Horário Declarado</span>
                      <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {p.declaredTime || format(new Date(p.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-orange-400 mx-2 shrink-0" />
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Batida no Sistema</span>
                      <span className="text-lg font-bold font-mono text-slate-500">
                        {format(new Date(p.systemTimestamp || p.timestamp), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Data da ocorrência: <strong>{format(new Date(p.systemTimestamp || p.timestamp), "dd 'de' MMMM", { locale: ptBR })}</strong>
                  </p>
                </div>
              )}

              {/* Specific Content for Retroactive Day */}
              {p.category === 'retroactive_day' && (
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-500/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Data e Horário Lançado</span>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {format(new Date(p.timestamp), 'dd/MM/yyyy')} às {format(new Date(p.timestamp), 'HH:mm')}
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-white dark:bg-black/40 rounded-lg text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10">
                      {RECORD_TYPES[p.type]?.label || p.type}
                    </span>
                  </div>
                  {p.systemTimestamp && (
                    <p className="text-[9px] text-slate-400 font-mono">
                      Solicitado em: {format(new Date(p.systemTimestamp), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  )}
                </div>
              )}

              {/* Photo Thumbnail if Available */}
              {p.photo && (
                <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-black/40 rounded-2xl border border-black/5 dark:border-white/5">
                  <div 
                    onClick={() => setSelectedPhoto(p.photo)}
                    className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer hover:opacity-80 transition-opacity border border-black/10 dark:border-white/10 shrink-0 relative group"
                  >
                    <img src={p.photo} alt="Comprovante" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Foto / Comprovante Anexo</p>
                    <p className="text-[10px] text-slate-400">Clique na miniatura para ampliar</p>
                  </div>
                </div>
              )}
              
              {/* Justification Comment */}
              <div className="bg-slate-50 dark:bg-black/40 p-5 rounded-2xl border border-black/5 dark:border-white/5">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Justificativa</p>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed italic break-words">
                  "{p.comment || 'Nenhum comentário fornecido.'}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {p.status !== 'approved' && (
                  <button 
                    onClick={() => setApproveModal({ show: true, record: p })}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Deferir (Aprovar)</span>
                  </button>
                )}
                {p.status !== 'rejected' && (
                  <button 
                    onClick={() => setRejectModal({ show: true, record: p, reason: '' })}
                    className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center space-x-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{p.status === 'pending' ? 'Indeferir (Recusar)' : 'Indeferir Novamente'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-md w-full bg-slate-900 rounded-[2.5rem] p-6 border border-white/10 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-white uppercase tracking-widest">Visualização da Captura</h4>
              <button onClick={() => setSelectedPhoto(null)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden aspect-square border border-white/10 bg-black">
              <img src={selectedPhoto} alt="Ampliada" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modal Customizado de Indeferimento com Justificativa */}
      {rejectModal.show && (
        <div 
          className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRejectModal({ show: false, record: null, reason: '' })}
        >
          <div 
            className="relative max-w-lg w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-red-500/20 shadow-2xl space-y-5 animate-in zoom-in duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0 border border-red-500/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Indeferir Solicitação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Colaborador: {rejectModal.record?.employeeName}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setRejectModal({ show: false, record: null, reason: '' })}
                className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-black/5 dark:border-white/5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Data / Horário Declarado:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                  {rejectModal.record && format(new Date(rejectModal.record.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Justificativa do Colaborador:</span>
                <span className="italic text-slate-600 dark:text-slate-300 text-right truncate max-w-[240px]">
                  "{rejectModal.record?.comment || 'Sem justificativa informada'}"
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">
                Motivo do Indeferimento (orientará o colaborador)
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Horário incompatível com a jornada; ausência de comprovação; favor procurar o RH..."
                value={rejectModal.reason}
                onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-500/20 rounded-2xl text-[11px] text-red-700 dark:text-red-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Impacto no painel do colaborador:</span>
              </p>
              <p className="text-[10px] leading-relaxed text-red-600/90 dark:text-red-400">
                O colaborador receberá uma notificação com o motivo e a orientação para procurar o RH. O recibo gerado ficará com a marca d'água cruzada <strong>INDEFERIDO</strong>.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ show: false, record: null, reason: '' })}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAction(rejectModal.record, 'rejected', rejectModal.reason)
                  setRejectModal({ show: false, record: null, reason: '' })
                }}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 active:scale-95"
              >
                Confirmar Indeferimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Customizado de Deferimento */}
      {approveModal.show && (
        <div 
          className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setApproveModal({ show: false, record: null })}
        >
          <div 
            className="relative max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-emerald-500/20 shadow-2xl space-y-5 animate-in zoom-in duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Deferir Solicitação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {approveModal.record?.employeeName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Deseja aprovar este registro de ponto e integrá-lo oficialmente à folha do colaborador? O colaborador será notificado sobre o deferimento.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModal({ show: false, record: null })}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAction(approveModal.record, 'approved')
                  setApproveModal({ show: false, record: null })
                }}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                Confirmar Deferimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AboutManager() {
  const handleDownloadManual = () => {
    const doc = new jsPDF()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('Manual do Sistema PontoAqui', 20, 20)
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Versão 1.0 Premium Edition', 20, 30)
    
    doc.setDrawColor(59, 130, 246)
    doc.line(20, 35, 190, 35)
    
    const content = [
      ['1. Registro de Ponto', 'Colaboradores usam PIN ou Biometria na tela inicial.'],
      ['2. Aprovações', 'Atestados médicos e registros fora da cerca virtual ficam pendentes.'],
      ['3. Relatórios', 'Gere extratos detalhados com filtros por colaborador ou período.'],
      ['4. Cerca Virtual', 'Configure o raio de alcance permitido na aba Preferências.'],
      ['Legislação', 'Atende ao Artigo 74, § 2º da CLT para até 20 funcionários.']
    ]
    
    autoTable(doc, {
      startY: 45,
      head: [['Módulo', 'Descrição']],
      body: content,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    })
    
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 150
    doc.text('Desenvolvido por: Leandro Oliveira Lima', 20, finalY + 20)
    doc.text('Site: www.leandroyata.com.br', 20, finalY + 30)
    
    doc.save('Manual_PontoAqui.pdf')
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Sobre o Ponto<span className="text-blue-600">Aqui</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Informações do sistema, manual e créditos do desenvolvedor.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {/* Manual Section */}
          <div className="bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-black/5 dark:border-white/10 shadow-sm space-y-10">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
              <BookOpen className="w-6 h-6 mr-3 text-blue-500" />
              Manual Rápido do Sistema
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Registro de Ponto', desc: 'Colaboradores usam PIN ou Biometria na tela inicial. O sistema captura foto e localização GPS.', color: 'bg-blue-500' },
                { title: 'Aprovações', desc: 'Atestados médicos e registros fora da cerca virtual ficam pendentes para análise do gestor.', color: 'bg-amber-500' },
                { title: 'Relatórios', desc: 'Gere extratos detalhados com filtros por colaborador, setor ou período.', color: 'bg-emerald-500' },
                { title: 'Cerca Virtual', desc: 'Configure o raio de alcance permitido para registros na aba Preferências.', color: 'bg-purple-500' }
              ].map((item, i) => (
                <div key={i} className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/10">
                  <div className={`w-10 h-1 ${item.color} rounded-full mb-4`} />
                  <h4 className="font-black text-sm text-slate-900 dark:text-white mb-2">{item.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-[2.5rem] space-y-4">
              <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center">
                <ShieldAlert className="w-4 h-4 mr-2" /> Compliance & Legislação
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-justify">
                O sistema PontoAqui foi projetado para atender aos requisitos de estabelecimentos com <strong>até 20 colaboradores</strong>, conforme o <strong>Artigo 74, § 2º da CLT</strong> (Redação dada pela Lei nº 13.874/2019). Esta legislação dispensa a obrigatoriedade de registro de ponto eletrônico complexo para empresas abaixo deste limite, permitindo o uso de sistemas simplificados e seguros de controle de jornada.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Developer Card */}
          <div className="bg-slate-900 dark:bg-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
            
            <div className="relative z-10 space-y-6">
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Desenvolvido por</p>
                <h3 className="text-2xl font-black text-white dark:text-slate-900 leading-tight">Leandro Oliveira Lima</h3>
              </div>

              <div className="flex flex-nowrap justify-center gap-2 pt-4 overflow-x-auto pb-2">
                {[
                  { icon: Mail, link: 'mailto:leandroayata07@hotmail.com', color: 'bg-blue-600', label: 'E-mail' },
                  { icon: MessageCircle, link: 'https://wa.me/5575991902534', color: 'bg-emerald-600', label: 'WhatsApp' },
                  { 
                    svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>, 
                    link: 'https://www.instagram.com/leandroyata07_/', 
                    color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600', 
                    label: 'Instagram' 
                  },
                  { 
                    svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>, 
                    link: 'https://www.linkedin.com/in/leandro-oliveira-lima-27140149/', 
                    color: 'bg-blue-700', 
                    label: 'LinkedIn' 
                  },
                  { icon: Globe, link: 'http://www.leandroyata.com.br', color: 'bg-slate-600', label: 'Site' }
                ].map((social, i) => (
                  <a 
                    key={i} 
                    href={social.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`${social.color} p-3 rounded-xl text-white shadow-lg hover:scale-110 active:scale-95 transition-all group/icon relative shrink-0`}
                    title={social.label}
                  >
                    {social.icon ? <social.icon className="w-4 h-4" /> : social.svg}
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-[8px] font-black uppercase px-2 py-1 rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {social.label}
                    </span>
                  </a>
                ))}
              </div>

              <div className="pt-6 border-t border-white/10 dark:border-black/5 text-center space-y-1">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                  © 2026 PontoAqui.
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                  Todos os direitos reservados.
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                  Versão 1.0 Premium Edition
                </p>
              </div>
            </div>
          </div>

          <div 
            onClick={handleDownloadManual}
            className="p-8 bg-blue-600 rounded-[2.5rem] shadow-xl shadow-blue-600/20 flex items-center space-x-6 text-white group cursor-pointer hover:bg-blue-500 transition-all"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Manual PDF</p>
              <p className="text-sm font-bold">Baixar Guia Completo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HolidaysManager() {
  const [holidays, setHolidays] = useState([])
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'municipal' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadHolidays()
  }, [])

  const loadHolidays = async () => {
    const all = await db.holidays.orderBy('date').toArray()
    setHolidays(all)
  }

  const fetchNationalHolidays = async () => {
    setLoading(true)
    const year = new Date().getFullYear()
    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
      if (!response.ok) throw new Error('Falha na API')
      const data = await response.json()
      
      for (const h of data) {
        const exists = await db.holidays.where('date').equals(h.date).first()
        if (!exists) {
          const hid = await db.holidays.add({
            date: h.date,
            name: h.name,
            type: 'national'
          })
          await pushDocToFirestore('holidays', hid, { id: hid, date: h.date, name: h.name, type: 'national' })
        }
      }
      await loadHolidays()
      alert('Feriados nacionais importados com sucesso!')
    } catch (err) {
      alert('Erro ao buscar feriados nacionais.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newHoliday.date || !newHoliday.name) return
    const hid = await db.holidays.add(newHoliday)
    await pushDocToFirestore('holidays', hid, { id: hid, ...newHoliday })
    setNewHoliday({ date: '', name: '', type: 'municipal' })
    await loadHolidays()
  }

  const handleDelete = async (id) => {
    await db.holidays.delete(id)
    await deleteDocFromFirestore('holidays', id)
    await loadHolidays()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-slate-900 p-8 lg:p-12 rounded-[3rem] border border-black/5 dark:border-white/10 shadow-sm space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
              <div className="w-2 h-6 bg-blue-600 rounded-full mr-3" />
              Gestão de Feriados
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Configure datas com 100% de adicional</p>
          </div>
          <button 
            onClick={fetchNationalHolidays}
            disabled={loading}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 text-[10px] uppercase tracking-widest transition-all flex items-center"
          >
            {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Importar Feriados Nacionais {new Date().getFullYear()}
          </button>
        </div>

        <div className="p-8 bg-slate-50 dark:bg-black/40 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-6">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Cadastrar Feriado Local (Municipal/Estadual)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="date" className="p-4 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} />
            <input type="text" placeholder="Nome do Feriado" className="p-4 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} />
            <button onClick={handleAdd} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl uppercase tracking-widest text-[10px] hover:scale-[1.02] transition-all active:scale-95">Adicionar</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datas Cadastradas</span>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{holidays.length} feriados</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between p-6 bg-white dark:bg-slate-800/50 rounded-3xl border border-black/5 dark:border-white/5 group hover:border-blue-500/30 transition-all">
                <div className="flex items-center space-x-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[10px] ${h.type === 'national' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {h.type === 'national' ? 'NAC' : 'LOC'}
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{h.name}</h5>
                    <p className="text-[10px] font-mono text-slate-500 font-bold">{format(new Date(h.date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(h.id)} className="p-3 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {holidays.length === 0 && (
              <div className="text-center py-20 bg-slate-50 dark:bg-black/20 rounded-[3rem] border border-dashed border-slate-200 dark:border-white/5">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum feriado cadastrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
