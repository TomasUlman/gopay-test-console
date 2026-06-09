export function pretty(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function groupActions(actions) {
  return Object.values(actions).reduce((groups, action) => {
    groups[action.group] ||= [];
    groups[action.group].push(action);
    return groups;
  }, {});
}
