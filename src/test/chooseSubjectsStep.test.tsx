import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ChooseSubjectsStep,
  getContextualSubjects,
  CONTEXTUAL_SUBJECT_CATALOG,
  EXAM_SUBJECT_CATALOG,
} from '@/components/onboarding/ChooseSubjectsStep';

describe('ChooseSubjectsStep and Contextual Subject System', () => {
  it('correctly retrieves contextual subjects for College Computer Science semester 4', () => {
    const { recommended, all } = getContextualSubjects({
      learningMode: 'college',
      degree: 'B.Tech / B.E.',
      course: 'BTech (Computer Science)',
      semester: 4,
    });

    // Sem 4 should include OS, DBMS, TOC, CN, DAA
    const names = recommended.map((s) => s.name);
    expect(names).toContain('Operating Systems');
    expect(names).toContain('Database Management Systems');
    expect(names).toContain('Theory of Computation');
    expect(names).toContain('Computer Networks');

    // Should include codes and abbreviations
    const os = recommended.find((s) => s.name === 'Operating Systems');
    expect(os?.code).toBe('CS401');
    expect(os?.abbreviation).toBe('OS');
    expect(os?.tags).toContain('deadlocks');
  });

  it('correctly retrieves contextual subjects for Competitive Exam (NEET)', () => {
    const { recommended } = getContextualSubjects({
      learningMode: 'exam',
      examType: 'NEET (Medical)',
      targetYear: '2026',
    });

    const names = recommended.map((s) => s.name);
    expect(names.some((n) => n.includes('Human Physiology'))).toBe(true);
    expect(names.some((n) => n.includes('Genetics'))).toBe(true);
  });

  it('renders Choose Your Subjects step with title, subtitle, and dynamic contextual badge', () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        degree="B.Tech"
        course="BTech (Computer Science)"
        semester="4"
        university="VTU"
        college="IIT Delhi"
        selectedSubjects={[]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Choose Your Subjects')).toBeDefined();
    expect(
      screen.getByText(
        'Select the subjects you want to study. You can change this later from your settings.'
      )
    ).toBeDefined();
    expect(screen.getByText('How many subjects are you studying?')).toBeDefined();

    // Context badge should show course and college/university
    expect(screen.getByText(/AI Catalog Tailored for:/i)).toBeDefined();
  });

  it('controls slot count with stepper and quick buttons', () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        course="BTech (Computer Science)"
        semester="4"
        selectedSubjects={[]}
        onChange={onChange}
      />
    );

    // Initial default count is 6
    const input = screen.getByLabelText('Subject count input') as HTMLInputElement;
    expect(input.value).toBe('6');

    // Should render 6 slots initially
    expect(screen.getByText('Subject 1')).toBeDefined();
    expect(screen.getByText('Subject 6')).toBeDefined();
    expect(screen.queryByText('Subject 7')).toBeNull();

    // Click quick pill 8
    const button8 = screen.getByRole('button', { name: '8' });
    fireEvent.click(button8);

    expect(input.value).toBe('8');
    expect(screen.getByText('Subject 8')).toBeDefined();
  });

  it('shows search dropdown and allows selecting a contextual subject', async () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        course="BTech (Computer Science)"
        semester="4"
        selectedSubjects={[]}
        onChange={onChange}
      />
    );

    // Click dropdown trigger for Subject 1
    const triggers = screen.getAllByRole('button', { name: /Search or select a subject/i });
    expect(triggers.length).toBeGreaterThan(0);
    fireEvent.click(triggers[0]);

    // Search input should appear with prompt placeholder
    const searchInput = screen.getByPlaceholderText('🔍 Search subjects...');
    expect(searchInput).toBeDefined();

    // Search for OS
    fireEvent.change(searchInput, { target: { value: 'Operating Systems' } });

    // Click Operating Systems
    const osOption = screen.getByRole('button', { name: /Operating Systems/i });
    fireEvent.click(osOption);

    // Slot 1 should now reflect selection and notify onChange
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['Operating Systems']));
    });
  });

  it('prevents selecting the same subject twice (deduplication)', async () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        course="BTech (Computer Science)"
        semester="4"
        selectedSubjects={['Operating Systems']}
        onChange={onChange}
      />
    );

    // Open dropdown for Subject 2
    const triggers = screen.getAllByRole('button', { name: /Search or select a subject/i });
    fireEvent.click(triggers[0]);

    // In Subject 2 dropdown, "Operating Systems" should be disabled or marked Selected
    const osButtons = screen.getAllByRole('button', { name: /Operating Systems/i });
    const disabledOption = osButtons.find((btn) => btn.hasAttribute('disabled'));
    expect(disabledOption).toBeDefined();
  });

  it('allows adding a custom subject with optional subject code', async () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        course="BTech (Computer Science)"
        semester="4"
        selectedSubjects={[]}
        onChange={onChange}
      />
    );

    // Open dropdown for slot 1
    const triggers = screen.getAllByRole('button', { name: /Search or select a subject/i });
    fireEvent.click(triggers[0]);

    // Click "+ Add custom subject"
    const addCustomBtn = screen.getByRole('button', { name: /\+ Add custom subject/i });
    fireEvent.click(addCustomBtn);

    // Form inputs should appear
    expect(screen.getByText('Enter subject name')).toBeDefined();
    expect(screen.getByText('Subject code (optional)')).toBeDefined();

    const nameInput = screen.getByPlaceholderText('e.g. Operating Systems');
    const codeInput = screen.getByPlaceholderText('e.g. CS401');

    fireEvent.change(nameInput, { target: { value: 'Distributed Ledgers' } });
    fireEvent.change(codeInput, { target: { value: 'BC101' } });

    const submitBtn = screen.getByRole('button', { name: 'Add Subject' });
    fireEvent.click(submitBtn);

    // Should notify onChange with the custom subject
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.arrayContaining(['Distributed Ledgers (BC101)'])
      );
    });
  });

  it('prompts user with warning if reducing subject count removes an active selection', async () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        course="BTech (Computer Science)"
        semester="4"
        selectedSubjects={[
          'Subject One',
          'Subject Two',
          'Subject Three',
          'Subject Four',
          'Subject Five',
          'Subject Six',
        ]}
        onChange={onChange}
      />
    );

    // Try to reduce count from 6 to 5
    const minusBtn = screen.getByLabelText('Decrease subject count');
    fireEvent.click(minusBtn);

    // Confirmation warning must appear
    expect(screen.getByText(/Reducing from 6 to 5 will remove previously selected subjects/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm & Remove' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Count should still be 6 and all 6 remain intact
    expect(screen.queryByText(/Reducing from 6 to 5/i)).toBeNull();
    const input = screen.getByLabelText('Subject count input') as HTMLInputElement;
    expect(input.value).toBe('6');
  });

  it('allows clearing a slot', async () => {
    const onChange = vi.fn();
    render(
      <ChooseSubjectsStep
        learningMode="college"
        course="BTech (Computer Science)"
        semester="4"
        selectedSubjects={['Operating Systems']}
        onChange={onChange}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearBtn);

    // Should clear the slot
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });
});
