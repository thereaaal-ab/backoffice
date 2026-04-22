import type { IncomingMessage, ServerResponse } from "http";

type VercelReq = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown };
type VercelRes = ServerResponse;

/**
 * Proxies /api/* to BACKEND_URL when the Express server is deployed elsewhere (e.g. Railway).
 * Set BACKEND_URL in Vercel env to your backend root URL (e.g. https://your-app.railway.app).
 * If unset, returns 503 so the UI can show a clear message.
 */
export default async function handler(req: VercelReq, res: VercelRes) {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "Backend not configured. Set BACKEND_URL in Vercel to your API server URL (e.g. Railway or Render).",
      })
    );
    return;
  }

  const path = (req.query.path as string[] | undefined) ?? [];
  const pathSegment = path.length ? `/${path.join("/")}` : "";
  const rest = { ...req.query };
  delete rest.path;
  const qs = Object.keys(rest).length ? "?" + new URLSearchParams(rest as Record<string, string>).toString() : "";
  const targetUrl = `${backend.replace(/\/$/, "")}/api${pathSegment}${qs}`;

  const headers: Record<string, string> = {};
  const skip = new Set(["host", "connection", "content-length"]);
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null && !skip.has(k.toLowerCase()))
      headers[k] = Array.isArray(v) ? v[0] : String(v);
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const response = await fetch(targetUrl, {
    method: req.method ?? "GET",
    headers,
    body,
  });

  res.statusCode = response.status;
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("content-type", contentType);
  const text = await response.text();
  res.end(text);
}
