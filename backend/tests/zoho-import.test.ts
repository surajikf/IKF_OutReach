import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const getUserMock = vi.fn();
const syncZohoDealsMock = vi.fn();

vi.mock("@/backend/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/backend/domain/integrations", () => ({
  syncZohoDeals: syncZohoDealsMock,
}));

describe("/api/import/zoho POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { user_metadata: { role: "ADMIN" } } },
    });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  it("returns 400 when Zoho is not connected", async () => {
    syncZohoDealsMock.mockRejectedValueOnce(
      new Error("Zoho is not connected. Please configure and authorize Zoho first."),
    );

    const { POST: importZoho } = await import("@/app/api/import/zoho/route");

    const res = await importZoho(new Request("http://localhost", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Zoho is not connected. Please configure and authorize Zoho first.",
      },
    });
  });
});
