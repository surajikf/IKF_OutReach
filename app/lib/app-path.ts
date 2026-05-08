const KNOWN_TOP_LEVEL_ROUTES = new Set([
    "admin",
    "banned",
    "campaigns",
    "clients",
    "forgot-password",
    "history",
    "import",
    "login",
    "pending",
    "pending-approval",
    "register",
    "settings",
    "update-password",
]);

function normalizeBasePath(basePath: string | undefined) {
    if (!basePath) return "";

    const trimmed = basePath.trim();
    if (!trimmed || trimmed === "/") return "";

    return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function stripSearchAndHash(pathname: string) {
    const [withoutHash] = pathname.split("#", 1);
    const [withoutSearch] = withoutHash.split("?", 1);
    return withoutSearch || "/";
}

export function inferBasePath(pathname: string) {
    const sanitizedPath = stripSearchAndHash(pathname);
    const withoutTrailingSlash = sanitizedPath.replace(/\/+$/, "") || "/";

    if (withoutTrailingSlash === "/") {
        return "";
    }

    const segments = withoutTrailingSlash.split("/").filter(Boolean);
    const knownRouteIndex = segments.findIndex((segment) => KNOWN_TOP_LEVEL_ROUTES.has(segment));

    if (knownRouteIndex === -1) {
        return withoutTrailingSlash;
    }

    if (knownRouteIndex === 0) {
        return "";
    }

    return `/${segments.slice(0, knownRouteIndex).join("/")}`;
}

export function getAppBasePath(pathname?: string) {
    const envBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
    if (envBasePath) {
        return envBasePath;
    }

    if (pathname) {
        return inferBasePath(pathname);
    }

    if (typeof window !== "undefined") {
        return inferBasePath(window.location.pathname);
    }

    return "";
}

export function appPath(path: string, pathname?: string) {
    if (!path) {
        return getAppBasePath(pathname) || "/";
    }

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const basePath = getAppBasePath(pathname);

    if (!basePath) {
        return normalizedPath;
    }

    return normalizedPath === "/" ? basePath : `${basePath}${normalizedPath}`;
}

export function apiPath(path: string, pathname?: string) {
    const normalizedPath =
        path === "/api" || path.startsWith("/api/")
            ? path
            : `/api${path.startsWith("/") ? path : `/${path}`}`;

    return appPath(normalizedPath, pathname);
}
