"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveStatus = "connecting" | "online" | "offline";

export function useLive(
  url: string,
  onEvent?: (payload: unknown) => void,
): { status: LiveStatus; lastEventAt: Date | null } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data === "ping") return;
    setLastEventAt(new Date());
    try {
      const payload = JSON.parse(event.data);
      handler.current?.(payload);
    } catch {
      handler.current?.(null);
    }
  }, []);

  useEffect(() => {
    const source = new EventSource(url);
    source.onopen = () => setStatus("online");
    source.onmessage = handleMessage;
    source.onerror = () => setStatus("offline");
    const heartbeat = window.setInterval(() => {
      if (source.readyState === EventSource.CLOSED) setStatus("offline");
    }, 30_000);
    return () => {
      window.clearInterval(heartbeat);
      source.close();
    };
  }, [url, handleMessage]);

  return { status, lastEventAt };
}
