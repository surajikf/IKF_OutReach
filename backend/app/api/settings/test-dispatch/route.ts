import { getGlobalSettings } from "@/backend/lib/settings";
import { getBackendSession } from "@/backend/lib/auth";
import { ok, error } from "@/backend/lib/api-response";
import { sendStrategicEmail } from "@/backend/lib/mail";
import prisma from "@/backend/lib/prisma";

/**
 * DIAGNOSTIC DISPATCH PROTOCOL
 * Sends a verified test email using a specific or system-default node.
 */
export async function POST(request: Request) {
    try {
        const session = await getBackendSession(request);
        if (!session) return error("UNAUTHORIZED", "Active session required.", { status: 401 });

        const body = await request.json();
        const { nodeType, accountId } = body;

        const sessionEmail = session.user?.email || "unknown";
        console.log(`[TEST_DISPATCH] Initiating diagnostic for Node: ${nodeType} | Triggered by: ${sessionEmail}`);

        // Custom Logic: If a specific accountId is provided, we temporarily force it as default for the test
        if (nodeType === "GMAIL" && accountId) {
             // We don't want to permanently change the default, but we want THIS test to use THIS account
             // However, sendStrategicEmail uses the DB 'isDefault'.
             // Simplest way for a test: temporarily set this one as default, then revert? 
             // Or better: refactor mail.ts to accept an optional 'overrideIdentityId'.
             // For now, we'll verify the System Default or the requested provider.
        }

        const testOptions = {
            to: sessionEmail,
            subject: `[SYSTEM] Neural Connection Verified - ${new Date().toLocaleTimeString()}`,
            html: `
                <div style="font-family: sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 24px;">
                        <span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 99px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em;">
                            Transmission Verified
                        </span>
                    </div>
                    <h1 style="color: #0f172a; margin-top: 0; font-weight: 800; letter-spacing: -0.025em;">Neural Link Established</h1>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                        The communication bridge for <strong>${nodeType}</strong> has been successfully validated. 
                        Your outreach engine is now synchronized and ready for strategic deployment.
                    </p>
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                        Dispatch Protocol: ${nodeType} <br/>
                        Timestamp: ${new Date().toISOString()} <br/>
                        Authorized by: ${sessionEmail}
                    </div>
                </div>
            `
        };

        const forcedProvider = nodeType === "SMTP" ? "SMTP" : "GMAIL";
        const result: any = await sendStrategicEmail(testOptions, {
            forceProvider: forcedProvider,
            disableFailover: true,
            overrideGmailAccountId: forcedProvider === "GMAIL" ? accountId : undefined,
        });

        if (result.success) {
            return ok({ 
                message: "Diagnostic dispatch successful.", 
                messageId: result.messageId,
                failoverUsed: result.failoverOccurred || false
            });
        } else {
            return error("DISPATCH_FAILURE", `Node verification failed: ${result.error}`, { status: 500 });
        }

    } catch (err: any) {
        console.error("Diagnostic Dispatch Failure:", err);
        return error("INTERNAL_ERROR", "Internal system failure during diagnostic test.");
    }
}
