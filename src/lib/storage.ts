import { storage } from 'wxt/utils/storage';
import type { TimerState, Settings, DailyStats } from '../types/timer';
import { DEFAULT_SETTINGS, DEFAULT_TIMER_STATE } from '../types/timer';

// Storage keys
export const timerStateStorage = storage.defineItem<TimerState>('local:timerState', {
  fallback: DEFAULT_TIMER_STATE,
});

export const settingsStorage = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

export const dailyStatsStorage = storage.defineItem<DailyStats[]>('local:dailyStats', {
  fallback: [],
});

// Helper to get today's date string
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Timer operations
export const timerOperations = {
  async getState(): Promise<TimerState> {
    return await timerStateStorage.getValue();
  },

  async setState(state: Partial<TimerState>): Promise<TimerState> {
    const current = await this.getState();
    const updated = { ...current, ...state };
    await timerStateStorage.setValue(updated);
    return updated;
  },

  async reset(): Promise<TimerState> {
    const settings = await settingsStorage.getValue();
    const resetState: TimerState = {
      ...DEFAULT_TIMER_STATE,
      timeRemaining: settings.focusDuration * 60,
    };
    await timerStateStorage.setValue(resetState);
    return resetState;
  },

  async startSession(sessionType: TimerState['sessionType']): Promise<TimerState> {
    const settings = await settingsStorage.getValue();
    let duration: number;
    
    switch (sessionType) {
      case 'focus':
        duration = settings.focusDuration;
        break;
      case 'shortBreak':
        duration = settings.shortBreakDuration;
        break;
      case 'longBreak':
        duration = settings.longBreakDuration;
        break;
    }

    const state = await this.getState();
    return await this.setState({
      status: 'running',
      sessionType,
      timeRemaining: duration * 60,
      startedAt: Date.now(),
    });
  },

  async completeSession(): Promise<TimerState> {
    const state = await this.getState();
    const settings = await settingsStorage.getValue();
    
    if (state.sessionType === 'focus') {
      // Update stats
      await statsOperations.recordFocusSession(state.timeRemaining);
      
      const newSessionsCompleted = state.sessionsCompleted + 1;
      const isLongBreak = newSessionsCompleted % settings.sessionsUntilLongBreak === 0;
      
      return await this.setState({
        status: 'idle',
        sessionsCompleted: newSessionsCompleted,
        totalFocusTime: state.totalFocusTime + (settings.focusDuration * 60),
        sessionType: isLongBreak ? 'longBreak' : 'shortBreak',
        timeRemaining: (isLongBreak ? settings.longBreakDuration : settings.shortBreakDuration) * 60,
        startedAt: null,
      });
    } else {
      // Break completed, switch to focus
      await statsOperations.recordBreak();
      
      return await this.setState({
        status: 'idle',
        sessionType: 'focus',
        timeRemaining: settings.focusDuration * 60,
        startedAt: null,
      });
    }
  },
};

// Settings operations
export const settingsOperations = {
  async get(): Promise<Settings> {
    return await settingsStorage.getValue();
  },

  async update(updates: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...updates };
    await settingsStorage.setValue(updated);
    return updated;
  },

  async reset(): Promise<Settings> {
    await settingsStorage.setValue(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  },
};

// Stats operations
export const statsOperations = {
  async getTodayStats(): Promise<DailyStats | null> {
    const stats = await dailyStatsStorage.getValue();
    const today = getTodayString();
    return stats.find(s => s.date === today) || null;
  },

  async getAllStats(): Promise<DailyStats[]> {
    return await dailyStatsStorage.getValue();
  },

  async recordFocusSession(unusedSeconds: number = 0): Promise<DailyStats> {
    const stats = await dailyStatsStorage.getValue();
    const today = getTodayString();
    const settings = await settingsStorage.getValue();
    
    const todayIndex = stats.findIndex(s => s.date === today);
    const focusMinutes = settings.focusDuration - Math.floor(unusedSeconds / 60);
    
    if (todayIndex >= 0) {
      stats[todayIndex].focusSessions += 1;
      stats[todayIndex].totalFocusMinutes += focusMinutes;
    } else {
      stats.push({
        date: today,
        focusSessions: 1,
        totalFocusMinutes: focusMinutes,
        breaks: 0,
      });
    }
    
    // Keep only last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filtered = stats.filter(s => new Date(s.date) >= thirtyDaysAgo);
    
    await dailyStatsStorage.setValue(filtered);
    return filtered.find(s => s.date === today)!;
  },

  async recordBreak(): Promise<void> {
    const stats = await dailyStatsStorage.getValue();
    const today = getTodayString();
    
    const todayIndex = stats.findIndex(s => s.date === today);
    
    if (todayIndex >= 0) {
      stats[todayIndex].breaks += 1;
    } else {
      stats.push({
        date: today,
        focusSessions: 0,
        totalFocusMinutes: 0,
        breaks: 1,
      });
    }
    
    await dailyStatsStorage.setValue(stats);
  },

  async canStartSession(): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const settings = await settingsStorage.getValue();
    const todayStats = await this.getTodayStats();
    
    if (settings.isPro) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }
    
    const used = todayStats?.focusSessions || 0;
    const remaining = settings.maxFreeSessions - used;
    
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      limit: settings.maxFreeSessions,
    };
  },
};
