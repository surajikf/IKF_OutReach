import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IKF Outreach API | Status Node",
  description: "Backend service monitoring and synchronization console.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body 
        className={inter.className} 
        style={{ margin: 0, padding: 0, background: "#020617", color: "white", fontFamily: "sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
