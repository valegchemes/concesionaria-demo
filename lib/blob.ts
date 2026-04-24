import { upload } from '@vercel/blob/client'

export async function uploadImage(
  file: File,
  onComplete?: (url: string) => void
): Promise<string> {
  const blob = await upload(file.name, file, {
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
  const urls = await Promise.all(
    files.map(async (file) => {
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
