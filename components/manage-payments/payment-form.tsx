"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isValidEthereumAddress,
  isValidAmount,
  toBaseUnits,
  USDCE_DECIMALS,
} from "@/lib/cronos/network-config";
import type { PaymentParams } from "@/lib/cronos/facilitator-service";
import { Send, AlertCircle } from "lucide-react";

interface PaymentFormProps {
  onSubmit: (params: PaymentParams) => void;
  disabled?: boolean;
}

interface FormErrors {
  recipientAddress?: string;
  amount?: string;
}

export function PaymentForm({ onSubmit, disabled = false }: PaymentFormProps) {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [baseUnits, setBaseUnits] = useState("0");

  const tokenSymbol = "devUSDC.e"; // Fixed to testnet token

  useEffect(() => {
    if (isValidAmount(amount)) {
      setBaseUnits(toBaseUnits(amount));
    } else {
      setBaseUnits("0");
    }
  }, [amount]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!recipientAddress) {
      newErrors.recipientAddress = "Recipient address is required";
    } else if (!isValidEthereumAddress(recipientAddress)) {
      newErrors.recipientAddress = "Invalid Ethereum address format";
    }

    if (!amount) {
      newErrors.amount = "Amount is required";
    } else if (!isValidAmount(amount)) {
      newErrors.amount = "Amount must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSubmit({
      recipientAddress,
      amount: toBaseUnits(amount),
      description: description || undefined,
    });
  };

  const handleAddressChange = (value: string) => {
    setRecipientAddress(value);
    if (errors.recipientAddress) {
      if (isValidEthereumAddress(value) || !value) {
        setErrors((prev) => ({ ...prev, recipientAddress: undefined }));
      }
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (errors.amount) {
      if (isValidAmount(value) || !value) {
        setErrors((prev) => ({ ...prev, amount: undefined }));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Create Payment
        </CardTitle>
        <CardDescription>
          Send {tokenSymbol} to a recipient on Cronos Testnet (by facilitator sdk) 
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              disabled={disabled}
              className={`font-mono ${errors.recipientAddress ? "border-destructive" : ""}`}
            />
            {errors.recipientAddress && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.recipientAddress}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({tokenSymbol})</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={disabled}
              className={errors.amount ? "border-destructive" : ""}
            />
            {errors.amount ? (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.amount}
              </p>
            ) : (
              amount && isValidAmount(amount) && (
                <p className="text-xs text-muted-foreground">
                  Base units ({USDCE_DECIMALS} decimals): {baseUnits}
                </p>
              )
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Payment description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={disabled}
              rows={2}
              maxLength={256}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/256
            </p>
          </div>

          <Button
            type="submit"
            disabled={disabled || !recipientAddress || !amount}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            Send Payment
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
