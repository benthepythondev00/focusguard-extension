import { useState, useEffect } from 'react';
import { X, Clock, Target, Coffee, TrendingUp, Crown } from 'lucide-react';
import type { DailyStats, Settings } from '../types/timer';

interface StatsModalProps {
  onClose: () => void;
}

export function StatsModal({ onClose }: StatsModalProps) {
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'week'>('today');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [allStats, settingsData] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_ALL_STATS' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
      ]);
      setStats(allStats || []);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTodayString = () => new Date().toISOString().split('T')[0];

  const todayStats = stats.find(s => s.date === getTodayString()) || {
    date: getTodayString(),
    focusSessions: 0,
    totalFocusMinutes: 0,
    breaks: 0,
  };

  const getWeekStats = () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekStats = stats.filter(s => {
      const date = new Date(s.date);
      return date >= weekAgo && date <= today;
    });

    return {
      totalSessions: weekStats.reduce((sum, s) => sum + s.focusSessions, 0),
      totalMinutes: weekStats.reduce((sum, s) => sum + s.totalFocusMinutes, 0),
      totalBreaks: weekStats.reduce((sum, s) => sum + s.breaks, 0),
      avgSessionsPerDay: weekStats.length > 0 
        ? Math.round(weekStats.reduce((sum, s) => sum + s.focusSessions, 0) / weekStats.length * 10) / 10
        : 0,
    };
  };

  const weekStats = getWeekStats();

  const formatHoursMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Get last 7 days for chart
  const getLast7Days = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = stats.find(s => s.date === dateStr);
      
      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en', { weekday: 'short' }),
        sessions: dayStats?.focusSessions || 0,
        minutes: dayStats?.totalFocusMinutes || 0,
      });
    }
    
    return days;
  };

  const last7Days = getLast7Days();
  const maxSessions = Math.max(...last7Days.map(d => d.sessions), 1);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-80">
          <p className="text-center text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl w-80 max-h-[460px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Statistics</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="px-4 pt-4">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setView('today')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'today'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setView('week')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'week'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              This Week
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {view === 'today' ? (
            <>
              {/* Today Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">Sessions</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {todayStats.focusSessions}
                  </p>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Focus Time</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatHoursMinutes(todayStats.totalFocusMinutes)}
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Coffee className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Breaks</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {todayStats.breaks}
                  </p>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Avg/Session</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {todayStats.focusSessions > 0 
                      ? Math.round(todayStats.totalFocusMinutes / todayStats.focusSessions)
                      : 0}m
                  </p>
                </div>
              </div>

              {/* Pro feature hint */}
              {!settings?.isPro && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      Upgrade for detailed weekly stats
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Week Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">Total Sessions</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {weekStats.totalSessions}
                  </p>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Time</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatHoursMinutes(weekStats.totalMinutes)}
                  </p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Last 7 Days
                </h3>
                <div className="flex items-end justify-between gap-2 h-24">
                  {last7Days.map((day, i) => (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end h-16">
                        <div
                          className={`w-full rounded-t ${
                            day.date === getTodayString()
                              ? 'bg-red-500'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                          style={{ 
                            height: `${(day.sessions / maxSessions) * 100}%`,
                            minHeight: day.sessions > 0 ? '4px' : '0'
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{day.dayName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Average */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                      Daily Average
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {weekStats.avgSessionsPerDay} sessions/day
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-indigo-400" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
