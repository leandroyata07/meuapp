import { db } from '../db'
import { pushDocToFirestore } from '../firebase'
import { format } from 'date-fns'

export const RECORD_TYPES_AUTO = {
  check_in: 'Entrada Principal',
  lunch_out: 'Saída Refeição',
  lunch_in: 'Retorno Refeição',
  check_out: 'Saída Definitiva',
  other_out: 'Saída Extra / Pausa',
  other_in: 'Retorno Extra'
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas (Fórmula de Haversine).
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity
  const R = 6371000 // Raio da Terra em metros
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Emite som harmônico suave ao bater ponto automático (Web Audio API nativa).
 */
export function playAutoPunchChime(type = 'in') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'in') {
      // Tom ascendente harmonioso (Entrada / Retorno)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15) // G5
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.4)
    } else {
      // Tom descendente suave (Saídas)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(783.99, now) // G5
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18) // C5
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45)
      osc.start(now)
      osc.stop(now + 0.45)
    }
  } catch (e) {
    console.warn('[AutoPunch] Chime audio não pôde ser reproduzido:', e)
  }
}

/**
 * Dispara notificação nativa do sistema operacional (se autorizado).
 */
export function triggerSystemNotification(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png'
      })
    }
  } catch (e) {
    console.warn('[AutoPunch] Erro na notificação do sistema:', e)
  }
}

// Armazena estado dos observadores em memória
let watchId = null
let statusListeners = []
let activeEmployees = []
let isEvaluating = false

// Estado por colaborador: { lastState: 'INSIDE'|'OUTSIDE', lastPunchType, lastPunchTime, consecutiveCount }
const employeeStates = new Map()

