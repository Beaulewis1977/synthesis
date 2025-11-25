/**
 * Synthesis Desktop - Renderer Process
 * Handles UI interactions and communicates with main process via IPC
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
  // Get API reference
  const api = window.synthesisAPI;

  if (!api) {
    console.error('synthesisAPI not available');
    showError('Failed to initialize: API not available');
    return;
  }

  // Set version
  document.getElementById('version').textContent = `v${api.getVersion()}`;

  // Get DOM elements
  const elements = {
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    openUiBtn: document.getElementById('open-ui-btn'),
    clearLogsBtn: document.getElementById('clear-logs-btn'),
    logContainer: document.getElementById('log-container'),
    errorDisplay: document.getElementById('error-display'),
    errorMessage: document.querySelector('.error-message'),
    errorDismiss: document.querySelector('.error-dismiss'),
    docsLink: document.getElementById('docs-link'),
    githubLink: document.getElementById('github-link'),
    modeInputs: document.querySelectorAll('input[name="mode"]'),
    services: document.querySelectorAll('.service'),
  };

  // State
  let isRunning = false;
  let isTransitioning = false;

  /**
   * Update UI based on running state
   */
  function updateUI(running, transitioning = false) {
    isRunning = running;
    isTransitioning = transitioning;

    elements.startBtn.disabled = running || transitioning;
    elements.stopBtn.disabled = !running || transitioning;
    elements.openUiBtn.disabled = !running;

    // Update button text during transition
    if (transitioning) {
      if (!running) {
        elements.startBtn.innerHTML = '<span class="btn-icon">⏳</span> Starting...';
      } else {
        elements.stopBtn.innerHTML = '<span class="btn-icon">⏳</span> Stopping...';
      }
    } else {
      elements.startBtn.innerHTML = '<span class="btn-icon">▶</span> Start Synthesis';
      elements.stopBtn.innerHTML = '<span class="btn-icon">■</span> Stop Synthesis';
    }

    // Disable mode selector when running
    for (const input of elements.modeInputs) {
      input.disabled = running || transitioning;
    }
  }

  /**
   * Update service status in dashboard
   */
  function updateServiceStatus(services) {
    const serviceMap = {
      database: services.database,
      server: services.server,
      web: services.web,
      ollama: services.ollama,
      redis: services.redis,
    };

    for (const [key, service] of Object.entries(serviceMap)) {
      const element = document.querySelector(`.service[data-service="${key}"]`);
      if (element && service) {
        element.setAttribute('data-status', service.status);
        element.querySelector('.service-status').textContent = service.status;
      }
    }
  }

  /**
   * Add a log entry to the viewer
   */
  function addLogEntry(entry) {
    const logContainer = elements.logContainer;

    // Remove "waiting for logs" message if present
    const waitingMsg = logContainer.querySelector('.log-entry:only-child');
    if (waitingMsg?.textContent.includes('Waiting for logs')) {
      waitingMsg.remove();
    }

    const entryEl = document.createElement('div');
    entryEl.className = `log-entry log-${entry.level}`;

    const time = new Date(entry.timestamp);
    const timeStr = time.toTimeString().substring(0, 8);

    let html = `<span class="log-time">${timeStr}</span>`;
    if (entry.source) {
      html += `<span class="log-source">[${entry.source}]</span>`;
    }
    html += `<span class="log-message">${escapeHtml(entry.message)}</span>`;

    entryEl.innerHTML = html;
    logContainer.appendChild(entryEl);

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;

    // Limit log entries
    while (logContainer.children.length > 500) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorDisplay.classList.remove('hidden');
  }

  /**
   * Hide error message
   */
  function hideError() {
    elements.errorDisplay.classList.add('hidden');
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Event Listeners

  // Start button
  elements.startBtn.addEventListener('click', async () => {
    hideError();
    updateUI(false, true);

    const result = await api.startSynthesis();

    if (result.success) {
      updateUI(true, false);
    } else {
      updateUI(false, false);
      showError(result.error || 'Failed to start Synthesis');
    }
  });

  // Stop button
  elements.stopBtn.addEventListener('click', async () => {
    hideError();
    updateUI(true, true);

    const result = await api.stopSynthesis();

    if (result.success) {
      updateUI(false, false);
    } else {
      updateUI(true, false);
      showError(result.error || 'Failed to stop Synthesis');
    }
  });

  // Open Web UI button
  elements.openUiBtn.addEventListener('click', () => {
    api.openWebUI();
  });

  // Clear logs button
  elements.clearLogsBtn.addEventListener('click', async () => {
    await api.clearLogs();
    elements.logContainer.innerHTML = `
      <div class="log-entry log-info">
        <span class="log-time">--:--:--</span>
        <span class="log-message">Logs cleared</span>
      </div>
    `;
  });

  // Error dismiss button
  elements.errorDismiss.addEventListener('click', hideError);

  // Mode selector
  for (const input of elements.modeInputs) {
    input.addEventListener('change', async (e) => {
      await api.setLaunchMode(e.target.value);
    });
  }

  // Footer links
  elements.docsLink.addEventListener('click', (e) => {
    e.preventDefault();
    api.openExternal('https://github.com/beaulewis1977/synthesis#readme');
  });

  elements.githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    api.openExternal('https://github.com/beaulewis1977/synthesis');
  });

  // Subscribe to status updates
  const unsubscribeStatus = api.onStatusUpdate((status) => {
    updateServiceStatus(status.services);

    // Update running state based on overall status
    const wasRunning = isRunning;
    const nowRunning = status.overall === 'running';

    if (wasRunning !== nowRunning && !isTransitioning) {
      updateUI(nowRunning, false);
    }
  });

  // Subscribe to log entries
  const unsubscribeLogs = api.onLogEntry((entry) => {
    addLogEntry(entry);
  });

  // Initial status check
  const initialStatus = await api.getStackStatus();
  updateServiceStatus(initialStatus.services);
  updateUI(initialStatus.overall === 'running', false);

  // Load initial mode
  const currentMode = await api.getLaunchMode();
  const modeInput = document.querySelector(`input[name="mode"][value="${currentMode}"]`);
  if (modeInput) {
    modeInput.checked = true;
  }

  // Load existing logs
  const existingLogs = await api.getLogs();
  if (existingLogs.length > 0) {
    elements.logContainer.innerHTML = '';
    existingLogs.forEach(addLogEntry);
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    unsubscribeStatus();
    unsubscribeLogs();
  });
}
