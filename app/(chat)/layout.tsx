import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WalletProvider } from "@/lib/contracts/wallet-context";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <WalletProvider>
          <Suspense fallback={<div className="flex h-dvh" />}>
            <LayoutWrapper>{children}</LayoutWrapper>
          </Suspense>
        </WalletProvider>
      </DataStreamProvider>
    </>
  );
}

async function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  // Default to open (true) unless explicitly set to "false"
  const isOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // If user is not logged in or is a guest, render without sidebar
  if (!session?.user || session.user.type !== "regular") {
    return <>{children}</>;
  }

  // Logged in regular users get the sidebar
  return (
    <SidebarProvider defaultOpen={isOpen}>
      <AppSidebar user={session?.user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
