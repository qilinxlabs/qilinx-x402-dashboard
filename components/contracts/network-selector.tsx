"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { EthereumNetwork } from "@/lib/db/schema";

interface NetworkSelectorProps {
  value: EthereumNetwork;
  onChange: (network: EthereumNetwork) => void;
  disabled?: boolean;
}

export function NetworkSelector({ value, onChange, disabled }: NetworkSelectorProps) {
  return (
    <Card className="w-[180px]">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium">Cronos Testnet</span>
        </div>
      </CardContent>
    </Card>
  );
}
