import type { Metadata } from "next";
import "./globals.css";
import { ClientWrapper } from "@/components/ClientWrapper";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "IKF Outreach | AI Client Communication Engine",
  description: "Intelligent CRM and automated campaign generation for modern business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-primary/30">
        <Toaster position="top-right" richColors closeButton />
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
