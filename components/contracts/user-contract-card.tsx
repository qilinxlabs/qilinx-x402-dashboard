"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play, Copy, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { UserContract } from "@/lib/db/schema";
import { getBlockExplorerUrl, getBlockExplorerTxUrl, getNetworkDisplayName } from "@/lib/contracts/network-config";
import { ContractInteractor } from "./contract-interactor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserContractCardProps {
  contract: UserContract;
  compact?: boolean;
  onDelete?: (id: string) => void;
}

export function UserContractCard({ contract, compact = false, onDelete }: UserContractCardProps) {
  const [showInteractor, setShowInteractor] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showAbi, setShowAbi] = useState(false);
  const [copiedAbi, setCopiedAbi] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const explorerUrl = getBlockExplorerUrl(contract.network, contract.contractAddress);
  const txUrl = getBlockExplorerTxUrl(contract.network, contract.transactionHash);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(contract.contractAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const copyAbi = async () => {
    await navigator.clipboard.writeText(JSON.stringify(contract.abi, null, 2));
    setCopiedAbi(true);
    setTimeout(() => setCopiedAbi(false), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contracts/user-contracts?id=${contract.id}`, {
        method: "DELETE",
      });
      if (res.ok && onDelete) {
        onDelete(contract.id);
      }
    } catch (error) {
      console.error("Failed to delete contract:", error);
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Compact version for bundle display
  if (compact) {
    return (
      <>
        <Card className="bg-muted/30">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {contract.name.split(" - ").pop() || contract.name}
              </span>
              <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"} className="text-xs">
                {getNetworkDisplayName(contract.network)}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-muted-foreground hover:underline inline-flex items-center gap-1"
              >
                {contract.contractAddress.slice(0, 8)}...{contract.contractAddress.slice(-6)}
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={copyAddress}
                className="p-0.5 hover:bg-muted rounded"
                title="Copy address"
              >
                {copiedAddress ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setShowInteractor(true)}
              >
                <Play className="h-3 w-3 mr-1" />
                Interact
              </Button>
              {contract.abi && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setShowAbi(!showAbi)}
                  title="View ABI"
                >
                  {showAbi ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              )}
            </div>
            {showAbi && contract.abi && (
              <div className="mt-1">
                <div className="flex justify-end mb-1">
                  <button onClick={copyAbi} className="p-0.5 hover:bg-muted rounded text-xs flex items-center gap-1" title="Copy ABI">
                    {copiedAbi ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    <span className="text-muted-foreground">Copy ABI</span>
                  </button>
                </div>
                <pre className="p-2 bg-muted rounded text-[10px] overflow-auto max-h-32 font-mono">
                  {JSON.stringify(contract.abi, null, 2)}
                </pre>
              </div>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {deleting ? "Removing..." : "Remove"}
              </Button>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Contract?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{contract.name}</strong> from your list?
                <br /><br />
                This only removes it from your dashboard. The contract remains deployed on the blockchain.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {showInteractor && (
          <ContractInteractor contract={contract} onClose={() => setShowInteractor(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{contract.name}</CardTitle>
            <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"}>
              {getNetworkDisplayName(contract.network)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Address: </span>
            <span className="inline-flex items-center gap-1">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs hover:underline inline-flex items-center gap-1"
              >
                {contract.contractAddress.slice(0, 10)}...{contract.contractAddress.slice(-8)}
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={copyAddress}
                className="p-0.5 hover:bg-muted rounded"
                title="Copy address"
              >
                {copiedAddress ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">TX: </span>
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs hover:underline inline-flex items-center gap-1"
            >
              {contract.transactionHash.slice(0, 10)}...{contract.transactionHash.slice(-8)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="text-xs text-muted-foreground">
            Deployed: {new Date(contract.deployedAt).toLocaleDateString()}
          </div>
          
          {contract.abi && (
            <div className="border-t pt-2 mt-2">
              <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
                <button
                  onClick={() => setShowAbi(!showAbi)}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <span>ABI</span>
                  {showAbi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showAbi && (
                  <button onClick={copyAbi} className="p-0.5 hover:bg-muted rounded" title="Copy ABI">
                    {copiedAbi ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 hover:text-foreground" />}
                  </button>
                )}
              </div>
              {showAbi && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48 font-mono">
                  {JSON.stringify(contract.abi, null, 2)}
                </pre>
              )}
            </div>
          )}
          
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowInteractor(true)}>
            <Play className="h-3 w-3 mr-2" />
            Interact
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              {deleting ? "Removing..." : "Remove from list"}
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{contract.name}</strong> from your list?
              <br /><br />
              This only removes it from your dashboard. The contract remains deployed on the blockchain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showInteractor && (
        <ContractInteractor contract={contract} onClose={() => setShowInteractor(false)} />
      )}
    </>
  );
}
