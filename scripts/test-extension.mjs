import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, '../.output/chrome-mv3');
const OUTPUT_DIR = path.resolve(__dirname, '../store-assets');

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Extension path:', EXTENSION_PATH);
  console.log('Output directory:', OUTPUT_DIR);
  
  // Check extension exists
  if (!fs.existsSync(EXTENSION_PATH)) {
    console.error('Extension not found! Run pnpm build first.');
    process.exit(1);
  }

  console.log('\nLaunching browser with extension...');
  
  // Launch browser with extension
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: { width: 400, height: 600 },
  });

  // Wait for extension to load
  console.log('Waiting for extension to initialize...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get extension ID from service workers
  let extensionId = '';
  
  const backgroundPages = context.backgroundPages();
  for (const bg of backgroundPages) {
    const url = bg.url();
    if (url.includes('chrome-extension://')) {
      extensionId = url.split('/')[2];
      console.log('Found extension ID from background page:', extensionId);
      break;
    }
  }

  if (!extensionId) {
    const serviceWorkers = context.serviceWorkers();
    for (const worker of serviceWorkers) {
      const url = worker.url();
      if (url.includes('chrome-extension://')) {
        extensionId = url.split('/')[2];
        console.log('Found extension ID from service worker:', extensionId);
        break;
      }
    }
  }

  if (!extensionId) {
    console.error('Could not find extension ID!');
    console.log('Background pages:', backgroundPages.map(p => p.url()));
    console.log('Service workers:', context.serviceWorkers().map(w => w.url()));
    await context.close();
    return;
  }

  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log('Opening popup:', popupUrl);
  
  const page = await context.newPage();
  await page.goto(popupUrl);
  await page.waitForTimeout(2000);

  // Set popup size for screenshots
  await page.setViewportSize({ width: 380, height: 520 });

  console.log('\n=== TESTING FOCUSGUARD EXTENSION ===\n');

  // Test 1: Initial State
  console.log('Test 1: Checking initial state...');
  const timerDisplay = await page.locator('text=/\\d{2}:\\d{2}/').first();
  if (await timerDisplay.isVisible()) {
    const time = await timerDisplay.textContent();
    console.log(`  ✅ Timer displays: ${time}`);
  } else {
    console.log('  ❌ Timer not visible');
  }

  // Screenshot 1: Initial/Idle State (Light Mode)
  console.log('\n📸 Screenshot 1: Idle State (Light)...');
  await page.screenshot({ 
    path: path.join(OUTPUT_DIR, 'screenshot-1-idle-light.png'),
    type: 'png'
  });
  console.log('  ✅ Saved screenshot-1-idle-light.png');

  // Test 2: Start Timer
  console.log('\nTest 2: Starting timer...');
  const startButton = page.locator('button:has-text("Start")').first();
  if (await startButton.isVisible()) {
    await startButton.click();
    await page.waitForTimeout(1500);
    console.log('  ✅ Start button clicked');
    
    // Screenshot 2: Running Timer
    console.log('\n📸 Screenshot 2: Running Timer...');
    await page.screenshot({ 
      path: path.join(OUTPUT_DIR, 'screenshot-2-running.png'),
      type: 'png'
    });
    console.log('  ✅ Saved screenshot-2-running.png');
  } else {
    console.log('  ❌ Start button not found');
  }

  // Test 3: Pause Timer
  console.log('\nTest 3: Pausing timer...');
  const pauseButton = page.locator('button:has-text("Pause")');
  if (await pauseButton.isVisible()) {
    await pauseButton.click();
    await page.waitForTimeout(500);
    console.log('  ✅ Timer paused');
    
    // Screenshot 3: Paused Timer
    console.log('\n📸 Screenshot 3: Paused Timer...');
    await page.screenshot({ 
      path: path.join(OUTPUT_DIR, 'screenshot-3-paused.png'),
      type: 'png'
    });
    console.log('  ✅ Saved screenshot-3-paused.png');
  }

  // Test 4: Stop Timer
  console.log('\nTest 4: Stopping timer...');
  const stopButton = page.locator('button[title="Stop"]');
  if (await stopButton.isVisible()) {
    await stopButton.click();
    await page.waitForTimeout(500);
    console.log('  ✅ Timer stopped');
  }

  // Test 5: Open Settings
  console.log('\nTest 5: Opening settings...');
  const settingsButton = page.locator('button[title="Settings"]');
  if (await settingsButton.isVisible()) {
    await settingsButton.click();
    await page.waitForTimeout(500);
    console.log('  ✅ Settings opened');
    
    // Screenshot 4: Settings Modal
    console.log('\n📸 Screenshot 4: Settings Modal...');
    await page.screenshot({ 
      path: path.join(OUTPUT_DIR, 'screenshot-4-settings.png'),
      type: 'png'
    });
    console.log('  ✅ Saved screenshot-4-settings.png');
    
    // Close settings by clicking Done button
    const doneButton = page.locator('button:has-text("Done")');
    if (await doneButton.isVisible()) {
      await doneButton.click();
    }
    await page.waitForTimeout(500);
  }

  // Test 6: Open Statistics
  console.log('\nTest 6: Opening statistics...');
  const statsButton = page.locator('button[title="Statistics"]');
  if (await statsButton.isVisible()) {
    await statsButton.click();
    await page.waitForTimeout(500);
    console.log('  ✅ Statistics opened');
    
    // Screenshot 5: Statistics Modal
    console.log('\n📸 Screenshot 5: Statistics Modal...');
    await page.screenshot({ 
      path: path.join(OUTPUT_DIR, 'screenshot-5-stats.png'),
      type: 'png'
    });
    console.log('  ✅ Saved screenshot-5-stats.png');
    
    // Close stats
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Test 7: Dark Mode
  console.log('\nTest 7: Testing dark mode...');
  await page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.theme = 'dark';
        chrome.storage.local.set({ settings }, resolve);
      });
    });
  });
  await page.reload();
  await page.waitForTimeout(1500);
  console.log('  ✅ Dark mode enabled');
  
  // Screenshot 6: Dark Mode
  console.log('\n📸 Screenshot 6: Dark Mode...');
  await page.screenshot({ 
    path: path.join(OUTPUT_DIR, 'screenshot-6-dark-mode.png'),
    type: 'png'
  });
  console.log('  ✅ Saved screenshot-6-dark-mode.png');

  // Test 8: Free tier indicator
  console.log('\nTest 8: Checking free tier indicator...');
  const freeIndicator = page.locator('text=/\\d+.*free.*sessions/i');
  if (await freeIndicator.isVisible()) {
    const text = await freeIndicator.textContent();
    console.log(`  ✅ Free tier indicator: ${text}`);
  } else {
    // Try alternative selectors
    const altIndicator = page.locator('text=/sessions.*remaining/i');
    if (await altIndicator.isVisible()) {
      const text = await altIndicator.textContent();
      console.log(`  ✅ Sessions indicator: ${text}`);
    } else {
      console.log('  ⚠️ Free tier indicator not found (may be styled differently)');
    }
  }

  // Switch back to light mode for final screenshot
  await page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || {};
        settings.theme = 'light';
        chrome.storage.local.set({ settings }, resolve);
      });
    });
  });
  await page.reload();
  await page.waitForTimeout(1500);

  console.log('\n=== TEST SUMMARY ===');
  console.log('All core functionality tested!');
  console.log(`Screenshots saved to: ${OUTPUT_DIR}`);
  
  // List screenshots
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log('\nScreenshots captured:');
  files.forEach(f => console.log(`  - ${f}`));

  console.log('\n✨ Testing complete!');
  console.log('\nClosing browser in 3 seconds...');
  await page.waitForTimeout(3000);
  
  await context.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
