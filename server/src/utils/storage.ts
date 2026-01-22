import { uploadFile, getFileUrl, deleteFile, generateFileKey } from '../config/s3';
import { FastifyRequest } from 'fastify';

/**
 * Handle file upload from multipart form
 */
export async function handleFileUpload(
  request: FastifyRequest,
  type: 'document' | 'image' | 'attachment',
  companyId?: string | null,
  userId?: string
): Promise<{
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
}> {
  const data = await request.file();

  if (!data) {
    throw new Error('No file uploaded');
  }

  const buffer = await data.toBuffer();
  const filename = data.filename || 'unknown';
  const contentType = data.mimetype || 'application/octet-stream';

  // Generate S3 key
  const key = generateFileKey(type, filename, companyId, userId);

  // Upload to S3
  await uploadFile(key, buffer, contentType);

  // Get signed URL
  const url = await getFileUrl(key);

  return {
    key,
    url,
    filename,
    size: buffer.length,
    contentType,
  };
}

/**
 * Handle multiple file uploads
 */
export async function handleMultipleFileUpload(
  request: FastifyRequest,
  type: 'document' | 'image' | 'attachment',
  companyId?: string | null,
  userId?: string
): Promise<Array<{
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
}>> {
  const files = [];

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      const filename = part.filename || 'unknown';
      const contentType = part.mimetype || 'application/octet-stream';

      const key = generateFileKey(type, filename, companyId, userId);
      await uploadFile(key, buffer, contentType);
      const url = await getFileUrl(key);

      files.push({
        key,
        url,
        filename,
        size: buffer.length,
        contentType,
      });
    }
  }

  return files;
}

/**
 * Delete file by key
 */
export async function removeFile(key: string): Promise<void> {
  await deleteFile(key);
}

/**
 * Get file URL by key
 */
export async function getFileUrlByKey(key: string, expiresIn?: number): Promise<string> {
  return await getFileUrl(key, expiresIn);
}


