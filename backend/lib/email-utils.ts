/**
 * Utility to identify role-based or generic business emails
 * that should be isolated from standard client lists.
 */

const ROLE_BASED_PREFIXES = [
    // General / Communication
    "info", "contact", "support", "help", "enquiry", "inquiries", "hello", "connect",
    // System / Automated
    "noreply", "donotreply", "no-reply", "notification", "notifications", "alerts", "updates", "system", "auto", "automated", "update",
    // HR / Careers
    "career", "careers", "jobs", "hr", "recruitment", "hiring", "talent",
    // Sales / Business
    "sales", "business", "partnerships", "partner", "marketing", "promotions",
    // Technical / IT / Server
    "admin", "administrator", "root", "hostmaster", "webmaster", "postmaster", "server", "tech", "it", "security", "abuse",
    // Billing / Accounts / Operational
    "accounts", "billing", "payments", "invoice", "finance", "amc", "office", "team",
    // Customer Service / Reception
    "service", "customerservice", "care", "customercare", "feedback", "reception", "frontdesk",
    // Internal / Testing / Junk
    "test", "testing", "demo", "dev", "developer", "qa", "staging", "sandbox", "junk", "temp", "temporary", "trash", "disposable"
];

// Patterns for systemic or auto-generated emails (e.g., user-123@, info.office@)
const SYSTEMIC_PATTERNS = [
    /^noreply-/,
    /^no-reply-/,
    /^notifications-/,
    /^alert-/,
    /^update-/,
    /^[a-f0-9]{8,}$/, // Hexadecimal hashes usually used for internal tracking
];

/**
 * Checks if an email address is role-based (generic).
 */
export function isRoleBasedEmail(email: string): boolean {
    if (!email || !email.includes('@')) return false;

    try {
        const parts = email.toLowerCase().trim().split('@');
        const localPart = parts[0];

        // 1. Check exact prefix matches
        if (ROLE_BASED_PREFIXES.includes(localPart)) return true;

        // 2. Check for dotted/hyphenated variations (e.g., info.support@)
        // If any part of a multi-segment local part is a role-based prefix, flag it
        const segments = localPart.split(/[.\-_]/);
        if (segments.some(seg => ROLE_BASED_PREFIXES.includes(seg))) return true;

        // 3. Check for systemic patterns
        if (SYSTEMIC_PATTERNS.some(pattern => pattern.test(localPart))) return true;

        return false;
    } catch (e) {
        return false;
    }
}
