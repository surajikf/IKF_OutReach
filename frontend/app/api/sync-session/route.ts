import { NextRequest, NextResponse } from "next/server";

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL?.trim().replace(/\/+$/, "") || "http://localhost:3001";

function buildBackendUrl() {
  return `${backendInternalUrl}/api/auth/sync-session`;
}

function buildForwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  const contentType = req.headers.get("content-type");
  const origin = req.headers.get("origin");

  if (cookie) headers.set("cookie", cookie);
  if (contentType) headers.set("content-type", contentType);
  if (origin) headers.set("origin", origin);

  return headers;
}

export async function OPTIONS(req: NextRequest) {
  try {
    const response = await fetch(buildBackendUrl(), {
      method: "OPTIONS",
      headers: buildForwardHeaders(req),
      cache: "no-store",
    });

    return new NextResponse(null, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SYNC_PROXY_ERROR",
          message: "Failed to reach backend sync endpoint.",
          details: err?.message || String(err),
        },
      },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const response = await fetch(buildBackendUrl(), {
      method: "POST",
      headers: buildForwardHeaders(req),
      body,
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SYNC_PROXY_ERROR",
          message: "Failed to proxy identity sync request.",
          details: err?.message || String(err),
        },
      },
      { status: 502 }
    );
  }
}
