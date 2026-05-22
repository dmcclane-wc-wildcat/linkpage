import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useState } from 'react';
import {
  deleteLink,
  fetchDashboard,
  logout,
  reorderCategories,
  reorderLinks,
} from '../api';
import type { Category, Link } from '../types';
import CategoriesModal from './CategoriesModal';
import CommentsModal from './CommentsModal';
import LinkFormModal from './LinkFormModal';

interface Props {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editLink, setEditLink] = useState<Link | undefined>();
  const [showCategories, setShowCategories] = useState(false);
  const [commentsLink, setCommentsLink] = useState<Link | undefined>();
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      setCategories(await fetchDashboard(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 250);
    return () => clearTimeout(timer);
  }, [search, load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    setCategories(reordered);
    reorderCategories(reordered.map((c) => c.id)).catch(() => load());
  }

  async function handleLogout() {
    await logout().catch(() => {});
    onLogout();
  }

  function openEdit(link: Link) {
    setEditLink(link);
    setShowLinkForm(true);
  }

  async function handleDeleteLink(link: Link) {
    if (!confirm(`Delete "${link.title}"?`)) return;
    try {
      await deleteLink(link.id);
      load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const flatCategories = categories.filter((c) => c.links.length > 0 || !search.trim());
  const searchActive = search.trim().length > 0;

  useEffect(() => {
    if (flatCategories.length === 0) return;
    setExpandedCategoryId((prev) => {
      if (searchActive) return prev;
      if (prev !== null && flatCategories.some((c) => c.id === prev)) return prev;
      return flatCategories[0].id;
    });
  }, [flatCategories, searchActive]);

  function isCategoryExpanded(categoryId: number) {
    if (searchActive) return true;
    return expandedCategoryId === categoryId;
  }

  function toggleCategory(categoryId: number) {
    if (searchActive) return;
    setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId));
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <h1>IT Links Dashboard</h1>
          <input
            className="search-input"
            type="search"
            placeholder="Search links…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search links"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditLink(undefined);
              setShowLinkForm(true);
            }}
            disabled={categories.length === 0}
          >
            + Add link
          </button>
          <button type="button" className="btn" onClick={() => setShowCategories(true)}>
            Categories
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="main">
        {error && <div className="error-banner">{error}</div>}
        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
        {!loading && categories.length === 0 && (
          <div className="empty-state">
            <p>No categories yet. Open <strong>Categories</strong> to create your first one.</p>
          </div>
        )}
        {!loading && categories.length > 0 && flatCategories.length === 0 && (
          <div className="empty-state">
            <p>No links match your search.</p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={flatCategories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {flatCategories.map((category) => (
              <SortableCategorySection
                key={category.id}
                category={category}
                isExpanded={isCategoryExpanded(category.id)}
                onToggle={() => toggleCategory(category.id)}
                onEditLink={openEdit}
                onDeleteLink={handleDeleteLink}
                onComments={(link) => setCommentsLink(link)}
                onLinksReordered={(catId, ids) => {
                  reorderLinks(catId, ids).catch(() => load(search));
                }}
                onLocalLinksUpdate={(catId, links) => {
                  setCategories((prev) =>
                    prev.map((c) => (c.id === catId ? { ...c, links } : c)),
                  );
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </main>

      {showLinkForm && categories.length > 0 && (
        <LinkFormModal
          categories={categories}
          link={editLink}
          onClose={() => {
            setShowLinkForm(false);
            setEditLink(undefined);
          }}
          onSaved={() => load(search)}
        />
      )}

      {showCategories && (
        <CategoriesModal
          categories={categories}
          onClose={() => setShowCategories(false)}
          onChanged={() => load(search)}
        />
      )}

      {commentsLink && (
        <CommentsModal
          link={commentsLink}
          onClose={() => setCommentsLink(undefined)}
          onChanged={() => load(search)}
        />
      )}
    </>
  );
}

function SortableCategorySection({
  category,
  isExpanded,
  onToggle,
  onEditLink,
  onDeleteLink,
  onComments,
  onLinksReordered,
  onLocalLinksUpdate,
}: {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  onEditLink: (link: Link) => void;
  onDeleteLink: (link: Link) => void;
  onComments: (link: Link) => void;
  onLinksReordered: (catId: number, ids: number[]) => void;
  onLocalLinksUpdate: (catId: number, links: Link[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const linkSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = category.links.findIndex((l) => l.id === active.id);
    const newIndex = category.links.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(category.links, oldIndex, newIndex);
    onLocalLinksUpdate(category.id, reordered);
    onLinksReordered(
      category.id,
      reordered.map((l) => l.id),
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`category-section${isExpanded ? ' is-expanded' : ''}`}
    >
      <div className="category-header">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag category ${category.name}`}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <button
          type="button"
          className="category-header-toggle"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={`category-links-${category.id}`}
        >
          <span className="category-chevron" aria-hidden="true">
            ▶
          </span>
          <h2 className="category-title">{category.name}</h2>
          <span className="badge">{category.links.length}</span>
        </button>
      </div>

      {isExpanded && category.links.length > 0 && (
        <DndContext
          sensors={linkSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLinkDragEnd}
        >
          <SortableContext items={category.links.map((l) => l.id)} strategy={rectSortingStrategy}>
            <div id={`category-links-${category.id}`} className="link-grid">
              {category.links.map((link) => (
                <SortableLinkCard
                  key={link.id}
                  link={link}
                  onEdit={() => onEditLink(link)}
                  onDelete={() => onDeleteLink(link)}
                  onComments={() => onComments(link)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {isExpanded && category.links.length === 0 && (
        <p id={`category-links-${category.id}`} className="category-empty">
          No links in this category yet.
        </p>
      )}
    </section>
  );
}

function SortableLinkCard({
  link,
  onEdit,
  onDelete,
  onComments,
}: {
  link: Link;
  onEdit: () => void;
  onDelete: () => void;
  onComments: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <article ref={setNodeRef} style={style} className="link-card">
      <button
        type="button"
        className="drag-handle"
        style={{ alignSelf: 'flex-start' }}
        aria-label={`Drag link ${link.title}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <h3>{link.title}</h3>
      {link.description && <p>{link.description}</p>}
      <div className="link-card-actions">
        <a
          className="btn btn-primary"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </a>
        <button type="button" className="btn" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn" onClick={onComments}>
          Comments{(link.comment_count ?? 0) > 0 ? ` (${link.comment_count})` : ''}
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}
