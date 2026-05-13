(function () {
  function showSignal(message, type = 'info') {
    let signal = document.querySelector('[data-signal]');

    if (!signal) {
      signal = document.createElement('div');
      signal.dataset.signal = '';
      signal.className = 'signal-bar';
      document.body.appendChild(signal);
    }

    signal.textContent = message;
    signal.className = `signal-bar signal-bar--${type} is-visible`;

    window.clearTimeout(signal.hideTimeout);
    signal.hideTimeout = window.setTimeout(() => {
      signal.classList.remove('is-visible');
    }, 3500);
  }

  function scrollToPanel(selector) {
    const panel = document.querySelector(selector);
    if (!panel) return;

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function highlightPanel(selector) {
    const panel = document.querySelector(selector);
    if (!panel) return;

    panel.classList.remove('has-new-response');
    window.requestAnimationFrame(() => {
      panel.classList.add('has-new-response');
    });
  }

  function setSendingState(isSending) {
    const button = document.querySelector('[data-send-request]');
    if (!button) return;

    button.disabled = isSending;
    button.textContent = isSending ? 'TRANSMITTING...' : 'SEND REQUEST';
    button.classList.toggle('is-loading', isSending);
  }

  function formatJson() {
    const textarea = document.getElementById('payloadEditor');
    if (!textarea) return;

    try {
      textarea.value = JSON.stringify(JSON.parse(textarea.value), null, 2);
      showSignal('JSON formatted.', 'success');
    } catch (error) {
      showSignal(`Invalid JSON: ${error.message}`, 'error');
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText((text || '').trim());
      showSignal('Copied to clipboard.', 'success');
    } catch (error) {
      showSignal('Copy failed. Select the text manually.', 'error');
    }
  }

  async function copyTextFromElement(targetId) {
    const element = document.getElementById(targetId);
    if (!element) {
      showSignal('Nothing to copy.', 'warning');
      return;
    }

    const text = element.innerText || element.textContent || '';
    copyText(text);
  }

  document.querySelectorAll('[data-feedback]').forEach((element) => {
    element.addEventListener('click', () => {
      showSignal(element.dataset.feedback || 'Action started...', 'info');
    });
  });

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', () => {
      copyTextFromElement(button.dataset.copyTarget);
    });
  });

  document.querySelectorAll('[data-copy-textarea]').forEach((button) => {
    button.addEventListener('click', () => {
      const textarea = document.getElementById(button.dataset.copyTextarea);
      copyText(textarea ? textarea.value : '');
    });
  });

  document.querySelectorAll('[data-feedback-change]').forEach((element) => {
    element.addEventListener('change', () => {
      showSignal(element.dataset.feedbackChange || 'Value changed.', 'info');
      if (element.form) element.form.submit();
    });
  });

  document.querySelectorAll('[data-feedback-form]').forEach((form) => {
    form.addEventListener('submit', () => {
      showSignal(form.dataset.feedbackForm || 'Saving...', 'info');
    });
  });

  const terminalForm = document.querySelector('[data-request-form]');
  if (terminalForm) {
    terminalForm.addEventListener('submit', () => {
      setSendingState(true);
      showSignal('Request transmitted...', 'info');
    });
  }

  const formatButton = document.querySelector('[data-format-json]');
  if (formatButton) {
    formatButton.addEventListener('click', formatJson);
  }

  const initialToastRaw = document.body.dataset.initialToast;
  if (initialToastRaw) {
    try {
      const toast = JSON.parse(initialToastRaw);
      showSignal(toast.message, toast.type);
    } catch (error) {
      // UI feedback must never break the app.
    }
  }

  if (document.body.dataset.hasResult === '1') {
    window.setTimeout(() => {
      scrollToPanel('[data-response-panel]');
      highlightPanel('[data-response-panel]');
    }, 120);
  } else if (document.body.dataset.hasAutoStatus === '1') {
    window.setTimeout(() => {
      scrollToPanel('[data-status-panel]');
      highlightPanel('[data-status-panel]');
    }, 120);
  }
})();
