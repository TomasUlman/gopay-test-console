async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok && !data) throw new Error(`HTTP ${response.status}`);
  return data;
}

export const api = {
  state(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
    return request(`/api/state?${query}`);
  },
  execute(body) {
    return request('/api/execute', { method: 'POST', body: JSON.stringify(body) });
  },
  saveCustomEnv(body) {
    return request('/api/custom-env', { method: 'POST', body: JSON.stringify(body) });
  },
  clearHistory() {
    return request('/api/history/clear', { method: 'POST', body: '{}' });
  },
};
