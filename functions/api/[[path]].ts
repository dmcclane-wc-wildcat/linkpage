import { handleAuthRoutes, requireAuth } from './auth';

interface CategoryRow {
  id: number;
  name: string;
  sort_order: number;
}

interface LinkRow {
  id: number;
  category_id: number;
  title: string;
  url: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CommentRow {
  id: number;
  link_id: number;
  body: string;
  created_at: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(err: unknown): Response {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  if (!message) return json({ error: 'Internal server error' }, 500);
  if (message.includes('no such table')) {
    return json(
      {
        error:
          'Database tables are missing. On your PC run: npm run db:migrate:remote',
      },
      503,
    );
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return json(
      { error: 'That category no longer exists. Refresh the page and try again.' },
      400,
    );
  }
  if (message.includes('prepare') && message.includes('undefined')) {
    return json(
      {
        error:
          'Database is not bound. In Cloudflare → your Pages project → Settings → Functions, add D1 binding DB → it-links-db',
      },
      503,
    );
  }
  return json({ error: message }, 500);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

async function parseBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

async function getDashboard(env: Env, query: string | null): Promise<Response> {
  const q = query?.trim().toLowerCase() ?? '';
  const categories = await env.DB.prepare(
    'SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC',
  ).all<CategoryRow>();

  const links = await env.DB.prepare(
    `SELECT id, category_id, title, url, description, sort_order, created_at, updated_at
     FROM links ORDER BY sort_order ASC, title ASC`,
  ).all<LinkRow>();

  const commentCounts = await env.DB.prepare(
    'SELECT link_id, COUNT(*) as count FROM comments GROUP BY link_id',
  ).all<{ link_id: number; count: number }>();

  const countMap = new Map(
    (commentCounts.results ?? []).map((r) => [r.link_id, r.count]),
  );

  const categoryRows = categories.results ?? [];
  const catNameById = new Map(categoryRows.map((c) => [c.id, c.name.toLowerCase()]));
  const allLinks = links.results ?? [];

  if (q) {
    const linkRows = allLinks.filter((link) => {
      const haystack =
        `${link.title} ${link.description} ${link.url} ${catNameById.get(link.category_id) ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
    const linksByCategorySearch = new Map<number, (LinkRow & { comment_count: number })[]>();
    for (const link of linkRows) {
      const list = linksByCategorySearch.get(link.category_id) ?? [];
      list.push({ ...link, comment_count: countMap.get(link.id) ?? 0 });
      linksByCategorySearch.set(link.category_id, list);
    }
    const result = categoryRows
      .map((cat) => ({
        ...cat,
        links: linksByCategorySearch.get(cat.id) ?? [],
      }))
      .filter((cat) => cat.name.toLowerCase().includes(q) || cat.links.length > 0);
    return json({ categories: result, query: q });
  }

  const linksByCategory = new Map<number, (LinkRow & { comment_count: number })[]>();
  for (const link of allLinks) {
    const list = linksByCategory.get(link.category_id) ?? [];
    list.push({ ...link, comment_count: countMap.get(link.id) ?? 0 });
    linksByCategory.set(link.category_id, list);
  }

  const result = categoryRows.map((cat) => ({
    ...cat,
    links: linksByCategory.get(cat.id) ?? [],
  }));

  return json({ categories: result, query: null });
}

export const onRequest: PagesFunction<Env, 'path'> = async (context) => {
  const { request, env, params } = context;
  const pathParam = params.path;
  const segments = (
    Array.isArray(pathParam)
      ? pathParam
      : pathParam
        ? String(pathParam).split('/').filter(Boolean)
        : []
  ) as string[];

  const url = new URL(request.url);
  const method = request.method;

  const authResponse = await handleAuthRoutes(request, env, segments);
  if (authResponse) return authResponse;

  if (segments[0] === 'health' && method === 'GET') {
    try {
      if (!env.DB) {
        return json({ ok: false, error: 'DB binding missing (set variable name DB)' }, 503);
      }
      await env.DB.prepare('SELECT 1 FROM categories LIMIT 1').first();
      await env.DB.prepare('SELECT 1 FROM links LIMIT 1').first();
      return json({ ok: true });
    } catch (err) {
      return apiError(err);
    }
  }

  const unauthorized = await requireAuth(request, env);
  if (unauthorized) return unauthorized;

  try {
    if (!env.DB) {
      return json(
        {
          error:
            'Database is not bound. In Cloudflare → your Pages project → Settings → Functions, add D1 binding DB → it-links-db',
        },
        503,
      );
    }

    if (segments[0] === 'dashboard' && method === 'GET') {
      return getDashboard(env, url.searchParams.get('q'));
    }

    if (segments[0] === 'categories') {
      if (segments[1] === 'reorder' && method === 'PUT') {
        const { ids } = await parseBody<{ ids: number[] }>(request);
        for (let i = 0; i < ids.length; i++) {
          await env.DB.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
            .bind(i, ids[i])
            .run();
        }
        return json({ ok: true });
      }

      if (!segments[1] && method === 'GET') {
        const rows = await env.DB.prepare(
          'SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC',
        ).all<CategoryRow>();
        return json({ categories: rows.results ?? [] });
      }

      if (!segments[1] && method === 'POST') {
        const { name } = await parseBody<{ name: string }>(request);
        const trimmed = name?.trim();
        if (!trimmed) return json({ error: 'Name is required' }, 400);
        const maxOrder = await env.DB.prepare(
          'SELECT COALESCE(MAX(sort_order), -1) as m FROM categories',
        ).first<{ m: number }>();
        const sortOrder = (maxOrder?.m ?? -1) + 1;
        const result = await env.DB.prepare(
          'INSERT INTO categories (name, sort_order) VALUES (?, ?) RETURNING id, name, sort_order',
        )
          .bind(trimmed, sortOrder)
          .first<CategoryRow>();
        return json({ category: result }, 201);
      }

      const catId = Number(segments[1]);
      if (!Number.isFinite(catId)) return json({ error: 'Invalid id' }, 400);

      if (method === 'PATCH') {
        const { name } = await parseBody<{ name: string }>(request);
        const trimmed = name?.trim();
        if (!trimmed) return json({ error: 'Name is required' }, 400);
        await env.DB.prepare('UPDATE categories SET name = ? WHERE id = ?')
          .bind(trimmed, catId)
          .run();
        const row = await env.DB.prepare(
          'SELECT id, name, sort_order FROM categories WHERE id = ?',
        )
          .bind(catId)
          .first<CategoryRow>();
        return json({ category: row });
      }

      if (method === 'DELETE') {
        const linkCount = await env.DB.prepare(
          'SELECT COUNT(*) as c FROM links WHERE category_id = ?',
        )
          .bind(catId)
          .first<{ c: number }>();
        if ((linkCount?.c ?? 0) > 0) {
          return json({ error: 'Category has links. Move or delete them first.' }, 400);
        }
        await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(catId).run();
        return json({ ok: true });
      }
    }

    if (segments[0] === 'links') {
      if (segments[1] === 'check-duplicate' && method === 'GET') {
        const target = url.searchParams.get('url') ?? '';
        const excludeId = Number(url.searchParams.get('excludeId') ?? '0');
        const normalized = normalizeUrl(target);
        const rows = await env.DB.prepare('SELECT id, url FROM links').all<{ id: number; url: string }>();
        const duplicate = (rows.results ?? []).find(
          (r) => r.id !== excludeId && normalizeUrl(r.url) === normalized,
        );
        return json({ duplicate: !!duplicate, existingId: duplicate?.id ?? null });
      }

      if (segments[1] === 'reorder' && method === 'PUT') {
        const { categoryId, ids } = await parseBody<{ categoryId: number; ids: number[] }>(request);
        for (let i = 0; i < ids.length; i++) {
          await env.DB.prepare(
            'UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?',
          )
            .bind(i, categoryId, ids[i])
            .run();
        }
        return json({ ok: true });
      }

      const linkId = Number(segments[1]);
      if (segments[1] && segments[2] === 'comments') {
        if (!Number.isFinite(linkId)) return json({ error: 'Invalid id' }, 400);

        if (method === 'GET') {
          const rows = await env.DB.prepare(
            'SELECT id, link_id, body, created_at FROM comments WHERE link_id = ? ORDER BY created_at ASC',
          )
            .bind(linkId)
            .all<CommentRow>();
          return json({ comments: rows.results ?? [] });
        }

        if (method === 'POST') {
          const { body } = await parseBody<{ body: string }>(request);
          const trimmed = body?.trim();
          if (!trimmed) return json({ error: 'Comment cannot be empty' }, 400);
          const row = await env.DB.prepare(
            'INSERT INTO comments (link_id, body) VALUES (?, ?) RETURNING id, link_id, body, created_at',
          )
            .bind(linkId, trimmed)
            .first<CommentRow>();
          return json({ comment: row }, 201);
        }
      }

      if (!segments[1] && method === 'POST') {
        const { title, url: linkUrl, description, category_id } = await parseBody<{
          title: string;
          url: string;
          description?: string;
          category_id: number;
        }>();
        const trimmedTitle = title?.trim();
        const trimmedUrl = linkUrl?.trim();
        const catId = Number(category_id);
        if (!trimmedTitle || !trimmedUrl || !Number.isFinite(catId) || catId <= 0) {
          return json({ error: 'Title, URL, and category are required' }, 400);
        }
        try {
          new URL(trimmedUrl);
        } catch {
          return json({ error: 'Invalid URL' }, 400);
        }
        const category = await env.DB.prepare('SELECT id FROM categories WHERE id = ?')
          .bind(catId)
          .first<{ id: number }>();
        if (!category) {
          return json({ error: 'Category not found. Refresh the page and try again.' }, 400);
        }
        const maxOrder = await env.DB.prepare(
          'SELECT COALESCE(MAX(sort_order), -1) as m FROM links WHERE category_id = ?',
        )
          .bind(catId)
          .first<{ m: number }>();
        const sortOrder = (maxOrder?.m ?? -1) + 1;
        const insertResult = await env.DB.prepare(
          `INSERT INTO links (category_id, title, url, description, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
        )
          .bind(catId, trimmedTitle, trimmedUrl, description?.trim() ?? '', sortOrder)
          .run();
        const newId = insertResult.meta.last_row_id;
        const row = await env.DB.prepare(
          `SELECT id, category_id, title, url, description, sort_order, created_at, updated_at
           FROM links WHERE id = ?`,
        )
          .bind(newId)
          .first<LinkRow>();
        if (!row) return json({ error: 'Link was saved but could not be loaded' }, 500);
        return json({ link: row }, 201);
      }

      if (Number.isFinite(linkId)) {
        if (method === 'PATCH') {
          const { title, url: linkUrl, description, category_id } = await parseBody<{
            title?: string;
            url?: string;
            description?: string;
            category_id?: number;
          }>();
          const existing = await env.DB.prepare('SELECT * FROM links WHERE id = ?')
            .bind(linkId)
            .first<LinkRow>();
          if (!existing) return json({ error: 'Not found' }, 404);

          const nextTitle = title?.trim() || existing.title;
          const nextUrl = linkUrl?.trim() || existing.url;
          const nextDesc = description !== undefined ? description.trim() : existing.description;
          const nextCat = category_id ?? existing.category_id;
          try {
            new URL(nextUrl);
          } catch {
            return json({ error: 'Invalid URL' }, 400);
          }
          await env.DB.prepare(
            `UPDATE links SET title = ?, url = ?, description = ?, category_id = ?, updated_at = datetime('now')
             WHERE id = ?`,
          )
            .bind(nextTitle, nextUrl, nextDesc, nextCat, linkId)
            .run();
          const row = await env.DB.prepare(
            `SELECT id, category_id, title, url, description, sort_order, created_at, updated_at FROM links WHERE id = ?`,
          )
            .bind(linkId)
            .first<LinkRow>();
          return json({ link: row });
        }

        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(linkId).run();
          return json({ ok: true });
        }
      }
    }

    if (segments[0] === 'comments' && method === 'DELETE') {
      const commentId = Number(segments[1]);
      if (!Number.isFinite(commentId)) return json({ error: 'Invalid id' }, 400);
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return apiError(err);
  }
};
