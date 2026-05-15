/**
 * Identifies emails that are provably automated/system addresses — i.e., addresses
 * that CANNOT belong to a real person and will never read a campaign email.
 *
 * Deliberately conservative: short abbreviations (amc, hr, admin, sales, it, finance,
 * info, office, team…) are NOT flagged because they are frequently a real person's
 * work address at a small business, especially in B2B contexts.
 *
 * Only block addresses where it is technically impossible for a human to be the
 * intended recipient: no-reply, bounce handlers, system daemons, spam traps.
 */

// Exact local-part matches that are provably non-human inboxes.
const SYSTEM_EXACT = new Set([
    "noreply", "no-reply", "no_reply",
    "donotreply", "do-not-reply", "do_not_reply",
    "mailer-daemon", "mailer_daemon",
    "postmaster",
    "bounce", "bounces",
    "abuse",
    "spam",
    "unsubscribe",
    "blackhole", "devnull", "null",
]);

// Prefix patterns for auto-generated addresses (e.g. noreply-xyz@, bounce+token@).
const SYSTEM_PATTERNS = [
    /^noreply[-+_.]/,
    /^no-reply[-+_.]/,
    /^no_reply[-+_.]/,
    /^donotreply[-+_.]/,
    /^bounce[-+_.]/,
    /^mailer-daemon/,
    /^postmaster[-+_.]/,
    /^notifications?[-+_.]/,    // notifications-xyz@, notification+id@
    /^alerts?[-+_.]/,           // alerts-xyz@
    /^[a-f0-9]{12,}$/,          // Long hex strings — internal tracking addresses
];

/**
 * Returns true only for provably automated / system email addresses.
 * Ambiguous prefixes (info, admin, sales, hr, amc, finance, office…) are treated
 * as potentially human and are NOT blocked — they are common real-person inboxes
 * in small and mid-size businesses.
 */
export function isRoleBasedEmail(email: string): boolean {
    if (!email || !email.includes("@")) return false;

    try {
        const localPart = email.toLowerCase().trim().split("@")[0];

        if (SYSTEM_EXACT.has(localPart)) return true;
        if (SYSTEM_PATTERNS.some((p) => p.test(localPart))) return true;

        return false;
    } catch {
        return false;
    }
}
