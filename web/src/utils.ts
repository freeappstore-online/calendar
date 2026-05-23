import type { CalendarEvent, BookingConfig } from './types'

// ---- Date helpers ----

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay())
  return r
}

export function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const weeks: Date[][] = []
  let current = addDays(first, -startDay)

  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current = addDays(current, 1)
    }
    // Skip week if all days are in next month and we already have enough weeks
    if (w >= 4 && week[0].getMonth() !== month && week[0].getDate() > 7) break
    weeks.push(week)
  }
  return weeks
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// ---- Time helpers ----

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`
}

// ---- Event helpers ----

const HOURS = Array.from({ length: 24 }, (_, i) => i)
export { HOURS }

export function getEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter(e => {
    if (e.date === date) return true
    if (!e.recurrence || e.recurrence === 'none') return false
    const eventDate = parseDate(e.date)
    const targetDate = parseDate(date)
    if (targetDate < eventDate) return false
    switch (e.recurrence) {
      case 'daily': return true
      case 'weekly': return eventDate.getDay() === targetDate.getDay()
      case 'monthly': return eventDate.getDate() === targetDate.getDate()
      case 'yearly':
        return eventDate.getMonth() === targetDate.getMonth() &&
               eventDate.getDate() === targetDate.getDate()
      default: return false
    }
  })
}

export function sortByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
}

// ---- Booking helpers ----

export function generateTimeSlots(
  config: BookingConfig,
  date: Date,
  existingEvents: CalendarEvent[]
): string[] {
  const dayOfWeek = date.getDay()
  const daySlots = config.availability.filter(s => s.day === dayOfWeek)
  if (daySlots.length === 0) return []

  const dateStr = toDateStr(date)
  const dayEvents = getEventsForDate(existingEvents, dateStr)
  const slots: string[] = []

  for (const slot of daySlots) {
    const startMin = timeToMinutes(slot.startTime)
    const endMin = timeToMinutes(slot.endTime)
    let current = startMin

    while (current + config.slotDuration <= endMin) {
      const slotStart = minutesToTime(current)

      // Check for conflicts with existing events
      const conflict = dayEvents.some(ev => {
        const evStart = timeToMinutes(ev.startTime)
        const evEnd = timeToMinutes(ev.endTime)
        return current < evEnd && current + config.slotDuration > evStart
      })

      if (!conflict) {
        slots.push(slotStart)
      }
      current += config.slotDuration + config.bufferTime
    }
  }

  return slots
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---- Persistence ----

const EVENTS_KEY = 'calendar_events'
const BOOKING_KEY = 'calendar_booking'

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

export function loadBookingConfig(): BookingConfig {
  try {
    const raw = localStorage.getItem(BOOKING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    enabled: false,
    title: 'Book a meeting',
    slotDuration: 30,
    bufferTime: 0,
    availability: [
      { day: 1, startTime: '09:00', endTime: '17:00' },
      { day: 2, startTime: '09:00', endTime: '17:00' },
      { day: 3, startTime: '09:00', endTime: '17:00' },
      { day: 4, startTime: '09:00', endTime: '17:00' },
      { day: 5, startTime: '09:00', endTime: '17:00' },
    ],
    maxDaysAhead: 30,
  }
}

export function saveBookingConfig(config: BookingConfig) {
  localStorage.setItem(BOOKING_KEY, JSON.stringify(config))
}
