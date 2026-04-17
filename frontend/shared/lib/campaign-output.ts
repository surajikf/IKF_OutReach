export interface ParsedCampaignOutput {
    subject: string;
    body: string;
    raw: Record<string, unknown>;
}

export function parseCampaignGeneratedOutput(input: string): ParsedCampaignOutput {
    let parsed: unknown;
    try {
        parsed = JSON.parse(input);
    } catch {
        throw new Error("Campaign payload is not valid JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
        throw new Error("Campaign payload must be a JSON object.");
    }

    const raw = parsed as Record<string, unknown>;
    const subject = typeof raw.subject === "string" ? raw.subject.trim() : "";
    const body = typeof raw.body === "string" ? raw.body.trim() : "";

    if (!subject) {
        throw new Error("Campaign payload is missing a valid subject.");
    }
    if (!body) {
        throw new Error("Campaign payload is missing a valid body.");
    }

    return {
        subject,
        body,
        raw,
    };
}
