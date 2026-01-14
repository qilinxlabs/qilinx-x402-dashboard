import { NextResponse } from "next/server";
import { ethers } from "ethers";

export interface WalletStatusResponse {
  configured: boolean;
  address?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse<WalletStatusResponse>> {
  const privateKey = process.env.CRONOS_DEVELOPER_PRIVATE_KEY;

  if (!privateKey) {
    return NextResponse.json({
      configured: false,
      error: "CRONOS_DEVELOPER_PRIVATE_KEY not configured",
    });
  }

  try {
    // Derive address from private key without exposing the key
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;

    return NextResponse.json({
      configured: true,
      address,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid private key";
    return NextResponse.json({
      configured: false,
      error: `Failed to derive wallet address: ${message}`,
    });
  }
}
