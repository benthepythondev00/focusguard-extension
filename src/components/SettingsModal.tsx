import { useState, useEffect } from 'react';
import { X, Sun, Moon, Monitor, Crown, Check, ExternalLink } from 'lucide-react';
import type { Settings } from '../types/timer';
import { DEFAULT_SETTINGS } from '../types/timer';
import { getPaymentStatus, openPaymentPage, type UserPaymentStatus } from '../lib/payment';

interface SettingsModalProps {
  onClose: () => void;
  onSettingsChange: () => void;
}

export function SettingsModal({ onClose, onSettingsChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<UserPaymentStatus | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      setSettings(data);

      // Load payment status
      try {
        const status = await getPaymentStatus();
        setPaymentStatus(status);
        
        // Sync payment status with settings
        if (status.paid && !data.isPro) {
          await chrome.runtime.sendMessage({ 
            type: 'UPDATE_SETTINGS', 
            payload: { isPro: true } 
          });
          setSettings({ ...data, isPro: true });
          onSettingsChange();
        }
      } catch (error) {
        console.log('Payment status check failed:', error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updates: Partial<Settings>) => {
    setSaving(true);
    try {
      await chrome.runtime.sendMessage({ 
        type: 'UPDATE_SETTINGS', 
        payload: updates 
      });
      setSettings(prev => ({ ...prev, ...updates }));
      onSettingsChange();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = () => {
    setLoadingPayment(true);
    openPaymentPage();
    // Payment page opens in new tab, close loading after short delay
    setTimeout(() => {
      setLoadingPayment(false);
    }, 1000);
  };

  const isPro = settings.isPro || paymentStatus?.paid;

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
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl w-80 max-h-[460px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Pro Status / Upgrade */}
          {!isPro ? (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Upgrade to Pro</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Unlimited sessions + stats</p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={loadingPayment}
                className="w-full px-4 py-2.5 text-sm font-medium text-white 
                         bg-gradient-to-r from-amber-500 to-orange-500 
                         hover:from-amber-600 hover:to-orange-600 
                         rounded-xl transition-all shadow-md
                         disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              >
                {loadingPayment ? 'Opening...' : '$9.99 One-Time'}
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 font-semibold">Pro Activated</span>
                  {paymentStatus?.paidAt && (
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Since {new Date(paymentStatus.paidAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => saveSettings({ theme: value as Settings['theme'] })}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                    settings.theme === value
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${
                    settings.theme === value 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-slate-500'
                  }`} />
                  <span className={`text-xs font-medium ${
                    settings.theme === value 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Timer Durations */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Timer Durations
            </label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Focus</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings.focusDuration}
                    onChange={(e) => saveSettings({ focusDuration: parseInt(e.target.value) || 25 })}
                    className="w-16 px-2 py-1.5 text-center text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-sm text-slate-500">min</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Short Break</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.shortBreakDuration}
                    onChange={(e) => saveSettings({ shortBreakDuration: parseInt(e.target.value) || 5 })}
                    className="w-16 px-2 py-1.5 text-center text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-sm text-slate-500">min</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Long Break</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.longBreakDuration}
                    onChange={(e) => saveSettings({ longBreakDuration: parseInt(e.target.value) || 15 })}
                    className="w-16 px-2 py-1.5 text-center text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-sm text-slate-500">min</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Sessions until long break</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.sessionsUntilLongBreak}
                    onChange={(e) => saveSettings({ sessionsUntilLongBreak: parseInt(e.target.value) || 4 })}
                    className="w-16 px-2 py-1.5 text-center text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Auto-start Options */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Automation
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Auto-start breaks</span>
                <button
                  onClick={() => saveSettings({ autoStartBreaks: !settings.autoStartBreaks })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.autoStartBreaks ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.autoStartBreaks ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Auto-start focus</span>
                <button
                  onClick={() => saveSettings({ autoStartFocus: !settings.autoStartFocus })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.autoStartFocus ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.autoStartFocus ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Notifications
            </label>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Sound alerts</span>
                <button
                  onClick={() => saveSettings({ soundEnabled: !settings.soundEnabled })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.soundEnabled ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-slate-400">Desktop notifications</span>
                <button
                  onClick={() => saveSettings({ notificationsEnabled: !settings.notificationsEnabled })}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    settings.notificationsEnabled ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-xs text-slate-500">FocusGuard v1.0.0</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
