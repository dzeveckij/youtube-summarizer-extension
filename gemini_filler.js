// gemini_filler.js - Content script for YouTube Summarizer with Gemini (Gemini page)
// Reads a prompt from local storage (set by the YouTube content script) and injects it into Gemini's main input field, with a fallback to clipboard.

(() => {
  "use strict";
  const SCRIPT_PREFIX = "Gemini Summarizer (Filler):";
  const STORAGE_KEY_PROMPT = "geminiPromptForNextLoad";
  const MAX_ATTEMPTS = 10; // Increased from 5 to 10 for more retry attempts
  const ATTEMPT_DELAY_MS = 500; // Reduced delay between attempts for faster response
  let attempts = 0;
  let observer = null; // Will hold our MutationObserver instance
  let hasPromptToFill = false; // Track if we have a prompt to fill

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
    
    // First try to find and click the activatable input area if it exists
    try {
      const inputArea = document.querySelector(activatableInputAreaSelector);
      if (inputArea) {
        log("log", "Found activatable input area. Clicking it.", inputArea);
        inputArea.click();
      }
    } catch (e) {
      log("warn", `Error trying to click ${activatableInputAreaSelector}: ${e.message}`);
    }
    
    // Try the main input field first
    try {
      const element = document.querySelector(mainInputSelector);
      if (element) {
        if (element.offsetParent !== null && !element.disabled && !element.readOnly) {
          log("log", `Found main input field:`, element);
          return { element, isEnabled: true };
        } else {
          log("log", `Found main input field but it's not ready:`, element);
          return { element, isEnabled: false };
        }
      }
    } catch (e) {
      log("warn", `Error with selector ${mainInputSelector}: ${e.message}`);
    }
    
    // Fall back to rich-textarea if main input not found
    const fallbackSelector = 'rich-textarea';
    try {
      const fallbackElement = document.querySelector(fallbackSelector);
      if (fallbackElement) {
        if (fallbackElement.offsetParent !== null && !fallbackElement.disabled && !fallbackElement.readOnly) {
          log("log", `Found ${fallbackSelector} input field:`, fallbackElement);
          return { element: fallbackElement, isEnabled: true };
        } else {
          log("log", `Found ${fallbackSelector} but it's not ready:`, fallbackElement);
          return { element: fallbackElement, isEnabled: false };
        }
      }
    } catch (e) {
      log("warn", `Error with fallback selector ${fallbackSelector}: ${e.message}`);
    }
    
    log("warn", "Could not find a suitable Gemini input field using known selectors.");
    return { element: null, isEnabled: false };
  }

  function injectTextAndDispatchEvents(inputField, text) {
    try {
      if (!inputField || !inputField.focus) {
        log("error", "Invalid input field provided to injectTextAndDispatchEvents");
        return false;
      }
      
      inputField.focus();
      
      // Clear existing content
      while (inputField.firstChild) {
        inputField.removeChild(inputField.firstChild);
      }
      
      // Insert text with proper line breaks
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (line.trim() !== '') {
          const p = document.createElement('p');
          p.textContent = line;
          inputField.appendChild(p);
          
          // Add a line break after each line except the last one
          if (index < lines.length - 1) {
            inputField.appendChild(document.createElement('br'));
          }
        }
      });
      
      // First dispatch input and change events to update the field value
      try {
        inputField.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      } catch (e) {
        log("warn", "Error dispatching input/change events:", e);
      }
      
      // Don't dispatch keyboard events here - let the findAndClickSendButton or simulateEnterKeyPress handle submission
      
      log("log", "Text injected and events dispatched.");
      return true;
    } catch (e) {
      log("error", "Error in injectTextAndDispatchEvents:", e);
      return false;
    }
  }

  function findAndClickSendButton() {
    const sendButtonSelector = "button[aria-label='Send message']";
    const sendButton = document.querySelector(sendButtonSelector);
    
    if (sendButton && sendButton.offsetParent !== null && !sendButton.disabled) {
      // Check if we've already clicked the send button recently
      if (window.__geminiSendButtonClicked) {
        log("log", "Send button was already clicked recently, skipping");
        return true;
      }
      
      log("log", "Send button found, about to click", sendButton);
      
      // Mark that we've clicked the send button
      window.__geminiSendButtonClicked = true;
      
      // Add a small delay to ensure the UI is ready
      setTimeout(() => {
        try {
          sendButton.click();
          log("log", "Send button clicked successfully");
        } catch (e) {
          log("error", "Error clicking send button:", e);
        }
      }, 100);
      
      // Clear the flag after a short delay in case of page reload
      setTimeout(() => {
        window.__geminiSendButtonClicked = false;
      }, 2000);
      
      return true;
    }
    
    log("warn", "Send button not found or not clickable.");
    return false;
  }

  function simulateEnterKeyPress(inputField) {
    // Check if we've already sent a submission recently
    if (window.__geminiEnterKeyPressed) {
      log("log", "Enter key was already pressed recently, skipping");
      return;
    }
    
    log("log", "Simulating Enter key press");
    
    // Mark that we've pressed Enter
    window.__geminiEnterKeyPressed = true;
    
    // Add a small delay to ensure the UI is ready
    setTimeout(() => {
      try {
        inputField.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Enter', 
          code: 'Enter', 
          keyCode: 13, 
          which: 13, 
          bubbles: true, 
          cancelable: true 
        }));
        
        inputField.dispatchEvent(new KeyboardEvent('keyup', { 
          key: 'Enter', 
          code: 'Enter', 
          keyCode: 13, 
          which: 13, 
          bubbles: true, 
          cancelable: true 
        }));
        
        log("log", "Enter key press simulated successfully");
      } catch (e) {
        log("error", "Error simulating Enter key press:", e);
      }
    }, 150);
    
    // Clear the flag after a short delay in case of page reload
    setTimeout(() => {
      window.__geminiEnterKeyPressed = false;
    }, 2000);
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
      return false; // Indicate failure
    }
    
    const promptText = data ? data[STORAGE_KEY_PROMPT] : null;
    if (!promptText) {
      log("log", "No prompt found in storage");
      hasPromptToFill = false;
      return false;
    }
    
    log("log", "Found prompt in storage");
    hasPromptToFill = true;
    
    try {
      const { element: inputField, isEnabled } = findGeminiInputTextField();
      
      if (!inputField) {
        log("warn", "Could not find input field");
        if (attempts >= MAX_ATTEMPTS) {
          showError("Could not find the prompt input field on the Gemini page. Please return to YouTube and click the summarize button again.");
          await clearPromptFromStorage();
        }
        return false;
      }
      
      if (!isEnabled) {
        log("log", "Input field found but not yet enabled, waiting...");
        return false;
      }
      
      log("log", "Input field found and enabled, injecting text");
      
      if (injectTextAndDispatchEvents(inputField, promptText)) {
        log("log", "Text injected successfully, attempting to submit...");
        
        // Try to click the send button first
        if (findAndClickSendButton()) {
          log("log", "Send button clicked successfully");
        } else {
          // Fall back to simulating Enter key if send button not found
          log("log", "Send button not found, simulating Enter key");
          simulateEnterKeyPress(inputField);
        }
        
        // Clear the prompt from storage after a short delay
        setTimeout(async () => {
          await clearPromptFromStorage();
          hasPromptToFill = false;
        }, 1000);
        
        return true; // Success
      } else {
        log("warn", "Failed to inject text into input field");
        if (attempts >= MAX_ATTEMPTS) {
          showError("Could not automatically fill the prompt. Please return to YouTube and click the summarize button again.");
          await clearPromptFromStorage();
        }
        return false;
      }
    } catch (error) {
      log("error", "Error in attemptToFillPrompt:", error);
      if (attempts >= MAX_ATTEMPTS) {
        showError("An error occurred while trying to fill the prompt. Please try again.");
        await clearPromptFromStorage();
      }
      return false;
    }
  }
  
  function showError(message) {
    log("error", message);
    // Only show alert if we're not in a background context
    if (typeof window !== 'undefined' && window.alert) {
      alert(`Gemini Summarizer: ${message}`);
    }
  }

  function setupMutationObserver(element) {
    if (observer) {
      observer.disconnect();
    }
    
    // Create a new observer instance
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'disabled' || 
             mutation.attributeName === 'class' || 
             mutation.attributeName === 'style')) {
          const isNowEnabled = !element.disabled && 
                             element.offsetParent !== null && 
                             !element.readOnly &&
                             window.getComputedStyle(element).display !== 'none';
          
          log("log", `Input field ${isNowEnabled ? 'enabled' : 'disabled'}:`, element);
          
          if (isNowEnabled && hasPromptToFill) {
            log("log", "Input field became enabled and we have a prompt to fill");
            attemptToFillPrompt();
          }
        }
      });
    });
    
    // Start observing the target node for attribute changes
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['disabled', 'class', 'style'],
      childList: false,
      subtree: false
    });
    
    log("log", "MutationObserver set up on input field");
  }

  function scheduleAttempt() {
    // Try to find the input field immediately
    const { element: inputField, isEnabled } = findGeminiInputTextField();
    
    if (inputField) {
      log("log", "Input field found, setting up observer");
      setupMutationObserver(inputField);
      
      // If the field is already enabled, try to fill it immediately
      if (isEnabled) {
        log("log", "Input field is already enabled, attempting to fill");
        attemptToFillPrompt();
      }
    } else {
      log("log", "Input field not found yet, will retry");
    }
    
    // Set up a more aggressive polling mechanism as a fallback
    const intervalId = setInterval(async () => {
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(intervalId);
        log("warn", `Max attempts (${MAX_ATTEMPTS}) reached. Stopping further checks.`);
        return;
      }
      
      const data = await (typeof browser !== "undefined" ? browser : chrome).storage.local.get(STORAGE_KEY_PROMPT);
      if (data && data[STORAGE_KEY_PROMPT]) {
        hasPromptToFill = true;
        const { element: field, isEnabled } = findGeminiInputTextField();
        if (field) {
          if (isEnabled) {
            log("log", "Input field found and enabled, attempting to fill");
            attemptToFillPrompt();
          } else if (!observer) {
            log("log", "Input field found but disabled, setting up observer");
            setupMutationObserver(field);
          }
        } else {
          log("log", `Input field not found (attempt ${attempts + 1}/${MAX_ATTEMPTS})`);
          attempts++;
        }
      } else {
        log("log", "No prompt found in storage, stopping");
        clearInterval(intervalId);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    }, ATTEMPT_DELAY_MS);
    
    // Clean up on page unload
    window.addEventListener('unload', () => {
      clearInterval(intervalId);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    });
  }

  log("log", "Gemini filler script initialized.");
  scheduleAttempt();

})();
