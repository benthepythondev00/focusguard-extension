import { useState, useEffect, useCallback } from 'react';
import { Settings, BarChart3, Play, Pause, Square, SkipForward, Coffee, Brain, Loader2 } from 'lucide-react';
import type { TimerState, Settings as SettingsType, DailyStats } from '../../types/timer';
import { DEFAULT_TIMER_STATE, DEFAULT_SETTINGS } from '../../types/timer';
import { SettingsModal } from '../../components/SettingsModal';
import { StatsModal } from '../../components/StatsModal';

function App() {
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_TIMER_STATE);
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [canStart, setCanStart] = useState({ allowed: true, remaining: 8, limit: 8 });

  // Apply theme
  const applyTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [state, settingsData, stats, canStartData] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATE' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' }),
        chrome.runtime.sendMessage({ type: 'CAN_START' }),
      ]);
      
      setTimerState(state);
      setSettings(settingsData);
      setTodayStats(stats);
      setCanStart(canStartData);
      applyTheme(settingsData.theme);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    loadData();
    
    // Poll for updates every second when timer is running
    const interval = setInterval(async () => {
      const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      setTimerState(state);
    }, 1000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Timer controls
  const handleStart = async () => {
    const result = await chrome.runtime.sendMessage({ 
      type: 'START_TIMER', 
      payload: { sessionType: timerState.sessionType } 
    });
    
    if (result.error === 'FREE_LIMIT_REACHED') {
      setCanStart(result);
      setShowSettings(true); // Show upgrade prompt
    } else {
      setTimerState(result);
      const newCanStart = await chrome.runtime.sendMessage({ type: 'CAN_START' });
      setCanStart(newCanStart);
    }
  };

  const handlePause = async () => {
    const result = await chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    setTimerState(result);
  };

  const handleResume = async () => {
    const result = await chrome.runtime.sendMessage({ type: 'RESUME_TIMER' });
    setTimerState(result);
  };

  const handleStop = async () => {
    const result = await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
    setTimerState(result);
  };

  const handleSkip = async () => {
    const result = await chrome.runtime.sendMessage({ type: 'SKIP_SESSION' });
    setTimerState(result);
    const stats = await chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' });
    setTodayStats(stats);
  };

  const handleSettingsChange = async () => {
    const [settingsData, canStartData] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
      chrome.runtime.sendMessage({ type: 'CAN_START' }),
    ]);
    setSettings(settingsData);
    setCanStart(canStartData);
    applyTheme(settingsData.theme);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress
  const getSessionDuration = () => {
    switch (timerState.sessionType) {
      case 'focus': return settings.focusDuration * 60;
      case 'shortBreak': return settings.shortBreakDuration * 60;
      case 'longBreak': return settings.longBreakDuration * 60;
    }
  };

  const progress = timerState.status !== 'idle' 
    ? ((getSessionDuration() - timerState.timeRemaining) / getSessionDuration()) * 100
    : 0;

  // Get colors based on session type
  const getColors = () => {
    if (timerState.sessionType === 'focus') {
      return {
        ring: '#ef4444',
        bg: 'bg-red-50',
        text: 'text-red-600',
        button: 'bg-red-500 hover:bg-red-600',
      };
    }
    return {
      ring: '#22c55e',
      bg: 'bg-green-50',
      text: 'text-green-600',
      button: 'bg-green-500 hover:bg-green-600',
    };
  };

  const colors = getColors();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[480px] bg-white">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[480px] bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">FocusGuard</h1>
              <p className="text-xs text-slate-500">
                {todayStats ? `${todayStats.focusSessions} sessions today` : 'Stay focused'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowStats(true)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Statistics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Timer */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Session Type Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} mb-4`}>
          {timerState.sessionType === 'focus' ? (
            <Brain className={`w-4 h-4 ${colors.text}`} />
          ) : (
            <Coffee className={`w-4 h-4 ${colors.text}`} />
          )}
          <span className={`text-sm font-medium ${colors.text}`}>
            {timerState.sessionType === 'focus' 
              ? 'Focus Time' 
              : timerState.sessionType === 'shortBreak' 
                ? 'Short Break' 
                : 'Long Break'}
          </span>
        </div>

        {/* Timer Circle */}
        <div className="relative w-48 h-48 mb-6">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="#e2e8f0"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke={colors.ring}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 88}
              strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
              className="timer-ring"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-slate-900">
              {formatTime(timerState.timeRemaining)}
            </span>
            <span className="text-sm text-slate-500 mt-1">
              {timerState.status === 'running' ? 'Running' : 
               timerState.status === 'paused' ? 'Paused' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {timerState.status === 'idle' && (
            <button
              onClick={handleStart}
              disabled={!canStart.allowed && timerState.sessionType === 'focus'}
              className={`flex items-center gap-2 px-6 py-3 ${colors.button} text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Play className="w-5 h-5" />
              Start
            </button>
          )}
          
          {timerState.status === 'running' && (
            <>
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
              <button
                onClick={handleStop}
                className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
                title="Stop"
              >
                <Square className="w-5 h-5" />
              </button>
            </>
          )}
          
          {timerState.status === 'paused' && (
            <>
              <button
                onClick={handleResume}
                className={`flex items-center gap-2 px-6 py-3 ${colors.button} text-white font-medium rounded-xl transition-colors`}
              >
                <Play className="w-5 h-5" />
                Resume
              </button>
              <button
                onClick={handleStop}
                className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
                title="Stop"
              >
                <Square className="w-5 h-5" />
              </button>
            </>
          )}

          {timerState.status !== 'idle' && (
            <button
              onClick={handleSkip}
              className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
              title="Skip to next"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Free tier indicator */}
        {!settings.isPro && timerState.sessionType === 'focus' && (
          <p className="text-xs text-slate-500 mt-4">
            {canStart.remaining} of {canStart.limit} free sessions remaining today
          </p>
        )}
      </main>

      {/* Session Counter */}
      <footer className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Sessions completed</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < (timerState.sessionsCompleted % settings.sessionsUntilLongBreak)
                    ? 'bg-red-500'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {showStats && (
        <StatsModal onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

export default App;
