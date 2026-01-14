"use client";

import { CRONOS_TESTNET } from "@/lib/cronos/network-config";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function NetworkSelector() {
  return (
    <div className="space-y-2">
      <Label>Network</Label>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="flex-1">
              <p className="font-medium">{CRONOS_TESTNET.name}</p>
              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                <span>Chain ID: {CRONOS_TESTNET.chainId}</span>
                <span>Symbol: {CRONOS_TESTNET.symbol}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
