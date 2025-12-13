import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'FocusGuard - Pomodoro Timer & Break Reminder',
    description: 'Stay productive with smart Pomodoro sessions, break reminders, and focus tracking. 8 free sessions/day.',
    version: '1.0.0',
    permissions: ['storage', 'alarms', 'notifications'],
    action: {
      default_title: 'FocusGuard',
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
      '128': 'icon/128.png',
    },
    // Required for ExtPay onPaid callback to work
    content_scripts: [
      {
        matches: ['https://extensionpay.com/*'],
        js: ['extpay-content.js'],
        run_at: 'document_start',
      },
    ],
  },
});
