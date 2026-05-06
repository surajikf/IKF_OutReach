import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "VALIDATION_ERROR"
    | "INTEGRATION_ERROR"
    | "INTERNAL_ERROR";

export interface ApiErrorDetail {
    code: ApiErrorCode | string;
    message: string;
    details?: unknown;
}

export type ApiResponse<T> =
    | { success: true; data: T }
    | { success: false; error: ApiErrorDetail };

export function ok<T>(data: T, init?: ResponseInit) {
    const status = init?.status ?? 200;
    return NextResponse.json<ApiResponse<T>>(
        {
            success: true,
            data,
        },
        { ...init, status },
    );
}

export function created<T>(data: T) {
    return ok(data, { status: 201 });
}

export function noContent() {
    return NextResponse.json<ApiResponse<null>>(
        {
            success: true,
            data: null,
        },
        { status: 204 },
    );
}

export function error(
    code: ApiErrorCode | string,
    message: string,
    options?: { status?: number; details?: unknown },
) {
    const status = options?.status ?? defaultStatusForCode(code);
    return NextResponse.json<ApiResponse<never>>(
        {
            success: false,
            error: {
                code,
                message,
                ...(options?.details !== undefined ? { details: options.details } : {}),
            },
        },
        { status },
    );
}

// Backwards compatibility/alias for 'fail'
export const fail = (code: string, message: string, status: number = 400, details?: unknown) => 
    error(code, message, { status, details });

export const ERROR_CODES = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    INTERNAL_SERVER_ERROR: "INTERNAL_ERROR",
} as const;

export function fromZodError(zodError: ZodError) {
    return error("VALIDATION_ERROR", "Request validation failed", {
        status: 400,
        details: zodError.flatten(),
    });
}

function defaultStatusForCode(code: string): number {
    switch (code) {
        case "BAD_REQUEST":
        case "VALIDATION_ERROR":
            return 400;
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "NOT_FOUND":
            return 404;
        case "CONFLICT":
            return 409;
        case "INTEGRATION_ERROR":
            return 502;
        case "INTERNAL_ERROR":
        case "INTERNAL_SERVER_ERROR":
            return 500;
        default:
            return 400;
    }
}

