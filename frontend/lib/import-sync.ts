export type ImportSyncStatus = "idle" | "syncing" | "success" | "warning" | "error";

export interface SafeImportResult<T = any> {
    ok: boolean;
    status: number;
    data: T | null;
    message: string;
    code?: string;
    retried: boolean;
}

function isRetriableStatus(status: number) {
    return status === 408 || status === 429 || status >= 500;
}

export async function safeImportRequest<T = any>(
    url: string,
    init?: RequestInit,
    options?: { timeoutMs?: number; retryOnce?: boolean },
): Promise<SafeImportResult<T>> {
    const timeoutMs = options?.timeoutMs ?? 20000;
    const retryOnce = options?.retryOnce ?? true;

    const run = async (): Promise<Response> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    let retried = false;
    try {
        let response = await run();
        if (retryOnce && isRetriableStatus(response.status)) {
            retried = true;
            response = await run();
        }
        const json = await response.json().catch(() => ({}));
        const message =
            json?.error?.message ||
            json?.message ||
            (response.ok ? "Request completed." : "Request failed.");
        return {
            ok: response.ok && !!json?.success,
            status: response.status,
            data: (json?.data ?? null) as T | null,
            message,
            code: json?.error?.code,
            retried,
        };
    } catch (err: any) {
        const isAbort = err?.name === "AbortError";
        return {
            ok: false,
            status: isAbort ? 408 : 0,
            data: null,
            message: isAbort ? "Request timed out. Please try again." : "Network error. Please retry.",
            retried,
        };
    }
}
