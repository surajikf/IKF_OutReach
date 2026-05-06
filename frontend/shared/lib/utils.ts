import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type GreetingOptions = {
    email?: string | null;
    signature?: string | null;
    isRoleBased?: boolean;
};

const GENERIC_LOCAL_PARTS = new Set([
    "admin",
    "info",
    "support",
    "sales",
    "contact",
    "help",
    "hello",
    "team",
    "office",
    "accounts",
    "billing",
    "hr",
    "careers",
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "mailer",
    "mail",
]);

function toTitleCaseToken(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getFirstNameFromEmailLocalPart(email?: string | null) {
    if (!email || !email.includes("@")) return "";
    const localPart = email.split("@")[0]?.trim().toLowerCase();
    if (!localPart) return "";
    if (GENERIC_LOCAL_PARTS.has(localPart)) return "";
    const tokens = localPart
        .split(/[._\-+0-9]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    const candidate = tokens[0] || "";
    if (!candidate || GENERIC_LOCAL_PARTS.has(candidate) || candidate.length < 2) return "";
    return toTitleCaseToken(candidate);
}

function getFirstNameFromSignature(signature?: string | null) {
    if (!signature || !signature.trim()) return "";
    const cleanSignature = signature
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!cleanSignature) return "";
    return getFirstName(cleanSignature);
}

export function getSmartGreeting(contactPerson?: string | null, options?: GreetingOptions) {
    const contactFirstName = getFirstName(contactPerson);
    if (contactFirstName) {
        return `Dear ${contactFirstName}`;
    }
    const emailFirstName = options?.isRoleBased ? "" : getFirstNameFromEmailLocalPart(options?.email);
    if (emailFirstName) {
        return `Dear ${emailFirstName}`;
    }
    const signatureFirstName = getFirstNameFromSignature(options?.signature);
    if (signatureFirstName) {
        return `Dear ${signatureFirstName}`;
    }
    return "Dear Sir/Ma'am";
}

export function getFirstName(contactPerson?: string | null) {
    if (!contactPerson || !contactPerson.trim()) return "";
    const nameParts = contactPerson.trim().split(/\s+/);
    let firstName = nameParts[0];
    
    const titles = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."];
    if (titles.includes(firstName) && nameParts.length > 1) {
        firstName = nameParts[1];
    }
    return firstName;
}

export function getLastName(contactPerson?: string | null) {
    if (!contactPerson || !contactPerson.trim()) return "";
    const nameParts = contactPerson.trim().split(/\s+/);
    if (nameParts.length <= 1) return "";
    return nameParts[nameParts.length - 1];
}

export function replaceVariables(content: string, client: any) {
    if (!content) return "";
    if (!client) return content; // Safe fallback if no client data is provided

    const now = new Date();
    let onboardDate: Date | null = null;
    try {
        if (client.clientAddedOn) {
            onboardDate = new Date(client.clientAddedOn);
            if (isNaN(onboardDate.getTime())) onboardDate = null;
        }
    } catch {
        onboardDate = null;
    }

    // Smart Company Name Derivation
    let derivedCompany = client.clientName || "";
    if (!derivedCompany && client.email && client.email.includes("@")) {
        const domain = client.email.split("@")[1].split(".")[0];
        // Only use domain if it's not a public provider
        const publicProviders = ["gmail", "outlook", "hotmail", "yahoo", "icloud", "me"];
        if (!publicProviders.includes(domain.toLowerCase())) {
            derivedCompany = domain.charAt(0).toUpperCase() + domain.slice(1);
        }
    }
    
    // Final default fallback
    derivedCompany = derivedCompany || "your organization";

    const fullName = client.contactPerson || client.poc || "";
    const derivedFirstName =
        getFirstName(fullName) ||
        getFirstNameFromEmailLocalPart(client.email) ||
        getFirstNameFromSignature(client.emailSignature || client.signature || client.signatureName) ||
        "there";
    
    // Core variable map with prioritized fallbacks
    const variables: Record<string, string> = {
        greeting: getSmartGreeting(fullName, {
            email: client.email,
            signature: client.emailSignature || client.signature || client.signatureName,
        }),
        firstName: derivedFirstName,
        lastName: getLastName(fullName) || "",
        fullName: fullName || "Valued Partner",
        companyName: derivedCompany,
        industry: client.industry || "your industry",
        services: client.invoiceServiceNames || "your current offering",
        location: client.address || "your team",
        relationship: client.relationshipLevel || "our partnership",
        tenureYears: onboardDate ? (now.getFullYear() - onboardDate.getFullYear()).toString() : "0",
        onboardDate: onboardDate ? onboardDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "the start of our journey",
        currentDate: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    };

    let processed = content;

    // 1. Replace defined variables (case-insensitive)
    Object.entries(variables).forEach(([key, val]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        processed = processed.replace(regex, val);
    });

    // 2. Specialized cleaning: Remove common left-over placeholders if not matched
    // This prevents sending emails with "{{Variable}}" still in them.
    processed = processed.replace(/\{\{[^}]+\}\}/g, (match) => {
        const inner = match.slice(2, -2).toLowerCase();
        if (inner.includes("company")) return variables.companyName;
        if (inner.includes("name") || inner.includes("person")) return variables.fullName;
        if (inner.includes("date")) return variables.currentDate;
        if (inner.includes("firstName")) return variables.firstName;
        return ""; // Fallback to empty if unknown
    });

    return processed;
}
