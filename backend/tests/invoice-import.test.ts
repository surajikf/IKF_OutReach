import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init })),
  },
  after: vi.fn(),
}));

const upsertMock = vi.fn();

vi.mock("@/backend/lib/settings", () => ({
  getGlobalSettings: vi.fn().mockResolvedValue({
    invoiceApiUrl: "http://test-api.com",
    invoiceApiKey: "test-key",
  }),
  DEFAULT_INVOICE_API_URL: "http://test-api.com",
}));

vi.mock("@/backend/lib/prisma", () => ({
  default: {
    client: {
      upsert: upsertMock,
    },
    globalSettings: {
        findUnique: vi.fn().mockResolvedValue({ id: "singleton", invoiceApiKeyEncrypted: "enc" }),
    }
  },
}));

vi.mock("@/backend/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { user_metadata: { role: "ADMIN" } } },
        error: null,
      }),
    },
  }),
}));

vi.mock("fast-xml-parser", () => {
  return {
    XMLParser: class {
      parse(xml: string) {
        return {
          ApiResponse: {
            data: {
              ActiveClientDto: {
                customerid: "123",
                Client_Email: "client@example.com",
                ClientName: "Invoice Client",
                ServiceNames: "Service A,Service B",
              },
            },
          },
        };
      }
    },
  };
});

describe("/api/import/invoice POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<xml>stub</xml>",
    });
  });

  it("imports clients from XML and upserts into Prisma", async () => {
    const { POST: importInvoice } = await import(
      "@/app/api/import/invoice/route"
    );

    const res = await importInvoice(
      new Request("http://localhost?mode=full", { method: "POST" }),
    );

    expect((global as any).fetch).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      where: {
        source_externalId: {
          source: "INVOICE_SYSTEM",
          externalId: "123",
        },
      },
      create: {
        clientName: "Invoice Client",
        email: "client@example.com",
        source: "INVOICE_SYSTEM",
        externalId: "123",
        industry: "Corporate",
      },
    });

    expect(res.body).toMatchObject({
      success: true,
      data: {
        count: 1,
      },
    });
  });
});

