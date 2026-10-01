import { Flashcard } from '@/hooks/useFlashcards';
import { StudyMaterial } from '@/hooks/useStudyMaterials';

export const localStore = {
  getFlashcards(): Flashcard[] {
    const data = localStorage.getItem('studymate-local-flashcards');
    return data ? JSON.parse(data) : [];
  },

  saveFlashcard(newFlashcard: Omit<Flashcard, 'id' | 'created_at' | 'updated_at' | 'mastery_level' | 'review_count' | 'last_reviewed' | 'next_review'>): Flashcard {
    const list = this.getFlashcards();
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
    const createdList = materials.map((m, idx) => ({
      ...m,
      id: `local-mat-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'local-dev-user-id',
    })) as StudyMaterial[];
    const updated = [...createdList, ...list];
    localStorage.setItem('studymate-local-materials', JSON.stringify(updated));
    return createdList;
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
