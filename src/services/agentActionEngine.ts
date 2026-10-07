import { getAllPages, createPage, updatePage, deletePage, movePage } from '@/api/pageAPI';
import { copyVaultItemToResources, markdownToBlocks } from '@/utils/vaultToResources';
import { cleanAiResponseToReadableNotes } from '@/utils/notesFormatter';
import { localStore } from '@/utils/localStore';
import { pageKeys } from '@/hooks/usePages';
import type { Page, Block } from '@/types/notion';
import type { QueryClient } from '@tanstack/react-query';

export interface WorkspaceCatalog {
  pages: Page[];
  activePageId?: string | null;
  activePageTitle?: string | null;
  pagesCatalog: Array<{ id: string; title: string; isFolder: boolean; parentId: string | null; isActive?: boolean; sample: string }>;
  vaultCatalog: Array<{ id: string; title: string; type: string; topic: string }>;
}

export interface AgentAction {
  type?: string;
  action?: string;
  pageId?: string;
  page_id?: string;
  pageTitle?: string;
  title?: string;
  oldTitle?: string;
  newTitle?: string;
  content?: string;
  mode?: 'replace' | 'append';
  folderTitle?: string;
  targetFolderTitle?: string;
  targetFolderId?: string;
  folderId?: string;
  icon?: string;
  vaultId?: string;
  vaultTitle?: string;
}

/**
 * Retrieve current workspace catalog of resources and vault items
 */
export async function getWorkspaceCatalog(): Promise<WorkspaceCatalog> {
  let pages: Page[] = [];
  try {
    pages = await getAllPages();
  } catch (err) {
    console.warn('Failed to load pages catalog:', err);
  }

  let activePageId: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      activePageId = localStorage.getItem('studymate-active-page-id');
    } catch {}
  }
  const activePage = activePageId ? pages.find((p) => p.id === activePageId) : undefined;

  const studyMaterials = localStore.getStudyMaterials();
  const flashcards = localStore.getFlashcards();

  const pagesCatalog = pages.map((p) => ({
    id: p.id,
    title: p.title,
    isFolder: !p.parent_id,
    parentId: p.parent_id,
    isActive: p.id === activePageId,
    sample: Array.isArray(p.content) && p.content.length > 0
      ? (p.content[0]?.content?.text || (typeof p.content[0]?.content === 'string' ? p.content[0]?.content : '') || '').slice(0, 80)
      : '',
  }));

  const vaultCatalog = [
    ...studyMaterials.map((m) => ({ id: m.id, title: m.title, type: m.type, topic: m.topic || '' })),
    ...flashcards.map((f) => ({ id: f.id, title: f.title || f.question.slice(0, 35), type: 'flashcard', topic: f.tags?.join(', ') || '' })),
  ];

  return {
    pages,
    activePageId: activePage?.id || null,
    activePageTitle: activePage?.title || null,
    pagesCatalog,
    vaultCatalog,
  };
}

/**
 * Build a system prompt giving the AI agent full control over the user's workspace
 */
