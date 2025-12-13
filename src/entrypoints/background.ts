import { timerOperations, settingsOperations, statsOperations } from '../lib/storage';
import { startPaymentBackgroundListener, onPaymentStatusChange } from '../lib/payment';
import type { TimerState } from '../types/timer';

export default defineBackground(() => {
  console.log('FocusGuard background script loaded');

  // Start ExtensionPay background listener
  startPaymentBackgroundListener();

  // Listen for payment status changes and sync to settings
  onPaymentStatusChange(async (user) => {
    if (user.paid) {
      await settingsOperations.update({ isPro: true });
      console.log('FocusGuard: User upgraded to Pro!');
    }
  });

  const ALARM_NAME = 'focusguard-timer';
  const TICK_ALARM = 'focusguard-tick';

  // Handle alarm events
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TICK_ALARM) {
      await handleTick();
    }
  });

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // Keep channel open for async response
  });

  async function handleMessage(message: { type: string; payload?: any }) {
    switch (message.type) {
      case 'START_TIMER':
        return await startTimer(message.payload?.sessionType || 'focus');
      
      case 'PAUSE_TIMER':
        return await pauseTimer();
      
      case 'RESUME_TIMER':
        return await resumeTimer();
      
      case 'STOP_TIMER':
        return await stopTimer();
      
      case 'SKIP_SESSION':
        return await skipSession();
      
      case 'GET_STATE':
        return await timerOperations.getState();
      
      case 'GET_SETTINGS':
        return await settingsOperations.get();
      
      case 'UPDATE_SETTINGS':
        return await settingsOperations.update(message.payload);
      
      case 'GET_STATS':
        return await statsOperations.getAllStats();
      
      case 'GET_ALL_STATS':
        return await statsOperations.getAllStats();
      
      case 'GET_TODAY_STATS':
        return await statsOperations.getTodayStats();
      
      case 'CAN_START':
        return await statsOperations.canStartSession();
      
      default:
        return { error: 'Unknown message type' };
    }
  }

  async function startTimer(sessionType: TimerState['sessionType']) {
    // Check if user can start (free limit)
    if (sessionType === 'focus') {
      const canStart = await statsOperations.canStartSession();
      if (!canStart.allowed) {
        return { error: 'FREE_LIMIT_REACHED', ...canStart };
      }
    }

    const state = await timerOperations.startSession(sessionType);
    
    // Start tick alarm (every second)
    await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 / 60 });
    
    // Update badge
    updateBadge(state);
    
    return state;
  }

  async function pauseTimer() {
    const state = await timerOperations.getState();
    if (state.status !== 'running') return state;

    await chrome.alarms.clear(TICK_ALARM);
    
    const updated = await timerOperations.setState({
      status: 'paused',
      startedAt: null,
    });
    
    updateBadge(updated);
    return updated;
  }

  async function resumeTimer() {
    const state = await timerOperations.getState();
    if (state.status !== 'paused') return state;

    await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 / 60 });
    
    const updated = await timerOperations.setState({
      status: 'running',
      startedAt: Date.now(),
    });
    
    updateBadge(updated);
    return updated;
  }

  async function stopTimer() {
    await chrome.alarms.clear(TICK_ALARM);
    const state = await timerOperations.reset();
    updateBadge(state);
    return state;
  }

  async function skipSession() {
    await chrome.alarms.clear(TICK_ALARM);
    const state = await timerOperations.completeSession();
    updateBadge(state);
    return state;
  }

  async function handleTick() {
    const state = await timerOperations.getState();
    
    if (state.status !== 'running') {
      await chrome.alarms.clear(TICK_ALARM);
      return;
    }

    const newTimeRemaining = state.timeRemaining - 1;
    
    if (newTimeRemaining <= 0) {
      // Session complete
      await chrome.alarms.clear(TICK_ALARM);
      await handleSessionComplete();
    } else {
      await timerOperations.setState({ timeRemaining: newTimeRemaining });
      updateBadge({ ...state, timeRemaining: newTimeRemaining });
    }
  }

  async function handleSessionComplete() {
    const state = await timerOperations.getState();
    const settings = await settingsOperations.get();
    
    // Show notification
    if (settings.notificationsEnabled) {
      const title = state.sessionType === 'focus' 
        ? 'Focus Session Complete!' 
        : 'Break Time Over!';
      const message = state.sessionType === 'focus'
        ? 'Great work! Time for a break.'
        : 'Ready to focus again?';
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/128.png'),
        title,
        message,
        requireInteraction: true,
      });
    }

    // Complete the session
    const newState = await timerOperations.completeSession();
    
    // Auto-start next session if enabled
    if (state.sessionType === 'focus' && settings.autoStartBreaks) {
      await startTimer(newState.sessionType);
    } else if (state.sessionType !== 'focus' && settings.autoStartFocus) {
      await startTimer('focus');
    }
    
    updateBadge(newState);
  }

  function updateBadge(state: TimerState) {
    const minutes = Math.ceil(state.timeRemaining / 60);
    
    if (state.status === 'idle') {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    } else if (state.status === 'paused') {
      chrome.action.setBadgeText({ text: '||' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    } else {
      chrome.action.setBadgeText({ text: `${minutes}` });
      
      if (state.sessionType === 'focus') {
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red for focus
      } else {
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // Green for break
      }
    }
  }

  // Initialize badge on load
  timerOperations.getState().then(updateBadge);
});
