"use client";

import { useState, useCallback } from "react";
import type { EthereumNetwork } from "@/lib/db/schema";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UseContractChatOptions {
  templateId: string;
  network: EthereumNetwork;
}

export function useContractChat({ templateId, network }: UseContractChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customizedCode, setCustomizedCode] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/contracts/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          network,
          messages: newMessages,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Parse SSE data
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("0:")) {
            // Text content
            const text = JSON.parse(line.slice(2));
            assistantContent += text;
          }
        }
      }

      setMessages([...newMessages, { role: "assistant", content: assistantContent }]);

      // Extract code block if present
      const codeMatch = assistantContent.match(/```solidity\n([\s\S]*?)```/);
      if (codeMatch) {
        setCustomizedCode(codeMatch[1]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, templateId, network]);

  const reset = useCallback(() => {
    setMessages([]);
    setCustomizedCode(null);
  }, []);

  return {
    messages,
    isLoading,
    customizedCode,
    sendMessage,
    reset,
  };
}
