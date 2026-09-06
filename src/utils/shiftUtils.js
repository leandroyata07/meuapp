// Regras e utilitários de escalas, turnos e legislação trabalhista (CLT)

export const DAYS_OF_WEEK = [
  { id: 1, label: 'Seg', fullName: 'Segunda-feira' },
  { id: 2, label: 'Ter', fullName: 'Terça-feira' },
  { id: 3, label: 'Qua', fullName: 'Quarta-feira' },
  { id: 4, label: 'Qui', fullName: 'Quinta-feira' },
  { id: 5, label: 'Sex', fullName: 'Sexta-feira' },
  { id: 6, label: 'Sáb', fullName: 'Sábado' },
  { id: 0, label: 'Dom', fullName: 'Domingo' }
]

export const SHIFT_PRESETS = [
  {
    id: 'clt_5x2_44',
    name: 'CLT 5x2 (44h)',
    badge: '5x2 • 44h',
    lawRef: 'CF Art. 7º, XIII',
    description: 'Segunda a Sexta (8h48/dia) com 1h de almoço. Folga aos sábados e domingos.',
    weeklyHours: 44,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '17:48',
    breakMinutes: 60,
    isScale: false
  },
  {
    id: 'clt_5x2_40',
    name: 'CLT 5x2 (40h)',
    badge: '5x2 • 40h',
    lawRef: 'CF Art. 7º, XIII',
    description: 'Segunda a Sexta (8h00/dia) com 1h de almoço. Folga aos sábados e domingos.',
    weeklyHours: 40,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '17:00',
    breakMinutes: 60,
    isScale: false
  },
  {
    id: 'clt_6x1_44',
    name: 'CLT 6x1 Comercial (44h)',
    badge: '6x1 • 44h',
    lawRef: 'CLT Art. 58 e 67',
    description: 'Segunda a Sábado (7h20/dia) com 1h de almoço. DSR aos domingos.',
    weeklyHours: 44,
    workDays: [1, 2, 3, 4, 5, 6],
    shiftStart: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '16:20',
    breakMinutes: 60,
    isScale: false
  },
  {
    id: 'scale_12x36_day',
    name: 'Escala 12x36 Diurna',
    badge: '12x36 • Diurno',
    lawRef: 'CLT Art. 59-A',
    description: '12h de trabalho por 36h de descanso ininterrupto (Dia sim, Dia não).',
    weeklyHours: 36,
    workDays: [],
    shiftStart: '07:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '19:00',
    breakMinutes: 60,
    isScale: true,
    scaleType: '12x36'
  },
  {
    id: 'scale_12x36_night',
    name: 'Escala 12x36 Noturna',
    badge: '12x36 • Noturno',
    lawRef: 'CLT Art. 59-A e 73',
    description: '12h noturnas por 36h de descanso. Aplica-se adicional noturno.',
    weeklyHours: 36,
    workDays: [],
    shiftStart: '19:00',
    lunchStart: '00:00',
    lunchEnd: '01:00',
    shiftEnd: '07:00',
    breakMinutes: 60,
    isScale: true,
    scaleType: '12x36',
    isNightShift: true
  },
  {
    id: 'scale_24x72',
    name: 'Escala 24x72 (Plantão)',
    badge: '24x72 • Plantão',
    lawRef: 'CCT / Leg. Específica',
    description: '24h de trabalho por 72h (3 dias inteiros) de folga contínua. Portaria, vigilância e saúde.',
    weeklyHours: 42,
    workDays: [],
    shiftStart: '07:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '07:00',
    breakMinutes: 60,
    isScale: true,
    scaleType: '24x72'
  },
  {
    id: 'scale_4x2',
    name: 'Escala 4x2 (Revezamento)',
    badge: '4x2 • Ciclo 6d',
    lawRef: 'Acordo Coletivo',
    description: '4 dias consecutivos de trabalho por 2 dias de folga ininterrupta.',
    weeklyHours: 44,
    workDays: [],
    shiftStart: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '19:00',
    breakMinutes: 60,
    isScale: true,
    scaleType: '4x2'
  },
  {
    id: 'internship_30',
    name: 'Estágio / Parcial (30h)',
    badge: 'Estágio • 30h',
    lawRef: 'Lei 11.788/08',
    description: 'Segunda a Sexta (6h/dia) com 15 min de intervalo obrigatório (CLT art. 71, § 1º).',
    weeklyHours: 30,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '08:00',
    lunchStart: '11:45',
    lunchEnd: '12:00',
    shiftEnd: '14:15',
    breakMinutes: 15,
    isScale: false
  },
  {
    id: 'custom',
    name: 'Personalizado',
    badge: 'Personalizado',
    lawRef: 'Acordo Individual',
    description: 'Configuração flexível dos dias da semana e horários de batida.',
    weeklyHours: 44,
    workDays: [1, 2, 3, 4, 5],
    shiftStart: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    shiftEnd: '17:00',
    breakMinutes: 60,
    isScale: false
  }
]

