import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Zoom blocks the Home URL unless these OWASP headers are present. */
const zoomOwaspHeaders = {
  'Strict-Transport-Security': 'max-age=31536000;',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: https://*.zoom.us https://appssdk.zoom.us",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
  ].join('; '),
  'Referrer-Policy': 'same-origin',
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    headers: zoomOwaspHeaders,
    hmr: { overlay: false },
  },
  preview: {
    host: '0.0.0.0',
    headers: zoomOwaspHeaders,
  },
})
