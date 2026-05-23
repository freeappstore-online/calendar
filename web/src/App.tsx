import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { initApp } from '@freeappstore/sdk'
import { FasShell, BuildInfo, Modal, Tabs } from '@freeappstore/sdk/ui'
import { useAuth } from '@freeappstore/sdk/hooks'
import type { CalendarEvent, ViewMode, BookingConfig, AvailabilitySlot } from './types'
import { EVENT_COLORS, DAY_NAMES, DAY_NAMES_FULL, MONTH_NAMES } from './types'
import {
  toDateStr, parseDate, addDays, startOfWeek, getMonthGrid, getWeekDays,
  timeToMinutes, minutesToTime, formatTime, formatTimeRange, HOURS,
  getEventsForDate, sortByTime, generateTimeSlots, generateId,
  loadEvents, saveEvents, loadBookingConfig, saveBookingConfig,
} from './utils'

const fas = initApp({ appId: 'calendar' })

// ---- Mobile detection ----

function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    setMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return mobile
}

// ---- Swipe support ----

function useSwipe(onLeft: () => void, onRight: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startX = 0
    let startY = 0
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) onRight()
        else onLeft()
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [onLeft, onRight])
  return ref
}

// ---- Shared styles ----

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--line-strong)', background: 'var(--paper)',
  color: 'var(--ink)', fontSize: '1rem', outline: 'none',
}
const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer',
  fontSize: '0.875rem',
}
const btnOutline: React.CSSProperties = {
  ...btnStyle, background: 'transparent', border: '1px solid var(--line-strong)',
  color: 'var(--ink)',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)',
  marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em',
}

// ---- Event Form Modal ----

