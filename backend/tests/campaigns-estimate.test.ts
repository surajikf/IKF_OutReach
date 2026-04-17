import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init })),
  },
}));

const countMock = vi.fn();
const groupByMock = vi.fn();

vi.mock("@/backend/lib/prisma", () => ({
  default: {
    client: {
      count: countMock,
      groupBy: groupByMock,
    },
  },
}));

describe("/api/campaigns/estimate GET", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    countMock.mockResolvedValue(42);
    groupByMock.mockResolvedValue([
      { industry: "IT", _count: 10 },
      { industry: "Finance", _count: 32 },
    ]);
  });

  it("computes audience estimate for broadcast campaigns", async () => {
    const { POST: estimate } = await import(
      "@/app/api/campaigns/estimate/route"
    );

    const url = "http://localhost/api/campaigns/estimate?type=broadcast";
    const res = await estimate(
      new Request(url, {
        method: "POST",
        body: JSON.stringify({ type: "broadcast" }),
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: {
        AND: [{ isBlocked: false }, { isRoleBased: false }],
      },
    });
    expect(groupByMock).toHaveBeenCalledWith({
      by: ["industry"],
      where: {
        AND: [{ isBlocked: false }, { isRoleBased: false }],
      },
      _count: { _all: true },
    });

    expect(res.body).toMatchObject({
      success: true,
      data: {
        count: 42,
        industries: ["IT", "Finance"],
      },
    });
  });
});

