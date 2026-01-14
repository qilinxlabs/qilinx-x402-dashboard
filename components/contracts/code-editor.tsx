"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon, RotateCcw } from "lucide-react";
import { solidity } from "@replit/codemirror-lang-solidity";
import { EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  originalCode?: string;
  language?: string;
  maxHeight?: string;
}

export function CodeEditor({ 
  code, 
  onChange, 
  originalCode,
  language = "solidity", 
  maxHeight = "400px" 
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = useCallback(() => {
    if (originalCode) {
      onChange(originalCode);
    }
  }, [originalCode, onChange]);

  const hasChanges = originalCode && code !== originalCode;

  // Initialize CodeMirror
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote)
          );
          if (transaction) {
            const newContent = update.state.doc.toString();
            onChange(newContent);
          }
        }
      });

      const extensions = [
        basicSetup,
        solidity, // Proper Solidity syntax highlighting
        oneDark,
        updateListener,
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "13px",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          },
          ".cm-content": {
            padding: "8px 0",
          },
          ".cm-gutters": {
            backgroundColor: "transparent",
            borderRight: "1px solid var(--border)",
          },
        }),
      ];

      const startState = EditorState.create({
        doc: code,
        extensions,
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update editor content when code prop changes externally
  useEffect(() => {
    if (editorRef.current) {
      const currentContent = editorRef.current.state.doc.toString();
      if (currentContent !== code) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: code,
          },
          annotations: [Transaction.remote.of(true)],
        });
        editorRef.current.dispatch(transaction);
      }
    }
  }, [code]);

  return (
    <div className="relative rounded-lg border bg-background flex flex-col overflow-hidden" style={{ height: maxHeight }}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{language}</span>
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400">• Modified</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {originalCode && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              disabled={!hasChanges}
              title="Reset to original"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Reset</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>
      <div 
        ref={containerRef} 
        className="flex-1 overflow-auto"
      />
    </div>
  );
}
