export function pretty(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function withoutMetaFields(payload = {}, fields = []) {
  const omit = new Set(['id', 'card_id', ...fields]);
  const clone = { ...payload };
  for (const key of omit) delete clone[key];
  return clone;
}

export function countFields(value) {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countFields(item), 0);
  return Object.values(value).reduce((sum, item) => sum + 1 + countFields(item), 0);
}

export function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
