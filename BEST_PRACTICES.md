# Our Commitment to Best Practices

We strive to ensure this extension is safe, secure, and respects your privacy. Here are some of the best practices we've implemented:

*   **Minimal Permissions**: We only request permissions that are absolutely necessary for the extension to function (`storage` for saving prompts and settings, `tabs` for opening Gemini, and specific `host_permissions` for YouTube and Gemini sites).
*   **Content Security Policy (CSP)**: A strict CSP (`script-src 'self'; object-src 'self'`) is in place to protect against cross-site scripting (XSS) attacks by preventing the execution of inline scripts and restricting resource loading.
*   **No Sensitive Data Exposure**: The extension does not handle, store, or transmit any personal API keys or secrets.
*   **Input Sanitization**: While user input is minimal, DOM manipulation (like inserting the button or filling the prompt) uses safe methods (`textContent`, `innerText`) to prevent XSS vulnerabilities.
*   **Dependency Security**: Development dependencies are regularly audited for known vulnerabilities using `npm audit`.
*   **HTTPS Only**: All external communication, specifically with `gemini.google.com`, is done over HTTPS.
*   **Clear Privacy Policy**: A detailed [Privacy Policy](PRIVACY.md) is provided, outlining what data is collected (YouTube video URL for the prompt, user settings for logging) and how it's used and stored.
*   **Transparent Disclaimers**: We clearly state that this extension is independent and not affiliated with Google, YouTube, or Gemini. We also inform users about potential charges from Google for Gemini API usage if they have billing enabled.
*   **Focus on Security and User Trust**: Ongoing efforts include reviewing code for potential security flaws and ensuring compliance with extension store guidelines.
