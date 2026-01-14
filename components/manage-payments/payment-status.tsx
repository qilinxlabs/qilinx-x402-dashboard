"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PaymentState } from "@/lib/cronos/facilitator-service";
import { getExplorerTxUrl } from "@/lib/cronos/network-config";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface PaymentStatusProps {
  state: PaymentState;
  onRetry?: () => void;
  onReset?: () => void;
}

export function PaymentStatus({
  state,
  onRetry,
  onReset,
}: PaymentStatusProps) {
  if (state.status === "idle") {
    return null;
  }

  const isProcessing = ["generating", "verifying", "settling"].includes(state.status);
  const isSuccess = state.status === "success";
  const isError = state.status === "error";

  return (
    <Card className={isError ? "border-destructive" : isSuccess ? "border-green-500" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {isSuccess && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {isError && <XCircle className="h-4 w-4 text-destructive" />}
          {isProcessing && "Processing Payment"}
          {isSuccess && "Payment Successful"}
          {isError && "Payment Failed"}
        </CardTitle>
        {state.currentStep && isProcessing && (
          <CardDescription>{state.currentStep}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  state.status === "generating" ? "bg-primary animate-pulse" : "bg-muted"
                }`}
              />
              <span
                className={`text-sm ${
                  state.status === "generating" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Generating payment header
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  state.status === "verifying" ? "bg-primary animate-pulse" : "bg-muted"
                }`}
              />
              <span
                className={`text-sm ${
                  state.status === "verifying" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Verifying payment
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  state.status === "settling" ? "bg-primary animate-pulse" : "bg-muted"
                }`}
              />
              <span
                className={`text-sm ${
                  state.status === "settling" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Settling on-chain
              </span>
            </div>
          </div>
        )}

        {isSuccess && state.txHash && (
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Transaction Hash</p>
              <p className="font-mono text-sm break-all">{state.txHash}</p>
            </div>
            <a
              href={getExplorerTxUrl("testnet", state.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              View on Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset} className="w-full mt-2">
                New Payment
              </Button>
            )}
          </div>
        )}

        {isError && (
          <div className="space-y-3">
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Payment
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
