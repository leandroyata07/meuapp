import React, { useState, useEffect, useRef } from 'react'
import { db } from '../db'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Delete, Check, X, User, Coffee, LogOut, LogIn, Clock, AlertCircle, Info, Camera, Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const RECORD_TYPES = {
  check_in: { label: 'Entrada Principal', icon: LogIn, color: 'bg-emerald-500' },
  lunch_out: { label: 'Saída Almoço', icon: Coffee, color: 'bg-orange-500' },
  lunch_in: { label: 'Retorno Almoço', icon: Coffee, color: 'bg-blue-500' },
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

  useEffect(() => {
    db.settings.get('config').then(setSettings)
    db.employees.get(Number(employeeId)).then(emp => {
      setEmployee(emp)
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

  const handleRecord = async (type) => {
    if (isProcessing) return
    if (RECORD_TYPES[type].needsReason && !reason) {
      setSelectedType(type)
      return
    }

    const now = new Date()
    
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
    setIsProcessing(true)
    const now = new Date()

    const saveRecord = async (locationData = null) => {
      const recordData = {
        employeeId: employee.id,
        timestamp: now.toISOString(),
        type: selectedType, // Use state here, as it was set in handleRecord
        comment: reason
      }
      if (locationData) recordData.location = locationData
      if (photoData) recordData.photo = photoData
      
      await db.records.add(recordData)

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

    // If already checked out definitively, everything is disabled
    if (hasCheckOut) return true

    // If no records today, only "check_in" is allowed
    if (todayRecords.length === 0) {
      return type !== 'check_in'
    }

    // If already has a check_in, you can't check_in again
    if (type === 'check_in' && hasCheckIn) return true

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
        // After returning from lunch: Final exit, Extra exit, or even another lunch (if allowed by HR, but here we restrict to 1 if needed)
        // Let's allow multiple lunches just in case, or other_out
        return !['check_out', 'other_out', 'lunch_out'].includes(type)
      
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
                    <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-blue-500/30 space-y-3 animate-in fade-in slide-in-from-top-2">
                      <p className="text-sm text-blue-400 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Justifique sua saída extra:
                      </p>
                      <textarea
                        autoFocus
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Consulta médica, resolver problema bancário..."
                        className="w-full bg-white/60 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        rows={2}
                      />
                      <button
                        onClick={() => handleRecord(key)}
                        disabled={!reason.trim()}
                        className="w-full p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-sm font-bold transition-all"
                      >
                        Confirmar Registro
                      </button>
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
    </div>
  )
}
