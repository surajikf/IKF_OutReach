import { describe, expect, it, vi } from "vitest";
import { safeImportRequest } from "@/frontend/lib/import-sync";

describe("safeImportRequest", () => {
    it("returns normalized success payload", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ success: true, data: { count: 2 }, message: "ok" }),
            } as Response),
        );

        const result = await safeImportRequest("/api/import/test");
        expect(result.ok).toBe(true);
        expect(result.status).toBe(200);
        expect(result.data).toEqual({ count: 2 });
    });

    it("retries once for retriable status", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 502,
                json: async () => ({ success: false, error: { message: "bad gateway" } }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, data: { count: 1 } }),
            } as Response);
        vi.stubGlobal("fetch", fetchMock);

        const result = await safeImportRequest("/api/import/test", undefined, { retryOnce: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.ok).toBe(true);
        expect(result.retried).toBe(true);
    });
});
