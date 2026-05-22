import { FormEvent, useEffect, useState } from 'react';
import { addComment, deleteComment, fetchComments } from '../api';
import type { Comment, Link } from '../types';
import Modal from './Modal';

interface Props {
  link: Link;
  onClose: () => void;
  onChanged: () => void;
}

export default function CommentsModal({ link, onClose, onChanged }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setComments(await fetchComments(link.id));
    } catch {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [link.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      await addComment(link.id, trimmed);
      setBody('');
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment(id);
      await load();
      onChanged();
    } catch {
      setError('Failed to delete comment');
    }
  }

  return (
    <Modal title={`Comments — ${link.title}`} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : comments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
      ) : (
        <ul className="comments-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time>
              <p style={{ margin: 0 }}>{c.body}</p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}
                onClick={() => handleDelete(c.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div className="form-field">
          <label htmlFor="comment-body">Add comment</label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Anonymous note for the team…"
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn btn-primary">
            Post
          </button>
        </div>
      </form>
    </Modal>
  );
}