function EventModal({ open, onClose, onSave, onDelete, event, defaultDate }: {
  open: boolean
  onClose: () => void
  onSave: (e: CalendarEvent) => void
  onDelete?: () => void
  event?: CalendarEvent | null
  defaultDate: string
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [color, setColor] = useState(EVENT_COLORS[0])
  const [description, setDescription] = useState('')
  const [recurrence, setRecurrence] = useState<CalendarEvent['recurrence']>('none')

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setDate(event.date)
      setStartTime(event.startTime)
      setEndTime(event.endTime)
      setColor(event.color)
      setDescription(event.description || '')
      setRecurrence(event.recurrence || 'none')
    } else {
      setTitle('')
      setDate(defaultDate)
      setStartTime('09:00')
      setEndTime('10:00')
      setColor(EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)])
      setDescription('')
      setRecurrence('none')
    }
  }, [event, defaultDate, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      id: event?.id || generateId(),
      title: title.trim(),
      date, startTime, endTime, color, description, recurrence,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={event ? 'Edit Event' : 'New Event'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Meeting with team" autoFocus required />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Start</label>
            <input style={inputStyle} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>End</label>
            <input style={inputStyle} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {EVENT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: color === c ? '2px solid var(--ink)' : 'none',
                  outlineOffset: 2, transition: 'outline 100ms', minWidth: 32,
                }} />
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Repeat</label>
          <select style={inputStyle} value={recurrence} onChange={e => setRecurrence(e.target.value as CalendarEvent['recurrence'])}>
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={description}
            onChange={e => setDescription(e.target.value)} placeholder="Optional notes..." />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          {onDelete && (
            <button type="button" onClick={onDelete}
              style={{ ...btnOutline, color: 'var(--error)', borderColor: 'var(--error)', marginRight: 'auto',
                minHeight: 44 }}>
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} style={{ ...btnOutline, minHeight: 44 }}>Cancel</button>
          <button type="submit" style={{ ...btnStyle, minHeight: 44 }}>{event ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Month View ----

function MonthView({ year, month, events, selectedDate, onSelectDate, onEventClick, isMobile }: {
  year: number, month: number, events: CalendarEvent[]
  selectedDate: string, onSelectDate: (d: string) => void
  onEventClick: (e: CalendarEvent) => void
  isMobile: boolean
}) {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const todayStr = toDateStr(new Date())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {(isMobile ? ['S','M','T','W','T','F','S'] : DAY_NAMES).map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: isMobile ? '0.65rem' : '0.7rem', fontWeight: 600,
            color: 'var(--muted)', padding: '0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 1 }}>
        {grid.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, flex: 1, minHeight: 0 }}>
            {week.map(day => {
              const dateStr = toDateStr(day)
              const isToday = dateStr === todayStr
              const isCurrentMonth = day.getMonth() === month
              const isSelected = dateStr === selectedDate
              const dayEvents = sortByTime(getEventsForDate(events, dateStr))

              return (
                <button key={dateStr} onClick={() => onSelectDate(dateStr)}
                  style={{
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    padding: isMobile ? '2px' : '0.25rem',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', minHeight: isMobile ? 40 : 0, overflow: 'hidden',
                    opacity: isCurrentMonth ? 1 : 0.35,
                  }}>
                  <span style={{
                    fontSize: isMobile ? '0.8rem' : '0.75rem', fontWeight: isToday ? 700 : 500,
                    color: isToday ? '#fff' : 'var(--ink)',
                    background: isToday ? 'var(--accent)' : 'transparent',
                    borderRadius: '50%',
                    width: isMobile ? 26 : 22, height: isMobile ? 26 : 22,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{day.getDate()}</span>
                  {isMobile ? (
                    // Colored dots on mobile
                    dayEvents.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} style={{
                            width: 5, height: 5, borderRadius: '50%', background: ev.color,
                          }} />
                        ))}
                      </div>
                    )
                  ) : (
                    // Text chips on desktop
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2,
                      overflow: 'hidden', flex: 1, width: '100%' }}>
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                          style={{
                            background: ev.color, color: '#fff', fontSize: '0.6rem',
                            padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
                            fontWeight: 500, lineHeight: '1.3',
                          }}>{ev.title}</div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span style={{ fontSize: '0.55rem', color: 'var(--muted)', textAlign: 'center' }}>
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Week View (3-day on mobile, 7-day on desktop) ----

function WeekView({ dateStr, events, onSelectDate, onEventClick, isMobile }: {
  dateStr: string, events: CalendarEvent[]
  onSelectDate: (d: string) => void, onEventClick: (e: CalendarEvent) => void
  isMobile: boolean
}) {
  const allDays = useMemo(() => getWeekDays(parseDate(dateStr)), [dateStr])
  const todayStr = toDateStr(new Date())

  // On mobile show 3 days centered on selected date
  const days = useMemo(() => {
    if (!isMobile) return allDays
    const sel = parseDate(dateStr)
    return [addDays(sel, -1), sel, addDays(sel, 1)]
  }, [isMobile, dateStr, allDays])

  const colCount = days.length

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `2.5rem repeat(${colCount}, 1fr)`, minWidth: 0 }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0,
          background: 'var(--paper)', zIndex: 2 }} />
        {days.map(d => {
          const ds = toDateStr(d)
          const isToday = ds === todayStr
          const isSelected = ds === dateStr
          return (
            <div key={ds} onClick={() => onSelectDate(ds)}
              style={{ textAlign: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--line)',
                cursor: 'pointer', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 2 }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                {isMobile ? DAY_NAMES[d.getDay()] : DAY_NAMES[d.getDay()]}
              </div>
              <div style={{
                fontSize: isMobile ? '1.1rem' : '1rem', fontWeight: isToday ? 700 : (isSelected ? 600 : 500),
                color: isToday ? '#fff' : 'var(--ink)',
                background: isToday ? 'var(--accent)' : 'transparent',
                borderRadius: '50%',
                width: isMobile ? 32 : 28, height: isMobile ? 32 : 28,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
              }}>{d.getDate()}</div>
            </div>
          )
        })}
        {/* Time grid */}
        {HOURS.map(h => (
          <div key={h} style={{ display: 'contents' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textAlign: 'right',
              paddingRight: '0.25rem', paddingTop: 2, borderTop: '1px solid var(--line)',
              height: isMobile ? 56 : 48 }}>
              {h === 0 ? '' : formatTime(`${String(h).padStart(2, '0')}:00`)}
            </div>
            {days.map(d => {
              const ds = toDateStr(d)
              const dayEvents = getEventsForDate(events, ds).filter(ev => {
                const evH = parseInt(ev.startTime.split(':')[0])
                return evH === h
              })
              const cellH = isMobile ? 56 : 48
              return (
                <div key={`${ds}-${h}`} onClick={() => onSelectDate(ds)}
                  style={{ borderTop: '1px solid var(--line)', height: cellH, position: 'relative',
                    cursor: 'pointer', borderLeft: '1px solid var(--line)' }}>
                  {dayEvents.map(ev => {
                    const startMin = timeToMinutes(ev.startTime)
                    const endMin = timeToMinutes(ev.endTime)
                    const top = ((startMin % 60) / 60) * cellH
                    const height = Math.max(((endMin - startMin) / 60) * cellH, isMobile ? 24 : 18)
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                        style={{
                          position: 'absolute', top, left: 1, right: 1,
                          height, background: ev.color, color: '#fff',
                          borderRadius: 4, padding: '2px 4px',
                          fontSize: isMobile ? '0.7rem' : '0.6rem',
                          overflow: 'hidden', cursor: 'pointer', fontWeight: 500,
                          lineHeight: '1.3', zIndex: 1,
                        }}>
                        {ev.title}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Day View ----

function DayView({ date, events, onEventClick, isMobile }: {
  date: string, events: CalendarEvent[], onEventClick: (e: CalendarEvent) => void
  isMobile: boolean
}) {
  const dayEvents = useMemo(() => sortByTime(getEventsForDate(events, date)), [events, date])
  const d = parseDate(date)
  const todayStr = toDateStr(new Date())
  const cellH = isMobile ? 56 : 48

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>
          {DAY_NAMES_FULL[d.getDay()]}
        </div>
        <div style={{
          fontSize: '1.5rem', fontWeight: 700,
          color: date === todayStr ? '#fff' : 'var(--ink)',
          background: date === todayStr ? 'var(--accent)' : 'transparent',
          borderRadius: '50%', width: 40, height: 40,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{d.getDate()}</div>
      </div>
      <div style={{ position: 'relative' }}>
        {HOURS.map(h => (
          <div key={h} style={{ display: 'flex', borderTop: '1px solid var(--line)', height: cellH }}>
            <div style={{ width: '2.5rem', fontSize: '0.6rem', color: 'var(--muted)',
              textAlign: 'right', paddingRight: '0.25rem', paddingTop: 2, flexShrink: 0 }}>
              {h === 0 ? '' : formatTime(`${String(h).padStart(2, '0')}:00`)}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {dayEvents.filter(ev => parseInt(ev.startTime.split(':')[0]) === h).map(ev => {
                const startMin = timeToMinutes(ev.startTime)
                const endMin = timeToMinutes(ev.endTime)
                const top = ((startMin % 60) / 60) * cellH
                const height = Math.max(((endMin - startMin) / 60) * cellH, 28)
                return (
                  <div key={ev.id} onClick={() => onEventClick(ev)}
                    style={{
                      position: 'absolute', top, left: 2, right: 4,
                      height, background: ev.color, color: '#fff',
                      borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem', overflow: 'hidden', cursor: 'pointer',
                      zIndex: 1, display: 'flex', flexDirection: 'column', gap: 1,
                    }}>
                    <span style={{ fontWeight: 600 }}>{ev.title}</span>
                    <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>
                      {formatTimeRange(ev.startTime, ev.endTime)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Day Sidebar (event list for selected date) ----

function DaySidebar({ date, events, onEventClick, onNewEvent }: {
  date: string, events: CalendarEvent[]
  onEventClick: (e: CalendarEvent) => void, onNewEvent: () => void
}) {
  const dayEvents = useMemo(() => sortByTime(getEventsForDate(events, date)), [events, date])
  const d = parseDate(date)

  return (
    <div style={{ padding: '0.75rem', borderTop: '1px solid var(--line)', background: 'var(--paper-deep)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
          {MONTH_NAMES[d.getMonth()]} {d.getDate()}
        </h3>
        <button onClick={onNewEvent} style={{ ...btnStyle, padding: '0.375rem 0.75rem', fontSize: '0.8rem',
          minHeight: 36 }}>
          + Event
        </button>
      </div>
      {dayEvents.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>No events</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {dayEvents.map(ev => (
            <button key={ev.id} onClick={() => onEventClick(ev)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem',
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', textAlign: 'left', width: '100%', minHeight: 44,
              }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {formatTimeRange(ev.startTime, ev.endTime)}
                  {ev.isBooking && ev.bookedByName && <> &middot; {ev.bookedByName}</>}
                  {ev.recurrence && ev.recurrence !== 'none' && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>&#x21bb; {ev.recurrence}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Booking Settings ----

function BookingSettings({ config, onChange, userId, isMobile }: {
  config: BookingConfig, onChange: (c: BookingConfig) => void, userId?: string
  isMobile: boolean
}) {
  const bookingUrl = userId
    ? `${location.origin}${location.pathname}#/book/${userId}`
    : null
  const [copied, setCopied] = useState(false)

  const updateSlot = (idx: number, field: keyof AvailabilitySlot, value: string | number) => {
    const slots = [...config.availability]
    slots[idx] = { ...slots[idx], [field]: value }
    onChange({ ...config, availability: slots })
  }

  const addSlot = () => {
    const usedDays = new Set(config.availability.map(s => s.day))
    const nextDay = [1, 2, 3, 4, 5, 6, 0].find(d => !usedDays.has(d)) ?? 1
    onChange({ ...config, availability: [...config.availability,
      { day: nextDay, startTime: '09:00', endTime: '17:00' }] })
  }

  const removeSlot = (idx: number) => {
    onChange({ ...config, availability: config.availability.filter((_, i) => i !== idx) })
  }

  const copyUrl = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enable Booking Page</label>
        <button onClick={() => onChange({ ...config, enabled: !config.enabled })}
          style={{
            width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: config.enabled ? 'var(--accent)' : 'var(--line-strong)',
            position: 'relative', transition: 'background 160ms',
          }}>
          <span style={{
            position: 'absolute', top: 3, left: config.enabled ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left 160ms',
          }} />
        </button>
      </div>

      {config.enabled && (
        <>
          {bookingUrl && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input style={{ ...inputStyle, flex: 1, fontSize: '0.8rem' }} value={bookingUrl} readOnly />
              <button onClick={copyUrl} style={{ ...btnOutline, fontSize: '0.8rem', whiteSpace: 'nowrap',
                minHeight: 44 }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {!userId && (
            <p style={{ fontSize: '0.85rem', color: 'var(--warning)', margin: 0 }}>
              Sign in to generate your booking link.
            </p>
          )}

          <div>
            <label style={labelStyle}>Booking Title</label>
            <input style={inputStyle} value={config.title}
              onChange={e => onChange({ ...config, title: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Slot Duration</label>
              <select style={inputStyle} value={config.slotDuration}
                onChange={e => onChange({ ...config, slotDuration: Number(e.target.value) })}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Buffer</label>
              <select style={inputStyle} value={config.bufferTime}
                onChange={e => onChange({ ...config, bufferTime: Number(e.target.value) })}>
                <option value={0}>None</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Max Days Ahead</label>
            <select style={inputStyle} value={config.maxDaysAhead}
              onChange={e => onChange({ ...config, maxDaysAhead: Number(e.target.value) })}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Availability</label>
              <button onClick={addSlot} style={{ ...btnOutline, padding: '0.3rem 0.625rem', fontSize: '0.75rem',
                minHeight: 32 }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {config.availability.map((slot, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center', gap: '0.375rem',
                  padding: isMobile ? '0.5rem' : 0,
                  background: isMobile ? 'var(--panel-quiet)' : 'transparent',
                  borderRadius: isMobile ? 'var(--radius-sm)' : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={slot.day}
                      onChange={e => updateSlot(i, 'day', Number(e.target.value))}>
                      {(isMobile ? DAY_NAMES : DAY_NAMES_FULL).map((name, d) => <option key={d} value={d}>{isMobile ? DAY_NAMES_FULL[d] : name}</option>)}
                    </select>
                    <button onClick={() => removeSlot(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer',
                        fontSize: '1.2rem', padding: '0.25rem', minWidth: 32, minHeight: 32 }}>
                      &times;
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <input style={{ ...inputStyle, width: 'auto', flex: 1 }} type="time" value={slot.startTime}
                      onChange={e => updateSlot(i, 'startTime', e.target.value)} />
                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem', flexShrink: 0 }}>to</span>
                    <input style={{ ...inputStyle, width: 'auto', flex: 1 }} type="time" value={slot.endTime}
                      onChange={e => updateSlot(i, 'endTime', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Public Booking Page ----

const bookingPages = fas.collections.collection('booking_pages')
const bookings = fas.collections.collection('bookings')

function BookingPage({ userId }: { userId: string }) {
  const { user, signIn } = useAuth(fas)
  const [config, setConfig] = useState<BookingConfig | null>(null)
  const [blockedSlots, setBlockedSlots] = useState<{ date: string; startTime: string; endTime: string }[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await bookingPages.query({ owner: userId, limit: 1 })
        if (result.documents.length > 0) {
          const doc = result.documents[0] as Record<string, unknown>
          setConfig(doc.config as BookingConfig)
          setBlockedSlots((doc.blockedSlots as typeof blockedSlots) || [])
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <p style={{ color: 'var(--muted)' }}>Loading booking page...</p>
      </div>
    )
  }

  if (!config || !config.enabled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Booking Unavailable</h2>
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>This booking page is not currently active.</p>
        <button onClick={() => { location.hash = '' }} style={{ ...btnOutline, minHeight: 44 }}>Go to Calendar</button>
      </div>
    )
  }

  const today = new Date()
  const maxDate = addDays(today, config.maxDaysAhead)
  const availableDates: string[] = []
  let d = new Date(today)
  while (d <= maxDate) {
    const daySlots = config.availability.filter(s => s.day === d.getDay())
    if (daySlots.length > 0) availableDates.push(toDateStr(d))
    d = addDays(d, 1)
  }

  const blockedEvents: CalendarEvent[] = blockedSlots.map((s, i) => ({
    id: `blocked-${i}`, title: '', date: s.date,
    startTime: s.startTime, endTime: s.endTime, color: '',
  }))
  const slots = selectedDate ? generateTimeSlots(config, parseDate(selectedDate), blockedEvents) : []

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot || !user) return
    try {
      await bookings.create({
        hostUserId: userId,
        guestName: user.login,
        guestAvatar: user.avatarUrl,
        date: selectedDate,
        startTime: selectedSlot,
        endTime: minutesToTime(timeToMinutes(selectedSlot) + config.slotDuration),
      })
    } catch {}
    setBooked(true)
  }

  if (booked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', flexDirection: 'column', gap: '0.75rem', padding: '2rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--mint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#fff' }}>
          &#10003;
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', textAlign: 'center' }}>Booked!</h2>
        <p style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 320 }}>
          Your booking on {parseDate(selectedDate!).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {formatTime(selectedSlot!)} has been confirmed.
        </p>
        <button onClick={() => { location.hash = '' }} style={{ ...btnOutline, minHeight: 44 }}>Go to Calendar</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem 1rem', minHeight: '100dvh' }}>
      <h1 className="display-font" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        {config.title}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        {config.slotDuration} min slots
      </p>

      <label style={labelStyle}>Pick a date</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
        gap: '0.375rem', marginBottom: '1rem' }}>
        {availableDates.slice(0, 21).map(ds => {
          const dd = parseDate(ds)
          const isSelected = ds === selectedDate
          return (
            <button key={ds} onClick={() => { setSelectedDate(ds); setSelectedSlot(null) }}
              style={{
                padding: '0.5rem 0.25rem', borderRadius: 'var(--radius-sm)',
                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line-strong)',
                background: isSelected ? 'var(--accent-soft)' : 'var(--panel)',
                cursor: 'pointer', textAlign: 'center', minHeight: 56,
              }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {DAY_NAMES[dd.getDay()]}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
                {dd.getDate()}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                {MONTH_NAMES[dd.getMonth()].slice(0, 3)}
              </div>
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <>
          <label style={labelStyle}>Pick a time</label>
          {slots.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No available slots on this day.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem', marginBottom: '1rem' }}>
              {slots.map(s => (
                <button key={s} onClick={() => setSelectedSlot(s)}
                  style={{
                    padding: '0.625rem 0.25rem', borderRadius: 'var(--radius-sm)',
                    border: s === selectedSlot ? '2px solid var(--accent)' : '1px solid var(--line-strong)',
                    background: s === selectedSlot ? 'var(--accent-soft)' : 'var(--panel)',
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, minHeight: 44,
                  }}>
                  {formatTime(s)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedSlot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          {user ? (
            <>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                Booking as <strong>{user.login}</strong>
              </p>
              <button onClick={handleBook} style={{ ...btnStyle, padding: '0.875rem', fontSize: '1rem',
                minHeight: 48 }}>
                Confirm Booking
              </button>
            </>
          ) : (
            <button onClick={signIn} style={{ ...btnStyle, padding: '0.875rem', fontSize: '1rem',
              minHeight: 48 }}>
              Sign in with GitHub to book
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Main App ----

export default function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onHash = () => setHash(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const bookingMatch = hash.match(/^#\/book\/(.+)$/)
  if (bookingMatch) {
    return <BookingPage userId={bookingMatch[1]} />
  }

  return <CalendarApp />
}

function CalendarApp() {
  const { user } = useAuth(fas)
  const isMobile = useIsMobile()
  const today = new Date()
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents)
  const [view, setView] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState(toDateStr(today))
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [showBookingSettings, setShowBookingSettings] = useState(false)
  const [bookingConfig, setBookingConfig] = useState<BookingConfig>(loadBookingConfig)

  // Persist events to localStorage
  useEffect(() => { saveEvents(events) }, [events])
  useEffect(() => { saveBookingConfig(bookingConfig) }, [bookingConfig])

  // Track the booking page doc ID for updates
  const [bookingPageDocId, setBookingPageDocId] = useState<string | null>(null)

  // Sync to KV when signed in
  useEffect(() => {
    if (!user) return
    const ac = new AbortController()
    const syncDown = async () => {
      try {
        const evRaw = await fas.kv.get('events')
        if (ac.signal.aborted) return
        if (evRaw) {
          const remote = JSON.parse(evRaw as string) as CalendarEvent[]
          const remoteIds = new Set(remote.map(e => e.id))
          const localOnly = events.filter(e => !remoteIds.has(e.id))
          if (remote.length === 0 && events.length > 0) {
            await fas.kv.set('events', JSON.stringify(events))
          } else {
            setEvents([...remote, ...localOnly])
          }
        } else if (events.length > 0) {
          await fas.kv.set('events', JSON.stringify(events))
        }

        const cfgRaw = await fas.kv.get('booking_config')
        if (cfgRaw) {
          setBookingConfig(JSON.parse(cfgRaw as string))
        }

        const existing = await bookingPages.query({ owner: user.id, limit: 1 })
        if (existing.documents.length > 0) {
          setBookingPageDocId(existing.documents[0].id)
        }

        const guestBookings = await bookings.query({ limit: 100 })
        const myBookings = guestBookings.documents.filter(
          (b: Record<string, unknown>) => b.hostUserId === user.id
        )
        if (myBookings.length > 0) {
          const newEvents: CalendarEvent[] = myBookings.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            title: `Booking: ${b.guestName as string}`,
            date: b.date as string,
            startTime: b.startTime as string,
            endTime: b.endTime as string,
            color: '#4c97b5',
            description: b.guestEmail ? `Contact: ${b.guestEmail}` : undefined,
            isBooking: true,
            bookedByName: b.guestName as string,
          }))
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id))
            const fresh = newEvents.filter(e => !existingIds.has(e.id))
            return fresh.length > 0 ? [...prev, ...fresh] : prev
          })
        }
      } catch { /* silent */ }
    }
    syncDown()
    return () => ac.abort()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync events up on change (debounced)
  useEffect(() => {
    if (!user) return
    const t = setTimeout(() => {
      fas.kv.set('events', JSON.stringify(events)).catch(() => {})
      fas.kv.set('booking_config', JSON.stringify(bookingConfig)).catch(() => {})

      if (bookingConfig.enabled) {
        const blockedSlots = events.map(e => ({
          date: e.date, startTime: e.startTime, endTime: e.endTime,
        }))
        const payload = { config: bookingConfig, blockedSlots }
        if (bookingPageDocId) {
          bookingPages.update(bookingPageDocId, payload).catch(() => {})
        } else {
          bookingPages.create(payload).then(doc => setBookingPageDocId(doc.id)).catch(() => {})
        }
      }
    }, 500)
    return () => clearTimeout(t)
  }, [events, bookingConfig, user?.id, bookingPageDocId]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToday = () => {
    const t = new Date()
    setYear(t.getFullYear())
    setMonth(t.getMonth())
    setSelectedDate(toDateStr(t))
  }

  const navigateForward = useCallback(() => {
    if (view === 'month') {
      setMonth(m => {
        if (m >= 11) { setYear(y => y + 1); return 0 }
        return m + 1
      })
    } else if (view === 'week') {
      setSelectedDate(prev => {
        const nd = addDays(parseDate(prev), 7)
        setYear(nd.getFullYear()); setMonth(nd.getMonth())
        return toDateStr(nd)
      })
    } else {
      setSelectedDate(prev => {
        const nd = addDays(parseDate(prev), 1)
        setYear(nd.getFullYear()); setMonth(nd.getMonth())
        return toDateStr(nd)
      })
    }
  }, [view])

  const navigateBack = useCallback(() => {
    if (view === 'month') {
      setMonth(m => {
        if (m <= 0) { setYear(y => y - 1); return 11 }
        return m - 1
      })
    } else if (view === 'week') {
      setSelectedDate(prev => {
        const nd = addDays(parseDate(prev), -7)
        setYear(nd.getFullYear()); setMonth(nd.getMonth())
        return toDateStr(nd)
      })
    } else {
      setSelectedDate(prev => {
        const nd = addDays(parseDate(prev), -1)
        setYear(nd.getFullYear()); setMonth(nd.getMonth())
        return toDateStr(nd)
      })
    }
  }, [view])

  const swipeRef = useSwipe(navigateForward, navigateBack)

  const handleSelectDate = useCallback((d: string) => {
    setSelectedDate(d)
    const dt = parseDate(d)
    setYear(dt.getFullYear())
    setMonth(dt.getMonth())
  }, [])

  const handleEventClick = useCallback((e: CalendarEvent) => {
    setEditingEvent(e)
    setShowEventModal(true)
  }, [])

  const handleSaveEvent = (ev: CalendarEvent) => {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === ev.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = ev
        return next
      }
      return [...prev, ev]
    })
    setShowEventModal(false)
    setEditingEvent(null)
  }

  const handleDeleteEvent = () => {
    if (!editingEvent) return
    setEvents(prev => prev.filter(e => e.id !== editingEvent.id))
    setShowEventModal(false)
    setEditingEvent(null)
  }

  const handleNewEvent = () => {
    setEditingEvent(null)
    setShowEventModal(true)
  }

  const headerLabel = view === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : view === 'week'
      ? (() => {
          const d = parseDate(selectedDate)
          const weekStart = startOfWeek(d)
          const weekEnd = addDays(weekStart, 6)
          if (isMobile) return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`
          return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} - ${
            weekEnd.getMonth() !== weekStart.getMonth() ? MONTH_NAMES[weekEnd.getMonth()] + ' ' : ''
          }${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
        })()
      : (() => {
          const d = parseDate(selectedDate)
          if (isMobile) return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`
          return `${DAY_NAMES_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
        })()

  return (
    <FasShell app={fas} appName="Calendar">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.25rem' : '0.5rem',
          padding: isMobile ? '0.375rem 0.5rem' : '0.5rem 0.75rem',
          borderBottom: '1px solid var(--line)',
        }}>
          {/* Row 1: Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
            <button onClick={goToday} style={{ ...btnOutline, padding: '0.3rem 0.5rem', fontSize: '0.75rem',
              minHeight: 36 }}>
              Today
            </button>
            <button onClick={navigateBack} style={{ background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '1.25rem', color: 'var(--ink)', padding: '0.25rem',
              minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>&lsaquo;</button>
            <button onClick={navigateForward} style={{ background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '1.25rem', color: 'var(--ink)', padding: '0.25rem',
              minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>&rsaquo;</button>
            <h2 className="display-font" style={{
              fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, flex: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {headerLabel}
            </h2>
            {!isMobile && (
              <>
                <button onClick={() => setShowBookingSettings(!showBookingSettings)}
                  style={{ ...(showBookingSettings ? btnStyle : btnOutline), padding: '0.3rem 0.625rem',
                    fontSize: '0.75rem' }}>
                  Booking
                </button>
                <button onClick={handleNewEvent} style={{ ...btnStyle, padding: '0.3rem 0.625rem',
                  fontSize: '0.75rem' }}>
                  + Event
                </button>
              </>
            )}
          </div>
          {/* Row 2: View tabs + actions (mobile) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{ flex: 1 }}>
              <Tabs
                tabs={[{ key: 'month', label: isMobile ? 'Mo' : 'Month' },
                       { key: 'week', label: isMobile ? 'Wk' : 'Week' },
                       { key: 'day', label: isMobile ? 'Dy' : 'Day' }]}
                active={view}
                onChange={k => setView(k as ViewMode)}
              />
            </div>
            {isMobile && (
              <>
                <button onClick={() => setShowBookingSettings(!showBookingSettings)}
                  style={{ ...(showBookingSettings ? btnStyle : btnOutline), padding: '0.3rem 0.5rem',
                    fontSize: '0.7rem', minHeight: 32 }}>
                  Book
                </button>
                <button onClick={handleNewEvent} style={{ ...btnStyle, padding: '0.3rem 0.5rem',
                  fontSize: '0.7rem', minHeight: 32 }}>
                  +
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main content */}
        {showBookingSettings ? (
          <BookingSettings config={bookingConfig} onChange={setBookingConfig} userId={user?.id}
            isMobile={isMobile} />
        ) : (
          <div ref={swipeRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
              padding: view === 'month' ? (isMobile ? '0.125rem' : '0.25rem') : 0 }}>
              {view === 'month' && (
                <MonthView year={year} month={month} events={events}
                  selectedDate={selectedDate} onSelectDate={handleSelectDate}
                  onEventClick={handleEventClick} isMobile={isMobile} />
              )}
              {view === 'week' && (
                <WeekView dateStr={selectedDate} events={events}
                  onSelectDate={handleSelectDate} onEventClick={handleEventClick}
                  isMobile={isMobile} />
              )}
              {view === 'day' && (
                <DayView date={selectedDate} events={events} onEventClick={handleEventClick}
                  isMobile={isMobile} />
              )}
            </div>
            {(view === 'month' || view === 'week') && (
              <DaySidebar date={selectedDate} events={events}
                onEventClick={handleEventClick} onNewEvent={handleNewEvent} />
            )}
          </div>
        )}
      </div>

      <EventModal
        open={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null) }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        event={editingEvent}
        defaultDate={selectedDate}
      />
      <BuildInfo />
    </FasShell>
  )
}
