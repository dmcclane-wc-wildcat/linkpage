import { useState } from 'react';
import { createCategory, deleteCategory, renameCategory } from '../api';
import type { Category } from '../types';
import Modal from './Modal';

interface Props {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}

export default function CategoriesModal({ categories, onClose, onChanged }: Props) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      await createCategory(name);
      setNewName('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(id: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await renameCategory(id, trimmed);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  }

  async function handleDelete(id: number, linkCount: number) {
    if (linkCount > 0) {
      setError('Remove or move links before deleting this category.');
      return;
    }
    if (!confirm('Delete this category?')) return;
    try {
      await deleteCategory(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <Modal title="Manage categories" onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-field">
        <label htmlFor="new-cat">New category</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="new-cat"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          />
          <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={loading}>
            Add
          </button>
        </div>
      </div>
      <ul className="category-list-manage">
        {categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function CategoryRow({
  category,
  onRename,
  onDelete,
}: {
  category: Category;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number, linkCount: number) => void;
}) {
  const [name, setName] = useState(category.name);

  return (
    <li>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== category.name && onRename(category.id, name)}
      />
      <span className="badge">{category.links.length} links</span>
      <button
        type="button"
        className="btn btn-danger"
        onClick={() => onDelete(category.id, category.links.length)}
      >
        Delete
      </button>
    </li>
  );
}
