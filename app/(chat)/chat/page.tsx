import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon, MessageSquareIcon } from "@/components/icons";

export default async function ChatListPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center space-y-4">
        <div className="flex justify-center text-muted-foreground">
          <MessageSquareIcon size={48} />
        </div>
        <h2 className="text-xl font-semibold">Select a chat or start a new one</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Choose a conversation from the sidebar or create a new chat to get started with your AI assistant.
        </p>
        <Button asChild>
          <Link href="/chat/new">
            <PlusIcon />
            New Chat
          </Link>
        </Button>
      </div>
    </div>
  );
}
