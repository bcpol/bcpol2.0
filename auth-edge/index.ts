// BCPOL web authentication gateway. No passwords or privileged API keys in the browser.
// Credential hashes and session hashes are stored in a restricted Supabase schema.
const allowedOrigins = new Set([
  "https://bcpol.es",
  "https://www.bcpol.es",
  "https://bcpol.github.io",
]);
const API_URL = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "") ?? "";
const API_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function headers(origin: string | null): Headers {
  const h = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && allowedOrigins.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    h.set("Access-Control-Allow-Headers", "content-type");
  }
  return h;
}
function answer(payload: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(payload), { status, headers: headers(origin) });
}
async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!API_URL || !API_KEY) throw new Error("Authentication configuration unavailable");
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: API_KEY,
    Prefer: "return=representation",
  };
  if (API_KEY.startsWith("eyJ")) h.Authorization = "Bearer " + API_KEY;
  const result = await fetch(API_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: h,
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(12000),
  });
  if (!result.ok) throw new Error("Authentication storage unavailable");
  return (await result.json()) as T;
}
function freshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return answer({ error: "Forbidden" }, 403, null);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return answer({ error: "Method not allowed" }, 405, origin);
  try {
    if (Number(req.headers.get("content-length") || 0) > 4096) return answer({ error: "Invalid request" }, 400, origin);
    const text = await req.text();
    if (text.length > 4096) return answer({ error: "Invalid request" }, 400, origin);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object") return answer({ error: "Invalid request" }, 400, origin);
    if (body.action === "login") {
      const username = body.username;
      const password = body.password;
      if (typeof username !== "string" || typeof password !== "string" ||
          !/^[a-zA-Z0-9_.-]{1,80}$/.test(username) ||
          password.length < 1 || password.length > 256)
        return answer({ error: "Credenciales incorrectas" }, 401, origin);
      const token = freshToken();
      const ok = await callRpc<boolean>("bcpol_web_auth_login", {
        p_username: username,
        p_password: password,
        p_token_hash: await hashToken(token),
      });
      return ok
        ? answer({ ok: true, token, username, expires_in: 43200 }, 200, origin)
        : answer({ error: "Credenciales incorrectas o acceso temporalmente bloqueado" }, 401, origin);
    }
    if (body.action === "verify" || body.action === "logout") {
      const token = body.token;
      if (typeof token !== "string" || !/^[a-zA-Z0-9_-]{43}$/.test(token))
        return answer({ ok: false }, 401, origin);
      const tokenHash = await hashToken(token);
      if (body.action === "logout") {
        await callRpc<null>("bcpol_web_auth_logout", { p_token_hash: tokenHash });
        return answer({ ok: true }, 200, origin);
      }
      const username = await callRpc<string | null>("bcpol_web_auth_verify", {
        p_token_hash: tokenHash,
      });
      return username
        ? answer({ ok: true, username }, 200, origin)
        : answer({ ok: false }, 401, origin);
    }
    return answer({ error: "Acción desconocida" }, 400, origin);
  } catch {
    return answer({ error: "Servicio de acceso temporalmente no disponible" }, 503, origin);
  }
});
