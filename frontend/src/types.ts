export interface Link {
  id: number;
  category_id: number;
  title: string;
  url: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  comment_count?: number;
}

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  links: Link[];
}

export interface Comment {
  id: number;
  link_id: number;
  body: string;
  created_at: string;
}
