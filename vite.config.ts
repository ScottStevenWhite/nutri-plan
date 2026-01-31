import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT:
// The USDA FoodData Central API is hosted on api.nal.usda.gov.
// Browser apps often hit CORS restrictions when calling third-party APIs directly.
// This Vite dev proxy lets you call it locally via "/fdc/*" in development:
//   fetch("/fdc/v1/foods/search?api_key=...&query=banana")
//
// For production deployments, you will need your own reverse proxy or backend
// that forwards "/fdc" to "https://api.nal.usda.gov/fdc".
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fdc': {
        target: 'https://api.nal.usda.gov/fdc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fdc/, ''),
      },
    },
  },
})
