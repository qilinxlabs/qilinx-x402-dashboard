import { auth } from "@/app/(auth)/auth";
import { LandingPage } from "@/components/landing-page";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth();
  
  // If user is logged in (not guest), redirect to dashboard
  if (session?.user && session.user.type === "regular") {
    redirect("/dashboard");
  }
  
  // Show landing page for guests and unauthenticated users
  return <LandingPage />;
}
