type QualityInput = {
    subject: string;
    bodyHtml: string;
    greeting: string;
    cta: string;
    companyName: string;
    industry?: string | null;
    services?: string | null;
};

export type QualityReport = {
    score: number;
    personalization: number;
    clarity: number;
    tone: number;
    ctaStrength: number;
    spamRisk: number;
    fixes: string[];
};

const SPAM_TRIGGERS = [
    "guaranteed",
    "act now",
    "limited time",
    "risk-free",
    "free!!!",
    "winner",
    "urgent",
    "buy now",
];

function stripHtml(input: string) {
    return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function evaluateEmailQuality(input: QualityInput): QualityReport {
    const bodyText = stripHtml(input.bodyHtml || "");
    const lower = bodyText.toLowerCase();
    const subject = (input.subject || "").trim();
    const fixes: string[] = [];

    let personalization = 45;
    if (lower.includes((input.companyName || "").toLowerCase())) personalization += 25;
    if (input.industry && lower.includes(String(input.industry).toLowerCase())) personalization += 15;
    if (input.services && lower.includes(String(input.services).split(",")[0].trim().toLowerCase())) personalization += 10;
    personalization = Math.min(100, personalization);
    if (personalization < 70) fixes.push("Add more client-specific context (company, industry, or service relevance).");

    const words = bodyText ? bodyText.split(/\s+/).length : 0;
    let clarity = 80;
    if (words < 70) clarity -= 10;
    if (words > 260) clarity -= 20;
    if ((bodyText.match(/\./g) || []).length < 3) clarity -= 10;
    if (/<li>/i.test(input.bodyHtml) && !/<ul>|<ol>/i.test(input.bodyHtml)) clarity -= 5;
    clarity = Math.max(0, Math.min(100, clarity));
    if (clarity < 70) fixes.push("Improve readability with shorter paragraphs and clearer sentence flow.");

    let tone = 85;
    const exclamations = (bodyText.match(/!/g) || []).length;
    if (exclamations > 2) tone -= 20;
    if (/awesome|amazing|revolutionary|unbelievable/i.test(bodyText)) tone -= 10;
    tone = Math.max(0, Math.min(100, tone));
    if (tone < 70) fixes.push("Use a more professional and less promotional tone.");

    let ctaStrength = 40;
    if (input.cta && lower.includes(input.cta.toLowerCase().trim())) ctaStrength += 45;
    if (/let us|let's|schedule|discuss|connect|reply|share/i.test(lower)) ctaStrength += 20;
    ctaStrength = Math.min(100, ctaStrength);
    if (ctaStrength < 70) fixes.push("Add one clear, actionable CTA near the closing.");

    let spamRisk = 8;
    for (const trigger of SPAM_TRIGGERS) {
        if (lower.includes(trigger)) spamRisk += 12;
    }
    if (subject.toUpperCase() === subject && subject.length > 8) spamRisk += 10;
    spamRisk = Math.max(0, Math.min(100, spamRisk));

    if (!lower.startsWith(input.greeting.toLowerCase().split(" ")[0])) {
        fixes.push("Start with a proper salutation for stronger personalization.");
    }

    const score = Math.round(
        personalization * 0.35 +
        clarity * 0.25 +
        tone * 0.2 +
        ctaStrength * 0.2 -
        spamRisk * 0.15
    );

    return {
        score: Math.max(0, Math.min(100, score)),
        personalization,
        clarity,
        tone,
        ctaStrength,
        spamRisk,
        fixes,
    };
}

