export type CampaignSessionData = {
    version: 1;
    updatedAt: string;
    audienceSources?: string[];
    selectedType?: string | null;
    topic?: string;
    coreMessage?: string;
    cta?: string;
    selectedServices?: string[];
    serviceLogic?: "AND" | "OR";
    excludedClientIds?: string[];
    activeJobId?: string | null;
};

const STORAGE_KEY = "ikf.activeCampaignSession.v1";

export function readCampaignSession(): CampaignSessionData | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CampaignSessionData;
        if (!parsed || parsed.version !== 1) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function writeCampaignSession(partial: Partial<CampaignSessionData>) {
    if (typeof window === "undefined") return;
    const current = readCampaignSession() || { version: 1, updatedAt: new Date().toISOString() };
    const next: CampaignSessionData = {
        ...current,
        ...partial,
        version: 1,
        updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearCampaignSession() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
}

