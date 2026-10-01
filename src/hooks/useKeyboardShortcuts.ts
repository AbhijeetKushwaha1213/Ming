
import { useEffect } from 'react';

interface KeyboardShortcuts {
  onNavigate: (tab: string) => void;
  onQuickAction?: (action: string) => void;
}

export const useKeyboardShortcuts = ({ onNavigate, onQuickAction }: KeyboardShortcuts) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Handle navigation shortcuts (Alt + number)
      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            onNavigate('home');
            break;
          case '2':
            event.preventDefault();
            onNavigate('flashcards');
            break;
          case '3':
            event.preventDefault();
            onNavigate('ai-chat');
            break;
          case '4':
            event.preventDefault();
            onNavigate('achievements');
            break;
          case '5':
            event.preventDefault();
            onNavigate('resources');
            break;
          case 'g':
            event.preventDefault();
            onNavigate('generate');
            break;
          case 'a':
            event.preventDefault();
            onNavigate('achievements');
            break;
          case 's':
            event.preventDefault();
            onNavigate('settings');
            break;
        }
      }

      // Handle quick actions (Ctrl + key)
      if (event.ctrlKey && !event.altKey && !event.shiftKey && onQuickAction) {
        switch (event.key) {
          case 'n':
            event.preventDefault();
            onQuickAction('create-flashcard');
            break;
          case 'k':
            event.preventDefault();
            onQuickAction('search');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onNavigate, onQuickAction]);
};
