/**
 * Utility for cross-tab and cross-feature navigation within StudyMate.
 * Allows buttons/links in any component (such as daily study plan activities)
 * to navigate directly to Assessment Studio, Flashcard Vault, AI Chat, or Resources.
 */

export interface NavigationTarget {
  tab: 'home' | 'flashcards' | 'ai' | 'achievements' | 'resources' | 'settings' | 'integrations' | 'ai-generator';
  subtab?: 'assessment' | 'generate' | 'dag' | 'vault' | string;
  topic?: string;
  sourceId?: string;
  initialMessage?: string;
}

export const navigateToTab = (
  tab: NavigationTarget['tab'],
  subtab?: string,
  params?: Record<string, any>
) => {
  if (typeof window === 'undefined') return;

  const targetTab = tab === 'ai-generator' ? 'flashcards' : tab;

  // Persist requested subtab so target component picks it up immediately
  if (subtab) {
    localStorage.setItem('studymate-active-material-tab', subtab);
  }

  if (params?.topic) {
    localStorage.setItem('studymate-assessment-prefill-topic', params.topic);
  }

  // Dispatch custom navigation events for reactive components
  window.dispatchEvent(
    new CustomEvent('studymate-navigate', {
      detail: {
        tab: targetTab,
        subtab,
        params,
      },
    })
  );

  if (subtab) {
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('studymate-subtab', {
          detail: { subtab, params },
        })
      );
    }, 50);
  }
};
