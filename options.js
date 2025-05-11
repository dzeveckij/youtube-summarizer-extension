// options.js
document.addEventListener('DOMContentLoaded', () => {
  const verboseLoggingCheckbox = document.getElementById('verboseLogging');

  // Load the current setting and update the checkbox
  chrome.storage.sync.get({ verboseLogging: false }, (items) => {
    verboseLoggingCheckbox.checked = items.verboseLogging;
  });

  // Save the setting when the checkbox changes
  verboseLoggingCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ verboseLogging: verboseLoggingCheckbox.checked }, () => {
      console.log('Verbose logging setting saved:', verboseLoggingCheckbox.checked);
    });
  });
});
