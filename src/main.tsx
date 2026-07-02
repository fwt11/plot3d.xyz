import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fade out and remove the splash shown by index.html once React has mounted.
// Triggered on the next frame so the first paint of <App /> starts before the
// fade begins — avoids a flash of empty content.
requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  splash.classList.add('is-hiding')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
})
