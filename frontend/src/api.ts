import type { Category, Comment, Link } from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data as T;
}

export async function checkAuth(): Promise<boolean> {
  const data = await request<{ authenticated: boolean }>('/api/auth/check');
  return data.authenticated;
}

export async function login(passphrase: string): Promise<void> {
  await request('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ passphrase }),
  });
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function fetchDashboard(q?: string): Promise<Category[]> {
  const params = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const data = await request<{ categories: Category[] }>(`/api/dashboard${params}`);
  return data.categories;
}

export async function createCategory(name: string): Promise<void> {
  await request('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameCategory(id: number, name: string): Promise<void> {
  await request(`/api/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteCategory(id: number): Promise<void> {
  await request(`/api/categories/${id}`, { method: 'DELETE' });
}

export async function reorderCategories(ids: number[]): Promise<void> {
  await request('/api/categories/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

export async function checkDuplicateUrl(
  url: string,
  excludeId?: number,
): Promise<{ duplicate: boolean; existingId: number | null }> {
  const params = new URLSearchParams({ url });
  if (excludeId) params.set('excludeId', String(excludeId));
  return request(`/api/links/check-duplicate?${params}`);
}

export async function createLink(data: {
  title: string;
  url: string;
  description: string;
  category_id: number;
}): Promise<Link> {
  const res = await request<{ link: Link }>('/api/links', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.link;
}

export async function updateLink(
  id: number,
  data: Partial<{ title: string; url: string; description: string; category_id: number }>,
): Promise<Link> {
  const res = await request<{ link: Link }>(`/api/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.link;
}

export async function deleteLink(id: number): Promise<void> {
  await request(`/api/links/${id}`, { method: 'DELETE' });
}

export async function reorderLinks(categoryId: number, ids: number[]): Promise<void> {
  await request('/api/links/reorder', {
    method: 'PUT',
    body: JSON.stringify({ categoryId, ids }),
  });
}

export async function fetchComments(linkId: number): Promise<Comment[]> {
  const data = await request<{ comments: Comment[] }>(`/api/links/${linkId}/comments`);
  return data.comments;
}

export async function addComment(linkId: number, body: string): Promise<Comment> {
  const data = await request<{ comment: Comment }>(`/api/links/${linkId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return data.comment;
}

export async function deleteComment(id: number): Promise<void> {
  await request(`/api/comments/${id}`, { method: 'DELETE' });
}
