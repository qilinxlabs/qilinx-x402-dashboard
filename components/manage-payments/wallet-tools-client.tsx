"use client";

import { useState } from "react";
import { WalletConfig } from "./wallet-config";
import { getNetworkConfig } from "@/lib/cronos/network-config";
import type { WalletInfo } from "@/lib/cronos/wallet-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";

export function WalletToolsClient() {
  const network = "testnet"; // Fixed to testnet only
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  const networkConfig = getNetworkConfig(network);

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-6">
        <Link href="/manage-payments">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payments
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Wallet Tools</h1>
            <p className="text-muted-foreground">
              Utility tools for wallet management on Cronos Testnet
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Seed Phrase to Private Key Converter</CardTitle>
            <CardDescription>
              Convert your BIP39 mnemonic phrase (12 or 24 words) to a private key.
              This tool runs entirely in your browser - your seed phrase is never sent to any server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WalletConfig
              rpcUrl={networkConfig.rpcUrl}
              onWalletConfigured={setWallet}
              configuredWallet={wallet}
              onDisconnect={() => setWallet(null)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
