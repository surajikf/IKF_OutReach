"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * IDENTITY SYNC COMPONENT
 * Silent side-effect component that bridges NextAuth sessions to the Backend Dispatcher.
 */
export function IdentitySync() {
    const { data: session, status } = useSession();
    const [lastSyncEmail, setLastSyncEmail] = useState<string | null>(null);

    useEffect(() => {
        // Only sync if authenticated and we have tokens in the session
        if (status === "authenticated" && session?.user && (session.user as any).refreshToken) {
            const userEmail = (session.user as any).email;
            
            // Avoid redundant syncs within the same session
            const syncIdentity = async () => {
                console.log(`[IDENTITY_SYNC] Attempting synchronization via internal proxy...`);
                
                try {
                    const response = await fetch(`/api/sync-session`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            email: userEmail,
                            refreshToken: (session.user as any).refreshToken,
                            accessToken: (session.user as any).accessToken,
                            scope: (session.user as any).scope,
                        }),
                    });

                    if (!response.ok) {
                        const rawBody = await response.text().catch(() => "");
                        let errorData: any = {};
                        try {
                            errorData = rawBody ? JSON.parse(rawBody) : {};
                        } catch {
                            errorData = { rawBody };
                        }
                        console.error("[IDENTITY_SYNC] Server Error:", response.status, errorData);
                        return;
                    }

                    const payload = await response.json().catch(() => null);
                    const data = payload?.data ?? null;

                    if (payload?.success && data) {
                        setLastSyncEmail(userEmail);
                        console.log("[IDENTITY_SYNC] Identity link secured:", data.accountId);
                        
                        if (data.actionRequired === "RE_LOGIN_GMAIL_SEND") {
                            toast.warning("Transmission Permissions Missing", {
                                description: "Login successful, but 'Send Email' scope was not granted. Please re-login and check the permission box to enable outreach.",
                                duration: 10000,
                            });
                        }
                    } else if (payload?.success === false) {
                        console.error("[IDENTITY_SYNC] Sync rejected:", payload.error);
                    }
                } catch (err: any) {
                    console.error("[IDENTITY_SYNC] Network/Fetch Error:", err);
                    // Detailed feedback for the user
                    if (err.message === "Failed to fetch") {
                        console.warn("[IDENTITY_SYNC] Hint: Ensure your backend server is running on port 3001 and CORS is configured.");
                    }
                }
            };

            syncIdentity();
        }
    }, [status, session, lastSyncEmail]);

    return null; // Silent component
}
