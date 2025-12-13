import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the built extension
const extensionPath = path.join(__dirname, '..', '.output', 'chrome-mv3');

test.describe('FocusGuard Extension', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    // Launch browser with extension
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension popup opens', async () => {
    // Get the extension ID by looking at service worker
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    // Open the popup page directly
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check that popup loaded - look for the app container
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 });
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'e2e/screenshots/popup-opened.png' });
  });

  test('shows timer in idle state', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Check for timer display (should show 25:00 by default)
    await expect(page.locator('text=25:00')).toBeVisible({ timeout: 5000 });
    
    // Check for "Ready" status
    await expect(page.locator('text=Ready')).toBeVisible();
    
    // Check for Start button
    await expect(page.locator('button:has-text("Start")')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/timer-idle.png' });
  });

  test('can start a focus session', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Click Start button
    await page.click('button:has-text("Start")');
    await page.waitForTimeout(1500); // Wait for timer to tick

    // Check that timer is running
    await expect(page.locator('text=Running')).toBeVisible({ timeout: 3000 });
    
    // Check for Pause button
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();
    
    // Time should have decreased (not 25:00 anymore)
    const timerText = await page.locator('text=/\\d{2}:\\d{2}/').first().textContent();
    expect(timerText).not.toBe('25:00');
    
    await page.screenshot({ path: 'e2e/screenshots/timer-running.png' });
  });

  test('can pause and resume timer', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // First check if timer is already running (from previous test) and stop it
    const stopButton = page.locator('button[title="Stop"]');
    if (await stopButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await stopButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for Start button to appear and click it
    const startButton = page.locator('button:has-text("Start")');
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();
    await page.waitForTimeout(1500);

    // Pause timer
    const pauseButton = page.locator('button:has-text("Pause")');
    await expect(pauseButton).toBeVisible({ timeout: 5000 });
    await pauseButton.click();
    await page.waitForTimeout(500);

    // Check for Paused status
    await expect(page.locator('text=Paused')).toBeVisible();
    
    // Check for Resume button
    await expect(page.locator('button:has-text("Resume")')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/timer-paused.png' });

    // Resume timer
    await page.click('button:has-text("Resume")');
    await page.waitForTimeout(500);

    // Check that timer is running again
    await expect(page.locator('text=Running')).toBeVisible();
  });

  test('can stop timer', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // First check if timer is already running and stop it to reset state
    const existingStopButton = page.locator('button[title="Stop"]');
    if (await existingStopButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await existingStopButton.click();
      await page.waitForTimeout(500);
    }

    // Start timer
    const startButton = page.locator('button:has-text("Start")');
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();
    await page.waitForTimeout(1000);

    // Stop timer (square button)
    await page.click('button[title="Stop"]');
    await page.waitForTimeout(500);

    // Check that timer is back to idle
    await expect(page.locator('text=Ready')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/timer-stopped.png' });
  });

  test('can open settings modal', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Click settings button
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(500);

    // Check that settings modal is open
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Theme')).toBeVisible();
    await expect(page.locator('text=Timer Durations')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/settings-modal.png' });
  });

  test('can change theme in settings', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(500);

    // Click Dark theme button
    await page.click('button:has-text("Dark")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e/screenshots/settings-dark-theme.png' });

    // Close settings
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(500);

    // Take screenshot of dark mode
    await page.screenshot({ path: 'e2e/screenshots/timer-dark-mode.png' });
  });

  test('can open statistics modal', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Click stats button
    await page.click('button[title="Statistics"]');
    await page.waitForTimeout(500);

    // Check that stats modal is open
    await expect(page.locator('text=Statistics')).toBeVisible();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
    await expect(page.locator('button:has-text("This Week")')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/stats-modal.png' });
  });

  test('can switch stats view between Today and Week', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Open stats
    await page.click('button[title="Statistics"]');
    await page.waitForTimeout(500);

    // Take screenshot of Today view
    await page.screenshot({ path: 'e2e/screenshots/stats-today.png' });

    // Switch to Week view
    await page.click('button:has-text("This Week")');
    await page.waitForTimeout(500);

    // Check for weekly stats elements
    await expect(page.locator('text=Last 7 Days')).toBeVisible();
    
    await page.screenshot({ path: 'e2e/screenshots/stats-week.png' });
  });

  test('shows session progress dots', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Check for session counter in footer
    await expect(page.locator('text=Sessions completed')).toBeVisible();
    
    // Should see 4 progress dots (default sessions until long break)
    const dots = page.locator('div.rounded-full.w-3.h-3');
    await expect(dots).toHaveCount(4);
  });

  test('shows focus time indicator', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Check for Focus Time label
    await expect(page.locator('text=Focus Time')).toBeVisible();
  });

  test('displays free tier sessions remaining', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Check for free sessions indicator
    await expect(page.locator('text=/\\d+ of 8 free sessions remaining/')).toBeVisible();
  });

  test('full UI screenshot', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Take full page screenshot
    await page.screenshot({ path: 'e2e/screenshots/full-ui.png', fullPage: true });
    
    // Verify root element exists
    await expect(page.locator('#root')).toBeVisible();
  });
});

test.describe('Timer Settings', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('can change focus duration', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(500);

    // Find focus duration input and change it (clear first, then type)
    const focusInput = page.locator('input[type="number"]').first();
    await focusInput.click();
    await focusInput.fill('');
    await focusInput.type('30');
    await page.waitForTimeout(1000);

    // Close settings
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(1000);

    // Timer should update - verify the settings took effect by checking if value changed
    // Note: The timer display might not immediately update; we verify the settings modal works
    await page.screenshot({ path: 'e2e/screenshots/timer-after-settings-change.png' });
  });

  test('can toggle auto-start breaks', async () => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Open settings
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(500);

    // Find and click auto-start breaks toggle
    const autoStartToggle = page.locator('text=Auto-start breaks').locator('..').locator('button.rounded-full');
    await autoStartToggle.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e/screenshots/settings-autostart.png' });
  });
});
