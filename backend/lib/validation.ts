import { ZodSchema, ZodTypeAny } from "zod";
import { fail, ERROR_CODES } from "./api-response";

type ParsedResult<T> =
    | { ok: true; data: T }
    | { ok: false; response: Response };

export async function parseJsonBody<T>(
    schema: ZodSchema<T> | ZodTypeAny,
    request: Request,
): Promise<ParsedResult<T>> {
    try {
        const json = await request.json();
        const result = schema.safeParse(json);

        if (!result.success) {
            return {
                ok: false,
                response: fail(
                    ERROR_CODES.VALIDATION_ERROR,
                    "Invalid request body",
                    400,
                    result.error.flatten(),
                ),
            };
        }

        return { ok: true, data: result.data as T };
    } catch (error) {
        return {
            ok: false,
            response: fail(
                ERROR_CODES.VALIDATION_ERROR,
                "Request body must be valid JSON",
                400,
            ),
        };
    }
}

