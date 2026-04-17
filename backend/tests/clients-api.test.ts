import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
const isRoleBasedEmailMock = vi.fn();

vi.mock("@/backend/lib/email-utils", () => ({
  isRoleBasedEmail: isRoleBasedEmailMock,
}));

vi.mock("@/backend/lib/prisma", () => ({
  default: {
    client: {
      create: createMock,
    },
  },
}));

describe("/api/clients POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRoleBasedEmailMock.mockReturnValue(true);
  });

  it("creates a client and computes isRoleBased from email", async () => {
    createMock.mockResolvedValueOnce({ id: "1", clientName: "Acme Corp" });

    const { POST: createClient } = await import("@/app/api/clients/route");

    const request = new Request("http://localhost/api/clients", {
      method: "POST",
      body: JSON.stringify({
        clientName: "Acme Corp",
        contactPerson: "John Doe",
        email: "info@acme.com",
        industry: "IT",
        relationshipLevel: "Active",
        serviceIds: ["service-1"],
      }),
    });

    const res = await createClient(request);
    const body = await res.json();

    expect(createMock).toHaveBeenCalledWith({
      data: {
        clientName: "Acme Corp",
        contactPerson: "John Doe",
        email: "info@acme.com",
        industry: "IT",
        relationshipLevel: "Active",
        isRoleBased: true,
        services: {
          connect: [{ id: "service-1" }],
        },
      },
    });

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: { id: "1", clientName: "Acme Corp" },
    });
  });

  it("returns 400 when Prisma unique constraint error occurs", async () => {
    createMock.mockRejectedValueOnce({ code: "P2002" });

    const { POST: createClient } = await import("@/app/api/clients/route");

    const request = new Request("http://localhost/api/clients", {
      method: "POST",
      body: JSON.stringify({
        clientName: "Duplicate Corp",
        contactPerson: "Jane Doe",
        email: "duplicate@corp.com",
        industry: "IT",
        relationshipLevel: "Active",
        serviceIds: [],
      }),
    });

    const res = await createClient(request);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "CONFLICT",
        message: "A client with this email already exists.",
      },
    });
  });
});
