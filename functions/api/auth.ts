const SESSION_COOKIE = 'it_links_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie') ?? '';
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  }
  return cookies;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createSessionToken(secret: string): Promise<string> {
  const payload = JSON.stringify({ v: 1, exp: Date.now() + SESSION_MAX_AGE * 1000 });
  const encoded = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return false;
  const expected = await sign(encoded, secret);
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const cookies = parseCookies(request);
  const ok = await verifySessionToken(cookies[SESSION_COOKIE], env.SESSION_SECRET);
  if (!ok) return json({ error: 'Unauthorized' }, 401);
  return null;
}

export async function handleAuthRoutes(
  request: Request,
  env: Env,
  segments: string[],
): Promise<Response | null> {
  if (segments[0] !== 'auth') return null;

  const method = request.method;
  const sub = segments[1] ?? '';

  if (sub === 'check' && method === 'GET') {
    const cookies = parseCookies(request);
    const authenticated = await verifySessionToken(
      cookies[SESSION_COOKIE],
      env.SESSION_SECRET,
    );
    return json({ authenticated });
  }

  if (sub === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  if (!sub && method === 'POST') {
    const body = (await request.json()) as { passphrase?: string };
    const passphrase = body.passphrase ?? '';
    if (!env.PASSPHRASE || !safeEqual(passphrase, env.PASSPHRASE)) {
      return json({ error: 'Invalid passphrase' }, 401);
    }
    const token = await createSessionToken(env.SESSION_SECRET);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE) });
  }

  return null;
}
