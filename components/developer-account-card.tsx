"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

interface DeveloperAccountCardProps {
  address: string;
}

export function DeveloperAccountCard({ address }: DeveloperAccountCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = `https://explorer.cronos.org/testnet/address/${address}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Developer Account</span>
          <span className="text-xs font-normal text-muted-foreground bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">
            Cronos Testnet
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Public Address</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-sm bg-muted p-2 rounded font-mono break-all">
              {address}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              title="Copy address"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(explorerUrl, "_blank")}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View on Explorer
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <p>
            This is the developer account used for deploying and managing smart contracts on Cronos testnet.
            All contract deployments and transactions will be executed from this address.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
