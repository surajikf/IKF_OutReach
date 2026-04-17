import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getSmartGreeting(contactPerson?: string | null) {
    if (!contactPerson || !contactPerson.trim()) {
        return "Dear Sir/Ma'am";
    }
    const firstName = getFirstName(contactPerson);
    if (!firstName) return "Dear Sir/Ma'am";
    return `Dear ${firstName}`;
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
    const firstName = getFirstName(fullName) || "there";
    
    // Core variable map with prioritized fallbacks
    const variables: Record<string, string> = {
        greeting: getSmartGreeting(fullName),
        firstName: firstName,
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