export function toMinutes(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function calculateNetShiftTime(start, lunchStart, lunchEnd, end) {
  if (!start || !end) return { dailyMin: 0, breakMin: 0, netText: '0h', breakText: '0m' }

  const sMin = toMinutes(start)
  let eMin = toMinutes(end)
  // Cross midnight or 24h
  if (eMin <= sMin) {
    eMin += 24 * 60
  }

  let breakMin = 0
  if (lunchStart && lunchEnd) {
    let ls = toMinutes(lunchStart)
    let le = toMinutes(lunchEnd)
    if (le <= ls) le += 24 * 60
    breakMin = Math.max(0, le - ls)
  }

  const grossMin = eMin - sMin
  const netMin = Math.max(0, grossMin - breakMin)

  const hours = Math.floor(netMin / 60)
  const mins = netMin % 60

  const bHours = Math.floor(breakMin / 60)
  const bMins = breakMin % 60

  return {
    dailyMin: netMin,
    breakMin,
    netText: `${hours}h ${mins.toString().padStart(2, '0')}m`,
    breakText: bHours > 0 ? `${bHours}h ${bMins.toString().padStart(2, '0')}m` : `${bMins} min`
  }
}

export function checkEmployeeWorkDay(emp, targetDate = new Date()) {
  if (!emp) return { isWorkDay: true, label: 'Dia Útil', type: 'work' }
  const d = new Date(targetDate)
  d.setHours(0, 0, 0, 0)

  const regime = emp.workRegime || 'clt_5x2_44'
  const preset = SHIFT_PRESETS.find(p => p.id === regime)

  if (preset?.isScale) {
    if (!emp.scaleStartDate) {
      return { isWorkDay: true, isScale: true, label: 'Escala (sem data base)', type: 'work' }
    }
    const [sy, sm, sd] = emp.scaleStartDate.split('-').map(Number)
    const baseDate = new Date(sy, sm - 1, sd)
    baseDate.setHours(0, 0, 0, 0)

    const diffMs = d.getTime() - baseDate.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (preset.scaleType === '12x36') {
      const mod = ((diffDays % 2) + 2) % 2
      const isWork = mod === 0
      return {
        isWorkDay: isWork,
        isScale: true,
        label: isWork ? 'Escala 12x36 (Trabalho)' : 'Escala 12x36 (Folga)',
        shortLabel: isWork ? '12x36 Trab' : '12x36 Folga',
        type: isWork ? 'work' : 'off'
      }
    } else if (preset.scaleType === '24x72') {
      const mod = ((diffDays % 4) + 4) % 4
      const isWork = mod === 0
      return {
        isWorkDay: isWork,
        isScale: true,
        label: isWork ? 'Plantão 24h (Trabalho)' : `Folga 72h (${mod}º dia)`,
        shortLabel: isWork ? '24h Plantão' : `Folga (${mod}/3)`,
        type: isWork ? 'work' : 'off'
      }
    } else if (preset.scaleType === '4x2') {
      const mod = ((diffDays % 6) + 6) % 6
      const isWork = mod < 4
      return {
        isWorkDay: isWork,
        isScale: true,
        label: isWork ? `Escala 4x2 (${mod + 1}º dia Trab)` : `Escala 4x2 (${mod - 3}º dia Folga)`,
        shortLabel: isWork ? `4x2 Trab (${mod + 1}/4)` : `4x2 Folga`,
        type: isWork ? 'work' : 'off'
      }
    }
  }

  // Regular days of week
  const workDays = Array.isArray(emp.workDays) && emp.workDays.length > 0 
    ? emp.workDays 
    : [1, 2, 3, 4, 5]

  const dayOfWeek = d.getDay()
  const isWork = workDays.includes(dayOfWeek)
  
  let label = 'Dia de Trabalho'
  let shortLabel = 'Trabalho'
  if (!isWork) {
    if (dayOfWeek === 0) {
      label = 'Domingo (DSR)'
      shortLabel = 'DSR'
    } else if (dayOfWeek === 6) {
      label = 'Sábado (Folga)'
      shortLabel = 'Sábado'
    } else {
      label = 'Folga Semanal'
      shortLabel = 'Folga'
    }
  }

  return {
    isWorkDay: isWork,
    isScale: false,
    label,
    shortLabel,
    type: isWork ? 'work' : 'off'
  }
}

export function formatWorkDaysSummary(emp) {
  if (!emp) return 'Seg a Sex'
  const regime = emp.workRegime || 'clt_5x2_44'
  const preset = SHIFT_PRESETS.find(p => p.id === regime)
  if (preset?.isScale) {
    return preset.name
  }

  const days = Array.isArray(emp.workDays) ? emp.workDays : [1, 2, 3, 4, 5]
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) {
    return 'Seg a Sex'
  }
  if (days.length === 6 && [1, 2, 3, 4, 5, 6].every(d => days.includes(d))) {
    return 'Seg a Sáb'
  }
  if (days.length === 7) {
    return 'Todos os dias'
  }

  const labels = DAYS_OF_WEEK.filter(d => days.includes(d.id)).map(d => d.label)
  return labels.join(', ') || 'Nenhum dia configurado'
}
