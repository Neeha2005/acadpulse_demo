import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://localhost:8000'

const backendRoutes = [
  '/health',
  '/auth',
  '/notifications',
  '/courses',
  '/whatsapp',
  '/classroom',
  '/course-source-mappings',
  '/urgency',
  '/groq',
  '/classifier',
  '/gmail',
  '/onboarding',
  '/archives',
  '/chat',
  '/deadlines',
  '/extract-deadline',
  '/classify',
  '/messages',
  '/abbreviations',
  '/semester',
  '/demo',
  '/test',
]

const proxy = Object.fromEntries(
  backendRoutes.map((route) => [
    route,
    {
      target: BACKEND,
      changeOrigin: true,
      secure: false,
    },
  ])
)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    proxy,
  },
})
