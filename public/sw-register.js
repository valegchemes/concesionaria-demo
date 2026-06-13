// Service Worker registration
// Archivo externo para cumplir con CSP (Content-Security-Policy) sin nonces
;(function() {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function(err) {
        console.warn('Service Worker registration failed:', err);
      });
    });
  }
})();
