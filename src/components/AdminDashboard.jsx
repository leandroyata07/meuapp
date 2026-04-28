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
  Clock as ClockIcon,
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
  Monitor
} from 'lucide-react'
import { format, subMonths, isBefore, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, differenceInDays } from 'date-fns'

const RECORD_TYPES = {
  check_in: { label: 'ENTRADA', color: 'bg-emerald-500/10 text-emerald-500' },
  lunch_out: { label: 'ALMOÇO (SAÍDA)', color: 'bg-orange-500/10 text-orange-500' },
  lunch_in: { label: 'ALMOÇO (RETORNO)', color: 'bg-blue-500/10 text-blue-500' },
  check_out: { label: 'SAÍDA DEFINITIVA', color: 'bg-red-500/10 text-red-500' },
  other_out: { label: 'SAÍDA EXTRA', color: 'bg-purple-500/10 text-purple-500' },
  other_in: { label: 'RETORNO EXTRA', color: 'bg-indigo-500/10 text-indigo-500' },
  system_auto_checkout: { label: 'SAÍDA AUTOMÁTICA', color: 'bg-red-500/10 text-red-500' },
  admin_absence: { label: 'FALTA NÃO JUSTIFICADA', color: 'bg-red-900/30 text-red-400 border border-red-500/30' },
  admin_excused: { label: 'ATESTADO MÉDICO/FÉRIAS', color: 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' }
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const navigate = useNavigate()

  useEffect(() => {
    if (!sessionStorage.getItem('isAdmin')) {
      navigate({ to: '/admin' })
    }
  }, [])

  const logout = () => {
    sessionStorage.removeItem('isAdmin')
    navigate({ to: '/' })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-200">
      <header className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-slate-100 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin <span className="text-blue-500 font-black">PontoAqui</span></h1>
        <button onClick={logout} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors bg-black/5 dark:bg-white/5 rounded-lg">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <nav className="flex space-x-2 p-1.5 bg-black/5 dark:bg-white/5 rounded-2xl sticky top-0 z-20 backdrop-blur-xl border border-black/5 dark:border-white/5">
          {[
            { id: 'dashboard', label: 'Painel', icon: Activity },
            { id: 'employees', label: 'Equipe', icon: Users },
            { id: 'reports', label: 'Relatórios', icon: FileText },
            { id: 'settings', label: 'Ajustes', icon: Settings }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition-all duration-300 ${activeTab === tab.id ? 'bg-blue-600 text-slate-900 dark:text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-black/5 dark:bg-white/5'}`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'dashboard' && <OverviewManager />}
          {activeTab === 'employees' && <EmployeeManager />}
          {activeTab === 'reports' && <ReportsManager />}
          {activeTab === 'settings' && <SettingsManager />}
        </div>
      </div>
    </div>
  )
}

function OverviewManager() {
  const [stats, setStats] = useState({ present: 0, lunch: 0, absent: 0, finished: 0, total: 0 })
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    loadDashboard()
    const timer = setInterval(loadDashboard, 60000) // Update every minute
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
      const empRecords = allRecordsToday.filter(r => r.employeeId === emp.id).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
      if (empRecords.length === 0) {
        absent++
      } else {
        const lastRecordType = empRecords[0].type
        if (['check_in', 'lunch_in', 'other_in'].includes(lastRecordType)) present++
        else if (['lunch_out', 'other_out'].includes(lastRecordType)) lunch++
        else if (['check_out', 'system_auto_checkout'].includes(lastRecordType)) finished++
      }
    })

    setStats({ present, lunch, absent, finished, total: allEmps.length })

    const recent = allRecordsToday.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5)
    setRecentActivity(recent.map(r => ({ ...r, empName: allEmps.find(e => e.id === r.employeeId)?.name || '?' })))
  }

  const getPercentage = (val) => stats.total === 0 ? 0 : Math.round((val / stats.total) * 100)

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-end px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center"><PieChart className="w-7 h-7 mr-3 text-blue-500" />Visão Geral</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Status em Tempo Real</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
          <UserCheck className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats.present}</p>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Trabalhando</p>
        </div>
        <div className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-orange-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
          <Coffee className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats.lunch}</p>
          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Em Pausa</p>
        </div>
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats.finished}</p>
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Já Saíram</p>
        </div>
        <div className="p-5 bg-slate-200 dark:bg-slate-800/50 border border-slate-700/50 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
          <UserX className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats.absent}</p>
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ausentes</p>
        </div>
      </div>

      <div className="bg-black/5 dark:bg-white/5 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Progresso do Dia</h3>
          <span className="text-xs font-bold text-blue-400">{getPercentage(stats.present + stats.lunch + stats.finished)}% Presentes</span>
        </div>
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
          <div style={{ width: `${getPercentage(stats.present)}%` }} className="bg-blue-500 h-full transition-all duration-1000" />
          <div style={{ width: `${getPercentage(stats.lunch)}%` }} className="bg-orange-500 h-full transition-all duration-1000" />
          <div style={{ width: `${getPercentage(stats.finished)}%` }} className="bg-emerald-500 h-full transition-all duration-1000" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2">Atividade Recente</h3>
        {recentActivity.length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-4">Nenhum registro hoje.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((r, i) => {
              const typeConfig = RECORD_TYPES[r.type] || { label: '?', color: 'bg-slate-500' }
              return (
                <div key={i} className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex justify-between items-center animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                  <div>
                    <p className="text-slate-900 dark:text-white font-bold">{r.empName}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{format(new Date(r.timestamp), 'HH:mm:ss')}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${typeConfig.color}`}>
                    {typeConfig.label}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmployeeManager() {
  const [employees, setEmployees] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newEmp, setNewEmp] = useState({ name: '', pin: '', startDate: format(new Date(), 'yyyy-MM-dd'), photo: '', cpf: '' })

  const load = async () => { setEmployees(await db.employees.toArray()) }
  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newEmp.name || !newEmp.pin) return
    await db.employees.add(newEmp)
    setNewEmp({ name: '', pin: '', startDate: format(new Date(), 'yyyy-MM-dd'), photo: '', cpf: '' })
    setShowAdd(false)
    load()
  }

  const handleDelete = async (id) => {
    if (confirm('Deseja excluir este funcionário?')) {
      await db.employees.delete(id)
      load()
    }
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setNewEmp({ ...newEmp, photo: reader.result })
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
      alert('Biometria cadastrada com sucesso!');
      load();
    } catch (err) {
      console.error(err);
      alert('Falha ao cadastrar biometria. Verifique as permissões do navegador ou se cancelou a operação.');
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center"><Users className="w-6 h-6 mr-2 text-blue-500" />Gestão de Pessoal</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-blue-600 hover:bg-blue-500 p-2.5 rounded-xl text-slate-900 dark:text-white transition-all shadow-lg active:scale-90">{showAdd ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}</button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[2.5rem] space-y-6 animate-in slide-in-from-top-4 duration-500 backdrop-blur-md">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-black/5 dark:border-white/5 flex items-center justify-center overflow-hidden shadow-2xl transition-all group-hover:border-blue-500/30">
                {newEmp.photo ? <img src={newEmp.photo} alt="Preview" className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-slate-600" />}
              </div>
              <label className="absolute bottom-1 right-1 p-2.5 bg-blue-600 rounded-full cursor-pointer hover:bg-blue-500 shadow-xl transition-transform hover:scale-110 active:scale-95"><Upload className="w-4 h-4 text-slate-900 dark:text-white" /><input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label>
            </div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Foto do Funcionário</p>
          </div>

          <div className="space-y-4">
            <input type="text" placeholder="Nome Completo" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Senha (4 dígitos)" maxLength="4" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-center font-black tracking-widest" value={newEmp.pin} onChange={e => setNewEmp({...newEmp, pin: e.target.value})} required />
              <input type="text" placeholder="CPF" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={newEmp.cpf} onChange={e => setNewEmp({...newEmp, cpf: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98]">CADASTRAR AGORA</button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3">
        {employees.map(emp => (
          <div key={emp.id} className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-blue-500/20 rounded-[1.5rem] flex items-center justify-between group transition-all backdrop-blur-sm">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 border border-black/10 dark:border-white/10 overflow-hidden shadow-inner">{emp.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-slate-600 mx-auto mt-4" />}</div>
              <div><p className="text-slate-900 dark:text-white font-black text-sm tracking-tight">{emp.name}</p><div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono"><ShieldAlert className="w-3 h-3 text-blue-500" /><span>PIN: {emp.pin}</span></div></div>
            </div>
            <div className="flex items-center">
              <button onClick={() => registerBiometrics(emp)} className={`p-3 transition-all rounded-xl opacity-0 group-hover:opacity-100 scale-90 hover:scale-100 mr-2 ${emp.biometricId ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10'}`} title={emp.biometricId ? "Biometria Ativada. Clique para sobrescrever." : "Ativar Biometria (FaceID/TouchID)"}><Fingerprint className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(emp.id)} className="p-3 text-slate-600 hover:text-red-500 transition-all bg-black/5 dark:bg-white/5 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportsManager() {
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState({ employeeId: '', period: 'day', date: format(new Date(), 'yyyy-MM-dd'), month: format(new Date(), 'yyyy-MM') })
  const [employees, setEmployees] = useState([])
  const [calculatedHours, setCalculatedHours] = useState(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualEntryData, setManualEntryData] = useState({
    employeeId: '',
    type: 'admin_excused',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    comment: ''
  })

  useEffect(() => {
    db.employees.toArray().then(setEmployees)
    loadRecords()
  }, [filter])

  const calculateTotalTime = (empRecords) => {
    const sorted = [...empRecords].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp))
    let totalMs = 0
    let isWorking = false
    let lastStart = null

    sorted.forEach(r => {
      if (['check_in', 'lunch_in', 'other_in'].includes(r.type)) {
        if (!isWorking) {
          isWorking = true
          lastStart = new Date(r.timestamp)
        }
      } else if (['lunch_out', 'other_out', 'check_out', 'system_auto_checkout'].includes(r.type)) {
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
    setRecords(filtered.map(r => ({ ...r, employeeName: emps.find(e => e.id === r.employeeId)?.name || 'Excluído' })))

    if (filter.employeeId && filtered.length > 0) {
      setCalculatedHours(calculateTotalTime(filtered))
    } else {
      setCalculatedHours(null)
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
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 500)
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
    setShowManualEntry(false)
    setManualEntryData({...manualEntryData, comment: ''})
    loadRecords()
    alert(`${newRecords.length} registro(s) inserido(s) com sucesso.`)
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
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center"><FileText className="w-6 h-6 mr-2 text-blue-500" />Relatórios Históricos</h2>
        <div className="flex items-center space-x-2">
          <button onClick={() => setShowManualEntry(!showManualEntry)} className="flex items-center space-x-2 text-[10px] font-black bg-blue-600/20 text-blue-400 px-4 py-2.5 rounded-xl hover:bg-blue-600/30 transition-all uppercase tracking-widest"><Plus className="w-4 h-4" /><span>Lançar Falta/Atestado</span></button>
          <button onClick={handlePrint} disabled={records.length === 0 || !filter.employeeId || filter.period !== 'month'} className="flex items-center space-x-2 text-[10px] font-black bg-purple-600/20 text-purple-400 px-4 py-2.5 rounded-xl hover:bg-purple-600/30 transition-all disabled:opacity-20 uppercase tracking-widest" title={!filter.employeeId || filter.period !== 'month' ? "Selecione 1 funcionário e o filtro 'Mês'" : ""}><Printer className="w-4 h-4" /><span>Gerar Espelho</span></button>
          <button onClick={exportCSV} disabled={records.length === 0} className="flex items-center space-x-2 text-[10px] font-black bg-emerald-600/20 text-emerald-400 px-4 py-2.5 rounded-xl hover:bg-emerald-600/30 transition-all disabled:opacity-20 uppercase tracking-widest"><Download className="w-4 h-4" /><span>Exportar</span></button>
        </div>
      </div>
      
      {showManualEntry && (
        <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-[1.5rem] space-y-4 animate-in fade-in slide-in-from-top-2 mb-6">
          <h3 className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">Ajuste Manual de Ponto (Atestados e Faltas)</h3>
          <div className="grid grid-cols-2 gap-3">
            <select className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={manualEntryData.employeeId} onChange={e => setManualEntryData({...manualEntryData, employeeId: e.target.value})}><option value="">Selecionar Funcionário</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            <select className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={manualEntryData.type} onChange={e => setManualEntryData({...manualEntryData, type: e.target.value})}><option value="admin_excused">Atestado Médico / Férias</option><option value="admin_absence">Falta Injustificada</option></select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">Data Inicial</label><input type="date" className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={manualEntryData.startDate} onChange={e => setManualEntryData({...manualEntryData, startDate: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">Data Final</label><input type="date" className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={manualEntryData.endDate} onChange={e => setManualEntryData({...manualEntryData, endDate: e.target.value})} /></div>
          </div>
          <div className="space-y-1"><label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">Motivo / Descrição</label><input type="text" placeholder="Ex: Atestado CID J01, Férias..." className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl p-3 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={manualEntryData.comment} onChange={e => setManualEntryData({...manualEntryData, comment: e.target.value})} /></div>
          <div className="flex space-x-2 pt-2">
            <button onClick={handleManualEntry} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-black rounded-xl text-sm transition-all">Confirmar Lançamento</button>
            <button onClick={() => setShowManualEntry(false)} className="px-5 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 text-slate-900 dark:text-white font-black rounded-xl text-sm transition-all">Cancelar</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <select className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filter.employeeId} onChange={e => setFilter({...filter, employeeId: e.target.value})}><option value="">Todos os Funcionários</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <div className="flex space-x-2">
          <select className="w-1/3 bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filter.period} onChange={e => setFilter({...filter, period: e.target.value})}>
            <option value="day">Dia</option>
            <option value="month">Mês</option>
          </select>
          {filter.period === 'day' ? (
            <input type="date" className="w-2/3 bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filter.date} onChange={e => setFilter({...filter, date: e.target.value})} />
          ) : (
            <input type="month" className="w-2/3 bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})} />
          )}
        </div>
      </div>

      {calculatedHours && (
        <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-[1.5rem] flex justify-between items-center animate-in zoom-in duration-300">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Cálculo de Horas do Dia</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{calculatedHours.hours}<span className="text-sm font-bold text-slate-500 dark:text-slate-400 mx-1">h</span>{calculatedHours.minutes}<span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-1">m</span></p>
          </div>
          {calculatedHours.isWorking && (
            <div className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-2xl animate-pulse tracking-widest border border-emerald-500/30">
              Jornada Ativa
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 pb-10">
        {records.map(r => {
          const config = RECORD_TYPES[r.type] || { label: '?', color: 'bg-slate-500' }
          return (
            <div key={r.id} className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-black/10 dark:border-white/10 rounded-2xl flex justify-between items-center transition-all animate-in fade-in">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <p className="text-slate-900 dark:text-white font-bold">{r.employeeName}</p>
                  {r.location && (
                    <a href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 bg-blue-500/10 p-1 rounded-full transition-colors" title="Ver Localização">
                      <MapPin className="w-3 h-3" />
                    </a>
                  )}
                  {r.photo && (
                    <div className="relative group z-10">
                      <button className="text-purple-400 hover:text-purple-300 bg-purple-500/10 p-1 rounded-full transition-colors" title="Ver Foto">
                        <Camera className="w-3 h-3" />
                      </button>
                      <div className="absolute top-full left-0 mt-2 hidden group-hover:block z-50 animate-in fade-in zoom-in duration-200">
                        <div className="bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 p-2 rounded-2xl shadow-2xl">
                          <img src={r.photo} alt="Selfie" className="w-32 h-32 object-cover rounded-xl" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono tracking-tighter uppercase"><span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {format(new Date(r.timestamp), 'dd/MM/yyyy')}</span><span className="flex items-center"><ClockIcon className="w-3 h-3 mr-1" /> {format(new Date(r.timestamp), 'HH:mm')}</span></div>
                {r.comment && <div className="text-[10px] text-blue-400 italic bg-blue-500/5 px-2 py-1 rounded w-fit">{r.comment}</div>}
              </div>
              <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${config.color}`}>{config.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SettingsManager() {
  const [settings, setSettings] = useState({ companyName: '', workingHours: '', adminPassword: '' })
  const [stats, setStats] = useState({ employees: 0, records: 0, dbSize: '...' })
  const [employees, setEmployees] = useState([])
  const [activeSubTab, setActiveSubTab] = useState('general')
  const [themeMode, setThemeMode] = useState(localStorage.getItem('theme') || 'dark')
  
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
    if (confirmModal.password !== settings.adminPassword) { alert('Senha incorreta!'); return }
    await db.records.bulkDelete(previewRecords.map(r => r.id))
    if (delFilter.scope === 'employee' && delFilter.employeeId) await db.employees.delete(Number(delFilter.employeeId))
    alert('Operação concluída!'); window.location.reload()
  }

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-xl font-black text-slate-900 dark:text-white px-1 flex items-center"><Settings className="w-6 h-6 mr-2 text-blue-500" />Configurações do Sistema</h2>

      <div className="flex space-x-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
        {['general', 'security', 'data'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveSubTab(tab)} 
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSubTab === tab ? 'bg-black/10 dark:bg-white/10 text-blue-400 shadow-inner' : 'text-slate-500 hover:text-slate-900 dark:text-white'}`}
          >
            {tab === 'general' ? 'Geral' : tab === 'security' ? 'Segurança' : 'Dados'}
          </button>
        ))}
      </div>

      {activeSubTab === 'general' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-black/5 dark:bg-white/5 p-6 rounded-[2rem] border border-black/10 dark:border-white/10 space-y-5 backdrop-blur-md">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Nome da Instituição</label><input className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Senha Mestra Admin</label><input type="password" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={settings.adminPassword} onChange={e => setSettings({...settings, adminPassword: e.target.value})} /></div>
            
            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Aparência do Sistema</label>
              <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                {[ { id: 'light', icon: Sun, label: 'Claro' }, { id: 'dark', icon: Moon, label: 'Escuro' }, { id: 'system', icon: Monitor, label: 'Sistema' } ].map(t => (
                  <button key={t.id} onClick={() => handleThemeChange(t.id)} className={`flex-1 py-3 rounded-xl flex flex-col items-center justify-center transition-all ${themeMode === t.id ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                    <t.icon className="w-5 h-5 mb-1" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => { db.settings.put({...settings, id: 'config'}); alert('Configurações Salvas!') }} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-black rounded-2xl shadow-lg transition-all active:scale-95">SALVAR ALTERAÇÕES</button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[ { label: 'Equipe', val: stats.employees, icon: Users }, { label: 'Pontos', val: stats.records, icon: FileText }, { label: 'Banco', val: stats.dbSize, icon: Database } ].map((s, i) => (
              <div key={i} className="bg-black/5 dark:bg-white/5 p-4 rounded-3xl border border-black/5 dark:border-white/5 text-center backdrop-blur-sm group hover:border-blue-500/30 transition-all">
                <s.icon className="w-5 h-5 mx-auto mb-2 text-blue-500/50 group-hover:text-blue-500 transition-colors" />
                <p className="text-slate-900 dark:text-white font-black text-lg leading-none">{s.val}</p>
                <p className="text-[8px] text-slate-600 uppercase font-black tracking-tighter mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-black/5 dark:bg-white/5 p-6 rounded-[2rem] border border-black/10 dark:border-white/10 space-y-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold">Cerca Virtual (Geofencing)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Restringir o registro de ponto a uma área específica.</p>
              </div>
              <button 
                onClick={() => setSettings({...settings, geofenceEnabled: !settings.geofenceEnabled})}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.geofenceEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.geofenceEnabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {settings.geofenceEnabled && (
              <div className="space-y-4 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Latitude Central</label><input type="number" step="any" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={settings.geofenceLat || ''} onChange={e => setSettings({...settings, geofenceLat: e.target.value})} placeholder="-23.550520" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Longitude Central</label><input type="number" step="any" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={settings.geofenceLng || ''} onChange={e => setSettings({...settings, geofenceLng: e.target.value})} placeholder="-46.633308" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Raio Permitido (Metros)</label><input type="number" className="w-full p-4 bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={settings.geofenceRadius || ''} onChange={e => setSettings({...settings, geofenceRadius: e.target.value})} placeholder="50" /></div>
                <button onClick={() => {
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(pos => {
                      setSettings({...settings, geofenceLat: pos.coords.latitude, geofenceLng: pos.coords.longitude})
                    })
                  }
                }} className="w-full py-3 text-[10px] font-black text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl uppercase tracking-widest transition-colors">
                  Obter Minha Localização Atual
                </button>
              </div>
            )}
            <button onClick={() => { db.settings.put({...settings, id: 'config'}); alert('Configurações Salvas!') }} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-black rounded-2xl shadow-lg transition-all active:scale-95">SALVAR ALTERAÇÕES</button>
          </div>
        </div>
      )}

      {activeSubTab === 'data' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-black/5 dark:bg-white/5 p-6 rounded-[2rem] border border-black/10 dark:border-white/10 space-y-8 backdrop-blur-md">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] px-1">Salvaguarda Local</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleBackup} className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex flex-col items-center group hover:bg-emerald-500/20 transition-all"><Download className="w-6 h-6 text-emerald-500 mb-2 group-hover:-translate-y-1 transition-transform" /><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Exportar JSON</span></button>
                <label className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex flex-col items-center group hover:bg-blue-500/20 transition-all cursor-pointer"><Upload className="w-6 h-6 text-blue-500 mb-2 group-hover:-translate-y-1 transition-transform" /><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Restaurar</span><input type="file" accept=".json" className="hidden" onChange={handleImport} /></label>
              </div>
            </div>

            <div className="space-y-5 pt-6 border-t border-black/5 dark:border-white/5">
              <h3 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] px-1">Gestão Avançada de Dados</h3>
              <div className="bg-black/30 p-5 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-5">
                <div className="space-y-2"><label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Filtro de Funcionário</label><select className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none appearance-none" value={delFilter.employeeId} onChange={e => setDelFilter({...delFilter, employeeId: e.target.value})}><option value="">Todos os Funcionários</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">O que apagar?</label><select className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none" value={delFilter.scope} onChange={e => setDelFilter({...delFilter, scope: e.target.value})}><option value="records">Apenas Pontos</option><option value="employee">Perfil + Pontos</option></select></div>
                  <div className="space-y-2"><label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Período</label><select className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm outline-none" value={delFilter.period} onChange={e => setDelFilter({...delFilter, period: e.target.value})}><option value="day">Dia</option><option value="month">Mês</option><option value="year">Ano</option><option value="custom">Customizado</option></select></div>
                </div>
                {delFilter.period === 'custom' ? (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <input type="date" className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-xs" value={delFilter.startDate} onChange={e => setDelFilter({...delFilter, startDate: e.target.value})} />
                    <input type="date" className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-xs" value={delFilter.endDate} onChange={e => setDelFilter({...delFilter, endDate: e.target.value})} />
                  </div>
                ) : (
                  <input type={delFilter.period === 'day' ? 'date' : delFilter.period === 'month' ? 'month' : 'number'} className="w-full bg-slate-100 dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white text-sm" value={delFilter.date} onChange={e => setDelFilter({...delFilter, date: e.target.value})} />
                )}
                <button onClick={handleRunPreview} className="w-full py-5 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-black text-xs rounded-2xl border border-red-500/30 flex items-center justify-center space-x-2 transition-all">
                  <Trash className="w-4 h-4" /><span>REVISAR E EXCLUIR FILTRADOS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'cloud' && (
        <div className="animate-in fade-in duration-500">
          <div className="bg-black/5 dark:bg-white/5 p-10 rounded-[2.5rem] border border-black/10 dark:border-white/10 text-center space-y-8 backdrop-blur-md overflow-hidden relative">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <Cloud className="w-12 h-12 text-blue-500/50 animate-pulse" />
              <div className="absolute inset-0 border-2 border-dashed border-blue-500/20 rounded-full animate-spin-slow" />
            </div>
            <div className="space-y-3">
              <h3 className="text-slate-900 dark:text-white font-black text-xl uppercase tracking-tighter">Backup em Nuvem</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[280px] mx-auto uppercase font-bold tracking-widest opacity-60">Sincronização profissional segura para seus dados críticos.</p>
            </div>
            <div className="space-y-4">
              <button className="w-full p-5 bg-white text-black font-black rounded-3xl text-[10px] flex items-center justify-center space-x-4 shadow-xl hover:bg-slate-200 transition-all uppercase tracking-[0.2em]"><img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="G" /><span>Conectar Google Drive</span></button>
              <button className="w-full p-5 bg-blue-600 text-slate-900 dark:text-white font-black rounded-3xl text-[10px] flex items-center justify-center space-x-4 shadow-xl shadow-blue-900/20 hover:bg-blue-500 transition-all uppercase tracking-[0.2em]"><Cloud className="w-4 h-4" /><span>Conectar OneDrive</span></button>
            </div>
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest animate-pulse mt-4">Pronto para Conexão</p>
          </div>
        </div>
      )}

      {/* FULL SCREEN PREVIEW OVERLAY */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-slate-100 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
            <div>
              <h3 className="text-slate-900 dark:text-white font-black uppercase text-base tracking-tight flex items-center"><FileWarning className="w-6 h-6 text-red-500 mr-3" />Relatório de Pré-Exclusão</h3>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em] mt-1">Revise os registros antes da ação definitiva</p>
            </div>
            <button onClick={() => setShowPreview(false)} className="p-2.5 bg-black/5 dark:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-all"><X className="w-7 h-7" /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="bg-blue-600 p-6 rounded-[2rem] shadow-2xl flex justify-between items-center mb-6">
              <div><p className="text-[10px] text-blue-100 uppercase font-black opacity-70 tracking-widest mb-1">Impacto Detectado</p><p className="text-3xl font-black text-slate-900 dark:text-white">{previewRecords.length} <span className="text-xs font-bold opacity-70 uppercase tracking-widest">Pontos</span></p></div>
              <Database className="w-10 h-10 text-slate-900 dark:text-white/20" />
            </div>
            {previewRecords.map((r, i) => (
              <div key={i} className="p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex justify-between items-center animate-in fade-in" style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}>
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${RECORD_TYPES[r.type]?.color.split(' ')[1]}`} />
                  <div><p className="text-slate-900 dark:text-white font-black text-xs uppercase tracking-tight">{r.empName}</p><p className="text-[10px] text-slate-500 font-mono tracking-tighter">{format(new Date(r.timestamp), 'dd/MM/yyyy HH:mm')}</p></div>
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">{RECORD_TYPES[r.type]?.label}</div>
              </div>
            ))}
          </div>
          <footer className="p-8 bg-slate-100 dark:bg-slate-900/90 border-t border-black/10 dark:border-white/10 backdrop-blur-2xl">
            <button onClick={() => setConfirmModal({ show: true, password: '' })} className="w-full py-6 bg-red-600 hover:bg-red-500 text-slate-900 dark:text-white font-black rounded-3xl shadow-2xl shadow-red-900/50 flex items-center justify-center space-x-4 transition-all active:scale-[0.98] uppercase tracking-widest text-sm"><Trash className="w-5 h-5" /><span>CONFIRMAR E APAGAR</span><ChevronRight className="w-5 h-5" /></button>
          </footer>
        </div>
      )}

      {/* PASSWORD CHALLENGE MODAL */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl animate-in zoom-in duration-200">
          <div className="w-full max-w-sm bg-slate-100 dark:bg-slate-900 border border-red-500/20 rounded-[3rem] p-10 space-y-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent animate-pulse" />
            <div className="text-center space-y-5">
              <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center mx-auto border-4 border-red-600/5"><ShieldAlert className="w-12 h-12 text-red-600 animate-pulse" /></div>
              <div className="space-y-1"><h3 className="text-slate-900 dark:text-white font-black uppercase text-2xl tracking-tighter">Autorização</h3><p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em]">Senha do Administrador</p></div>
            </div>
            <input type="password" placeholder="••••" className="w-full p-6 bg-black/50 border border-black/10 dark:border-white/10 rounded-3xl text-slate-900 dark:text-white text-center text-5xl tracking-[0.4em] font-black outline-none focus:border-red-600 transition-all placeholder:text-slate-900" value={confirmModal.password} onChange={e => setConfirmModal({...confirmModal, password: e.target.value})} autoFocus />
            <div className="flex flex-col space-y-4">
              <button onClick={runDeletion} className="w-full py-6 bg-red-600 hover:bg-red-500 text-slate-900 dark:text-white font-black rounded-2xl shadow-2xl shadow-red-900/30 transition-all active:scale-95 uppercase tracking-widest">EXECUTAR AGORA</button>
              <button onClick={() => setConfirmModal({ show: false, password: '' })} className="flex-1 py-3 text-[10px] font-black text-slate-600 uppercase hover:text-slate-900 dark:text-white tracking-[0.2em] transition-colors">CANCELAR OPERAÇÃO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
