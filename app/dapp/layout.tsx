import { Suspense } from "react";

export default function DappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      {children}
    </Suspense>
  );
}
