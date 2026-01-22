import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3 Client Configuration
 * Supports: AWS S3, MinIO, Viettel Cloud Storage, FPT Object Storage
 */
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT, // Required for MinIO/Viettel/FPT
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Required for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'buyer-rmg-storage';

/**
 * Upload file to S3
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

/**
 * Get signed URL for file download (expires in 1 hour by default)
 */
export async function getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Generate file key based on type and company
 */
export function generateFileKey(
  type: 'document' | 'image' | 'attachment',
  filename: string,
  companyId?: string | null,
  userId?: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const extension = filename.split('.').pop();
  const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

  const prefix = companyId ? `companies/${companyId}` : 'public';
  const userPrefix = userId ? `users/${userId}` : '';

  return `${prefix}/${userPrefix}${type}/${timestamp}_${random}_${baseName}.${extension}`;
}

export { s3Client, BUCKET_NAME };


