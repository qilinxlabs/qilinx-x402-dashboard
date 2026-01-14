"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { X402ProgressEvent } from "@/lib/x402/x402-client-execution";

interface X402ProgressProps {
  events: X402ProgressEvent[];
  isComplete: boolean;
  className?: string;
}

export function X402Progress({ events, isComplete, className }: X402ProgressProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  if (events.length === 0) {
    return null;
  }

  const lastEvent = events[events.length - 1];
  const isSuccess = lastEvent?.type === "success";
  const isError = lastEvent?.type === "error";

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress Events */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          X402 Execution Progress
        </div>
        {events.map((event, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2 text-sm",
              event.type === "error" && "text-destructive",
              event.type === "success" && "text-green-600 dark:text-green-400"
            )}
          >
            {event.type === "progress" && !isComplete && index === events.length - 1 ? (
              <Loader2 className="h-4 w-4 animate-spin mt-0.5 shrink-0" />
            ) : event.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : event.type === "error" ? (
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <span className="break-all">{event.message}</span>
          </div>
        ))}
      </div>

      {/* Success Result */}
      {isSuccess && lastEvent.data && (
        <X402TransactionResult
          data={lastEvent.data}
          onCopyHash={copyToClipboard}
          copiedHash={copiedHash}
        />
      )}

      {/* Error Result */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Transaction Failed</span>
          </div>
          <p className="mt-2 text-sm text-destructive/80">{lastEvent.message}</p>
        </div>
      )}
    </div>
  );
}

interface X402TransactionResultProps {
  data: X402ProgressEvent["data"];
  onCopyHash: (hash: string) => void;
  copiedHash: boolean;
}

function X402TransactionResult({
  data,
  onCopyHash,
  copiedHash,
}: X402TransactionResultProps) {
  if (!data) return null;

  const { service, transaction, splits } = data;

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-4">
      {/* Success Header */}
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Transaction Confirmed</span>
      </div>

      {/* Service Info */}
      {service && (
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              service.hookType === "nft-mint" && "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
              service.hookType === "reward-points" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
              service.hookType === "transfer-split" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            )}
          >
            {service.hookType}
          </Badge>
          <span className="text-sm font-medium">{service.title}</span>
        </div>
      )}

      {/* Transaction Details */}
      {transaction && (
        <div className="space-y-3">
          {/* Hash */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Transaction Hash</div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all flex-1">
                {transaction.hash}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onCopyHash(transaction.hash)}
              >
                {copiedHash ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Explorer Link */}
          <Button variant="outline" size="sm" asChild className="w-full">
            <a
              href={transaction.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Explorer
            </a>
          </Button>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Block</div>
              <div className="font-mono">{transaction.blockNumber}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Amount</div>
              <div className="font-medium">{transaction.amount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">From</div>
              <div className="font-mono text-xs truncate">{transaction.from}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">To (Merchant)</div>
              <div className="font-mono text-xs truncate">{transaction.payTo}</div>
            </div>
          </div>
        </div>
      )}

      {/* Split Recipients */}
      {splits && splits.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Split Recipients</div>
          <div className="space-y-1.5">
            {splits.map((split, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1"
              >
                <span className="font-mono text-xs truncate max-w-[180px]">
                  {split.recipient}
                </span>
                <span className="font-medium">{split.percentage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
