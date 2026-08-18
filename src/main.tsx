import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'
import { startZoomSdkConfig } from './zoom/zoomClient'

void startZoomSdkConfig()

function applyViewportHeight() {
  const h = window.innerHeight || document.documentElement.clientHeight || 640
  document.documentElement.style.setProperty('--app-h', `${h < 80 ? 640 : h}px`)
}
applyViewportHeight()
window.addEventListener('resize', applyViewportHeight)

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
