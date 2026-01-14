"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronosWalletService, type WalletInfo } from "@/lib/cronos/wallet-service";
import { AlertCircle, CheckCircle2, Wallet, Eye, EyeOff, Copy, Key } from "lucide-react";

interface WalletConfigProps {
  rpcUrl: string;
  onWalletConfigured: (wallet: WalletInfo) => void;
  configuredWallet?: WalletInfo | null;
  onDisconnect?: () => void;
}

export function WalletConfig({
  rpcUrl,
  onWalletConfigured,
  configuredWallet,
  onDisconnect,
}: WalletConfigProps) {
  const [mnemonic, setMnemonic] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showExportedKey, setShowExportedKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleMnemonicSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      if (!CronosWalletService.isValidMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic phrase. Please enter 12 or 24 words.");
      }

      const wallet = CronosWalletService.fromMnemonic(mnemonic, rpcUrl);
      onWalletConfigured(wallet);
      setMnemonic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to derive wallet");
    } finally {
      setLoading(false);
    }
  };

  const handlePrivateKeySubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      if (!CronosWalletService.isValidPrivateKey(privateKey)) {
        throw new Error("Invalid private key format");
      }

      const wallet = CronosWalletService.fromPrivateKey(privateKey, rpcUrl);
      onWalletConfigured(wallet);
      setPrivateKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrivateKey = async () => {
    if (configuredWallet?.privateKey) {
      await navigator.clipboard.writeText(configuredWallet.privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (configuredWallet) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Wallet Connected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs text-muted-foreground">Address</p>
            <p className="font-mono text-sm break-all">{configuredWallet.address}</p>
          </div>
          
          {showExportedKey && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Private Key</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm break-all flex-1">{configuredWallet.privateKey}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPrivateKey}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-green-500 mt-1">Copied to clipboard!</p>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportedKey(!showExportedKey)}
              className="flex-1"
            >
              <Key className="mr-2 h-4 w-4" />
              {showExportedKey ? "Hide Private Key" : "Export Private Key"}
            </Button>
            {onDisconnect && (
              <Button variant="outline" size="sm" onClick={onDisconnect} className="flex-1">
                Disconnect
              </Button>
            )}
          </div>
          
          {showExportedKey && (
            <p className="text-xs text-destructive">
              ⚠️ Never share your private key. Anyone with access can control your funds.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Configure Wallet
        </CardTitle>
        <CardDescription>
          Enter your mnemonic phrase or private key to sign transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mnemonic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mnemonic">Mnemonic</TabsTrigger>
            <TabsTrigger value="privatekey">Private Key</TabsTrigger>
          </TabsList>

          <TabsContent value="mnemonic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mnemonic">Recovery Phrase (12 or 24 words)</Label>
              <Textarea
                id="mnemonic"
                placeholder="Enter your mnemonic phrase..."
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                rows={3}
                className="font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleMnemonicSubmit}
              disabled={loading || !mnemonic.trim()}
              className="w-full"
            >
              {loading ? "Deriving..." : "Connect Wallet"}
            </Button>
          </TabsContent>

          <TabsContent value="privatekey" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="privatekey">Private Key</Label>
              <div className="relative">
                <Input
                  id="privatekey"
                  type={showPrivateKey ? "text" : "password"}
                  placeholder="0x..."
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              onClick={handlePrivateKeySubmit}
              disabled={loading || !privateKey.trim()}
              className="w-full"
            >
              {loading ? "Importing..." : "Connect Wallet"}
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Your wallet credentials are stored only in your browser session and are never sent to any server.
        </p>
      </CardContent>
    </Card>
  );
}
