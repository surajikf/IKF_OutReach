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

// Editor formatting preferences — persisted independently of the campaign session
// so they survive across refine → results navigation.
export type EditorPrefs = {
    fontFamily: string;
    fontSize: string;
};

const EDITOR_PREFS_KEY = "ikf.editorPrefs.v1";

export function readEditorPrefs(): EditorPrefs {
    if (typeof window === "undefined") return { fontFamily: "Calibri, sans-serif", fontSize: "14px" };
    try {
        const raw = window.localStorage.getItem(EDITOR_PREFS_KEY);
        if (!raw) return { fontFamily: "Calibri, sans-serif", fontSize: "14px" };
        const parsed = JSON.parse(raw) as EditorPrefs;
        // Backfill: if stored prefs have no fontFamily, use Calibri
        return { fontFamily: parsed.fontFamily || "Calibri, sans-serif", fontSize: parsed.fontSize || "14px" };
    } catch {
        return { fontFamily: "Calibri, sans-serif", fontSize: "14px" };
    }
}

export function writeEditorPrefs(prefs: Partial<EditorPrefs>) {
    if (typeof window === "undefined") return;
    const current = readEditorPrefs();
    window.localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

