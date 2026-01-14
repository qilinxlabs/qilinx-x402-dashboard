import { NextResponse } from "next/server";

export interface X402Service {
  id: string;
  title: string;
  description?: string;
  hookType: "nft-mint" | "reward-points" | "transfer-split";
  hookAddress: string;
  network: string;
  settlementRouter: string;
  usdcAddress: string;
  chainId: number;
  supportingContracts?: Record<string, string>;
  defaults?: {
    paymentAmount: string;
    facilitatorFee: string;
    payTo: string;
  };
}

export interface DiscoverResponse {
  services: X402Service[];
  serverUrl: string;
  configured: boolean;
  error?: string;
}

export async function GET(): Promise<NextResponse<DiscoverResponse>> {
  const serverUrl = process.env.RESOURCE_SERVICE_URL;

  if (!serverUrl) {
    return NextResponse.json({
      services: [],
      serverUrl: "",
      configured: false,
      error: "RESOURCE_SERVICE_URL not configured",
    });
  }

  try {
    const response = await fetch(`${serverUrl}/api/x402/services`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Don't cache - always fetch fresh services
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({
        services: [],
        serverUrl,
        configured: true,
        error: `Failed to fetch services: ${response.statusText}`,
      });
    }

    const data = await response.json();
    const services: X402Service[] = data.services || [];

    return NextResponse.json({
      services,
      serverUrl,
      configured: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      services: [],
      serverUrl,
      configured: true,
      error: `Failed to connect to A2A server: ${message}`,
    });
  }
}
