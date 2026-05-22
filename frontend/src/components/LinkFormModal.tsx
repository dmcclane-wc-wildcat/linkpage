import { FormEvent, useEffect, useState } from 'react';
import { checkDuplicateUrl, createLink, updateLink } from '../api';
import type { Category, Link } from '../types';
import Modal from './Modal';

interface Props {
  categories: Category[];
  link?: Link;
  onClose: () => void;
  onSaved: () => void;
}

export default function LinkFormModal({ categories, link, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(link?.title ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [description, setDescription] = useState(link?.description ?? '');
  const [categoryId, setCategoryId] = useState(
    String(link?.category_id ?? categories[0]?.id ?? ''),
  );
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forceSave, setForceSave] = useState(false);

  useEffect(() => {
    if (!url.trim()) {
      setDuplicateWarning('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { duplicate } = await checkDuplicateUrl(url, link?.id);
        setDuplicateWarning(duplicate ? 'A link with this URL already exists.' : '');
        if (!duplicate) setForceSave(false);
      } catch {
        setDuplicateWarning('');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [url, link?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (duplicateWarning && !forceSave) return;

    setLoading(true);
    try {
      const catId = Number(categoryId);
      if (link) {
        await updateLink(link.id, {
          title: title.trim(),
          url: url.trim(),
          description: description.trim(),
          category_id: catId,
        });
      } else {
        await createLink({
          title: title.trim(),
          url: url.trim(),
          description: description.trim(),
          category_id: catId,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={link ? 'Edit link' : 'Add link'} onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      {duplicateWarning && (
        <div className="warning-banner">
          {duplicateWarning}
          {!forceSave && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: '0.5rem' }}
              onClick={() => setForceSave(true)}
            >
              Save anyway
            </button>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="url">URL</label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="description">Short description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || (!!duplicateWarning && !forceSave)}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
