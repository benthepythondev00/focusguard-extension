import { describe, it, expect, beforeEach } from 'vitest';
import { 
  timerOperations, 
  settingsOperations, 
  statsOperations,
  getTodayString 
} from './storage';
import { clearMockStorage, setMockStorageValue } from '../test/setup';
import { DEFAULT_SETTINGS, DEFAULT_TIMER_STATE } from '../types/timer';

// Clear storage before each test to ensure isolation
beforeEach(() => {
  clearMockStorage();
});

describe('getTodayString', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const result = getTodayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\'s date', () => {
    const result = getTodayString();
    const expected = new Date().toISOString().split('T')[0];
    expect(result).toBe(expected);
  });
});

describe('timerOperations', () => {
  describe('getState', () => {
    it('returns default state when storage is empty', async () => {
      const state = await timerOperations.getState();
      expect(state.status).toBe('idle');
      expect(state.sessionType).toBe('focus');
      expect(state.timeRemaining).toBe(25 * 60);
      expect(state.sessionsCompleted).toBe(0);
    });

    it('returns stored state', async () => {
      const customState = {
        ...DEFAULT_TIMER_STATE,
        status: 'running' as const,
        timeRemaining: 1200,
        sessionsCompleted: 3,
      };
      setMockStorageValue('local:timerState', customState);
      
      const state = await timerOperations.getState();
      expect(state.status).toBe('running');
      expect(state.timeRemaining).toBe(1200);
      expect(state.sessionsCompleted).toBe(3);
    });
  });

  describe('setState', () => {
    it('updates state partially', async () => {
      const updated = await timerOperations.setState({ status: 'running' });
      expect(updated.status).toBe('running');
      expect(updated.sessionType).toBe('focus'); // unchanged
    });

    it('persists state changes', async () => {
      await timerOperations.setState({ timeRemaining: 600 });
      const state = await timerOperations.getState();
      expect(state.timeRemaining).toBe(600);
    });
  });

  describe('reset', () => {
    it('resets to default state with settings duration', async () => {
      // Set custom settings
      await settingsOperations.update({ focusDuration: 30 });
      
      // Start a session
      await timerOperations.setState({ 
        status: 'running', 
        timeRemaining: 100,
        sessionsCompleted: 5 
      });
      
      // Reset
      const resetState = await timerOperations.reset();
      
      expect(resetState.status).toBe('idle');
      expect(resetState.timeRemaining).toBe(30 * 60); // Uses settings duration
      expect(resetState.sessionsCompleted).toBe(0);
    });
  });

  describe('startSession', () => {
    it('starts focus session with correct duration', async () => {
      const state = await timerOperations.startSession('focus');
      
      expect(state.status).toBe('running');
      expect(state.sessionType).toBe('focus');
      expect(state.timeRemaining).toBe(25 * 60); // default 25 min
      expect(state.startedAt).toBeTruthy();
    });

    it('starts short break with correct duration', async () => {
      const state = await timerOperations.startSession('shortBreak');
      
      expect(state.sessionType).toBe('shortBreak');
      expect(state.timeRemaining).toBe(5 * 60); // default 5 min
    });

    it('starts long break with correct duration', async () => {
      const state = await timerOperations.startSession('longBreak');
      
      expect(state.sessionType).toBe('longBreak');
      expect(state.timeRemaining).toBe(15 * 60); // default 15 min
    });

    it('uses custom durations from settings', async () => {
      await settingsOperations.update({ 
        focusDuration: 50,
        shortBreakDuration: 10,
        longBreakDuration: 30 
      });
      
      const focus = await timerOperations.startSession('focus');
      expect(focus.timeRemaining).toBe(50 * 60);
      
      const shortBreak = await timerOperations.startSession('shortBreak');
      expect(shortBreak.timeRemaining).toBe(10 * 60);
      
      const longBreak = await timerOperations.startSession('longBreak');
      expect(longBreak.timeRemaining).toBe(30 * 60);
    });
  });

  describe('completeSession', () => {
    it('increments sessions completed after focus session', async () => {
      await timerOperations.startSession('focus');
      const completed = await timerOperations.completeSession();
      
      expect(completed.sessionsCompleted).toBe(1);
    });

    it('switches to short break after focus session', async () => {
      await timerOperations.startSession('focus');
      const completed = await timerOperations.completeSession();
      
      expect(completed.sessionType).toBe('shortBreak');
      expect(completed.status).toBe('idle');
    });

    it('switches to long break after 4 focus sessions', async () => {
      // Complete 3 sessions first
      setMockStorageValue('local:timerState', {
        ...DEFAULT_TIMER_STATE,
        status: 'running',
        sessionType: 'focus',
        sessionsCompleted: 3,
      });
      
      const completed = await timerOperations.completeSession();
      
      expect(completed.sessionsCompleted).toBe(4);
      expect(completed.sessionType).toBe('longBreak');
    });

    it('switches to focus after break session', async () => {
      await timerOperations.startSession('shortBreak');
      const completed = await timerOperations.completeSession();
      
      expect(completed.sessionType).toBe('focus');
    });
  });
});

