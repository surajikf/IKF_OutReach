import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession } from "@/services/auth";

export type OnboardingStep =
  | "connect_gmail"
  | "connect_bigin"
  | "connect_google_contacts"
  | "import_contacts"
  | "create_campaign";

export interface OnboardingState {
  dismissed: boolean;
  steps: Record<OnboardingStep, { completed: boolean; skipped: boolean }>;
  allDone: boolean;
}

const STEPS: OnboardingStep[] = [
  "connect_gmail",
  "connect_bigin",
  "connect_google_contacts",
  "import_contacts",
  "create_campaign",
];

export async function GET(req: Request) {
  try {
    const session = await getBackendSession(req);
    if (!session) return error("UNAUTHORIZED", "Not authenticated.", { status: 401 });

    const userId = session.user.id;

    const [user, gmailCount, zohoConn, clientCount, campaignCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingDismissed: true, onboardingSkippedSteps: true },
      }),
      prisma.gmailAccount.count({ where: { userId } }),
      prisma.zohoConnection.findUnique({ where: { userId } }),
      prisma.client.count({ where: { userId } }),
      prisma.campaignHistory.count({ where: { userId } }),
    ]);

    if (!user) return error("NOT_FOUND", "User not found.", { status: 404 });

    const skipped = new Set(user.onboardingSkippedSteps as OnboardingStep[]);

    // Derive completion from real data
    const realCompleted: Record<OnboardingStep, boolean> = {
      connect_gmail: gmailCount > 0,
      connect_bigin: zohoConn !== null,
      connect_google_contacts: false, // no separate DB record; only marked via skip or real sync
      import_contacts: clientCount > 0,
      create_campaign: campaignCount > 0,
    };

    const steps = STEPS.reduce(
      (acc, step) => {
        acc[step] = {
          completed: realCompleted[step],
          skipped: skipped.has(step),
        };
        return acc;
      },
      {} as Record<OnboardingStep, { completed: boolean; skipped: boolean }>,
    );

    const allDone = STEPS.every((s) => steps[s].completed || steps[s].skipped);

    const state: OnboardingState = {
      dismissed: user.onboardingDismissed,
      steps,
      allDone,
    };

    return ok(state);
  } catch (err: any) {
    console.error("Onboarding GET error:", err);
    return error("INTERNAL_ERROR", "Failed to fetch onboarding state.");
  }
}

export async function POST(req: Request) {
  try {
    const session = await getBackendSession(req);
    if (!session) return error("UNAUTHORIZED", "Not authenticated.", { status: 401 });

    const userId = session.user.id;
    const body = await req.json();
    const { action, step } = body as { action: "skip_step" | "dismiss"; step?: OnboardingStep };

    if (action === "dismiss") {
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingDismissed: true },
      });
      return ok({ dismissed: true });
    }

    if (action === "skip_step" && step && STEPS.includes(step)) {
      // Atomic push — safe under concurrent requests; dedup on read via Set
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingSkippedSteps: { push: step } },
      });
      return ok({ skipped: step });
    }

    return error("BAD_REQUEST", "Invalid action or missing step.");
  } catch (err: any) {
    console.error("Onboarding POST error:", err);
    return error("INTERNAL_ERROR", "Failed to update onboarding state.");
  }
}