export function getAgentWorkspacePrompt(catalog: WorkspaceCatalog, customInstructions?: string): string {
  return `You are Ming AI, the user's intelligent study assistant and autonomous workspace orchestrator.
You have direct read, write, edit, rename, move, and delete control over the user's Resources workspace and Vault!

${catalog.activePageTitle ? `📌 CURRENTLY ACTIVE PAGE BEING VIEWED BY USER:
- Title: "${catalog.activePageTitle}"
- Page ID: "${catalog.activePageId}"
CRITICAL INSTRUCTION: If the user asks to "add to this page", "add content", "add a checklist", "add notes", or refers to "${catalog.activePageTitle}", TARGET THIS EXACT PAGE using:
{ "type": "edit_page", "pageId": "${catalog.activePageId}", "pageTitle": "${catalog.activePageTitle}", "mode": "append", "content": "..." }
Do NOT create an unnecessary duplicate page when modifying or adding to the current page!
` : ''}

CURRENT WORKSPACE RESOURCES (Pages & Folders in Resources):
${JSON.stringify(catalog.pagesCatalog, null, 2)}

CURRENT STUDY VAULT ITEMS:
${JSON.stringify(catalog.vaultCatalog, null, 2)}

${customInstructions ? `SPECIFIC CONTEXT / INSTRUCTIONS:\n${customInstructions}\n` : ''}

CAPABILITIES & ACTIONS:
1. Edit & Modify Content:
   - When asked to update, edit, expand, rewrite, or add content to any resource page, provide the new content and execute the edit action.
   - Use mode: "append" to add new sections or notes to the end of a page.
   - Use mode: "replace" to rewrite or update the entire page.
2. Rename Resources:
   - Rename pages or folders to clearer, more descriptive titles.
3. Delete Resources:
   - Delete obsolete, duplicate, or user-specified pages and folders.
4. Create Pages & Folders:
   - Create new notes, summaries, study sheets, or folders.
5. Move & Organize:
   - Organize files into smart folders based on topic similarity.
   - Move pages between folders or to the workspace root.
6. Vault to Resources:
   - Copy any generated quiz, flashcard deck, or notes from the Vault into Resources.
7. Academic Tutoring:
   - Explain concepts, answer questions, and generate study aids with verified accuracy.
8. PROPER STUDY NOTES FORMAT (CRITICAL):
   - When the user asks for short notes, study notes, summaries, or concept breakdowns, NEVER respond in raw JSON or raw object notation!
   - Format notes directly in beautiful, ready-to-read structured Markdown notes with clear sections:
     # 📌 [Topic Title]
     ## 💡 Executive Summary
     ## 🔑 Key Concepts & Deep Dive (numbered with clear headings and bullet points)
     ## 📐 Essential Formulas & Rules (if applicable)
     ## ⚡ High-Yield Exam Facts & Takeaways
     ## 🎯 Exam Tips & Pitfalls

ACTION PROTOCOL:
When the user asks you to perform ANY workspace action (edit content, modify a page, delete a page, rename, organize, create a folder, copy from vault), explain what you did in a helpful, conversational response first, and then append an action block in this EXACT JSON format at the VERY END of your response:

\`\`\`json:action
{
  "actions": [
    { "type": "create_folder", "title": "📁 Operating Systems" },
    { "type": "create_page", "title": "Process Scheduling", "content": "# Process Scheduling\\nDetailed notes...", "folderTitle": "📁 Operating Systems" },
    { "type": "edit_page", "pageTitle": "Process Scheduling", "content": "## CPU Scheduling Algorithms\\n- FCFS\\n- Round Robin", "mode": "append" },
    { "type": "update_page_title", "oldTitle": "Untitled", "newTitle": "Computer Networks Overview" },
    { "type": "delete_page", "pageTitle": "Old Duplicate Page" },
    { "type": "move_page", "pageTitle": "Process Scheduling", "folderTitle": "📁 Operating Systems" },
    { "type": "copy_vault_to_resource", "vaultTitle": "Calculus Quiz" }
  ]
}
\`\`\`

Always output your friendly conversational text first. Only output the action block when actions need to be performed.`;
}

/**
 * Parse actions from AI agent response
 */
