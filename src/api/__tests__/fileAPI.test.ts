import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uploadFile, getFile, deleteFile } from '../fileAPI';
import { supabase } from '@/integrations/supabase/client';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('File API', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockFileMetadata = {
    id: 'file-123',
    page_id: 'page-123',
    user_id: 'user-123',
    filename: 'test.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    storage_path: 'user-123/page-123/123456_test.pdf',
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

  describe('uploadFile', () => {
    it('uploads a valid PDF file', async () => {
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });

      // Mock storage upload
      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'user-123/page-123/123456_test.pdf' },
          error: null,
        }),
      });
      vi.mocked(supabase.storage.from).mockImplementation(mockStorageFrom);

      // Mock database insert
      const mockDbFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockFileMetadata,
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const result = await uploadFile(file, 'page-123');

      expect(result.filename).toBe('test.pdf');
      expect(result.file_type).toBe('application/pdf');
      expect(mockStorageFrom).toHaveBeenCalledWith('files');
    });

    it('rejects file larger than 10MB', async () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });

      await expect(uploadFile(largeFile, 'page-123')).rejects.toThrow(
        'File size must be less than 10MB'
      );
    });

    it('rejects unsupported file type', async () => {
      const invalidFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      });

      await expect(uploadFile(invalidFile, 'page-123')).rejects.toThrow(
        'File type not supported'
      );
    });

    it('accepts DOCX file', async () => {
      const file = new File(['test content'], 'document.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'user-123/page-123/123456_document.docx' },
          error: null,
        }),
      });
      vi.mocked(supabase.storage.from).mockImplementation(mockStorageFrom);

      const mockDbFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockFileMetadata, filename: 'document.docx' },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const result = await uploadFile(file, 'page-123');
      expect(result.filename).toBe('document.docx');
    });

    it('accepts image files', async () => {
      const file = new File(['image data'], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const mockStorageFrom = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'user-123/page-123/123456_photo.jpg' },
          error: null,
        }),
      });
      vi.mocked(supabase.storage.from).mockImplementation(mockStorageFrom);

      const mockDbFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockFileMetadata, filename: 'photo.jpg', file_type: 'image/jpeg' },
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      const result = await uploadFile(file, 'page-123');
      expect(result.filename).toBe('photo.jpg');
    });

    it('throws error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      await expect(uploadFile(file, 'page-123')).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('getFile', () => {
    it('downloads a file by ID', async () => {
      const mockBlob = new Blob(['file content'], { type: 'application/pdf' });

      // Mock database query
      const mockDbFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockFileMetadata,
              error: null,
            }),
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbFrom);

      // Mock storage download
      const mockStorageFrom = vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({
          data: mockBlob,
          error: null,
        }),
      });
      vi.mocked(supabase.storage.from).mockImplementation(mockStorageFrom);

      const result = await getFile('file-123');

      expect(result).toBeInstanceOf(Blob);
      expect(mockStorageFrom).toHaveBeenCalledWith('files');
    });

    it('throws error when file not found', async () => {
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

      await expect(getFile('nonexistent')).rejects.toThrow(
        'Failed to get file metadata'
      );
    });
  });

  describe('deleteFile', () => {
    it('deletes file from storage and database', async () => {
      // Mock database query for metadata
      const mockDbSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockFileMetadata,
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });
      vi.mocked(supabase.from).mockImplementation(mockDbSelect);

      // Mock storage delete
      const mockStorageFrom = vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({
          error: null,
        }),
      });
      vi.mocked(supabase.storage.from).mockImplementation(mockStorageFrom);

      await deleteFile('file-123');

      expect(mockStorageFrom).toHaveBeenCalledWith('files');
    });

    it('throws error when file not found', async () => {
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

      await expect(deleteFile('nonexistent')).rejects.toThrow(
        'Failed to get file metadata'
      );
    });
  });
});
