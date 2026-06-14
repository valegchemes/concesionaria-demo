import { upload } from '@vercel/blob/client'
import imageCompression from 'browser-image-compression'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/webp' as const,
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= 500 * 1024) {
    return file
  }
  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
    return compressed
  } catch (error) {
    console.warn('Image compression failed, uploading original:', error)
    return file
  }
}

export async function uploadImage(
  file: File,
  onComplete?: (url: string) => void
): Promise<string> {
  const compressedFile = await compressImage(file)
  const blob = await upload(compressedFile.name, compressedFile, {
    access: 'public',
    handleUploadUrl: '/api/blob',
  })
  if (onComplete) onComplete(blob.url)
  return blob.url
}

export async function uploadMultipleImages(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<string[]> {
  let completed = 0
  const compressedFiles = await Promise.all(files.map(compressImage))
  const urls = await Promise.all(
    compressedFiles.map(async (file) => {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob',
      })
      completed++
      if (onProgress) onProgress(Math.round((completed / files.length) * 100))
      return blob.url
    })
  )
  return urls
}
