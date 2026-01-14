"use client";

import { useState, useCallback, useEffect } from "react";
import { NetworkSelector } from "./network-selector";
import { PaymentForm } from "./payment-form";
import { PaymentStatus } from "./payment-status";
import type { PaymentParams, PaymentState } from "@/lib/cronos/facilitator-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Wallet } from "lucide-react";

interface WalletStatus {
  configured: boolean;
  address?: string;
  error?: string;
}

export function ManagePaymentsClient() {
  const network = "testnet"; // Fixed to testnet only
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>({ status: "idle" });
  const [loading, setLoading] = useState(true);

  // Fetch wallet status on mount
  useEffect(() => {
    const fetchWalletStatus = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/cronos/payment?network=${network}`);
        const data = await response.json();
        setWalletStatus(data);
      } catch {
        setWalletStatus({ configured: false, error: "Failed to check wallet status" });
      } finally {
        setLoading(false);
      }
    };

    fetchWalletStatus();
  }, []);

  const handlePaymentSubmit = useCallback(
    async (params: PaymentParams) => {
      setPaymentState({ status: "generating", currentStep: "Generating payment header..." });

      try {
        setPaymentState({ status: "verifying", currentStep: "Verifying payment..." });

        const response = await fetch("/api/cronos/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            network,
            recipientAddress: params.recipientAddress,
            amount: params.amount,
            description: params.description,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setPaymentState({ status: "error", error: data.error || "Payment failed" });
          return;
        }

        setPaymentState({ status: "settling", currentStep: "Settling payment on-chain..." });

        // Small delay to show settling state
        await new Promise((resolve) => setTimeout(resolve, 500));

        setPaymentState({ status: "success", txHash: data.txHash });
      } catch (error) {
        setPaymentState({
          status: "error",
          error: error instanceof Error ? error.message : "Payment failed",
        });
      }
    },
    []
  );

  const handleRetry = useCallback(() => {
    setPaymentState({ status: "idle" });
  }, []);

  const handleReset = useCallback(() => {
    setPaymentState({ status: "idle" });
  }, []);

  const isProcessing = ["generating", "verifying", "settling"].includes(paymentState.status);

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Manage Payments</h1>
        <p className="text-muted-foreground">
          Create X402 payments on Cronos Testnet using devUSDC.e
        </p>
      </div>

      <div className="space-y-6">
        <NetworkSelector />

        {/* Sender Wallet Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Sender Wallet
            </CardTitle>
            <CardDescription>
              From developer wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Checking wallet configuration...</p>
            ) : walletStatus?.configured ? (
              <div className="space-y-2">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-mono text-sm break-all">{walletStatus.address}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">
                  {walletStatus?.error || "No private key configured for testnet. Add CRONOS_TESTNET_PRIVATE_KEY to .env.local"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Form - always visible if wallet is configured */}
        {walletStatus?.configured && (
          <>
            <PaymentForm
              onSubmit={handlePaymentSubmit}
              disabled={isProcessing || paymentState.status === "success"}
            />

            <PaymentStatus
              state={paymentState}
              onRetry={handleRetry}
              onReset={handleReset}
            />
          </>
        )}
      </div>
    </div>
  );
}