export function parseAgentActions(responseText: string): { cleanText: string; actions: AgentAction[] } {
  let cleanText = responseText;
  let actions: AgentAction[] = [];

  const actionBlockRegex = /```(?:json:action|action|json)?\s*(\{[\s\S]*?"actions"[\s\S]*?\})\s*```/i;
  const match = responseText.match(actionBlockRegex);

  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.actions)) {
        actions = parsed.actions;
        cleanText = responseText.replace(match[0], '').trim();
      }
    } catch (e) {
      console.warn('Failed to parse JSON action block:', e);
    }
  } else {
    const rawMatch = responseText.match(/\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
    if (rawMatch) {
      try {
        const parsed = JSON.parse(rawMatch[0]);
        if (Array.isArray(parsed.actions)) {
          actions = parsed.actions;
          cleanText = responseText.replace(rawMatch[0], '').trim();
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Ensure any JSON notes returned in the conversational text are transformed into clean, ready-to-read notes
  cleanText = cleanAiResponseToReadableNotes(cleanText);

  return { cleanText, actions };
}

/**
 * Execute parsed agent actions across the workspace and notify listeners
 */
export async function executeAgentActions(
  actions: AgentAction[],
  queryClient?: QueryClient
): Promise<string[]> {
  if (!actions || actions.length === 0) return [];

  const executedSummaries: string[] = [];
  const createdFolders: Record<string, string> = {}; // normalized name -> id

  let allPages: Page[] = [];
  try {
    allPages = await getAllPages();
    allPages.forEach((p) => {
      if (!p.parent_id) {
        createdFolders[p.title.toLowerCase().trim()] = p.id;
      }
    });
  } catch (err) {
    console.warn('Failed to pre-fetch pages in executeAgentActions:', err);
  }

  let activePageId: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      activePageId = localStorage.getItem('studymate-active-page-id');
    } catch {}
  }
  const activePage = activePageId ? allPages.find((p) => p.id === activePageId) : undefined;

  const findPage = (pageId?: string, pageTitle?: string): Page | undefined => {
    if (pageId) {
      const found = allPages.find((p) => p.id === pageId);
      if (found) return found;
    }
    if (pageTitle) {
      const cleanTitle = pageTitle.replace(/^["'`]|["'`]$/g, '').trim().toLowerCase();
      if (!cleanTitle) return activePage;
      // If the action refers to "this page" or "current page", return activePage if available
      if (activePage && (cleanTitle.includes('this page') || cleanTitle.includes('current page') || cleanTitle === 'untitled')) {
        return activePage;
      }
      // If activePage matches or is mentioned in the cleanTitle
      if (activePage && (cleanTitle.includes(activePage.title.toLowerCase().trim()) || activePage.title.toLowerCase().trim().includes(cleanTitle))) {
        return activePage;
      }
      return allPages.find((p) => p.title.toLowerCase().trim() === cleanTitle)
        || allPages.find((p) => p.title.toLowerCase().includes(cleanTitle))
        || allPages.find((p) => cleanTitle.includes(p.title.toLowerCase().trim()));
    }
    return activePage;
  };

  const studyMaterials = localStore.getStudyMaterials();
  const flashcards = localStore.getFlashcards();

  for (const act of actions) {
    try {
      const actType = (act.type || act.action || '').toLowerCase();

      // 1. CREATE FOLDER
      if (actType === 'create_folder') {
        const title = act.title || 'New Folder';
        const norm = title.toLowerCase().trim();
        if (!createdFolders[norm]) {
          const folder = await createPage({
            title,
            icon: act.icon || '📁',
            parent_id: null,
          });
          createdFolders[norm] = folder.id;
          allPages.push(folder);
          executedSummaries.push(`📁 Created folder "${title}"`);
        }
      }

      // 2. CREATE PAGE
      else if (actType === 'create_page') {
        const title = act.title || 'Untitled';
        const initialBlocks = typeof act.content === 'string'
          ? markdownToBlocks(act.content)
          : (Array.isArray(act.content) ? act.content : []);

        let parentId: string | null = null;
        const folderName = (act.folderTitle || act.targetFolderTitle || '').toLowerCase().trim();
        if (folderName && createdFolders[folderName]) {
          parentId = createdFolders[folderName];
        }

        const newPage = await createPage({
          title,
          icon: act.icon || '📝',
          content: initialBlocks,
          parent_id: parentId,
        });
        allPages.push(newPage);
        executedSummaries.push(`📄 Created resource "${title}"`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studymate-page-created', { detail: { pageId: newPage.id } }));
          window.dispatchEvent(new CustomEvent('studymate-select-resource-page', { detail: { pageId: newPage.id } }));
        }
      }

      // 3. EDIT / MODIFY PAGE CONTENT
      else if (
        actType === 'edit_page' || 
        actType === 'modify_page' || 
        actType === 'update_page_content' || 
        actType === 'append_to_page' || 
        actType === 'append_page'
      ) {
        const targetPage = findPage(act.pageId, act.pageTitle || act.title);
        if (targetPage && act.content) {
          const newBlocks = typeof act.content === 'string'
            ? markdownToBlocks(act.content)
            : (Array.isArray(act.content) ? act.content : []);

          const isAppend = act.mode === 'append' || actType.includes('append');
          let updatedContent: Block[] = newBlocks;
          if (isAppend && Array.isArray(targetPage.content) && targetPage.content.length > 0) {
            updatedContent = [...targetPage.content, ...newBlocks];
          }

          const updated = await updatePage(targetPage.id, { content: updatedContent });
          const index = allPages.findIndex((p) => p.id === targetPage.id);
          if (index !== -1) allPages[index] = updated;

          executedSummaries.push(`✏️ Modified content in "${targetPage.title}" (${newBlocks.length} blocks)`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studymate-page-updated', { detail: { pageId: targetPage.id } }));
            window.dispatchEvent(new CustomEvent('studymate-select-resource-page', { detail: { pageId: targetPage.id } }));
          }
        } else if (!targetPage && act.content) {
          // If page didn't exist, create it so user request is fulfilled
          const newBlocks = typeof act.content === 'string'
            ? markdownToBlocks(act.content)
            : (Array.isArray(act.content) ? act.content : []);
          const title = (act.pageTitle || act.title || 'New Notes').replace(/^["'`]|["'`]$/g, '').trim();
          const newPage = await createPage({
            title,
            icon: '📝',
            content: newBlocks,
            parent_id: null,
          });
          allPages.push(newPage);
          executedSummaries.push(`📄 Created resource "${newPage.title}" (${newBlocks.length} blocks)`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studymate-page-created', { detail: { pageId: newPage.id } }));
            window.dispatchEvent(new CustomEvent('studymate-select-resource-page', { detail: { pageId: newPage.id } }));
          }
        }
      }

      // 4. RENAME PAGE OR FOLDER
      else if (actType === 'update_page_title' || actType === 'rename_page' || actType === 'rename_resource') {
        const targetPage = findPage(act.pageId, act.oldTitle || act.pageTitle);
        const newTitle = act.newTitle || act.title;
        if (targetPage && newTitle) {
          const updated = await updatePage(targetPage.id, { title: newTitle });
          const index = allPages.findIndex((p) => p.id === targetPage.id);
          if (index !== -1) allPages[index] = updated;

          executedSummaries.push(`📝 Renamed "${targetPage.title}" to "${newTitle}"`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studymate-page-updated', { detail: { pageId: targetPage.id } }));
          }
        }
      }

      // 5. DELETE PAGE OR FOLDER
      else if (
        actType === 'delete_page' || 
        actType === 'delete_resource' || 
        actType === 'remove_page' || 
        actType === 'remove_resource'
      ) {
        const targetPage = findPage(act.pageId, act.pageTitle || act.title);
        if (targetPage) {
          await deletePage(targetPage.id);
          allPages = allPages.filter((p) => p.id !== targetPage.id);
          executedSummaries.push(`🗑️ Deleted resource "${targetPage.title}"`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studymate-page-deleted', { detail: { pageId: targetPage.id } }));
          }
        }
      }

      // 6. MOVE PAGE
      else if (actType === 'move_page' || actType === 'move_resource') {
        const targetPage = findPage(act.pageId, act.pageTitle);
        const targetFolderTitle = (act.folderTitle || act.targetFolderTitle || '').toLowerCase().trim();
        let targetFolderId = act.targetFolderId || act.folderId || createdFolders[targetFolderTitle];

        if (!targetFolderId && targetFolderTitle) {
          const folder = await createPage({
            title: act.folderTitle || act.targetFolderTitle || 'New Folder',
            icon: '📁',
            parent_id: null,
          });
          targetFolderId = folder.id;
          createdFolders[targetFolderTitle] = folder.id;
          allPages.push(folder);
          executedSummaries.push(`📁 Created folder "${folder.title}"`);
        }

        if (targetPage && targetFolderId) {
          await movePage(targetPage.id, targetFolderId, 0);
          executedSummaries.push(`📂 Moved "${targetPage.title}" into folder`);
        }
      }

      // 7. COPY FROM VAULT TO RESOURCES
      else if (actType === 'copy_vault_to_resource' || actType === 'copy_vault') {
        const vaultId = act.vaultId;
        const vaultTitle = (act.vaultTitle || act.title || '').toLowerCase().trim();

        const item = studyMaterials.find((m) => m.id === vaultId || (vaultTitle && m.title.toLowerCase().includes(vaultTitle)))
          || flashcards.find((f) => f.id === vaultId || (vaultTitle && f.title?.toLowerCase().includes(vaultTitle)));

        if (item) {
          const newPage = await copyVaultItemToResources(item);
          allPages.push(newPage);
          executedSummaries.push(`📚 Copied "${newPage.title}" from Vault to Resources`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studymate-select-resource-page', { detail: { pageId: newPage.id } }));
          }
        }
      }

      // 8. DELETE FROM VAULT
      else if (actType === 'delete_vault_item' || actType === 'remove_vault_item' || actType === 'delete_vault') {
        const vaultId = act.vaultId;
        const vaultTitle = (act.vaultTitle || act.title || '').replace(/^["'`]|["'`]$/g, '').toLowerCase().trim();
        const mat = studyMaterials.find((m) => m.id === vaultId || (vaultTitle && m.title.toLowerCase().includes(vaultTitle)));
        if (mat) {
          localStore.deleteStudyMaterial(mat.id);
          executedSummaries.push(`🗑️ Deleted study material "${mat.title}" from Vault`);
        } else {
          const fc = flashcards.find((f) => f.id === vaultId || (vaultTitle && f.title?.toLowerCase().includes(vaultTitle)));
          if (fc) {
            localStore.deleteFlashcard(fc.id);
            executedSummaries.push(`🗑️ Deleted flashcard "${fc.title || 'Flashcard'}" from Vault`);
          }
        }
      }
    } catch (err) {
      console.error('Error executing agent action:', err);
    }
  }

  // Invalidate React Query & dispatch cross-component events
  if (executedSummaries.length > 0) {
    if (queryClient) {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studymate-resources-updated'));
      window.dispatchEvent(new CustomEvent('studymate-page-created'));
      window.dispatchEvent(new CustomEvent('studymate-page-updated'));
      window.dispatchEvent(new CustomEvent('studymate-page-deleted'));
    }
  }

  return executedSummaries;
}
