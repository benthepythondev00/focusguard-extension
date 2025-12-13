export type TimerStatus = 'idle' | 'running' | 'paused' | 'break' | 'longBreak';

export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export interface TimerState {
  status: TimerStatus;
  sessionType: SessionType;
  timeRemaining: number; // in seconds
  sessionsCompleted: number;
  totalFocusTime: number; // in seconds, cumulative today
  startedAt: number | null; // timestamp
}

export interface TimerSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  focusSessions: number;
  totalFocusMinutes: number;
  breaks: number;
}

export interface Settings extends TimerSettings {
  isPro: boolean;
  maxFreeSessions: number; // Free tier limit per day
}

export const DEFAULT_SETTINGS: Settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  notificationsEnabled: true,
  theme: 'system',
  isPro: false,
  maxFreeSessions: 8, // 8 free Pomodoro sessions per day
};

export const DEFAULT_TIMER_STATE: TimerState = {
  status: 'idle',
  sessionType: 'focus',
  timeRemaining: 25 * 60, // 25 minutes in seconds
  sessionsCompleted: 0,
  totalFocusTime: 0,
  startedAt: null,
};
