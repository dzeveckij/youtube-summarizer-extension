const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_ROOT_PATH = path.join(__dirname, '..', '..'); // Adjust if your test file is deeper
const EXTENSION_ID = 'youtube-summarizer-extension'; // This will be replaced by Playwright

// Selectors
const BUTTON_SELECTOR_YOUTUBE = '#gemini-summarize-youtube-page-button';

const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up

test.describe('YouTube Summarizer Extension - Button Test', () => {
  let browserContext;

  test.beforeAll(async () => {
    console.log("Attempting to launch browser context with the extension...");
    const userDataDir = path.join(__dirname, '..', '..', 'test-results', 'user-data-quick');
    const pathToExtension = EXTENSION_ROOT_PATH;

    browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Keep browser visible
      args: [
        `--mute-audio`, // Keep audio muted
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
    });
    console.log("Browser context launched with extension.");
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    if (browserContext) {
      await browserContext.close();
    }
  });

  test('should inject summarize button on YouTube', async () => {
    const page = await browserContext.newPage();
    await page.goto(YOUTUBE_VIDEO_URL, { waitUntil: 'networkidle' });
    console.log("Navigated to YouTube video page.");

    // Check for the button on the YouTube page
    console.log("Waiting for summarize button on YouTube...");
    try {
      await page.waitForSelector(BUTTON_SELECTOR_YOUTUBE, { timeout: 10000 });
      console.log("Summarize button found on YouTube.");
    } catch (error) {
      console.error("Summarize button NOT found on YouTube page within timeout.", error);
      await page.screenshot({ path: 'test-results/debug-youtube-no-button.png' });
      throw new Error("Summarize button not found on YouTube page.");
    }
    
    const summarizeButton = await page.$(BUTTON_SELECTOR_YOUTUBE);
    expect(summarizeButton).toBeTruthy();
    console.log("Button injection test passed!");

    await page.close();
  });
}); 