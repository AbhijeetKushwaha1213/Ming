
import { useState, useEffect } from 'react';
import { Flashcard } from './useFlashcards';
import { StudySession } from './useStudySessions';

interface OfflineData {
  flashcards: Flashcard[];
  studySessions: StudySession[];
  lastSync: string;
}

export const useOfflineSupport = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline data from localStorage
    const stored = localStorage.getItem('studymate-offline-data');
    if (stored) {
      try {
        setOfflineData(JSON.parse(stored));
      } catch (error) {
        console.error('Error parsing offline data:', error);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveOfflineData = (data: Partial<OfflineData>) => {
    const currentData = offlineData || { flashcards: [], studySessions: [], lastSync: new Date().toISOString() };
    const newData = {
      ...currentData,
      ...data,
      lastSync: new Date().toISOString()
    };
    
    setOfflineData(newData);
    localStorage.setItem('studymate-offline-data', JSON.stringify(newData));
  };

  const clearOfflineData = () => {
    setOfflineData(null);
    localStorage.removeItem('studymate-offline-data');
  };

  return {
    isOnline,
    offlineData,
    saveOfflineData,
    clearOfflineData,
  };
};
