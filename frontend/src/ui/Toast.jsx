import { useEffect, useRef } from 'react';

export function Toast({ toast, onClose }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => {
      onCloseRef.current?.();
    }, 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return <div className={`signal-bar signal-bar--${toast.type || 'info'} is-visible`}>{toast.message}</div>;
}