describe('settingsOperations', () => {
  describe('get', () => {
    it('returns default settings when storage is empty', async () => {
      const settings = await settingsOperations.get();
      
      expect(settings.focusDuration).toBe(25);
      expect(settings.shortBreakDuration).toBe(5);
      expect(settings.longBreakDuration).toBe(15);
      expect(settings.sessionsUntilLongBreak).toBe(4);
      expect(settings.isPro).toBe(false);
      expect(settings.maxFreeSessions).toBe(8);
    });
  });

  describe('update', () => {
    it('updates settings partially', async () => {
      const updated = await settingsOperations.update({ focusDuration: 45 });
      
      expect(updated.focusDuration).toBe(45);
      expect(updated.shortBreakDuration).toBe(5); // unchanged
    });

    it('persists settings changes', async () => {
      await settingsOperations.update({ theme: 'dark' });
      const settings = await settingsOperations.get();
      
      expect(settings.theme).toBe('dark');
    });

    it('updates isPro status', async () => {
      await settingsOperations.update({ isPro: true });
      const settings = await settingsOperations.get();
      
      expect(settings.isPro).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets to default settings', async () => {
      await settingsOperations.update({ 
        focusDuration: 60,
        theme: 'dark',
        isPro: true 
      });
      
      const reset = await settingsOperations.reset();
      
      expect(reset.focusDuration).toBe(25);
      expect(reset.theme).toBe('system');
      expect(reset.isPro).toBe(false);
    });
  });
});

