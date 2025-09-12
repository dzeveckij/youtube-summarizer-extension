/**
 * Injects a "Summarize with Gemini" button on YouTube video pages.
 * On click, stores a prompt in local storage and opens Gemini in a new tab.
 */

(() => {
  "use strict";

  const SCRIPT_PREFIX = "Gemini Summarizer (YouTube Content):";
  const BUTTON_ID = "gemini-summarize-youtube-page-button";
  const BUTTON_TEXT = "✨ Summarize with Gemini";
  const CUSTOM_BUTTON_ID = "gemini-summarize-youtube-custom-button";
  const CUSTOM_BUTTON_TEXT = "✍️ Custom Prompt";
  const BUTTON_CONTAINER_ID = "gemini-summarizer-button-container";
  const BUTTON_TEXT_OPENING = "✨ Opening Gemini...";
  const GEMINI_URL = "https://gemini.google.com/app";
  const STORAGE_KEY_PROMPT = "geminiPromptForNextLoad";
  const STORAGE_KEY_CUSTOM_PROMPTS = "geminiCustomPrompts";
  const MAX_SAVED_PROMPTS = 15;
  const YOUTUBE_INJECTION_POINT_SELECTORS = ['ytd-watch-metadata #title'];
  const MOBILE_YOUTUBE_INJECTION_SELECTOR = 'ytm-slim-video-metadata-renderer .slim-video-metadata-title';
  let injectionInterval = null;

  const storage = typeof browser !== "undefined" ? browser.storage.local : chrome.storage.local;

  function findButtonInjectionPoint(isMobile = false) {
    const selectors = isMobile ? [MOBILE_YOUTUBE_INJECTION_SELECTOR] : YOUTUBE_INJECTION_POINT_SELECTORS;
    for (const selector of selectors) {
      const parent = document.querySelector(selector);
      if (parent) {
        devLog(SCRIPT_PREFIX, `Found injection point: ${selector}`);
        return parent;
      }
    }
    devWarn(SCRIPT_PREFIX, "No injection point found", isMobile ? "(Mobile)" : "(Desktop)");
    return null;
  }

  function createButtonContainer() {
    const container = document.createElement("div");
    container.id = BUTTON_CONTAINER_ID;
    container.classList.add("gemini-summarizer-button-container");
    return container;
  }

  function createSummarizeButtonElement() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = BUTTON_TEXT;
    button.classList.add("gemini-summarizer-button");
    button.addEventListener("click", handleSummarizeClick);
    devLog(SCRIPT_PREFIX, "Button created");
    return button;
  }

  function createCustomPromptButtonElement() {
    const button = document.createElement("button");
    button.id = CUSTOM_BUTTON_ID;
    button.textContent = CUSTOM_BUTTON_TEXT;
    button.classList.add("gemini-summarizer-button", "gemini-summarizer-button-custom");
    button.addEventListener("click", handleCustomPromptClick);
    devLog(SCRIPT_PREFIX, "Custom prompt button created");
    return button;
  }
  
  async function sendPromptToGemini(userPrompt, shouldSavePrompt = false) {
    const fullPrompt = `${userPrompt}\n\nVideo URL: ${window.location.href}`;
    try {
      await storage.set({ [STORAGE_KEY_PROMPT]: fullPrompt });
      devLog(SCRIPT_PREFIX, "Prompt saved for Gemini");

      if (shouldSavePrompt) {
        const data = await storage.get({ [STORAGE_KEY_CUSTOM_PROMPTS]: [] });
        let savedPrompts = data[STORAGE_KEY_CUSTOM_PROMPTS];
        if (!savedPrompts.includes(userPrompt)) {
          savedPrompts.unshift(userPrompt);
          if (savedPrompts.length > MAX_SAVED_PROMPTS) {
            savedPrompts = savedPrompts.slice(0, MAX_SAVED_PROMPTS);
          }
          await storage.set({ [STORAGE_KEY_CUSTOM_PROMPTS]: savedPrompts });
          devLog(SCRIPT_PREFIX, "Custom prompt list updated");
        }
      }
      
      window.open(GEMINI_URL, "_blank");
    } catch (error) {
      devError(SCRIPT_PREFIX, "Error during prompt submission:", error);
      alert(`Could not process request: ${error.message}. Please try again.`);
    }
  }

  async function showCustomPromptModal() {
    const existingModal = document.getElementById('gemini-custom-prompt-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'gemini-custom-prompt-modal';
    modalOverlay.classList.add('gemini-modal-overlay');

    const modalContent = document.createElement('div');
    modalContent.classList.add('gemini-modal-content');

    const modalHeader = document.createElement('h3');
    modalHeader.textContent = 'Enter Your Custom Prompt';
    modalHeader.classList.add('gemini-modal-header');

    const modalTextarea = document.createElement('textarea');
    modalTextarea.classList.add('gemini-modal-textarea');
    modalTextarea.placeholder = 'e.g., "Summarize this video for a 5th grader." or "Extract all the key statistics mentioned."';
    modalTextarea.rows = 5;

    const savedPromptsContainer = document.createElement('div');
    savedPromptsContainer.classList.add('gemini-modal-saved-prompts-container');
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalTextarea);
    modalContent.appendChild(savedPromptsContainer);

    const modalButtons = document.createElement('div');
    modalButtons.classList.add('gemini-modal-buttons');

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Summarize';
    submitButton.classList.add('gemini-modal-button', 'gemini-modal-button-submit');

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.classList.add('gemini-modal-button', 'gemini-modal-button-cancel');

    modalButtons.appendChild(cancelButton);
    modalButtons.appendChild(submitButton);
    modalContent.appendChild(modalButtons);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    modalTextarea.focus();

    const closeModal = () => modalOverlay.remove();
    
    cancelButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    const handleDeletePrompt = async (promptText, listItemElement) => {
      try {
        const data = await storage.get({ [STORAGE_KEY_CUSTOM_PROMPTS]: [] });
        const savedPrompts = data[STORAGE_KEY_CUSTOM_PROMPTS];
        const newPrompts = savedPrompts.filter(p => p !== promptText);
        await storage.set({ [STORAGE_KEY_CUSTOM_PROMPTS]: newPrompts });
        listItemElement.remove();
        devLog(SCRIPT_PREFIX, "Deleted prompt:", promptText);
      } catch (error)
 {
        devError(SCRIPT_PREFIX, "Error deleting prompt:", error);
      }
    };

    const renderSavedPrompts = (prompts) => {
      savedPromptsContainer.innerHTML = '';
      if (!prompts || prompts.length === 0) return;

      const header = document.createElement('h4');
      header.textContent = 'Saved Prompts';
      header.classList.add('gemini-modal-saved-prompts-header');
      savedPromptsContainer.appendChild(header);

      const list = document.createElement('ul');
      list.classList.add('gemini-modal-saved-prompts-list');

      prompts.forEach(prompt => {
        const listItem = document.createElement('li');
        listItem.classList.add('gemini-modal-saved-prompt-item');

        const promptTextSpan = document.createElement('span');
        promptTextSpan.textContent = prompt;
        promptTextSpan.classList.add('gemini-modal-saved-prompt-text');
        promptTextSpan.title = 'Click to use this prompt';
        promptTextSpan.onclick = () => {
          modalTextarea.value = prompt;
          modalTextarea.focus();
        };
        
        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('gemini-modal-prompt-actions');

        const sendButton = document.createElement('button');
        sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z"/></svg>`;
        sendButton.classList.add('gemini-modal-send-prompt-btn');
        sendButton.title = 'Send this prompt immediately';
        sendButton.onclick = async () => {
          sendButton.disabled = true;
          await sendPromptToGemini(prompt, false);
          closeModal();
        };

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        deleteButton.classList.add('gemini-modal-delete-prompt-btn');
        deleteButton.title = 'Delete this prompt';
        deleteButton.onclick = () => handleDeletePrompt(prompt, listItem);

        actionsContainer.appendChild(sendButton);
        actionsContainer.appendChild(deleteButton);
        listItem.appendChild(promptTextSpan);
        listItem.appendChild(actionsContainer);
        list.appendChild(listItem);
      });
      savedPromptsContainer.appendChild(list);
    };

    try {
      const data = await storage.get({ [STORAGE_KEY_CUSTOM_PROMPTS]: [] });
      renderSavedPrompts(data[STORAGE_KEY_CUSTOM_PROMPTS]);
    } catch (error) {
      devError(SCRIPT_PREFIX, "Error loading saved prompts:", error);
    }

    submitButton.addEventListener('click', async () => {
      const userPrompt = modalTextarea.value.trim();
      if (!userPrompt) {
        modalTextarea.style.borderColor = 'red';
        setTimeout(() => { modalTextarea.style.borderColor = '' }, 2000);
        return;
      }

      submitButton.textContent = 'Opening...';
      submitButton.disabled = true;
      cancelButton.disabled = true;

      await sendPromptToGemini(userPrompt, true);
      closeModal();
    });
  }

  function handleCustomPromptClick() {
    showCustomPromptModal();
  }

  async function handleSummarizeClick() {
    if (this.disabled) return;

    const originalText = this.textContent;
    this.textContent = BUTTON_TEXT_OPENING;
    this.disabled = true;

    try {
      const promptText = `Please analyze the following YouTube video and provide a systematic summary in English.

## 📝 TLDR (3-Line Summary)
1. First key point
2. Second key point
3. Third key point

## 🔍 Detailed Analysis
### Main Arguments
- Key claims and arguments presented in the video

### Evidence and Examples
- Analysis of evidence, data, and examples provided

### Background Context
- Background and socio-temporal context of the topic

### Opinions and Perspectives
- Evaluation of the presenter's viewpoint, bias, and objectivity

## 💡 Key Insights
- Main lessons and implications from the video
- Practical applications and relevance

## 🤔 Critical Review
- Review of logical consistency
- Missing perspectives or limitations
- Alternative opinions or different viewpoints

Video URL: ${window.location.href}`;
      await (typeof browser !== "undefined" ? browser : chrome).storage.local.set({ [STORAGE_KEY_PROMPT]: promptText });
      devLog(SCRIPT_PREFIX, "Prompt saved to storage");
      window.open(GEMINI_URL, "_blank");
      devLog(SCRIPT_PREFIX, `Opening Gemini: ${GEMINI_URL}`);
    } catch (error) {
      devError(SCRIPT_PREFIX, "Error during summarize click:", error);
      alert(`Could not process request: ${error.message}. Please try again.`);
      this.textContent = originalText;
      this.disabled = false;
      return;
    }

    setTimeout(() => {
      const btn = document.getElementById(BUTTON_ID);
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }, 2000);
  }

  function isWatchPage() {
    const { hostname, pathname, search } = window.location;
    const isDesktopWatchPage = hostname === 'www.youtube.com' && pathname === '/watch' && search.includes('v=');
    const isMobileWatchPage = hostname === 'm.youtube.com' && pathname === '/watch';
    return isDesktopWatchPage || isMobileWatchPage;
  }

  function getSkipReason() {
    const { hostname, pathname, search } = window.location;
    if (pathname.includes('/shorts/')) return "On a Shorts page";
    if (!hostname.includes('youtube.com')) return "Not on youtube.com";
    if (hostname === 'www.youtube.com') return `Not a desktop watch page (path: ${pathname}, search: ${search})`;
    return `Not a mobile watch page (path: ${pathname})`;
  }

  function attemptButtonInjection() {
    const { hostname, pathname } = window.location;
    const existingContainer = document.getElementById(BUTTON_CONTAINER_ID);

    if (pathname.includes('/shorts/') || !hostname.includes('youtube.com') || !isWatchPage()) {
      const reason = getSkipReason();
      devLog(SCRIPT_PREFIX, `Skipping injection: ${reason}`);
      if (existingContainer) {
        existingContainer.remove();
        devLog(SCRIPT_PREFIX, "Button container removed (not a target page)");
      }
      return;
    }

    if (existingContainer) {
      const isVisible = existingContainer.offsetParent !== null && getComputedStyle(existingContainer).display !== 'none';
      if (isVisible) {
        devLog(SCRIPT_PREFIX, "Button container exists and visible, skipping");
        return;
      }
      existingContainer.remove();
      devLog(SCRIPT_PREFIX, "Removed invisible button container for re-injection");
    }

    const isMobile = hostname === 'm.youtube.com';
    const injectionParentElement = findButtonInjectionPoint(isMobile);

    if (injectionParentElement) {
      const container = createButtonContainer();
      const standardButton = createSummarizeButtonElement();
      const customButton = createCustomPromptButtonElement();

      container.appendChild(standardButton);
      container.appendChild(customButton);

      injectionParentElement.appendChild(container);
      devLog(SCRIPT_PREFIX, "Button container injected successfully");
    } else {
      devWarn(SCRIPT_PREFIX, "No suitable parent element found for injection");
    }
  }

  // Event Listeners
  window.addEventListener('yt-navigate-start', (event) => {
    try {
      const upcomingUrl = event.detail?.url || event.detail?.page?.url || 
        (event.detail?.endpoint?.watchEndpoint?.videoId ? `/watch?v=${event.detail.endpoint.watchEndpoint.videoId}` : null);
      if (upcomingUrl?.includes('/shorts/')) {
        const existingContainer = document.getElementById(BUTTON_CONTAINER_ID);
        if (existingContainer) {
          existingContainer.remove();
          devLog(SCRIPT_PREFIX, "Button container removed (navigating to Shorts)");
        }
      }
    } catch (e) {
      devWarn(SCRIPT_PREFIX, "Error in navigation handler:", e);
    }
  });

  // Initialize
  if (injectionInterval) {
    clearInterval(injectionInterval);
    injectionInterval = null;
  }

  if (window.location.hostname === 'm.youtube.com') {
    devLog(SCRIPT_PREFIX, "Mobile mode: using interval");
    setTimeout(attemptButtonInjection, 500);
    injectionInterval = setInterval(attemptButtonInjection, 1500);
  } else {
    devLog(SCRIPT_PREFIX, "Desktop mode: using events");
    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(attemptButtonInjection, 250);
    });

    if (document.readyState === 'complete') {
      setTimeout(attemptButtonInjection, 250);
    } else {
      window.addEventListener('load', () => {
        setTimeout(attemptButtonInjection, 250);
      });
    }
  }

  devLog(SCRIPT_PREFIX, "Initialized", window.location.hostname === 'm.youtube.com' ? "Mobile" : "Desktop");
})();