function getStoredState(empId) {
  if (employeeStates.has(empId)) return employeeStates.get(empId)
  try {
    const raw = localStorage.getItem(`auto_punch_state_${empId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      employeeStates.set(empId, parsed)
      return parsed
    }
  } catch (e) {}
  const initial = {
    lastState: 'UNKNOWN',
    lastPunchType: null,
    lastPunchTime: null,
    consecutiveCount: 0
  }
  employeeStates.set(empId, initial)
  return initial
}

function setStoredState(empId, state) {
  employeeStates.set(empId, state)
  try {
    localStorage.setItem(`auto_punch_state_${empId}`, JSON.stringify(state))
  } catch (e) {}
}

/**
 * Avalia o posicionamento de um colaborador e executa o ponto automático se as condições forem atendidas.
 */
async function evaluateEmployeePosition(emp, coords) {
  if (!emp.autoPunchEnabled || emp.autoPunchLat == null || emp.autoPunchLng == null) return null

  const targetLat = Number(emp.autoPunchLat)
  const targetLng = Number(emp.autoPunchLng)
  const radius = Number(emp.autoPunchRadius) || 25 // Raio em metros
  const lunchThreshold = emp.autoPunchLunchThreshold || '11:50'
  const minIntervalMinutes = Number(emp.autoPunchMinInterval) || 10
  const minIntervalMs = minIntervalMinutes * 60 * 1000

  const dist = calculateDistanceMeters(targetLat, targetLng, coords.latitude, coords.longitude)
  const isInsideNow = dist <= radius
  const currentState = isInsideNow ? 'INSIDE' : 'OUTSIDE'

  const state = getStoredState(emp.id)
  const prevStoredState = state.lastState

  // Notificar ouvintes de telemetria (para UI)
  const telemetry = {
    employeeId: emp.id,
    distance: Math.round(dist),
    radius,
    isInside: isInsideNow,
    accuracy: Math.round(coords.accuracy || 0),
    lastCheck: new Date().toISOString(),
    lastPunchType: state.lastPunchType,
    lastPunchTime: state.lastPunchTime
  }
  notifyListeners(telemetry)

  // Se o estado anterior era desconhecido, apenas inicializa
  if (prevStoredState === 'UNKNOWN') {
    state.lastState = currentState
    state.consecutiveCount = 1
    setStoredState(emp.id, state)
    return telemetry
  }

  // Filtro de histerese: exige 2 detecções consistentes para confirmar mudança de estado
  if (currentState !== prevStoredState) {
    state.consecutiveCount = (state.consecutiveCount || 0) + 1
    if (state.consecutiveCount < 2) {
      setStoredState(emp.id, state)
      return telemetry
    }
  } else {
    state.consecutiveCount = 0
    setStoredState(emp.id, state)
    return telemetry
  }

  // Mudança confirmada de estado!
  const now = new Date()
  const nowIso = now.toISOString()
  const currentTimeStr = format(now, 'HH:mm')

  // Verificar proteção anti-rebote (intervalo mínimo)
  if (state.lastPunchTime) {
    const elapsed = now.getTime() - new Date(state.lastPunchTime).getTime()
    if (elapsed < minIntervalMs) {
      console.log(`[AutoPunch] Ponto ignorado para ${emp.name}: anti-rebote ativo (${Math.round((minIntervalMs - elapsed)/1000)}s restantes).`)
      state.lastState = currentState
      state.consecutiveCount = 0
      setStoredState(emp.id, state)
      return telemetry
    }
  }

  // Buscar registros de hoje do colaborador
  const todayStr = format(now, 'yyyy-MM-dd')
  const startOfDay = new Date(`${todayStr}T00:00:00`)
  const endOfDay = new Date(`${todayStr}T23:59:59.999`)

  const todayRecords = await db.records
    .filter(r => {
      if (r.employeeId !== emp.id) return false
      const d = new Date(r.timestamp)
      return d >= startOfDay && d <= endOfDay
    })
    .sortBy('timestamp')

  let punchType = null

  if (currentState === 'INSIDE') {
    // TRANSIÇÃO: CHEGOU NA SALA / TRABALHO
    if (todayRecords.length === 0) {
      punchType = 'check_in' // 1. Entrada Principal
    } else {
      const lastRecord = todayRecords[todayRecords.length - 1]
      if (lastRecord.type === 'lunch_out') {
        punchType = 'lunch_in' // Retorno do Almoço
      } else if (lastRecord.type === 'other_out') {
        punchType = 'other_in' // Retorno de Pausa / Saída Extra
      } else if (['check_in', 'lunch_in', 'other_in'].includes(lastRecord.type)) {
        // Já estava ativo; nada a registrar
        punchType = null
      }
    }
  } else {
    // TRANSIÇÃO: SAIU DO RAIO DA SALA
    if (todayRecords.length > 0) {
      const lastRecord = todayRecords[todayRecords.length - 1]
      
      // Só registra saída se o último registro foi uma entrada/retorno
      if (['check_in', 'lunch_in', 'other_in'].includes(lastRecord.type)) {
        const hasLunchOut = todayRecords.some(r => r.type === 'lunch_out')
        const hasLunchIn = todayRecords.some(r => r.type === 'lunch_in')

        if (!hasLunchOut) {
          // Ainda não almoçou hoje
          if (currentTimeStr < lunchThreshold) {
            punchType = 'other_out' // Saída Extra / Pausa (ex: 10:00h)
          } else {
            punchType = 'lunch_out' // Saída Refeição (ex: >= 11:50)
          }
        } else if (hasLunchIn) {
          // Já almoçou e já retornou
          punchType = 'check_out' // Saída Definitiva de Fim de Expediente
        }
      }
    }
  }

  // Atualizar estado
  state.lastState = currentState
  state.consecutiveCount = 0

  if (punchType) {
    console.log(`[AutoPunch] 🔥 Ponto Automático acionado para ${emp.name}: ${punchType} às ${currentTimeStr}`)
    
    // Gravar registro
    const recordData = {
      employeeId: emp.id,
      timestamp: nowIso,
      systemTimestamp: nowIso,
      type: punchType,
      category: 'auto_geofence',
      status: 'auto',
      location: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || null,
        address: 'Registro Automático por Presença (GPS)'
      },
      comment: `Auto-Ponto Inteligente: ${RECORD_TYPES_AUTO[punchType] || punchType} via GPS (${Math.round(dist)}m da base)`
    }

    const recId = await db.records.add(recordData)
    await pushDocToFirestore('records', recId, { ...recordData, id: recId })

    // Criar notificação para o colaborador e admin
    const typeLabel = RECORD_TYPES_AUTO[punchType] || punchType
    const notifMsg = `📍 Ponto Automático: ${emp.name} registrou ${typeLabel} às ${currentTimeStr} via GPS.`
    
    const notifId = await db.notifications.add({
      target: 'all',
      employeeId: emp.id,
      type: 'auto_punch',
      message: notifMsg,
      timestamp: nowIso,
      read: false
    })
    await pushDocToFirestore('notifications', notifId, {
      id: notifId,
      target: 'all',
      employeeId: emp.id,
      type: 'auto_punch',
      message: notifMsg,
      timestamp: nowIso,
      read: false
    })

    // Feedback sonoro e notificação de sistema
    if (emp.autoPunchSound !== false) {
      playAutoPunchChime(currentState === 'INSIDE' ? 'in' : 'out')
    }
    triggerSystemNotification('PontoAqui - Ponto Automático', notifMsg)

    state.lastPunchType = punchType
    state.lastPunchTime = nowIso
  }

  setStoredState(emp.id, state)
  return telemetry
}

function notifyListeners(data) {
  statusListeners.forEach(fn => {
    try {
      fn(data)
    } catch (e) {}
  })
}

/**
 * Inicializa o rastreamento contínuo de geolocalização para os colaboradores com auto-ponto ativo.
 */
export function startAutoPunchWatcher(employees = []) {
  activeEmployees = employees.filter(e => e.autoPunchEnabled && e.autoPunchLat != null && e.autoPunchLng != null)
  
  if (activeEmployees.length === 0) {
    stopAutoPunchWatcher()
    return
  }

  if (watchId !== null) return // Já está ativo

  if (!('geolocation' in navigator)) {
    console.warn('[AutoPunch] Geolocalização não suportada neste dispositivo.')
    return
  }

  // Solicitar permissão de notificação nativa proativamente
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }

  console.log(`[AutoPunch] Iniciando monitoramento de presença para ${activeEmployees.length} colaborador(es).`)

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      if (isEvaluating) return
      isEvaluating = true
      try {
        const coords = position.coords
        for (const emp of activeEmployees) {
          await evaluateEmployeePosition(emp, coords)
        }
      } catch (err) {
        console.error('[AutoPunch] Erro ao avaliar posição:', err)
      } finally {
        isEvaluating = false
      }
    },
    (err) => {
      console.warn('[AutoPunch] Erro na leitura de GPS:', err.message)
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    }
  )
}

/**
 * Interrompe o rastreamento contínuo.
 */
export function stopAutoPunchWatcher() {
  if (watchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
    console.log('[AutoPunch] Monitoramento de presença interrompido.')
  }
}

/**
 * Permite que componentes da interface se inscrevam para receber atualizações de telemetria em tempo real.
 */
export function subscribeAutoPunchStatus(listener) {
  statusListeners.push(listener)
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener)
  }
}
