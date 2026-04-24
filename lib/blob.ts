import { upload } from '@vercel/blob/client'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('BlobClient')

export async function uploadImage(
  file: File,
  onComplete?: (url: string) => void
): Promise<string> {
  try {
    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: '/api/blob',
    })

    if (onComplete) {
      onComplete(blob.url)
    }

    return blob.url
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error uploading image to Vercel Blob')
    throw new Error('Failed to upload image')
  }
}

export async function uploadMultipleImages(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<string[]> {
  try {
    let completed = 0;

    const uploadPromises = files.map(async (file) => {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob',
      })

      completed++;
      if (onProgress) {
        onProgress(Math.round((completed / files.length) * 100))
      }

      return blob.url
    })

    const urls = await Promise.all(uploadPromises)
    return urls
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error uploading images to Vercel Blob')
    throw new Error(error instanceof Error ? error.message : 'Failed to upload images')
  }
}

// Note: deleteImage is removed because Vercel Blob client SDK does not support deletion.
// Deletions must be performed via server actions or API routes using the server SDK.
