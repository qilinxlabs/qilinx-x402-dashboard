"use client";

import { useState, useCallback } from "react";
import { useSigningMode } from "@/lib/x402/signing-mode-context";
import {
  executeWithConnectedWallet,
  type X402ProgressEvent,
} from "@/lib/x402/x402-client-execution";
import type { X402Service } from "@/hooks/use-x402-services";

export interface UseX402ExecutionResult {
  isExecuting: boolean;
  events: X402ProgressEvent[];
  execute: (service: X402Service) => Promise<void>;
  reset: () => void;
}

export function useX402Execution(): UseX402ExecutionResult {
  const { mode } = useSigningMode();
  const [isExecuting, setIsExecuting] = useState(false);
  const [events, setEvents] = useState<X402ProgressEvent[]>([]);

  const addEvent = useCallback((event: X402ProgressEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setIsExecuting(false);
  }, []);

  const executeWithDeveloperWallet = useCallback(
    async (service: X402Service) => {
      try {
        const response = await fetch("/api/chat/x402/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: service.id,
            query: service.title,
          }),
        });

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response stream");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: X402ProgressEvent = JSON.parse(line.slice(6));
                addEvent({
                  ...event,
                  timestamp: Date.now(),
                });
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        addEvent({
          type: "error",
          message,
          timestamp: Date.now(),
        });
      }
    },
    [addEvent]
  );

  const execute = useCallback(
    async (service: X402Service) => {
      setIsExecuting(true);
      setEvents([]);

      try {
        if (mode === "connected-wallet") {
          await executeWithConnectedWallet({
            service,
            onProgress: addEvent,
          });
        } else {
          await executeWithDeveloperWallet(service);
        }
      } finally {
        setIsExecuting(false);
      }
    },
    [mode, addEvent, executeWithDeveloperWallet]
  );

  return {
    isExecuting,
    events,
    execute,
    reset,
  };
}
