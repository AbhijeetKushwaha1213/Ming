import { supabase } from '@/integrations/supabase/client';
import type { FileMetadata } from '@/types/notion';

/**
 * File API - File upload, download, and management operations
 */

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
];

const STORAGE_BUCKET = 'files';

/**
 * Validate file size
 */
function validateFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
}

/**
 * Validate file type
 */
function validateFileType(file: File): void {
  // Check MIME type
  const isValidMimeType = ALLOWED_FILE_TYPES.includes(file.type);
  
  // Check file extension as fallback
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
  
  if (!isValidMimeType && !isValidExtension) {
    throw new Error(
      `File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
  }
}

/**
 * Upload a file to Supabase Storage and store metadata
 */
export async function uploadFile(
  file: File,
  pageId: string
): Promise<FileMetadata> {
  // Validate file size
  validateFileSize(file);
  
  // Validate file type
  validateFileType(file);
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }
  
  // Generate unique file path
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${user.id}/${pageId}/${timestamp}_${sanitizedFilename}`;
  
  // Upload file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }
  
  // Store file metadata in database
  const fileMetadata = {
    page_id: pageId,
    user_id: user.id,
    filename: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_path: uploadData.path,
  };
  
  const { data: metadata, error: metadataError } = await supabase
    .from('files')
    .insert(fileMetadata)
    .select()
    .single();
  
  if (metadataError) {
    // Clean up uploaded file if metadata insertion fails
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`Failed to store file metadata: ${metadataError.message}`);
  }
  
  return metadata as FileMetadata;
}

/**
 * Get a file blob from storage
 */
export async function getFile(id: string): Promise<Blob> {
  // Get file metadata
  const { data: metadata, error: metadataError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single();
  
  if (metadataError) {
    throw new Error(`Failed to get file metadata: ${metadataError.message}`);
  }
  
  if (!metadata) {
    throw new Error('File not found');
  }
  
  // Download file from storage
  const { data: blob, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(metadata.storage_path);
  
  if (downloadError) {
    throw new Error(`Failed to download file: ${downloadError.message}`);
  }
  
  if (!blob) {
    throw new Error('File not found in storage');
  }
  
  return blob;
}

/**
 * Delete a file and its metadata
 */
export async function deleteFile(id: string): Promise<void> {
  // Get file metadata to get storage path
  const { data: metadata, error: metadataError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .single();
  
  if (metadataError) {
    throw new Error(`Failed to get file metadata: ${metadataError.message}`);
  }
  
  if (!metadata) {
    throw new Error('File not found');
  }
  
  // Delete file from storage
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([metadata.storage_path]);
  
  if (storageError) {
    throw new Error(`Failed to delete file from storage: ${storageError.message}`);
  }
  
  // Delete file metadata from database
  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .eq('id', id);
  
  if (deleteError) {
    throw new Error(`Failed to delete file metadata: ${deleteError.message}`);
  }
}
