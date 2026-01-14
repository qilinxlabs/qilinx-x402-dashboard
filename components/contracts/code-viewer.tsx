"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";

interface CodeViewerProps {
  code: string;
  language?: string;
  maxHeight?: string;
}

export function CodeViewer({ code, language = "solidity", maxHeight = "400px" }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg border bg-muted">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <span className="text-sm text-muted-foreground">{language}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre
        className="p-4 overflow-auto text-sm"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
