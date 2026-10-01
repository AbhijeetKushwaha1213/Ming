export type ResourceType = 'NOTE' | 'LINK' | 'PDF';

export interface ResourceItem {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  type: ResourceType;
  noteContent?: string | null;
  linkUrl?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  folder?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceInput {
  title: string;
  description?: string;
  type: ResourceType;
  noteContent?: string;
  linkUrl?: string;
  fileUrl?: string;
  storagePath?: string;
  folder?: string;
  tags?: string[];
}
