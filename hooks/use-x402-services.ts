"use client";

import { useState, useEffect, useCallback } from "react";
import type { X402Service, DiscoverResponse } from "@/app/(chat)/api/x402/discover/route";

export type { X402Service };

export interface UseX402ServicesResult {
  services: X402Service[];
  isLoading: boolean;
  error: string | null;
  serverUrl: string;
  configured: boolean;
  refetch: () => Promise<void>;
}

export function useX402Services(): UseX402ServicesResult {
  const [services, setServices] = useState<X402Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [configured, setConfigured] = useState(false);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/x402/discover");
      const data: DiscoverResponse = await response.json();

      setServices(data.services);
      setServerUrl(data.serverUrl);
      setConfigured(data.configured);

      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch services";
      setError(message);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return {
    services,
    isLoading,
    error,
    serverUrl,
    configured,
    refetch: fetchServices,
  };
}
