/**
 * Single allowed operator for this deployment (Supabase Auth + app admin).
 * All other auth users can be removed; registration is closed for other emails.
 */
export const PRIMARY_ADMIN_EMAIL = "suraj.sonnar@ikf.co.in";

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
    return (email || "").trim().toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
}
