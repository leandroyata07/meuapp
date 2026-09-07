import React, { useState, useEffect, useRef } from 'react'
import { db } from '../db'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Delete, Check, CheckCircle2, X, User, Coffee, LogOut, LogIn, Clock, AlertCircle, Info, Camera, Share2, FileText, Download, QrCode, Activity, ChevronRight, Bell, ShieldCheck, ShieldAlert, Mail, Calendar } from 'lucide-react'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import html2canvas from 'html2canvas'
import { QRCodeSVG } from 'qrcode.react'
import { ThemeToggle } from './ThemeToggle'
import { toMinutes } from '../utils/shiftUtils'
import { pushDocToFirestore } from '../firebase'

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

  // Notificações pessoais do colaborador (deferimentos / indeferimentos)
  const [employeeNotifications, setEmployeeNotifications] = useState([])
  const [showEmployeeNotifsModal, setShowEmployeeNotifsModal] = useState(false)

  // Ajuste de Ponto Esquecido no mesmo dia
  const [isForgottenOpen, setIsForgottenOpen] = useState(false)
  const [forgottenType, setForgottenType] = useState('check_in')
  const [forgottenTime, setForgottenTime] = useState(format(new Date(), 'HH:mm'))
  const [forgottenReason, setForgottenReason] = useState('')

  // Inclusão de Pontos de Dias Anteriores (quando autorizado)
  const [retroDayDate, setRetroDayDate] = useState('')
  const [retroDayType, setRetroDayType] = useState('check_in')
  const [retroDayTime, setRetroDayTime] = useState('08:00')
  const [retroDayReason, setRetroDayReason] = useState('')
  const [isSubmittingRetro, setIsSubmittingRetro] = useState(false)

  const loadEmployeeNotifications = async (empId = employeeId) => {
    if (!empId) return
    try {
      const notifs = await db.notifications
        .where('employeeId')
        .equals(Number(empId))
        .toArray()
      const empNotifs = notifs.filter(n => n.target === 'employee' || ['request_approved', 'request_rejected'].includes(n.type))
      empNotifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setEmployeeNotifications(empNotifs)
    } catch (err) {
      console.warn('Erro ao carregar notificações do colaborador:', err)
    }
  }

  useEffect(() => {
    db.settings.get('config').then(setSettings)
    db.employees.get(Number(employeeId)).then(emp => {
      setEmployee(emp)
      if (emp?.cpf === '000.000.000-00') setIsDemo(true)
      if (emp?.allowRetroactive && emp?.retroactiveStart) {
        setRetroDayDate(emp.retroactiveStart)
      }
      if (sessionStorage.getItem('biometricVerified') === String(employeeId)) {
        sessionStorage.removeItem('biometricVerified')
        setStep('select')
      }
    })
    loadTodayRecords()
    loadEmployeeNotifications()

    const handleSync = () => {
      loadTodayRecords()
      loadEmployeeNotifications()
    }
    window.addEventListener('pontoaqui:sync', handleSync)
    return () => {
      window.removeEventListener('pontoaqui:sync', handleSync)
    }
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
    
    const text = `*COMPROVANTE DE PONTO*\n\n🏢 *Empresa:* ${settings?.companyName || 'Empresa'}\n👤 *Funcionário:* ${employee.name}\n📅 *Data:* ${format(recordedTime, 'dd/MM/yyyy')}\n⏰ *Hora do Registro:* ${format(recordedTime, 'HH:mm')}${extraCategory === 'esquecimento' ? `\n🕒 *Chegada Declarada:* ${forgottenTime} (Em análise pelo Administrador)` : ''}\n📝 *Registro:* ${RECORD_TYPES[selectedType].label}\n🔑 *Autenticação:* ${recordedTime.getTime().toString(16).toUpperCase()}`

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
      const isRejected = t.status === 'rejected'
      body = (isRejected ? `[SOLICITAÇÃO INDEFERIDA - NÃO VÁLIDA COMO PONTO OFICIAL]\nMotivo: ${t.rejectionReason || 'Recusado pela gestão'}\nFavor procurar o setor de Recursos Humanos (RH).\n\n` : '') +
             `COMPROVANTE DE PONTO\n\n` +
             `Empresa: ${settings?.companyName || 'Empresa'}\n` +
             `Funcionário: ${employee.name}\n` +
             `Data: ${format(new Date(t.timestamp), 'dd/MM/yyyy')}\n` +
             `Hora: ${format(new Date(t.timestamp), 'HH:mm')}\n` +
             `Registro: ${RECORD_TYPES[t.type]?.label}\n` +
             (isRejected ? `Status: INDEFERIDO (RECUSADO)\n` : '') +
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

  const handleStartForgottenRecord = () => {
    if (!forgottenTime) {
      alert('Por favor, informe o horário em que você realmente chegou.')
      return
    }
    setSelectedType(forgottenType)
    setExtraCategory('esquecimento')
    setReason(forgottenReason)
    setIsForgottenOpen(false)
    setStep('camera')
  }

  const handleSaveRetroDay = async (e) => {
    e.preventDefault()
    if (!retroDayDate || !retroDayTime) {
      alert('Por favor, informe a data e o horário.')
      return
    }
    if (employee?.retroactiveStart && retroDayDate < employee.retroactiveStart) {
      alert(`A data não pode ser anterior ao início autorizado (${format(new Date(employee.retroactiveStart + 'T12:00:00'), 'dd/MM/yyyy')}).`)
      return
    }
    if (employee?.retroactiveEnd && retroDayDate > employee.retroactiveEnd) {
      alert(`A data não pode ser posterior ao fim autorizado (${format(new Date(employee.retroactiveEnd + 'T12:00:00'), 'dd/MM/yyyy')}).`)
      return
    }

    setIsSubmittingRetro(true)
    try {
      const [year, month, day] = retroDayDate.split('-').map(Number)
      const [hour, minute] = retroDayTime.split(':').map(Number)
      const targetDateTime = new Date(year, month - 1, day, hour, minute, 0, 0)

      const recId = await db.records.add({
        employeeId: employee.id,
        timestamp: targetDateTime.toISOString(),
        systemTimestamp: new Date().toISOString(),
        type: retroDayType,
        comment: `Ponto Retroativo (${retroDayReason || 'Autorizado pela gestão'})`,
        category: 'retroactive_day',
        status: 'pending'
      })

      await pushDocToFirestore('records', recId, {
        id: recId,
        employeeId: employee.id,
        timestamp: targetDateTime.toISOString(),
        systemTimestamp: new Date().toISOString(),
        type: retroDayType,
        comment: `Ponto Retroativo (${retroDayReason || 'Autorizado pela gestão'})`,
        category: 'retroactive_day',
        status: 'pending'
      })

      const notifId = await db.notifications.add({
        target: 'admin',
        type: 'retroactive',
        message: `${employee.name} lançou ponto retroativo para ${format(targetDateTime, 'dd/MM/yyyy')} às ${retroDayTime} (${RECORD_TYPES[retroDayType]?.label || retroDayType}). Aguarda deferimento.`,
        timestamp: new Date().toISOString(),
        read: false,
        employeeId: employee.id
      })

      await pushDocToFirestore('notifications', notifId, {
        id: notifId,
        target: 'admin',
        type: 'retroactive',
        message: `${employee.name} lançou ponto retroativo para ${format(targetDateTime, 'dd/MM/yyyy')} às ${retroDayTime} (${RECORD_TYPES[retroDayType]?.label || retroDayType}). Aguarda deferimento.`,
        timestamp: new Date().toISOString(),
        read: false,
        employeeId: employee.id
      })

      alert('Ponto retroativo enviado com sucesso para a aprovação do Administrador!')
      setRetroDayReason('')
      setStep('select')
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar ponto retroativo.')
    } finally {
      setIsSubmittingRetro(false)
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
      const isForgotten = extraCategory === 'esquecimento'
      const recordData = {
        employeeId: employee.id,
        timestamp: now.toISOString(),
        systemTimestamp: now.toISOString(),
        declaredTime: isForgotten ? forgottenTime : null,
        type: selectedType, 
        comment: isForgotten 
          ? `Ajuste por Esquecimento (Chegada Declarada: ${forgottenTime}) - ${reason || 'Sem observações'}`
          : extraCategory ? { medico: 'Médico', pessoal: 'Pessoal', servico: 'A Serviço' }[extraCategory] : '',
        category: extraCategory,
        status: (extraCategory === 'medico' || isForgotten) ? 'pending' : 'auto'
      }
      if (locationData) recordData.location = locationData
      if (photoData) recordData.photo = photoData
      
      const recId = await db.records.add(recordData)
      await pushDocToFirestore('records', recId, { ...recordData, id: recId })

      // Create Admin Notifications
      if (isForgotten) {
        const notifId = await db.notifications.add({
          target: 'admin',
          type: 'esquecimento',
          message: `${employee.name} registrou ponto com declaração de esquecimento: informou chegada às ${forgottenTime} (registrado às ${format(now, 'HH:mm')}).`,
          timestamp: new Date().toISOString(),
          read: false,
          employeeId: employee.id
        })
        await pushDocToFirestore('notifications', notifId, {
          id: notifId,
          target: 'admin',
          type: 'esquecimento',
          message: `${employee.name} registrou ponto com declaração de esquecimento: informou chegada às ${forgottenTime} (registrado às ${format(now, 'HH:mm')}).`,
          timestamp: new Date().toISOString(),
          read: false,
          employeeId: employee.id
        })
      } else if (extraCategory === 'medico') {
        const notifId = await db.notifications.add({
          target: 'admin',
          type: 'medical',
          message: `${employee.name} registrou uma saída para o médico e anexou um comprovante/foto.`,
          timestamp: new Date().toISOString(),
          read: false,
          employeeId: employee.id
        })
        await pushDocToFirestore('notifications', notifId, {
          id: notifId,
          target: 'admin',
          type: 'medical',
          message: `${employee.name} registrou uma saída para o médico e anexou um comprovante/foto.`,
          timestamp: new Date().toISOString(),
          read: false,
          employeeId: employee.id
        })
      }

      // Late Check-in Notification
      if (selectedType === 'check_in' && employee.shiftStart && !isForgotten) {
        const [h, m] = employee.shiftStart.split(':').map(Number)
        const shiftStart = new Date(now)
        shiftStart.setHours(h, m, 0, 0)
        
        if (now > shiftStart) {
          const diffMin = Math.round((now - shiftStart) / 60000)
          const tolerance = employee.toleranceMin ?? 10
          if (diffMin > tolerance) { // Tolerância da CLT (Art. 58, § 1º)
            const notifId = await db.notifications.add({
              target: 'admin',
              type: 'late',
              message: `${employee.name} chegou com ${diffMin} minutos de atraso (Turno: ${employee.shiftStart}, Tolerância CLT: ${tolerance} min).`,
              timestamp: new Date().toISOString(),
              read: false,
              employeeId: employee.id
            })
            await pushDocToFirestore('notifications', notifId, {
              id: notifId,
              target: 'admin',
              type: 'late',
              message: `${employee.name} chegou com ${diffMin} minutos de atraso (Turno: ${employee.shiftStart}, Tolerância CLT: ${tolerance} min).`,
              timestamp: new Date().toISOString(),
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
      const nowMin = now.getHours() * 60 + now.getMinutes()
      
      const lunchStartMin = employee?.lunchStart ? toMinutes(employee.lunchStart) : (12 * 60)
      const lunchEndMin = employee?.lunchEnd ? toMinutes(employee.lunchEnd) : (13 * 60)
      const shiftEndMin = employee?.shiftEnd ? toMinutes(employee.shiftEnd) : (17 * 60)
      
      const hasLunchOut = todayRecords.some(r => r.type === 'lunch_out')
      
      // Se ainda não saiu para almoço e está na janela do horário de almoço do colaborador
      if (!hasLunchOut && nowMin >= (lunchStartMin - 45) && nowMin < lunchEndMin) {
        return 'lunch_out'
      }
      
      // Se está próximo ou já passou do horário de saída definitiva do colaborador
      if (nowMin >= (shiftEndMin - 45)) {
        return 'check_out'
      }
    }
    return null
  }

  if (!employee) return null

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 overflow-hidden bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-white transition-colors duration-500"
      onClick={handleContainerClick}
    >
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[120px]" />

      <button 
        onClick={(e) => {
          e.stopPropagation()
          navigate({ to: '/' })
        }}
        className="absolute top-5 left-5 p-2.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm active:scale-90 z-50 backdrop-blur-md"
        title="Voltar para busca"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-5 right-5 z-50">
        <ThemeToggle />
      </div>

      {step === 'pin' && (
        <div className="w-full max-w-sm space-y-6 text-center animate-in fade-in zoom-in duration-400 relative z-10">
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
          
          <div className="glass-panel p-8 rounded-[2.5rem] shadow-2xl space-y-6 border border-slate-200/80 dark:border-white/10">
            <div className="space-y-3">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 flex items-center justify-center border-2 border-blue-500/30 overflow-hidden shadow-lg p-0.5">
                {employee.photo ? (
                  <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover rounded-[1.4rem]" />
                ) : (
                  <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{employee.name}</h2>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5 font-medium">Digite seu PIN de 4 dígitos</p>
              </div>
            </div>

            {/* PIN Dots Indicator */}
            <div className="flex justify-center items-center space-x-4 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    pin.length > i 
                      ? 'bg-blue-600 border-2 border-blue-400 shadow-md shadow-blue-500/40 scale-125' 
                      : error 
                        ? 'border-2 border-red-500 bg-red-500/20 animate-pulse' 
                        : 'border-2 border-slate-300 dark:border-slate-700 bg-slate-200/50 dark:bg-white/5'
                  }`}
                />
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={(e) => { e.stopPropagation(); handleNumber(num.toString()) }}
                  className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-2xl font-bold font-mono text-slate-900 dark:text-white transition-all shadow-sm active:scale-90 hover:shadow-md"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete() }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all active:scale-90"
                title="Apagar"
              >
                <Delete className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNumber('0') }}
                className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-2xl font-bold font-mono text-slate-900 dark:text-white transition-all shadow-sm active:scale-90 hover:shadow-md"
              >
                0
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handlePinSubmit() }}
                disabled={pin.length < 4}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                  pin.length === 4 
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105' 
                    : 'text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-white/5 cursor-not-allowed'
                }`}
                title="Confirmar"
              >
                <Check className="w-7 h-7" />
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-xs font-bold animate-bounce bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                Senha incorreta! Tente novamente.
              </p>
            )}
          </div>
        </div>
      )}

      {step === 'select' && (
        <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400 relative z-10">
          <div className="glass-panel p-6 rounded-3xl shadow-xl flex items-center justify-between border border-slate-200/80 dark:border-white/10">
            <div className="flex items-center space-x-5 min-w-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 flex items-center justify-center border border-blue-500/30 overflow-hidden flex-shrink-0 shadow-sm p-0.5">
                {employee.photo ? (
                  <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="truncate">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  Olá, {employee.name.split(' ')[0]}!
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {todayRecords.length === 0 ? 'Aguardando Entrada' : 'Jornada em andamento'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium truncate">
                    • {todayRecords.length} registro(s) hoje
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Histórico de Notificações */}
            {employeeNotifications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEmployeeNotifsModal(true)}
                className="relative p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-white/10 shrink-0"
                title="Minhas Notificações"
              >
                <Bell className="w-5 h-5" />
                {employeeNotifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm">
                    {employeeNotifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Cards de Notificações Não Lidas (Especialmente Indeferimentos) */}
          {employeeNotifications.filter(n => !n.read).length > 0 && (
            <div className="space-y-3">
              {employeeNotifications.filter(n => !n.read).map(notif => (
                <div 
                  key={notif.id}
                  className={`p-6 rounded-3xl border-2 shadow-xl space-y-4 animate-in slide-in-from-top-3 ${
                    notif.type === 'request_rejected' 
                      ? 'bg-red-50 dark:bg-[#1a0b0e] border-red-300 dark:border-red-500/40 shadow-red-500/10' 
                      : 'bg-emerald-50 dark:bg-[#091a12] border-emerald-300 dark:border-emerald-500/40 shadow-emerald-500/10'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-lg mt-0.5 ${
                      notif.type === 'request_rejected' ? 'bg-red-600 shadow-red-600/30' : 'bg-emerald-600 shadow-emerald-600/30'
                    }`}>
                      {notif.type === 'request_rejected' ? <ShieldAlert className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-black text-sm uppercase tracking-wide ${
                          notif.type === 'request_rejected' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {notif.title || (notif.type === 'request_rejected' ? 'Solicitação Indeferida' : 'Solicitação Deferida')}
                        </h4>
                        {notif.type === 'request_rejected' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white uppercase animate-pulse">
                            Procure o RH
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold mt-1 leading-relaxed text-slate-800 dark:text-slate-200">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1.5">
                        {notif.timestamp && format(new Date(notif.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-black/5 dark:border-white/10">
                    <button
                      type="button"
                      onClick={async () => {
                        await db.notifications.update(notif.id, { read: true })
                        const updated = await db.notifications.get(notif.id)
                        if (updated) await pushDocToFirestore('notifications', notif.id, updated)
                        loadEmployeeNotifications()
                      }}
                      className="px-5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-white/10 active:scale-95 shadow-sm"
                    >
                      Marcar como Ciente
                    </button>
                    
                    {notif.recordId && (
                      <button
                        type="button"
                        onClick={async () => {
                          const rec = await db.records.get(notif.recordId)
                          if (rec) {
                            setSelectedTickets([rec])
                            setStep('ticket')
                          }
                        }}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-red-600/30 active:scale-95 flex items-center space-x-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver Recibo com Marca d'Água</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal com Histórico Completo de Notificações */}
          {showEmployeeNotifsModal && (
            <div 
              className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowEmployeeNotifsModal(false)}
            >
              <div 
                className="relative max-w-lg w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 border border-slate-200 dark:border-white/10 shadow-2xl space-y-5 animate-in zoom-in duration-200 max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Minhas Notificações</h3>
                      <p className="text-[10px] text-slate-400 font-bold">Histórico de comunicados da gestão</p>
                    </div>
                  </div>
                  <button onClick={() => setShowEmployeeNotifsModal(false)} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {employeeNotifications.length === 0 ? (
                    <p className="text-center py-8 text-xs text-slate-400 font-medium">Nenhuma notificação registrada.</p>
                  ) : (
                    employeeNotifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-4 rounded-2xl border text-xs space-y-2 ${
                          n.type === 'request_rejected' ? 'bg-red-500/5 border-red-500/20 text-red-900 dark:text-red-200' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`font-black uppercase text-[10px] ${n.type === 'request_rejected' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {n.title}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {format(new Date(n.timestamp), 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="font-medium leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowEmployeeNotifsModal(false)}
                  className="w-full py-3.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-black rounded-2xl text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

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

          {/* Banner de Liberação de Dias Anteriores */}
          {employee?.allowRetroactive && employee?.retroactiveStart && employee?.retroactiveEnd && (
            <div className="p-6 bg-indigo-600/10 border border-indigo-500/30 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-3">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">Inclusão de Dias Anteriores Liberada</h4>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    Autorizado de {format(new Date(employee.retroactiveStart + 'T12:00:00'), 'dd/MM/yyyy')} até {format(new Date(employee.retroactiveEnd + 'T12:00:00'), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('retroactive_day')}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 active:scale-95 shrink-0"
              >
                Lançar Pontos
              </button>
            </div>
          )}

          {/* Card de Ponto Esquecido no Mesmo Dia */}
          <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-[2rem] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm">Esqueceu de bater no horário exato?</h4>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Declare a sua chegada retroativa para aprovação da administração</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgottenOpen(!isForgottenOpen)}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-orange-500/20 active:scale-95 shrink-0"
              >
                {isForgottenOpen ? 'Fechar Declaração' : 'Declarar Chegada'}
              </button>
            </div>

            {isForgottenOpen && (
              <div className="p-5 bg-white/80 dark:bg-black/50 rounded-2xl border border-orange-500/20 space-y-4 animate-in zoom-in duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Tipo de Registro</label>
                    <select
                      value={forgottenType}
                      onChange={e => setForgottenType(e.target.value)}
                      className="w-full p-3.5 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold text-xs outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="check_in">Entrada Principal</option>
                      <option value="lunch_in">Retorno Refeição (Volta do Almoço)</option>
                      <option value="check_out">Saída Definitiva</option>
                      <option value="lunch_out">Saída Refeição</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Horário Real em que Chegou</label>
                    <input
                      type="time"
                      value={forgottenTime}
                      onChange={e => setForgottenTime(e.target.value)}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-black text-lg text-center outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Justificativa do Esquecimento</label>
                  <input
                    type="text"
                    placeholder="Ex: Cheguei às 08h, fui direto atender cliente e esqueci de registrar..."
                    value={forgottenReason}
                    onChange={e => setForgottenReason(e.target.value)}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleStartForgottenRecord}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Prosseguir para Foto Selfie e Confirmar</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                        ? 'opacity-35 grayscale cursor-not-allowed bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-white/5' 
                        : isSelected 
                          ? 'glass-card border-blue-500/80 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10' 
                          : isSuggested
                            ? 'bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/15 shadow-md shadow-blue-500/10'
                            : 'glass-card border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className={`w-12 h-12 rounded-xl ${disabled ? 'bg-slate-400 dark:bg-slate-800 text-slate-500' : config.color} text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105 shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-base block text-slate-900 dark:text-white leading-tight">{config.label}</span>
                        {isSuggested ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 uppercase font-black tracking-wider mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Sugerido agora
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Toque para bater</span>
                        )}
                      </div>
                    </div>
                    {!disabled && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white' : 'text-slate-300 dark:text-slate-600 group-hover:text-blue-500'}`}>
                        <Check className="w-4 h-4" />
                      </div>
                    )}
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
        <div className="w-full max-w-sm text-center space-y-6 animate-in fade-in zoom-in duration-400 relative z-10">
          {/* Animated Success Badge with Pulse Ring */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <Check className="w-12 h-12 text-white stroke-[3px]" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-emerald-500 dark:text-emerald-400 tracking-tight">
              Ponto Registrado!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Identidade e horário autenticados com sucesso
            </p>
          </div>

          {/* Mini Wallet Pass Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl text-left space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Registro</p>
                <p className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  {RECORD_TYPES[selectedType]?.label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horário Gravado</p>
                <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {format(recordedTime, 'HH:mm:ss')}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium font-mono">{format(recordedTime, 'dd/MM/yyyy')}</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Criptografia SHA-256
              </span>
            </div>

            {extraCategory === 'esquecimento' && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1 animate-in slide-in-from-bottom-2">
                <div className="flex items-center space-x-1.5 text-orange-600 dark:text-orange-400 font-bold text-[11px] uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ajuste de Chegada Declarado</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Horário declarado: <strong className="text-orange-600 dark:text-orange-400 font-mono">{forgottenTime}</strong> (em análise pelo administrador).
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-2.5 pt-1">
            <button
              onClick={handleShareReceipt}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] text-xs uppercase tracking-wider flex items-center justify-center space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Ver Comprovante Digital (Ticket)</span>
            </button>
            
            <button
              onClick={() => navigate({ to: '/' })}
              className="w-full py-3 glass-card rounded-2xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]"
            >
              Concluir e Voltar
            </button>
          </div>

          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-slate-400 text-[10px] font-semibold tracking-wider uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>Retornando ao início automaticamente...</span>
          </div>
        </div>
      )}

      {step === 'retroactive_day' && (
        <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={() => setStep('select')}
            className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:text-white transition-colors text-sm font-bold"
          >
            <X className="w-4 h-4" />
            <span>Cancelar e Voltar</span>
          </button>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-2 text-indigo-500 border border-indigo-500/30">
              <Calendar className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Lançar Ponto de Dias Anteriores</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Período autorizado pela gestão: <strong className="text-indigo-500">{employee?.retroactiveStart ? format(new Date(employee.retroactiveStart + 'T12:00:00'), 'dd/MM/yyyy') : ''}</strong> até <strong className="text-indigo-500">{employee?.retroactiveEnd ? format(new Date(employee.retroactiveEnd + 'T12:00:00'), 'dd/MM/yyyy') : ''}</strong>.
            </p>
          </div>

          <form onSubmit={handleSaveRetroDay} className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-black/10 dark:border-white/10 space-y-6 shadow-xl">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Data do Ponto</label>
              <input 
                type="date" 
                min={employee?.retroactiveStart || undefined}
                max={employee?.retroactiveEnd || undefined}
                required
                className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={retroDayDate}
                onChange={e => setRetroDayDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Marcação</label>
              <select 
                value={retroDayType} 
                onChange={e => setRetroDayType(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="check_in">Entrada Principal</option>
                <option value="lunch_out">Saída Refeição (Almoço)</option>
                <option value="lunch_in">Retorno Refeição (Almoço)</option>
                <option value="check_out">Saída Definitiva</option>
                <option value="other_in">Retorno Extra</option>
                <option value="other_out">Saída Extra</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Horário Real em que Ocorreu</label>
              <input 
                type="time" 
                required
                className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white font-black text-xl text-center outline-none focus:ring-2 focus:ring-indigo-500"
                value={retroDayTime}
                onChange={e => setRetroDayTime(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Justificativa / Motivo</label>
              <textarea 
                rows="3"
                placeholder="Ex: Registro manual em folha física no início das atividades na empresa..."
                className="w-full p-4 bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                value={retroDayReason}
                onChange={e => setRetroDayReason(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmittingRetro}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98] uppercase tracking-widest text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmittingRetro ? 'Enviando...' : 'Enviar para Aprovação do Administrador'}</span>
            </button>
          </form>
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
                            {['medico', 'esquecimento', 'retroactive_day'].includes(r.category) && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                r.status === 'pending' ? 'bg-orange-500/20 text-orange-500' :
                                r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' :
                                'bg-red-500/20 text-red-500'
                              }`}>
                                {r.status === 'pending' ? 'Pendente' : r.status === 'approved' ? 'Deferido' : 'Indeferido'}
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
            {/* Marca d'água cruzada oficial de INDEFERIDO quando o registro for recusado */}
            {selectedTickets.length === 1 && selectedTickets[0].status === 'rejected' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 overflow-hidden">
                <div className="transform -rotate-45 border-4 border-dashed border-red-600/80 text-red-600/90 font-black text-2xl uppercase tracking-widest px-4 py-2 text-center select-none bg-red-100/60 backdrop-blur-[0.5px] shadow-sm">
                  INDEFERIDO
                  <span className="text-[8px] font-bold tracking-normal block mt-0.5 text-red-700 uppercase">
                    INVÁLIDO • PROCURE O RH
                  </span>
                </div>
              </div>
            )}

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
                      <p className="text-[9px] text-[#64748b] italic mt-1 font-medium">Motivo declarado: {selectedTickets[0].comment}</p>
                    )}
                  </div>

                  {/* Informação destacada de Indeferimento dentro do comprovante */}
                  {selectedTickets[0].status === 'rejected' && (
                    <div className="p-3 bg-red-100/95 border-2 border-dashed border-red-500 rounded-lg text-red-900 text-[10px] space-y-1.5 my-2">
                      <p className="font-black text-xs flex items-center gap-1 text-red-700">
                        <span>⚠️ SOLICITAÇÃO INDEFERIDA (RECUSADA)</span>
                      </p>
                      {selectedTickets[0].rejectionReason && (
                        <p className="font-bold">Motivo: "{selectedTickets[0].rejectionReason}"</p>
                      )}
                      <p className="font-semibold leading-tight text-[9px] text-red-800">
                        Este lançamento não foi aceito como ponto oficial pela administração. Favor procurar o setor de Recursos Humanos (RH) para esclarecimentos e regularização.
                      </p>
                    </div>
                  )}

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
                                    [{t.status === 'pending' ? 'Pendente' : t.status === 'approved' ? 'Deferido' : 'Indeferido'}]
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
                      ? `whatsapp://send?text=${encodeURIComponent((selectedTickets[0].status === 'rejected' ? '❌ *[SOLICITAÇÃO INDEFERIDA - INVÁLIDO COMO PONTO OFICIAL]*\n⚠️ *Favor procurar o setor de RH.*\n\n' : '') + '*COMPROVANTE DE PONTO*\n\n🏢 *Empresa:* ' + (settings?.companyName || 'Empresa') + '\n👤 *Funcionário:* ' + employee.name + '\n📅 *Data:* ' + format(new Date(selectedTickets[0].timestamp), 'dd/MM/yyyy') + '\n⏰ *Hora:* ' + format(new Date(selectedTickets[0].timestamp), 'HH:mm') + '\n📝 *Registro:* ' + RECORD_TYPES[selectedTickets[0].type]?.label + (selectedTickets[0].status === 'rejected' ? '\n❌ *Status:* INDEFERIDO' : '') + '\n🔑 *Hash:* ' + new Date(selectedTickets[0].timestamp).getTime().toString(16).toUpperCase())}`
                      : `whatsapp://send?text=${encodeURIComponent('*EXTRATO DE PONTO*\n\n🏢 *Empresa:* ' + (settings?.companyName || 'Empresa') + '\n👤 *Funcionário:* ' + employee.name + '\n📅 *Período:* ' + format(new Date(startDate), 'dd/MM') + ' a ' + format(new Date(endDate), 'dd/MM') + '\n⏱️ *Total:* ' + calculateTotalHours(selectedTickets) + '\n\n' + selectedTickets.map(t => '• ' + format(new Date(t.timestamp), 'dd/MM HH:mm') + ' - ' + RECORD_TYPES[t.type]?.label.split(' ')[0] + (t.status === 'rejected' ? ' [INDEFERIDO]' : '')).join('\n'))}`
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
