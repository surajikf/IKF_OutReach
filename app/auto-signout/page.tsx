"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function AutoSignOut() {
  useEffect(() => {
    void signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
      <p className="text-sm text-white/40">Signing out…</p>
    </div>
  );
}
