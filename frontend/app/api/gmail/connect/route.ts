import { NextRequest, NextResponse } from "next/server";

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL?.trim().replace(/\/+$/, "") || "http://localhost:3001";

export async function GET(req: NextRequest) {
  const target = new URL(`${backendInternalUrl}/api/auth/google`);
  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  return NextResponse.redirect(target.toString());
}

