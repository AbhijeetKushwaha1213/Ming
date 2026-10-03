import { Flashcard } from '@/hooks/useFlashcards';
import { StudyMaterial } from '@/hooks/useStudyMaterials';

export const localStore = {
  getFlashcards(): Flashcard[] {
    const data = localStorage.getItem('studymate-local-flashcards');
    return data ? JSON.parse(data) : [];
  },

  saveFlashcard(newFlashcard: Omit<Flashcard, 'id' | 'created_at' | 'updated_at' | 'mastery_level' | 'review_count' | 'last_reviewed' | 'next_review'>): Flashcard {
    const list = this.getFlashcards();
    const normTitle = (newFlashcard.title || '').trim().toLowerCase();
    const normQ = (newFlashcard.question || '').trim().toLowerCase();
    const existingIdx = list.findIndex(fc => 
      (fc.title || '').trim().toLowerCase() === normTitle &&
      (fc.question || '').trim().toLowerCase() === normQ
    );
    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...newFlashcard,
        updated_at: new Date().toISOString(),
      } as Flashcard;
      localStorage.setItem('studymate-local-flashcards', JSON.stringify(list));
      return list[existingIdx];
    }

    const created: Flashcard = {
      ...newFlashcard,
      id: `local-fc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      mastery_level: 0,
      review_count: 0,
      last_reviewed: null,
      next_review: new Date().toISOString(),
    };
    list.unshift(created);
    localStorage.setItem('studymate-local-flashcards', JSON.stringify(list));
    return created;
  },

  updateFlashcard(id: string, updates: Partial<Flashcard>): Flashcard {
    const list = this.getFlashcards();
    const idx = list.findIndex(fc => fc.id === id);
    if (idx === -1) throw new Error('Flashcard not found');
    list[idx] = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    } as Flashcard;
    localStorage.setItem('studymate-local-flashcards', JSON.stringify(list));
    return list[idx];
  },

  deleteFlashcard(id: string): void {
    const list = this.getFlashcards();
    const filtered = list.filter(fc => fc.id !== id);
    localStorage.setItem('studymate-local-flashcards', JSON.stringify(filtered));
  },

  getStudyMaterials(type?: string): StudyMaterial[] {
    const data = localStorage.getItem('studymate-local-materials');
    const list: StudyMaterial[] = data ? JSON.parse(data) : [];
    if (type) {
      return list.filter(m => m.type === type);
    }
    return list;
  },

  saveStudyMaterial(newMaterial: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at' | 'user_id'>): StudyMaterial {
    const list = this.getStudyMaterials();
    const normTitle = (newMaterial.title || '').trim().toLowerCase();
    const normType = (newMaterial.type || '').toLowerCase();
    const existingIdx = list.findIndex(m => 
      (m.title || '').trim().toLowerCase() === normTitle && 
      (m.type || '').toLowerCase() === normType
    );
    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...newMaterial,
        updated_at: new Date().toISOString(),
      } as StudyMaterial;
      localStorage.setItem('studymate-local-materials', JSON.stringify(list));
      return list[existingIdx];
    }

    const created: StudyMaterial = {
      ...newMaterial,
      id: `local-mat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'local-dev-user-id',
    } as StudyMaterial;
    list.unshift(created);
    localStorage.setItem('studymate-local-materials', JSON.stringify(list));
    return created;
  },

  updateStudyMaterial(id: string, updates: Partial<StudyMaterial>): StudyMaterial {
    const list = this.getStudyMaterials();
    const idx = list.findIndex(m => m.id === id);
    if (idx === -1) throw new Error('Study material not found');
    list[idx] = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    } as StudyMaterial;
    localStorage.setItem('studymate-local-materials', JSON.stringify(list));
    return list[idx];
  },

  deleteStudyMaterial(id: string): void {
    const list = this.getStudyMaterials();
    const filtered = list.filter(m => m.id !== id);
    localStorage.setItem('studymate-local-materials', JSON.stringify(filtered));
  },

  saveMultipleStudyMaterials(materials: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at' | 'user_id'>[]): StudyMaterial[] {
    const list = this.getStudyMaterials();
    const result: StudyMaterial[] = [];
    materials.forEach((m, idx) => {
      const normTitle = (m.title || '').trim().toLowerCase();
      const normType = (m.type || '').toLowerCase();
      const existingIdx = list.findIndex(existing => 
        (existing.title || '').trim().toLowerCase() === normTitle && 
        (existing.type || '').toLowerCase() === normType
      );
      if (existingIdx !== -1) {
        list[existingIdx] = {
          ...list[existingIdx],
          ...m,
          updated_at: new Date().toISOString(),
        } as StudyMaterial;
        result.push(list[existingIdx]);
      } else {
        const created: StudyMaterial = {
          ...m,
          id: `local-mat-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: 'local-dev-user-id',
        } as StudyMaterial;
        list.unshift(created);
        result.push(created);
      }
    });
    localStorage.setItem('studymate-local-materials', JSON.stringify(list));
    return result;
  },

  getSkills(): any[] {
    const data = localStorage.getItem('studymate-local-skills');
    return data ? JSON.parse(data) : [];
  },

  saveSkill(newSkill: { skill: string; category: string; progress?: number }): any {
    const list = this.getSkills();
    const created = {
      ...newSkill,
      id: `local-skill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'local-dev-user-id',
      progress: newSkill.progress || 0,
    };
    list.unshift(created);
    localStorage.setItem('studymate-local-skills', JSON.stringify(list));
    return created;
  },

  updateSkill(id: string, updates: any): any {
    const list = this.getSkills();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Skill not found');
    list[idx] = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem('studymate-local-skills', JSON.stringify(list));
    return list[idx];
  },

  deleteSkill(id: string): void {
    const list = this.getSkills();
    const filtered = list.filter(s => s.id !== id);
    localStorage.setItem('studymate-local-skills', JSON.stringify(filtered));
  }
};
