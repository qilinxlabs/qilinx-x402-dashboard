import { Suspense } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { SigningModeProvider } from "@/lib/x402/signing-mode-context";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SigningModeProvider>
      <div className="flex h-[calc(100dvh-0px)] overflow-hidden">
        {/* Chat History Sidebar */}
        <Suspense fallback={<div className="w-80 border-r bg-muted/30" />}>
          <ChatSidebar />
        </Suspense>
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </SigningModeProvider>
  );
}
