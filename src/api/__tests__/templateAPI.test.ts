import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTemplates,
  createPageFromTemplate,
  createTemplate,
  createTemplateFromPage,
  deleteTemplate,
} from '../templateAPI';
import { supabase } from '@/integrations/supabase/client';
import type { Template, Block } from '@/types/notion';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock the pageAPI
vi.mock('../pageAPI', () => ({
  createPage: vi.fn(),
}));

describe('Template API', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSystemTemplate: Template = {
    id: 'template-system-1',
    user_id: null,
    name: 'Notes',
    description: 'Simple note-taking template',
    icon: '📝',
    content: [
      {
        id: '1',
        type: 'heading1',
        content: { text: 'Notes', marks: [] },
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as Block[],
    is_system: true,
    created_at: new Date().toISOString(),
  };

  const mockUserTemplate: Template = {
    id: 'template-user-1',
    user_id: 'user-123',
    name: 'My Custom Template',
    description: 'Custom template',
    icon: '✨',
    content: [
      {
        id: '1',
        type: 'text',
        content: { text: 'Custom content', marks: [] },
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as Block[],
    is_system: false,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth.getUser
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    });
  });

  describe('getTemplates', () => {
    it('returns system and user templates', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockSystemTemplate, mockUserTemplate],
                error: null,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const result = await getTemplates();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Notes');
      expect(result[1].name).toBe('My Custom Template');
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(getTemplates()).rejects.toThrow('User not authenticated');
    });

    it('throws error on database failure', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      await expect(getTemplates()).rejects.toThrow('Failed to get templates');
    });
  });

  describe('createPageFromTemplate', () => {
    it('creates a page from a template', async () => {
      const { createPage } = await import('../pageAPI');

      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockSystemTemplate,
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'Notes',
        icon: '📝',
        cover_image: null,
        content: mockSystemTemplate.content,
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const result = await createPageFromTemplate('template-system-1');

      expect(result.title).toBe('Notes');
      expect(result.icon).toBe('📝');
      expect(createPage).toHaveBeenCalledWith({
        title: 'Notes',
        icon: '📝',
        parent_id: undefined,
        content: mockSystemTemplate.content,
      });
    });

    it('creates a page with custom title and parent', async () => {
      const { createPage } = await import('../pageAPI');

      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockSystemTemplate,
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: 'parent-123',
        title: 'My Notes',
        icon: '📝',
        cover_image: null,
        content: mockSystemTemplate.content,
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.mocked(createPage).mockResolvedValue(mockPage);

      const result = await createPageFromTemplate(
        'template-system-1',
        'My Notes',
        'parent-123'
      );

      expect(result.title).toBe('My Notes');
      expect(result.parent_id).toBe('parent-123');
      expect(createPage).toHaveBeenCalledWith({
        title: 'My Notes',
        icon: '📝',
        parent_id: 'parent-123',
        content: mockSystemTemplate.content,
      });
    });

    it('throws error when template not found', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      await expect(
        createPageFromTemplate('nonexistent')
      ).rejects.toThrow('Failed to get template');
    });
  });

  describe('createTemplate', () => {
    it('creates a custom template', async () => {
      const content: Block[] = [
        {
          id: '1',
          type: 'text',
          content: { text: 'Test content', marks: [] },
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockDbFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...mockUserTemplate,
                name: 'New Template',
                content,
              },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const result = await createTemplate(
        'New Template',
        content,
        'Test description',
        '🎨'
      );

      expect(result.name).toBe('New Template');
      expect(result.is_system).toBe(false);
    });

    it('throws error when name is empty', async () => {
      await expect(
        createTemplate('', [])
      ).rejects.toThrow('Template name is required');
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        createTemplate('Test', [])
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('createTemplateFromPage', () => {
    it('creates a template from an existing page', async () => {
      const mockPage = {
        id: 'page-123',
        user_id: 'user-123',
        parent_id: null,
        title: 'My Page',
        icon: '📄',
        cover_image: null,
        content: [
          {
            id: '1',
            type: 'text',
            content: { text: 'Page content', marks: [] },
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ] as Block[],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const mockDbSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockPage,
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...mockUserTemplate,
                name: 'Template from Page',
                content: mockPage.content,
                icon: mockPage.icon,
              },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbSelect);

      const result = await createTemplateFromPage(
        'page-123',
        'Template from Page',
        'Created from my page'
      );

      expect(result.name).toBe('Template from Page');
      expect(result.icon).toBe('📄');
    });

    it('throws error when page not found', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      await expect(
        createTemplateFromPage('nonexistent', 'Test')
      ).rejects.toThrow('Failed to get page');
    });
  });

  describe('deleteTemplate', () => {
    it('deletes a custom template', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: null,
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      await deleteTemplate('template-user-1');

      expect(mockDbFrom).toHaveBeenCalledWith('templates');
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        deleteTemplate('template-user-1')
      ).rejects.toThrow('User not authenticated');
    });

    it('throws error on database failure', async () => {
      const mockDbFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      await expect(
        deleteTemplate('template-user-1')
      ).rejects.toThrow('Failed to delete template');
    });
  });
});
