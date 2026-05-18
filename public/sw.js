self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Un simple listener fetch para que Chrome reconozca la PWA
self.addEventListener('fetch', (event) => {
  // No hacemos nada para no interferir con el caché dinámico de Next.js.
  // Solo con la presencia de este evento, habilitamos la opción "Instalar App".
})
