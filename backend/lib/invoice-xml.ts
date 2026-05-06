import { XMLParser } from "fast-xml-parser";

const PARSER_OPTS = { ignoreAttributes: false, attributeNamePrefix: "@_" } as const;

function extractStringContent(val: unknown): string | null {
    if (typeof val === "string") return val;
    if (val && typeof val === "object") {
        const v = val as Record<string, unknown>;
        if (typeof v["#text"] === "string") return v["#text"];
        if (typeof v.__text === "string") return v.__text;
    }
    return null;
}

function tryParseEmbeddedString(s: string, parser: XMLParser): unknown {
    const t = s.trim();
    if (!t) return undefined;
    if (t.startsWith("<")) {
        try {
            return parser.parse(t);
        } catch {
            return undefined;
        }
    }
    if (t.startsWith("[") || t.startsWith("{")) {
        try {
            return JSON.parse(t) as unknown;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function extractTextOrParse(val: unknown, parser: XMLParser): unknown | undefined {
    const s = extractStringContent(val);
    if (!s) return undefined;
    const parsed = tryParseEmbeddedString(s, parser);
    return parsed !== undefined ? parsed : undefined;
}

/**
 * ASMX/SOAP often returns: Envelope → Body → GetClientsResponse → GetClientsResult → CDATA/XML/JSON string.
 * Peel those layers so findClientsRecursive can see ActiveClientDto / ClientDto etc.
 */
export function unwrapInvoiceServicePayload(parsed: unknown): unknown {
    const parser = new XMLParser(PARSER_OPTS);
    let current: unknown = parsed;

    for (let i = 0; i < 10; i++) {
        const next = peelOneLayer(current, parser);
        if (next === current) break;
        current = next;
    }
    return current;
}

function peelOneLayer(obj: unknown, parser: XMLParser): unknown {
    if (!obj || typeof obj !== "object") return obj;
    const o = obj as Record<string, unknown>;

    const wrapperKeys = [
        "GetActiveClientsResult",
        "GetInactiveClientsResult",
        "GetActiveClientsResponse",
        "GetInactiveClientsResponse",
        "getActiveClientsResult",
        "getInactiveClientsResult",
        "getActiveClientsResponse",
        "getInactiveClientsResponse",
        "GetClientsResult",
        "getClientsResult",
        "GetClientsResponse",
        "getClientsResponse",
        "string",
        "return",
    ];
    for (const k of wrapperKeys) {
        if (o[k] === undefined) continue;
        const inner = extractTextOrParse(o[k], parser);
        if (inner !== undefined) return inner;
        if (o[k] && typeof o[k] === "object") return o[k] as object;
    }

    for (const key of Object.keys(o)) {
        if (/(^|:)Body$/i.test(key) || key === "Body") {
            return o[key];
        }
    }

    for (const v of Object.values(o)) {
        const inner = extractTextOrParse(v, parser);
        if (inner !== undefined) return inner;
    }

    for (const v of Object.values(o)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
            const inner = peelOneLayer(v, parser);
            if (inner !== v) return inner;
        }
    }

    return obj;
}

/** Normalize single DTO or array from typical .NET / ASMX XML shapes */
function asArray<T>(v: T | T[] | undefined | null): T[] {
    if (v === undefined || v === null) return [];
    return Array.isArray(v) ? v : [v];
}

/**
 * Recursively locate client rows in parsed XML/JSON (after SOAP unwrap).
 */
export function findClientsRecursive(obj: unknown): any[] | null {
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;

    const arrayKeys = [
        "ActiveClientDto",
        "InactiveClientDto",
        "NotActiveClientDto",
        "ClientDto",
        "Client",
        "ArrayOfActiveClientDto",
        "ArrayOfClient",
        "ArrayOfClientDto",
    ];
    for (const k of arrayKeys) {
        if (o[k] !== undefined) {
            const arr = asArray(o[k] as any);
            if (arr.length) return arr;
        }
    }

    if (o.ClientName || o.Customerid || o.customerid) return [o];

    for (const key of Object.keys(o)) {
        const v = o[key];
        if (v && typeof v === "object") {
            const found = findClientsRecursive(v);
            if (found?.length) return found;
        }
    }
    return null;
}

/** Full pipeline: unwrap SOAP → find DTO array → list (empty if none) */
export function extractInvoiceClientRows(parsedXmlRoot: unknown): any[] {
    const root = unwrapInvoiceServicePayload(parsedXmlRoot);
    return findClientsRecursive(root) || [];
}
