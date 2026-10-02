import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseAgentActions,
  executeAgentActions,
  getWorkspaceCatalog,
  getAgentWorkspacePrompt,
  AgentAction,
} from '@/services/agentActionEngine';
import * as pageAPI from '@/api/pageAPI';
import { localStore } from '@/utils/localStore';
import type { Page } from '@/types/notion';

describe('Agent Workspace Action Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseAgentActions', () => {
    it('correctly parses ```json:action blocks and strips them from cleanText', () => {
      const input = `Sure, I have updated your workspace!
\`\`\`json:action
{
  "actions": [
    { "type": "delete_page", "pageTitle": "Old Duplicate Page" },
    { "type": "edit_page", "pageTitle": "Algorithms", "content": "## Sorting\\n- QuickSort", "mode": "append" }
  ]
}
\`\`\`
Let me know if you need anything else!`;

      const { cleanText, actions } = parseAgentActions(input);
      expect(actions).toHaveLength(2);
      expect(actions[0].type).toBe('delete_page');
      expect(actions[0].pageTitle).toBe('Old Duplicate Page');
      expect(actions[1].type).toBe('edit_page');
      expect(actions[1].mode).toBe('append');
      expect(cleanText).not.toContain('```json:action');
      expect(cleanText).toContain('Sure, I have updated your workspace!');
      expect(cleanText).toContain('Let me know if you need anything else!');
    });

    it('handles raw JSON actions object when markdown code fence is omitted', () => {
      const input = `Done! {"actions": [{"type": "rename_page", "oldTitle": "Draft", "newTitle": "Final Notes"}]}`;
      const { cleanText, actions } = parseAgentActions(input);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('rename_page');
      expect(actions[0].newTitle).toBe('Final Notes');
      expect(cleanText).toBe('Done!');
    });

    it('returns empty actions and untouched text when no action block exists', () => {
      const input = "Here is an explanation of QuickSort and its time complexity O(n log n).";
      const { cleanText, actions } = parseAgentActions(input);
      expect(actions).toHaveLength(0);
      expect(cleanText).toBe(input);
    });
  });

  describe('executeAgentActions', () => {
    it('executes delete_page action and dispatches event', async () => {
      const mockPage: Page = {
        id: 'page_123',
        user_id: 'user_1',
        title: 'Deprecated Notes',
        parent_id: null,
        icon: '📝',
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([mockPage]);
      const deleteSpy = vi.spyOn(pageAPI, 'deletePage').mockResolvedValue();

      const eventSpy = vi.spyOn(window, 'dispatchEvent');

      const actions: AgentAction[] = [
        { type: 'delete_page', pageTitle: 'Deprecated Notes' },
      ];

      const summaries = await executeAgentActions(actions);
      expect(deleteSpy).toHaveBeenCalledWith('page_123');
      expect(summaries).toContain('🗑️ Deleted resource "Deprecated Notes"');
      expect(eventSpy).toHaveBeenCalled();
    });

    it('executes edit_page with append mode', async () => {
      const mockPage: Page = {
        id: 'page_456',
        user_id: 'user_1',
        title: 'Operating Systems',
        parent_id: null,
        icon: '📝',
        cover_image: null,
        content: [
          { id: 'b1', type: 'paragraph', content: { text: 'Introduction to OS' } },
        ],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([mockPage]);
      const updateSpy = vi.spyOn(pageAPI, 'updatePage').mockResolvedValue({
        ...mockPage,
        updated_at: new Date().toISOString(),
      });

      const actions: AgentAction[] = [
        {
          type: 'edit_page',
          pageTitle: 'Operating Systems',
          content: '## Deadlocks\n- Mutual Exclusion\n- Hold and Wait',
          mode: 'append',
        },
      ];

      const summaries = await executeAgentActions(actions);
      expect(updateSpy).toHaveBeenCalled();
      const passedData = updateSpy.mock.calls[0][1];
      expect(passedData.content).toBeDefined();
      expect(passedData.content!.length).toBeGreaterThan(1);
      expect(summaries.some((s) => s.includes('Modified content in "Operating Systems"'))).toBe(true);
    });

    it('executes create_folder and create_page inside that folder', async () => {
      const mockFolder: Page = {
        id: 'folder_99',
        user_id: 'user_1',
        title: '📁 Computer Networks',
        parent_id: null,
        icon: '📁',
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const mockPage: Page = {
        id: 'page_100',
        user_id: 'user_1',
        title: 'TCP vs UDP',
        parent_id: 'folder_99',
        icon: '📝',
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([]);
      const createSpy = vi.spyOn(pageAPI, 'createPage')
        .mockResolvedValueOnce(mockFolder)
        .mockResolvedValueOnce(mockPage);

      const actions: AgentAction[] = [
        { type: 'create_folder', title: '📁 Computer Networks' },
        { type: 'create_page', title: 'TCP vs UDP', content: '# Transport Layer', folderTitle: '📁 Computer Networks' },
      ];

      const summaries = await executeAgentActions(actions);
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(summaries).toContain('📁 Created folder "📁 Computer Networks"');
      expect(summaries).toContain('📄 Created resource "TCP vs UDP"');
    });

    it('matches page titles with wrapping quotes and fuzzy substring', async () => {
      const mockPage: Page = {
        id: 'page_789',
        user_id: 'user_1',
        title: 'Machine Learning Foundations',
        parent_id: null,
        icon: '🤖',
        cover_image: null,
        content: [],
        position: 0,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([mockPage]);
      const updateSpy = vi.spyOn(pageAPI, 'updatePage').mockResolvedValue(mockPage);

      const actions: AgentAction[] = [
        { type: 'rename_page', pageTitle: '"Machine Learning"', newTitle: 'ML Foundations & Math' },
      ];

      const summaries = await executeAgentActions(actions);
      expect(updateSpy).toHaveBeenCalledWith('page_789', { title: 'ML Foundations & Math' });
      expect(summaries).toContain('📝 Renamed "Machine Learning Foundations" to "ML Foundations & Math"');
    });
  });

  describe('getWorkspaceCatalog & getAgentWorkspacePrompt', () => {
    it('generates prompt containing current workspace pages and action instructions', async () => {
      vi.spyOn(pageAPI, 'getAllPages').mockResolvedValue([
        {
          id: 'p1',
          user_id: 'u1',
          title: 'Calculus III',
          parent_id: null,
          icon: '📐',
          cover_image: null,
          content: [],
          position: 0,
          is_favorite: false,
          created_at: '',
          updated_at: '',
          deleted_at: null,
        },
      ]);

      const catalog = await getWorkspaceCatalog();
      expect(catalog.pagesCatalog).toHaveLength(1);
      expect(catalog.pagesCatalog[0].title).toBe('Calculus III');

      const prompt = getAgentWorkspacePrompt(catalog, 'Test instructions');
      expect(prompt).toContain('Calculus III');
      expect(prompt).toContain('edit_page');
      expect(prompt).toContain('delete_page');
      expect(prompt).toContain('Test instructions');
    });
  });
});
