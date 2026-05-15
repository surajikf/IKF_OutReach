/**
 * Maps technical errors and API responses to plain-English messages
 * that any user can understand — no jargon, no stack traces.
 *
 * Every entry has:
 *   title   – short headline shown in the toast
 *   message – one sentence explaining what happened and what to do
 *   wait    – optional "try again in X" hint
 */

export interface FriendlyError {
  title: string;
  message: string;
  wait?: string;
}

// ─── Internal keyword → friendly error map ───────────────────────────────────

const PATTERNS: Array<{ test: RegExp | string[]; friendly: FriendlyError }> = [
  // DB / connection pool exhausted
  {
    test: ["EMAXCONNSESSION", "max clients reached", "pool_size", "connection pool", "too many connections"],
    friendly: {
      title: "System is busy",
      message: "Our servers are handling too many requests right now. Please wait 2–3 minutes and try again.",
      wait: "2–3 min",
    },
  },
  // Supabase / DB timeout
  {
    test: ["pool_timeout", "ETIMEDOUT", "connection timeout", "query timeout", "statement timeout"],
    friendly: {
      title: "Request timed out",
      message: "The server took too long to respond. Please wait a moment and try again.",
      wait: "1 min",
    },
  },
  // AI provider rate-limit / timeout
  {
    test: ["AI timeout", "rate_limit", "rate limit", "429", "model_overloaded", "overloaded"],
    friendly: {
      title: "AI is busy",
      message: "Our AI provider is handling a lot of requests right now. Please wait 1–2 minutes and try again.",
      wait: "1–2 min",
    },
  },
  // Network / fetch failure
  {
    test: ["Failed to fetch", "ECONNREFUSED", "ENOTFOUND", "NetworkError", "net::ERR"],
    friendly: {
      title: "Connection problem",
      message: "We couldn't reach the server. Check your internet connection and try again.",
    },
  },
  // Auth / session expired
  {
    test: ["UNAUTHORIZED", "401", "session expired", "invalid token", "jwt expired"],
    friendly: {
      title: "Session expired",
      message: "Your session has expired. Please refresh the page and sign in again.",
    },
  },
  // Forbidden / no access
  {
    test: ["FORBIDDEN", "403", "not allowed", "access denied"],
    friendly: {
      title: "Access not allowed",
      message: "You don't have permission to do this. Contact your admin if you think this is a mistake.",
    },
  },
  // No matching contacts for campaign
  {
    test: ["No matching clients", "no clients found", "audience is empty"],
    friendly: {
      title: "No matching contacts",
      message: "We couldn't find any contacts that match your selected filters. Try adjusting your audience or service filters.",
    },
  },
  // Campaign save / generate failure
  {
    test: ["Batch generation failed", "generation failed", "campaign generation"],
    friendly: {
      title: "Email generation failed",
      message: "Something went wrong while creating your emails. Please try again in a moment.",
      wait: "30 sec",
    },
  },
  // Dispatch / send failure
  {
    test: ["dispatch", "Dispatch batch failed", "Failed to enqueue"],
    friendly: {
      title: "Sending failed",
      message: "We couldn't send your emails right now. Please try again in a few seconds.",
      wait: "30 sec",
    },
  },
  // Gmail OAuth token expired / revoked
  {
    test: ["invalid_grant", "Token has been expired", "Token has been revoked", "token has been", "Gmail OAuth failed", "BadCredentials", "535-5.7.8", "535 5.7.8"],
    friendly: {
      title: "Gmail reconnection needed",
      message: "Your Gmail connection has expired. Please go to Settings → Import → Gmail and click 'Reconnect' next to your account to restore email sending.",
    },
  },
  // Gmail / OAuth scope
  {
    test: ["insufficient authentication scopes", "gmail.send", "scope"],
    friendly: {
      title: "Gmail permission missing",
      message: "We need permission to send emails via Gmail. Please go to Settings → Import → Gmail and reconnect your account.",
    },
  },
  // Sync failures (Gmail / Zoho / Google Contacts)
  {
    test: ["Failed to sync", "sync failed", "import failed"],
    friendly: {
      title: "Sync failed",
      message: "We couldn't import your contacts this time. Please try again in a minute.",
      wait: "1 min",
    },
  },
  // Generic DB / prisma error
  {
    test: ["P1001", "P1008", "P1017", "P2002", "P2025", "prisma", "database"],
    friendly: {
      title: "Database error",
      message: "We hit a temporary database issue. Please wait a moment and try again.",
      wait: "1 min",
    },
  },
];

/**
 * Given any raw error string (message, code, API response text),
 * returns a user-friendly title + message.
 * Falls back to a generic "something went wrong" if nothing matches.
 */
export function getFriendlyError(raw: unknown, fallback?: Partial<FriendlyError>): FriendlyError {
  const text = extractText(raw).toLowerCase();

  for (const { test, friendly } of PATTERNS) {
    const keywords = Array.isArray(test) ? test : [test.source];
    if (keywords.some((k) => text.includes(k.toLowerCase()))) {
      return friendly;
    }
  }

  return {
    title: fallback?.title ?? "Something went wrong",
    message:
      fallback?.message ??
      "An unexpected error occurred. Please try again. If the problem continues, wait a couple of minutes before retrying.",
    wait: fallback?.wait,
  };
}

/**
 * Returns just the plain message string (title: message) for use in
 * simple toast.error() calls that only accept a string.
 */
export function friendlyMsg(raw: unknown, fallback?: string): string {
  const { title, message, wait } = getFriendlyError(raw, { message: fallback });
  return wait ? `${title} — ${message} (Try again in ${wait})` : `${title} — ${message}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractText(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "object") {
    const r = raw as any;
    return [r.message, r.error?.message, r.code, r.details, r.error]
      .filter(Boolean)
      .map(String)
      .join(" ");
  }
  return String(raw);
}
