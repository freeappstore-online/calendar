export interface CalendarEvent {
  id: string
  title: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM
  endTime: string     // HH:MM
  color: string
  description?: string
  isBooking?: boolean
  bookedBy?: string
  bookedByName?: string
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export interface AvailabilitySlot {
  day: number          // 0=Sun, 1=Mon, ...
  startTime: string    // HH:MM
  endTime: string      // HH:MM
}

export interface BookingConfig {
  enabled: boolean
  title: string
  slotDuration: number // minutes: 15, 30, 45, 60
  bufferTime: number   // minutes between slots
  availability: AvailabilitySlot[]
  maxDaysAhead: number // how far ahead can people book
}

export type ViewMode = 'month' | 'week' | 'day'

export const EVENT_COLORS: string[] = [
  '#d86f4d', '#4c97b5', '#4d9a6a', '#c6862a',
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
]

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const
