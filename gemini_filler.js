// gemini_filler.js - Content script for YouTube Summarizer with Gemini (Gemini page)
// Reads a prompt from local storage (set by the YouTube content script) and injects it into Gemini's main input field, with a fallback to clipboard.

(() => {
  "use strict";
  const SCRIPT_PREFIX = "Gemini Summarizer (Filler):";
  const STORAGE_KEY_PROMPT = "geminiPromptForNextLoad";
  const MAX_ATTEMPTS = 5;
  const ATTEMPT_DELAY_MS = 1000;
  let attempts = 0;

  function log(level, message, details) {
    const logArgs = details ? [message, details] : [message];
    if (level === 'log') devLog(SCRIPT_PREFIX, ...logArgs);
    else if (level === 'warn') devWarn(SCRIPT_PREFIX, ...logArgs);
    else if (level === 'error') devError(SCRIPT_PREFIX, ...logArgs);
    else devLog(SCRIPT_PREFIX, `[${level.toUpperCase()}]:`, ...logArgs);
  }

  function findGeminiInputTextField() {
    const mainInputSelector = '[aria-label="Enter a prompt here"]';
    const activatableInputAreaSelector = '.text-input-field';
    try {
      const inputArea = document.querySelector(activatableInputAreaSelector);
      if (inputArea) {
        log("log", "Found activatable input area. Clicking it.", inputArea);
        inputArea.click();
      }
    } catch (e) {
      log("warn", `Error trying to click ${activatableInputAreaSelector}: ${e.message}`);
    }
    try {
      const element = document.querySelector(mainInputSelector);
      if (element && element.offsetParent !== null && !element.disabled && !element.readOnly) {
        log("log", `Found main input field:`, element);
        return element;
      }
    } catch (e) {
      log("warn", `Error with selector ${mainInputSelector}: ${e.message}`);
    }
    const fallbackSelector = 'rich-textarea';
    try {
      const fallbackElement = document.querySelector(fallbackSelector);
      if (fallbackElement && fallbackElement.offsetParent !== null && !fallbackElement.disabled && !fallbackElement.readOnly) {
        log("warn", `Falling back to ${fallbackSelector}:`, fallbackElement);
        return fallbackElement;
      }
    } catch (e) {
      log("warn", `Error with fallback selector ${fallbackSelector}: ${e.message}`);
    }
    log("warn", "Could not find a suitable Gemini input field using known selectors.");
    return null;
  }

  function injectTextAndDispatchEvents(inputField, text) {
    inputField.focus();
    while (inputField.firstChild) inputField.removeChild(inputField.firstChild);
    text.split('\n').forEach(line => {
      const p = document.createElement('p');
      p.innerText = line;
      inputField.appendChild(p);
    });
    inputField.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    inputField.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
    inputField.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
    log("log", "Text injected and events dispatched.");
    return true;
  }

  function findAndClickSendButton() {
    const sendButtonSelector = "button[aria-label='Send message']";
    const sendButton = document.querySelector(sendButtonSelector);
    if (sendButton && sendButton.offsetParent !== null && !sendButton.disabled) {
      log("log", "Send button found and clicked.", sendButton);
      sendButton.click();
      return true;
    }
    log("warn", "Send button not found or not clickable.");
    return false;
  }

  function simulateEnterKeyPress(inputField) {
    inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    inputField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    log("log", "Enter key press simulated.");
  }

  async function clearPromptFromStorage() {
    try {
      await (typeof browser !== "undefined" ? browser : chrome).storage.local.remove(STORAGE_KEY_PROMPT);
      log("log", "Prompt cleared from local storage.");
    } catch (error) {
      log("error", "Error clearing prompt from storage:", error);
    }
  }

  async function attemptToFillPrompt() {
    attempts++;
    log("log", `Attempting to fill prompt (attempt ${attempts}/${MAX_ATTEMPTS})...`);
    let data;
    try {
      data = await (typeof browser !== "undefined" ? browser : chrome).storage.local.get(STORAGE_KEY_PROMPT);
    } catch (error) {
      log("error", "Error retrieving prompt from storage:", error);
      return;
    }
    const promptText = data ? data[STORAGE_KEY_PROMPT] : null;
    if (promptText) {
      log("log", "Found prompt in storage:", promptText);
      const inputField = findGeminiInputTextField();
      if (inputField) {
        if (injectTextAndDispatchEvents(inputField, promptText)) {
          setTimeout(async () => {
            if (!findAndClickSendButton()) simulateEnterKeyPress(inputField);
            await clearPromptFromStorage();
          }, 500);
        } else {
          alert("Gemini Summarizer: Could not automatically fill the prompt. Please paste the YouTube video URL manually into Gemini.");
          await clearPromptFromStorage();
        }
      } else {
        alert("Gemini Summarizer: Could not find the prompt input field on the Gemini page. Please paste the YouTube video URL manually.");
        await clearPromptFromStorage();
      }
    } else {
      log("log", "No prompt found in storage for this load.");
    }
  }

  function scheduleAttempt() {
    if (document.readyState === "complete") {
      attemptToFillPrompt();
    } else {
      window.addEventListener('load', () => {
        setTimeout(attemptToFillPrompt, ATTEMPT_DELAY_MS / 2);
      }, { once: true });
    }
    const intervalId = setInterval(async () => {
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(intervalId);
        log("log", "Max attempts reached. Stopping further checks for input field.");
        return;
      }
      const data = await (typeof browser !== "undefined" ? browser : chrome).storage.local.get(STORAGE_KEY_PROMPT);
      if (data && data[STORAGE_KEY_PROMPT]) {
        if (!findGeminiInputTextField()) {
          attemptToFillPrompt();
        } else {
          clearInterval(intervalId);
        }
      } else {
        clearInterval(intervalId);
      }
    }, ATTEMPT_DELAY_MS);
  }

  log("log", "Gemini filler script initialized.");
  scheduleAttempt();

})();
