'use client';

import { useEffect, useState } from 'react';

export function useWebSocket<T>(url?: string) {
  const [message, setMessage] = useState<T | null>(null);

  useEffect(() => {
    if (!url) return;
    const socket = new WebSocket(url);
    socket.onmessage = (event) => setMessage(JSON.parse(event.data) as T);
    return () => socket.close();
  }, [url]);

  return message;
}
