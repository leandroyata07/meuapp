import React, { useState, useEffect, useRef } from 'react'
import { db } from '../db'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Delete, Check, X, User, Coffee, LogOut, LogIn, Clock, AlertCircle, Info, Camera, Share2, FileText, Download, QrCode, Activity, ChevronRight, Bell, ShieldCheck, Mail } from 'lucide-react'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import html2canvas from 'html2canvas'
import { QRCodeSVG } from 'qrcode.react'

const RECORD_TYPES = {
  check_in: { label: 'Entrada Principal', icon: LogIn, color: 'bg-emerald-500' },
  lunch_out: { label: 'Saída Refeição', icon: Coffee, color: 'bg-orange-500' },
  lunch_in: { label: 'Retorno Refeição', icon: Coffee, color: 'bg-blue-500' },
  check_out: { label: 'Saída Definitiva', icon: LogOut, color: 'bg-red-500' },
  other_out: { label: 'Saída Extra', icon: Clock, color: 'bg-purple-500', needsReason: true },
  other_in: { label: 'Retorno Extra', icon: Clock, color: 'bg-indigo-500' },
  system_auto_checkout: { label: 'Saída Automática', icon: LogOut, color: 'bg-red-500' }
}

export function PinEntry() {
  const { employeeId } = useParams({ from: '/pin/$employeeId' })
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [step, setStep] = useState('pin') // pin | select | success
  const [pin, setPin] = useState('')
  const [employee, setEmployee] = useState(null)
  const [error, setError] = useState(false)
  const [todayRecords, setTodayRecords] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [reason, setReason] = useState('')
  const [recordedTime, setRecordedTime] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [settings, setSettings] = useState(null)
  const [redirectTimer, setRedirectTimer] = useState(null)
  const [historyRecords, setHistoryRecords] = useState([])
  const [selectedTickets, setSelectedTickets] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [extraCategory, setExtraCategory] = useState(null)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [isDemo, setIsDemo] = useState(false)
  const [simulateTime, setSimulateTime] = useState(false)
  const [customTime, setCustomTime] = useState(format(new Date(), 'HH:mm'))
  const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const ticketRef = useRef(null)

  useEffect(() => {
    db.settings.get('config').then(setSettings)
    db.employees.get(Number(employeeId)).then(emp => {
      setEmployee(emp)
      if (emp?.cpf === '000.000.000-00') setIsDemo(true)
      if (sessionStorage.getItem('biometricVerified') === String(employeeId)) {
        sessionStorage.removeItem('biometricVerified')
        setStep('select')
      }
    })
    loadTodayRecords()
  }, [employeeId])

  useEffect(() => {
    if (step === 'pin') {
      const focusInput = () => {
        if (inputRef.current) inputRef.current.focus()
      }
      focusInput()
      const timer = setTimeout(focusInput, 100)
      window.addEventListener('focus', focusInput)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('focus', focusInput)
      }
    }
  }, [step])

  useEffect(() => {
    if (step === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [step])

  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        navigate({ to: '/' })
      }, 8000)
      setRedirectTimer(timer)
      return () => clearTimeout(timer)
    }
  }, [step, navigate])

  const handleShareReceipt = async () => {
    if (redirectTimer) clearTimeout(redirectTimer)
    
    const text = `*COMPROVANTE DE PONTO*\n\n🏢 *Empresa:* ${settings?.companyName || 'Empresa'}\n👤 *Funcionário:* ${employee.name}\n📅 *Data:* ${format(recordedTime, 'dd/MM/yyyy')}\n⏰ *Hora:* ${format(recordedTime, 'HH:mm')}\n📝 *Registro:* ${RECORD_TYPES[selectedType].label}\n🔑 *Autenticação:* ${recordedTime.getTime().toString(16).toUpperCase()}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Comprovante de Ponto',
          text: text,
        })
      } catch (err) {
        console.error('Error sharing', err)
      }
    } else {
      await navigator.clipboard.writeText(text)
      alert('Comprovante copiado! Você pode colar no seu WhatsApp ou Bloco de Notas.')
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera failed:', err)
      // If camera fails or is denied, skip the selfie step
      saveFinalRecord(null)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      canvasRef.current.width = 320
      canvasRef.current.height = 320
      const video = videoRef.current
      const size = Math.min(video.videoWidth, video.videoHeight)
      const x = (video.videoWidth - size) / 2
      const y = (video.videoHeight - size) / 2
      context.drawImage(video, x, y, size, size, 0, 0, 320, 320)
      const photoData = canvasRef.current.toDataURL('image/jpeg', 0.6)
      saveFinalRecord(photoData)
    }
  }

  const loadTodayRecords = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const records = await db.records
      .where('employeeId')
      .equals(Number(employeeId))
      .filter(r => new Date(r.timestamp) >= today)
      .toArray()
    setTodayRecords(records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)))
  }

  const loadHistoryRecords = async () => {
    const records = await db.records
      .where('employeeId')
      .equals(Number(employeeId))
      .reverse()
      .limit(30)
      .toArray()
    setHistoryRecords(records)
  }

  const handleGenerateExtract = async () => {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0)
    
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)
    
    const records = await db.records
      .where('employeeId')
      .equals(Number(employeeId))
      .filter(r => {
        const d = new Date(r.timestamp)
        return d >= start && d <= end
      })
      .toArray()
      
    if (records.length === 0) {
      alert('Nenhum registro encontrado neste período.')
      return
    }
    
    setSelectedTickets(records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)))
    setShowQR(false)
    setStep('ticket')
  }

  const calculateTotalHours = (records) => {
    if (!records || records.length < 2) return '00:00'
    let totalMs = 0
    let start = null
    
    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    
    sorted.forEach(r => {
      const isEntry = ['check_in', 'lunch_in', 'other_in'].includes(r.type)
      const isExit = ['check_out', 'lunch_out', 'other_out'].includes(r.type)
      
      if (isEntry) {
        if (!start) start = new Date(r.timestamp)
      } else if (isExit && start) {
        const isWorkingAbsence = r.type === 'other_out' && (r.category === 'servico' || (r.category === 'medico' && r.status !== 'rejected'))
        if (!isWorkingAbsence) {
          totalMs += new Date(r.timestamp) - start
          start = null
        }
      }
    })
    
    const hours = Math.floor(totalMs / 3600000)
    const minutes = Math.floor((totalMs % 3600000) / 60000)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}h`
  }

  const downloadTicketPNG = async () => {
    if (ticketRef.current) {
      try {
        // Ensure element is fully visible before capture
        const element = ticketRef.current
        const canvas = await html2canvas(element, { 
          backgroundColor: '#fef3c7', 
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
          windowHeight: element.scrollHeight + 100
        })
        const link = document.createElement('a')
        link.download = `Comprovante_PontoAqui_${selectedTickets && selectedTickets.length === 1 ? new Date(selectedTickets[0].timestamp).getTime().toString(16).toUpperCase() : 'extrato'}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      } catch (err) {
        console.error('Failed to capture ticket', err)
        alert('Erro ao gerar imagem do comprovante.')
      }
    }
  }

  const sendEmail = () => {
    const isSingle = selectedTickets.length === 1
    const subject = isSingle ? `Comprovante de Ponto - ${employee.name}` : `Extrato de Ponto - ${employee.name}`
    
    let body = ''
    if (isSingle) {
      const t = selectedTickets[0]
      body = `COMPROVANTE DE PONTO\n\n` +
             `Empresa: ${settings?.companyName || 'Empresa'}\n` +
             `Funcionário: ${employee.name}\n` +
             `Data: ${format(new Date(t.timestamp), 'dd/MM/yyyy')}\n` +
             `Hora: ${format(new Date(t.timestamp), 'HH:mm')}\n` +
             `Registro: ${RECORD_TYPES[t.type]?.label}\n` +
             `Chave: ${new Date(t.timestamp).getTime().toString(16).toUpperCase()}`
    } else {
      body = `EXTRATO DE PONTO\n\n` +
             `Empresa: ${settings?.companyName || 'Empresa'}\n` +
             `Funcionário: ${employee.name}\n` +
             `Período: ${format(new Date(startDate), 'dd/MM')} a ${format(new Date(endDate), 'dd/MM')}\n` +
             `Total Trabalhado: ${calculateTotalHours(selectedTickets)}\n\n` +
             `Registros:\n` +
             selectedTickets.map(t => `• ${format(new Date(t.timestamp), 'dd/MM HH:mm')} - ${RECORD_TYPES[t.type]?.label}`).join('\n')
    }

    const mailtoUrl = `mailto:${employee.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoUrl
  }

  const handleContainerClick = () => {
    if (step === 'pin') inputRef.current?.focus()
  }

  const handleInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(val)
    if (error) setError(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && pin.length === 4) {
      handlePinSubmit()
    }
  }

  const handleNumber = (num) => {
    if (pin.length < 4) {
      setPin(pin + num)
      setError(false)
    }
  }

  const handleDelete = () => {
    setPin(pin.slice(0, -1))
  }

  const handlePinSubmit = () => {
    if (pin === employee.pin) {
      setStep('select')
    } else {
      setError(true)
      setPin('')
    }
  }

  const handleRecord = async (type, category = null) => {
    if (isProcessing) return
    if (RECORD_TYPES[type].needsReason && !category) {
      setSelectedType(type)
      return
    }

    if (category) {
      setExtraCategory(category)
    }

    const now = simulateTime ? new Date(`${customDate}T${customTime}:00`) : new Date()
    
    // Safety check: Prevent duplicate records within 1 minute
    if (todayRecords.length > 0) {
      const lastRecord = todayRecords[todayRecords.length - 1]
      const diffMs = now - new Date(lastRecord.timestamp)
      if (diffMs < 60000) {
        alert('Aguarde pelo menos 1 minuto entre registros de ponto.')
        return
      }
    }

    // Bulletproof validation before saving
    if (isTypeDisabled(type)) {
      alert('Este registro não é permitido no momento de acordo com a sequência lógica do ponto.')
      return
    }

    setSelectedType(type)
    setStep('camera')
  }

  const saveFinalRecord = async (photoData) => {
    // Wi-Fi Geofence Check (Simulated for Web)
    if (settings?.wifiGeofenceEnabled && settings.allowedSSID) {
      const isCorrectWifi = confirm(`O sistema está configurado para permitir ponto apenas na rede "${settings.allowedSSID}". Você está conectado a esta rede?`)
      if (!isCorrectWifi) {
        alert('Registro negado: Você deve estar conectado ao Wi-Fi da empresa.')
        return
      }
    }

    setIsProcessing(true)
    const now = simulateTime ? new Date(`${customDate}T${customTime}:00`) : new Date()

    const saveRecord = async (locationData = null) => {
      const recordData = {
        employeeId: employee.id,
        timestamp: now.toISOString(),
        type: selectedType, 
        comment: extraCategory ? { medico: 'Médico', pessoal: 'Pessoal', servico: 'A Serviço' }[extraCategory] : '',
        category: extraCategory,
        status: extraCategory === 'medico' ? 'pending' : 'auto'
      }
      if (locationData) recordData.location = locationData
      if (photoData) recordData.photo = photoData
      
      await db.records.add(recordData)

      // Create Admin Notifications
      if (extraCategory === 'medico') {
        await db.notifications.add({
          type: 'medical',
          message: `${employee.name} registrou uma saída para o médico e anexou um comprovante/foto.`,
          timestamp: new Date(),
          read: false,
          employeeId: employee.id
        })
      }

      // Late Check-in Notification
      if (selectedType === 'check_in' && employee.shiftStart) {
        const [h, m] = employee.shiftStart.split(':').map(Number)
        const shiftStart = new Date(now)
        shiftStart.setHours(h, m, 0, 0)
        
        if (now > shiftStart) {
          const diffMin = Math.round((now - shiftStart) / 60000)
          if (diffMin > 5) { // 5 min grace period
            await db.notifications.add({
              type: 'late',
              message: `${employee.name} chegou com ${diffMin} minutos de atraso (Turno: ${employee.shiftStart}).`,
              timestamp: new Date(),
              read: false,
              employeeId: employee.id
            })
          }
        }
      }

      setRecordedTime(now)
      setStep('success')
      setIsProcessing(false)
    }

    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3;
      const f1 = lat1 * Math.PI/180;
      const f2 = lat2 * Math.PI/180;
      const df = (lat2-lat1) * Math.PI/180;
      const dl = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    const handleGeolocation = (pos) => {
      const userLat = pos.coords.latitude
      const userLng = pos.coords.longitude
      
      if (settings?.geofenceEnabled && settings.geofenceLat && settings.geofenceLng) {
        const dist = getDistance(userLat, userLng, parseFloat(settings.geofenceLat), parseFloat(settings.geofenceLng))
        if (dist > (parseFloat(settings.geofenceRadius) || 50)) {
          alert(`Acesso bloqueado: Você está fora da área permitida da empresa (Distância: ${Math.round(dist)}m).`)
          setIsProcessing(false)
          setStep('select')
          return
        }
      }
      saveRecord({ lat: userLat, lng: userLng })
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        handleGeolocation,
        (err) => {
          if (settings?.geofenceEnabled) {
            alert('Acesso ao GPS negado. Você precisa permitir a localização para bater o ponto com Cerca Virtual.')
            setIsProcessing(false)
            setStep('select')
            return
          }
          saveRecord(null)
        },
        { timeout: 15000, maximumAge: 0 }
      )
    } else {
      if (settings?.geofenceEnabled) {
        alert('Seu dispositivo não suporta GPS. Não é possível bater o ponto com Cerca Virtual.')
        setIsProcessing(false)
        setStep('select')
        return
      }
      saveRecord(null)
    }
  }

  const isTypeDisabled = (type) => {
    const hasCheckIn = todayRecords.some(r => r.type === 'check_in')
    const hasCheckOut = todayRecords.some(r => r.type === 'check_out')
    const hasLunchOut = todayRecords.some(r => r.type === 'lunch_out')

    // If already checked out definitively, everything is disabled
    if (hasCheckOut) return true

    // If no records today, only "check_in" is allowed
    if (todayRecords.length === 0) {
      return type !== 'check_in'
    }

    // If already has a check_in, you can't check_in again
    if (type === 'check_in' && hasCheckIn) return true
    
    // Only 1 lunch per day allowed
    if (type === 'lunch_out' && hasLunchOut) return true

    const lastRecord = todayRecords[todayRecords.length - 1]
    const lastType = lastRecord.type

    switch (lastType) {
      case 'check_in':
        // After entry: Lunch out, Final exit, or Extra exit
        return !['lunch_out', 'check_out', 'other_out'].includes(type)
      
      case 'lunch_out':
        // During lunch: Only Lunch in allowed
        return type !== 'lunch_in'
      
      case 'lunch_in':
        // After returning from lunch: Final exit, Extra exit
        return !['check_out', 'other_out'].includes(type)
      
      case 'other_out':
        // During extra exit: Only Extra in allowed
        return type !== 'other_in'
      
      case 'other_in':
        // After returning from extra exit: Any exit allowed
        return !['lunch_out', 'check_out', 'other_out'].includes(type)
      
      default:
        return false
    }
  }

  const getSuggestedType = () => {
    if (todayRecords.length === 0) return 'check_in'
    const lastType = todayRecords[todayRecords.length - 1].type
    if (lastType === 'lunch_out') return 'lunch_in'
    if (lastType === 'other_out') return 'other_in'
    if (lastType === 'check_in' || lastType === 'other_in' || lastType === 'lunch_in') {
      const now = new Date()
      const hour = now.getHours()
      if (hour >= 11 && hour <= 14 && !todayRecords.some(r => r.type === 'lunch_out')) return 'lunch_out'
      if (hour >= 16) return 'check_out'
    }
    return null
  }

  if (!employee) return null

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
      onClick={handleContainerClick}
    >
      <button 
        onClick={(e) => {
          e.stopPropagation()
          navigate({ to: '/' })
        }}
        className="absolute top-6 left-6 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white z-50"
      >
        <X className="w-6 h-6" />
      </button>

      {step === 'pin' && (
        <div className="w-full max-w-sm space-y-8 text-center animate-in fade-in zoom-in duration-300">
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={pin}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="absolute top-0 left-0 w-px h-px opacity-0 overflow-hidden"
          />
          <div className="space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center border-2 border-blue-500/30 overflow-hidden">
              {employee.photo ? (
                <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{employee.name}</h2>
              <p className="text-slate-500 dark:text-slate-400">Insira sua senha para continuar</p>
            </div>
          </div>

          <div className="flex justify-center space-x-4 py-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pin.length > i 
                    ? 'bg-blue-500 border-blue-500 scale-125' 
                    : error ? 'border-red-500 animate-pulse' : 'border-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={(e) => { e.stopPropagation(); handleNumber(num.toString()) }}
                className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/5 text-2xl font-semibold transition-all active:scale-90"
              >
                {num}
              </button>
            ))}
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              className="w-16 h-16 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-all active:scale-90"
            >
              <Delete className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNumber('0') }}
              className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/5 text-2xl font-semibold transition-all active:scale-90"
            >
              0
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handlePinSubmit() }}
              disabled={pin.length < 4}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                pin.length === 4 ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'text-slate-600'
              }`}
            >
              <Check className="w-8 h-8" />
            </button>
          </div>
          {error && <p className="text-red-500 font-medium animate-bounce">Senha incorreta!</p>}
        </div>
      )}

      {step === 'select' && (
        <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center space-x-6 bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/10 dark:border-white/10">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 overflow-hidden flex-shrink-0">
              {employee.photo ? (
                <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">Olá, {employee.name.split(' ')[0]}!</h2>
              <p className="text-slate-500 dark:text-slate-400">Status atual: {todayRecords.length === 0 ? 'Aguardando Entrada' : 'Jornada em andamento'}</p>
            </div>
          </div>

          {isDemo && (
            <div className="p-6 bg-orange-500/10 border border-orange-500/20 rounded-[2.5rem] space-y-4 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Ferramentas de Apresentação</h4>
                    <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">Modo Simulação Ativo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSimulateTime(!simulateTime)}
                  className={`w-12 h-6 rounded-full transition-all relative ${simulateTime ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-800'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${simulateTime ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {simulateTime && (
                <div className="grid grid-cols-2 gap-4 animate-in zoom-in duration-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Simular Data</label>
                    <input type="date" className="w-full p-3 bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs font-black" value={customDate} onChange={e => setCustomDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Simular Horário</label>
                    <input type="time" className="w-full p-3 bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs font-black" value={customTime} onChange={e => setCustomTime(e.target.value)} />
                  </div>
                  <p className="col-span-2 text-[10px] text-slate-500 font-medium italic text-center">Neste modo, o ponto será registrado com o horário escolhido acima.</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(RECORD_TYPES).map(([key, config]) => {
              const Icon = config.icon
              const isSelected = selectedType === key
              const disabled = isTypeDisabled(key)
              const isSuggested = getSuggestedType() === key

              return (
                <div key={key} className="space-y-2">
                  <button
                    disabled={disabled}
                    onClick={() => handleRecord(key)}
                    className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group active:scale-[0.98] ${
                      disabled 
                        ? 'opacity-30 grayscale cursor-not-allowed' 
                        : isSelected 
                          ? 'bg-black/10 dark:bg-white/10 border-black/40 dark:border-white/40 ring-2 ring-blue-500' 
                          : isSuggested
                            ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20 animate-pulse-subtle'
                            : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 dark:bg-white/10 hover:border-black/20 dark:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl ${disabled ? 'bg-slate-700' : config.color} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                        <Icon className="w-6 h-6 text-slate-900 dark:text-white" />
                      </div>
                      <div className="text-left">
                        <span className="font-semibold text-lg block">{config.label}</span>
                        {isSuggested && <span className="text-[10px] text-blue-400 uppercase font-bold tracking-widest">Sugerido</span>}
                      </div>
                    </div>
                    {!disabled && <Check className={`w-5 h-5 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />}
                  </button>
                  
                  {isSelected && config.needsReason && (
                    <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-blue-500/30 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <p className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Selecione o tipo de saída
                      </p>
                      
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'medico', label: 'Médico', icon: Activity, desc: 'Pendente de Atestado' },
                          { id: 'pessoal', label: 'Pessoal', icon: User, desc: 'Desconta das Horas' },
                          { id: 'servico', label: 'A Serviço', icon: Clock, desc: 'Conta como Trabalho' }
                        ].map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => handleRecord(key, cat.id)}
                            className="flex items-center justify-between p-4 bg-white/60 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-black/60 border border-black/10 dark:border-white/10 rounded-xl transition-all group/cat"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover/cat:scale-110 transition-transform">
                                <cat.icon className="w-5 h-5 text-blue-500" />
                              </div>
                              <div className="text-left">
                                <span className="text-sm font-bold block">{cat.label}</span>
                                <span className="text-[10px] text-slate-500 uppercase font-bold">{cat.desc}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover/cat:translate-x-1 transition-transform" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {todayRecords.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Registros de hoje</h3>
                <span className="text-[10px] text-slate-600">{todayRecords.length} ponto(s) registrados</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {todayRecords.map((record, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-black/10 dark:bg-white/10 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${RECORD_TYPES[record.type]?.color || 'bg-slate-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{RECORD_TYPES[record.type]?.label}</p>
                        {record.comment && <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{record.comment}</p>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span className="font-mono text-blue-400 font-bold">{format(new Date(record.timestamp), 'HH:mm')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isTypeDisabled('check_out') && todayRecords.some(r => r.type === 'check_out') && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center space-x-3 text-emerald-400">
              <Info className="w-5 h-5" />
              <p className="text-sm">Jornada de hoje concluída! Até amanhã.</p>
            </div>
          )}

          <div className="pt-4 border-t border-black/10 dark:border-white/10">
            <button
              onClick={() => {
                loadHistoryRecords()
                setStep('history')
              }}
              className="w-full py-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center border border-black/10 dark:border-white/10"
            >
              <FileText className="w-5 h-5 mr-2 text-blue-500" />
              Portal do Funcionário (Meus Comprovantes)
            </button>
          </div>

          {isProcessing && (
            <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-blue-400 font-bold tracking-widest uppercase text-[10px]">Autenticando & Capturando GPS...</p>
            </div>
          )}
        </div>
      )}

      {step === 'camera' && (
        <div className="w-full max-w-sm text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center justify-center"><Camera className="w-6 h-6 mr-2 text-blue-500" /> Confirmação de Identidade</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Por favor, posicione seu rosto no quadro abaixo.</p>
          </div>

          <div className="relative mx-auto w-64 h-64 rounded-full overflow-hidden border-4 border-blue-500/30 shadow-2xl shadow-blue-500/20">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full opacity-50" />
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-scan" />
          </div>

          <button
            onClick={capturePhoto}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm"
          >
            Capturar e Confirmar
          </button>
          
          <button
            onClick={() => setStep('select')}
            className="w-full py-3 text-slate-500 hover:text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Voltar
          </button>

          <canvas ref={canvasRef} className="hidden" />

          {isProcessing && (
            <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-blue-400 font-bold tracking-widest uppercase text-[10px]">Autenticando & Capturando GPS...</p>
            </div>
          )}
        </div>
      )}

      {step === 'success' && (
        <div className="w-full max-w-sm text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
            <div className="relative w-32 h-32 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
              <Check className="w-16 h-16 text-slate-900 dark:text-white stroke-[3px]" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-emerald-400">Sucesso!</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              {RECORD_TYPES[selectedType]?.label} registrado às <span className="font-bold text-slate-900 dark:text-white">{format(recordedTime, 'HH:mm')}</span>
            </p>
          </div>

          <div className="pt-4 flex flex-col space-y-3">
            <button
              onClick={handleShareReceipt}
              className="w-full py-4 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 font-black rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-xs flex items-center justify-center border border-emerald-500/30"
            >
              <Share2 className="w-4 h-4 mr-2" /> Gerar Comprovante Digital
            </button>
            
            <button
              onClick={() => navigate({ to: '/' })}
              className="w-full py-3 text-slate-500 hover:text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest transition-colors"
            >
              Voltar ao Início
            </button>
          </div>

          <div className="pt-2">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Redirecionando automaticamente...</span>
            </div>
          </div>
        </div>
      )}

      {step === 'history' && (
        <div className="w-full max-w-sm space-y-6 animate-in fade-in duration-300 pb-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold flex items-center justify-center"><FileText className="w-6 h-6 mr-2 text-blue-500" /> Histórico</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Selecione um ponto ou gere um extrato.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-black/10 dark:border-white/10 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center">Gerar Extrato por Período</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Data Inicial</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Data Final</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full mt-1 p-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button onClick={handleGenerateExtract} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20">
              Gerar Extrato Consolidado
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-2">Comprovantes Individuais</h3>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden shadow-xl max-h-[40vh] overflow-y-auto">
              {historyRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Nenhum registro encontrado.</div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {historyRecords.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedTickets([r])
                        setShowQR(false)
                        setStep('ticket')
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{RECORD_TYPES[r.type]?.label}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-500">{format(new Date(r.timestamp), 'dd/MM/yyyy')}</span>
                            {r.comment && (
                              <span className="text-[10px] text-blue-500 italic truncate max-w-[120px] font-medium">({r.comment})</span>
                            )}
                            {r.category === 'medico' && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                r.status === 'pending' ? 'bg-orange-500/20 text-orange-500' :
                                r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' :
                                'bg-red-500/20 text-red-500'
                              }`}>
                                {r.status === 'pending' ? 'Pendente' : r.status === 'approved' ? 'Aprovado' : 'Recusado'}
                              </span>
                            )}
                          </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-blue-500 font-bold">{format(new Date(r.timestamp), 'HH:mm')}</span>
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setStep('select')}
            className="w-full py-4 text-slate-500 hover:text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest transition-colors bg-black/5 dark:bg-white/5 rounded-2xl"
          >
            Voltar ao Início
          </button>
        </div>
      )}

      {step === 'ticket' && selectedTickets && selectedTickets.length > 0 && (
        <div className="w-full max-w-sm flex flex-col items-center space-y-6 animate-in slide-in-from-bottom-8 duration-500 pb-10">
          <div 
            ref={ticketRef}
            className="w-72 bg-[#fef3c7] text-[#1e293b] p-6 shadow-2xl relative overflow-hidden"
            style={{ fontFamily: '"Courier New", Courier, monospace', borderTop: '4px dashed #cbd5e1', borderBottom: '4px dashed #cbd5e1' }}
          >
            <div className="text-center space-y-2 border-b border-dashed border-[#94a3b8] pb-4 mb-4">
              <h2 className="font-black text-lg tracking-tight uppercase leading-tight">{settings?.companyName || 'Empresa'}</h2>
              <p className="text-[10px] font-bold">{selectedTickets.length > 1 ? 'EXTRATO DE PONTO' : 'COMPROVANTE DE PONTO'}</p>
            </div>
            
            <div className="space-y-4 text-sm font-bold">
              <div>
                <p className="text-[#64748b] text-[10px] uppercase">Funcionário</p>
                <p className="truncate">{employee.name}</p>
              </div>
              
              {selectedTickets.length === 1 ? (
                <>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[#64748b] text-[10px] uppercase">Data</p>
                      <p>{format(new Date(selectedTickets[0].timestamp), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#64748b] text-[10px] uppercase">Hora</p>
                      <p className="text-xl">{format(new Date(selectedTickets[0].timestamp), 'HH:mm')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[#64748b] text-[10px] uppercase">Registro</p>
                    <p>{RECORD_TYPES[selectedTickets[0].type]?.label}</p>
                    {selectedTickets[0].comment && (
                      <p className="text-[9px] text-[#64748b] italic mt-1 font-medium">Motivo: {selectedTickets[0].comment}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[#64748b] text-[10px] uppercase">Chave de Autenticação (Hash)</p>
                    <p className="text-xs break-all opacity-80">{new Date(selectedTickets[0].timestamp).getTime().toString(16).toUpperCase()}</p>
                  </div>
                </>
              ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-dashed border-[#94a3b8] pb-1">
                      <p className="text-[#64748b] text-[10px] uppercase">Período</p>
                      <p className="text-xs">{format(new Date(startDate), 'dd/MM/yyyy')} a {format(new Date(endDate), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="space-y-2">
                      {selectedTickets.map((t, i) => (
                        <div key={i} className="flex justify-between items-start text-xs border-b border-[#cbd5e1]/50 pb-1 py-1">
                          <div className="flex flex-col text-left">
                            <div className="flex items-center space-x-2">
                              <span className="text-[#64748b] text-[9px]">{format(new Date(t.timestamp), 'dd/MM')}</span>
                              <span className="font-bold">{RECORD_TYPES[t.type]?.label}</span>
                            </div>
                            {t.comment && (
                              <div className="flex items-center space-x-2">
                                <span className="text-[8px] text-[#64748b] leading-tight italic max-w-[150px]">Motivo: {t.comment}</span>
                                {t.category === 'medico' && (
                                  <span className="text-[7px] font-black uppercase opacity-70">
                                    [{t.status === 'pending' ? 'Pendente' : t.status === 'approved' ? 'Aprovado' : 'Recusado'}]
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="font-black text-sm">{format(new Date(t.timestamp), 'HH:mm')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 flex justify-between items-center border-t border-dashed border-[#94a3b8] mt-2">
                      <p className="text-[#64748b] text-[10px] uppercase">Registros: {selectedTickets.length}</p>
                      <p className="text-lg font-black">{calculateTotalHours(selectedTickets)}</p>
                    </div>
                  </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-dashed border-[#94a3b8] text-center">
              <p className="text-[9px] uppercase font-bold text-[#64748b]">Via do Trabalhador</p>
              <p className="text-[8px] text-[#94a3b8] mt-1">{selectedTickets.length > 1 ? 'Guarde este extrato' : 'Guarde este recibo'}</p>
            </div>
          </div>

          <div className="w-full space-y-3">
            {showQR ? (
              <div className="bg-white p-4 rounded-3xl flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in shadow-2xl">
                <QRCodeSVG 
                  value={
                    selectedTickets.length === 1 
                      ? `whatsapp://send?text=${encodeURIComponent('*COMPROVANTE DE PONTO*\n\n🏢 *Empresa:* ' + (settings?.companyName || 'Empresa') + '\n👤 *Funcionário:* ' + employee.name + '\n📅 *Data:* ' + format(new Date(selectedTickets[0].timestamp), 'dd/MM/yyyy') + '\n⏰ *Hora:* ' + format(new Date(selectedTickets[0].timestamp), 'HH:mm') + '\n📝 *Registro:* ' + RECORD_TYPES[selectedTickets[0].type]?.label + '\n🔑 *Hash:* ' + new Date(selectedTickets[0].timestamp).getTime().toString(16).toUpperCase())}`
                      : `whatsapp://send?text=${encodeURIComponent('*EXTRATO DE PONTO*\n\n🏢 *Empresa:* ' + (settings?.companyName || 'Empresa') + '\n👤 *Funcionário:* ' + employee.name + '\n📅 *Período:* ' + format(new Date(startDate), 'dd/MM') + ' a ' + format(new Date(endDate), 'dd/MM') + '\n⏱️ *Total:* ' + calculateTotalHours(selectedTickets) + '\n\n' + selectedTickets.map(t => '• ' + format(new Date(t.timestamp), 'dd/MM HH:mm') + ' - ' + RECORD_TYPES[t.type]?.label.split(' ')[0]).join('\n'))}`
                  } 
                  size={200} 
                />
                <p className="text-xs font-bold text-slate-500 text-center">Abra a câmera do celular<br/>e aponte para o código.</p>
                <button onClick={() => setShowQR(false)} className="text-[10px] font-black uppercase text-blue-500 p-2 hover:bg-blue-50 rounded-lg">Voltar aos botões</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadTicketPNG}
                  className="py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] flex flex-col items-center justify-center space-y-1 shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-5 h-5" />
                  <span>Salvar Imagem</span>
                </button>
                <button
                  onClick={() => setShowQR(true)}
                  className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] flex flex-col items-center justify-center space-y-1 shadow-lg shadow-emerald-500/20"
                >
                  <QrCode className="w-5 h-5" />
                  <span>Ler com Celular</span>
                </button>
                <button
                  onClick={sendEmail}
                  className="col-span-2 py-4 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 text-slate-900 dark:text-white font-black rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-[10px] flex items-center justify-center space-x-3 shadow-xl"
                >
                  <Mail className="w-5 h-5 text-blue-500" />
                  <span>{employee.email ? `Enviar p/ ${employee.email}` : 'Enviar por E-mail'}</span>
                </button>
              </div>
            )}
            
            <button
              onClick={() => setStep('history')}
              className="w-full py-4 text-slate-500 hover:text-slate-900 dark:text-white text-xs font-bold uppercase tracking-widest transition-colors"
            >
              Voltar ao Histórico
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
