// src/lib/api/storage.ts
// PENORA Blockchain — Creator Media & Image Storage Service
// Handles upload, validation, and public URL generation for profile avatars and cover banners.
import { supabase } from '../supabaseClient';
import { penoraKeyAuth } from '../auth/penoraKeyAuth';

export interface StorageUploadResult {
  publicUrl: string | null;
  path: string | null;
  error: string | null;
  isPendingBucket?: boolean;
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type "${file.type}". Allowed formats are JPEG, PNG, WebP, and GIF.`,
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 5.0 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Uploads an avatar or cover banner image to the Supabase 'creator-media' bucket.
 * Files are isolated by userId in the path: `${userId}/${category}-${timestamp}.${extension}`
 */
export async function uploadCreatorMedia(
  file: File,
  category: 'avatar' | 'cover'
): Promise<StorageUploadResult> {
  // 1. Client-side validation
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { publicUrl: null, path: null, error: validation.error || 'Validation failed.' };
  }

  // 2. Auth identity enforcement
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;
  const keyUser = penoraKeyAuth.getCurrentUser();
  const activeUserId = sessionUser?.id || keyUser?.id;

  if (!activeUserId) {
    return {
      publicUrl: null,
      path: null,
      error: 'Authentication required: You must be signed in to upload creator media.',
    };
  }

  // 3. Generate sanitized unique path
  const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'image/png' ? 'png' : 'jpg');
  const sanitizedExt = ext.replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now();
  const objectPath = `${activeUserId}/${category}-${timestamp}.${sanitizedExt}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('creator-media')
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      const isPending =
        uploadError.message.includes('bucket not found') ||
        uploadError.message.includes('not found') ||
        uploadError.message.includes('Bucket') ||
        (uploadError as any).statusCode === 404;

      return {
        publicUrl: null,
        path: null,
        error: isPending
          ? 'Storage bucket "creator-media" has not been initialized on the database yet. Staged migration 0003 is required.'
          : uploadError.message,
        isPendingBucket: isPending,
      };
    }

    // 4. Retrieve public URL
    const { data: urlData } = supabase.storage
      .from('creator-media')
      .getPublicUrl(objectPath);

    return {
      publicUrl: urlData.publicUrl,
      path: objectPath,
      error: null,
    };
  } catch (err: any) {
    return {
      publicUrl: null,
      path: null,
      error: err.message || 'Unexpected failure uploading media.',
    };
  }
}
