export type PublicRoute =
  | { kind: "missing"; value: "" }
  | { kind: "download"; value: string }
  | { kind: "public"; value: string };

export function resolvePublicRoute(pathname: string): PublicRoute | null {
  if (pathname === "/file-not-found" || pathname.startsWith("/f/")) {
    return { kind: "missing", value: "" };
  }

  const downloadMatch = pathname.match(/^\/d\/([^/]+)\/?$/);
  if (downloadMatch) {
    return { kind: "download", value: downloadMatch[1] };
  }

  if (pathname === "/public" || pathname.startsWith("/public/")) {
    const encoded = pathname.replace(/^\/public\/?/, "");
    try {
      return {
        kind: "public",
        value: encoded
          .split("/")
          .filter(Boolean)
          .map(decodeURIComponent)
          .join("/"),
      };
    } catch {
      return { kind: "missing", value: "" };
    }
  }

  return null;
}
