"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { executeWithConnectedWallet, type X402ProgressEvent } from "@/lib/x402/x402-client-execution";
import type { X402Service } from "@/hooks/use-x402-services";
import { cn } from "@/lib/utils";

interface X402WalletSignerProps {
  service: X402Service;
  splits?: Array<{ recipient: string; bips: number }> | null;
  onComplete?: (result: {
    success: boolean;
    transactionHash?: string;
    explorerUrl?: string;
    error?: string;
  }) => void;
}

type SigningState = "idle" | "signing" | "success" | "error";

export function X402WalletSigner({ service, splits, onComplete }: X402WalletSignerProps) {
  const [state, setState] = useState<SigningState>("idle");
  const [progress, setProgress] = useState<string[]>([]);
  const [result, setResult] = useState<{
    transactionHash?: string;
    explorerUrl?: string;
    error?: string;
  } | null>(null);
  
  // Ref to prevent multiple signing attempts
  const hasStartedRef = useRef(false);

  const handleSign = async () => {
    // Prevent multiple executions
    if (hasStartedRef.current && state !== "error") {
      return;
    }
    hasStartedRef.current = true;
    
    setState("signing");
    setProgress([]);
    setResult(null);

    const progressMessages: string[] = [];

    const handleProgress = (event: X402ProgressEvent) => {
      progressMessages.push(event.message);
      setProgress([...progressMessages]);

      if (event.type === "success" && event.data?.transaction) {
        setState("success");
        const txResult = {
          success: true,
          transactionHash: event.data.transaction.hash,
          explorerUrl: event.data.transaction.explorerUrl,
        };
        setResult(txResult);
        onComplete?.(txResult);
      } else if (event.type === "error") {
        setState("error");
        const errorResult = {
          success: false,
          error: event.message,
        };
        setResult(errorResult);
        onComplete?.(errorResult);
      }
    };

    try {
      // Convert service to the format expected by executeWithConnectedWallet
      const serviceForExecution: X402Service = {
        ...service,
        defaults: service.defaults || {
          paymentAmount: "0.1",
          facilitatorFee: "0",
          payTo: "0x0000000000000000000000000000000000000000",
        },
      };

      await executeWithConnectedWallet({
        service: serviceForExecution,
        splits: splits,
        onProgress: handleProgress,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setState("error");
      setResult({ error: errorMessage });
      onComplete?.({ success: false, error: errorMessage });
    }
  };

  const handleRetry = () => {
    // Allow retry after error
    hasStartedRef.current = false;
    handleSign();
  };

  // Auto-trigger signing on mount (only once)
  useEffect(() => {
    if (!hasStartedRef.current) {
      handleSign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {service.title}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              service.hookType === "nft-mint" && "border-purple-500 text-purple-600",
              service.hookType === "reward-points" && "border-green-500 text-green-600",
              service.hookType === "transfer-split" && "border-blue-500 text-blue-600"
            )}
          >
            {service.hookType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress messages */}
        {progress.length > 0 && (
          <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
            {progress.map((msg, i) => (
              <div key={i} className="flex items-center gap-2">
                {state === "signing" && i === progress.length - 1 ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
                <span>{msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Success state */}
        {state === "success" && result?.explorerUrl && (
          <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-300">
              Transaction confirmed!
            </span>
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Error state */}
        {state === "error" && result?.error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded-md">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-300">
                {result.error}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleRetry} className="w-full">
              <Wallet className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Idle state - shouldn't normally show due to auto-trigger */}
        {state === "idle" && (
          <Button size="sm" onClick={handleSign} className="w-full">
            <Wallet className="h-4 w-4 mr-2" />
            Sign with Wallet
          </Button>
        )}

        {/* Payment info */}
        <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
          <div>Amount: {service.defaults?.paymentAmount || "0.1"} USDC</div>
          {splits && splits.length > 0 && (
            <div className="space-y-0.5">
              <div className="font-medium">Split recipients:</div>
              {splits.map((split, i) => (
                <div key={i} className="flex justify-between font-mono text-[10px]">
                  <span>{split.recipient.slice(0, 8)}...{split.recipient.slice(-6)}</span>
                  <span>{split.bips / 100}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