describe('statsOperations', () => {
  describe('getTodayStats', () => {
    it('returns today\'s stats when available', async () => {
      const today = getTodayString();
      setMockStorageValue('local:dailyStats', [{
        date: today,
        focusSessions: 5,
        totalFocusMinutes: 125,
        breaks: 4,
      }]);
      
      const stats = await statsOperations.getTodayStats();
      expect(stats?.focusSessions).toBe(5);
      expect(stats?.totalFocusMinutes).toBe(125);
    });
  });

  describe('getAllStats', () => {
    it('returns all stored stats', async () => {
      setMockStorageValue('local:dailyStats', [
        { date: '2025-12-10', focusSessions: 3, totalFocusMinutes: 75, breaks: 2 },
        { date: '2025-12-11', focusSessions: 5, totalFocusMinutes: 125, breaks: 4 },
      ]);
      
      const stats = await statsOperations.getAllStats();
      expect(stats.length).toBe(2);
    });
  });

  describe('recordFocusSession', () => {
    it('increments existing stats for today', async () => {
      const today = getTodayString();
      setMockStorageValue('local:dailyStats', [{
        date: today,
        focusSessions: 3,
        totalFocusMinutes: 75,
        breaks: 2,
      }]);
      
      const updated = await statsOperations.recordFocusSession(0);
      expect(updated.focusSessions).toBe(4);
    });
  });

  describe('recordBreak', () => {
    it('increments break count', async () => {
      const today = getTodayString();
      setMockStorageValue('local:dailyStats', [{
        date: today,
        focusSessions: 3,
        totalFocusMinutes: 75,
        breaks: 2,
      }]);
      
      await statsOperations.recordBreak();
      const stats = await statsOperations.getTodayStats();
      
      expect(stats?.breaks).toBe(3);
    });
  });

  describe('canStartSession', () => {
    it('allows unlimited sessions for Pro users', async () => {
      await settingsOperations.update({ isPro: true });
      
      const result = await statsOperations.canStartSession();
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('allows free users up to 8 sessions', async () => {
      const today = getTodayString();
      setMockStorageValue('local:dailyStats', [{
        date: today,
        focusSessions: 5,
        totalFocusMinutes: 125,
        breaks: 4,
      }]);
      
      const result = await statsOperations.canStartSession();
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.limit).toBe(8);
    });

    it('blocks free users after 8 sessions', async () => {
      const today = getTodayString();
      setMockStorageValue('local:dailyStats', [{
        date: today,
        focusSessions: 8,
        totalFocusMinutes: 200,
        breaks: 7,
      }]);
      
      const result = await statsOperations.canStartSession();
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });
});

describe('Timer type constants', () => {
  it('has correct default timer state values', () => {
    expect(DEFAULT_TIMER_STATE.status).toBe('idle');
    expect(DEFAULT_TIMER_STATE.sessionType).toBe('focus');
    expect(DEFAULT_TIMER_STATE.timeRemaining).toBe(25 * 60);
    expect(DEFAULT_TIMER_STATE.sessionsCompleted).toBe(0);
    expect(DEFAULT_TIMER_STATE.totalFocusTime).toBe(0);
    expect(DEFAULT_TIMER_STATE.startedAt).toBeNull();
  });

  it('has correct default settings values', () => {
    expect(DEFAULT_SETTINGS.focusDuration).toBe(25);
    expect(DEFAULT_SETTINGS.shortBreakDuration).toBe(5);
    expect(DEFAULT_SETTINGS.longBreakDuration).toBe(15);
    expect(DEFAULT_SETTINGS.sessionsUntilLongBreak).toBe(4);
    expect(DEFAULT_SETTINGS.autoStartBreaks).toBe(false);
    expect(DEFAULT_SETTINGS.autoStartFocus).toBe(false);
    expect(DEFAULT_SETTINGS.soundEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.notificationsEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.theme).toBe('system');
    expect(DEFAULT_SETTINGS.isPro).toBe(false);
    expect(DEFAULT_SETTINGS.maxFreeSessions).toBe(8);
  });
});

describe('Edge cases', () => {
  it('handles zero time remaining', async () => {
    await timerOperations.setState({ 
      status: 'running', 
      timeRemaining: 0,
      sessionType: 'focus' 
    });
    
    const state = await timerOperations.getState();
    expect(state.timeRemaining).toBe(0);
  });

  it('preserves other state when updating', async () => {
    await timerOperations.setState({
      status: 'running',
      sessionType: 'focus',
      timeRemaining: 1500,
      sessionsCompleted: 2,
      totalFocusTime: 3000,
      startedAt: Date.now(),
    });
    
    await timerOperations.setState({ timeRemaining: 1400 });
    
    const state = await timerOperations.getState();
    expect(state.sessionsCompleted).toBe(2);
    expect(state.totalFocusTime).toBe(3000);
  });

  it('handles custom session count for long break', async () => {
    await settingsOperations.update({ sessionsUntilLongBreak: 2 });
    
    // Complete 1 session
    await timerOperations.startSession('focus');
    await timerOperations.completeSession();
    
    // Complete 2nd session - should trigger long break
    setMockStorageValue('local:timerState', {
      ...DEFAULT_TIMER_STATE,
      status: 'running',
      sessionType: 'focus',
      sessionsCompleted: 1,
    });
    
    const completed = await timerOperations.completeSession();
    expect(completed.sessionType).toBe('longBreak');
  });
});
