import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // 로컬 네트워크 및 스마트폰에서 접속 가능하도록 0.0.0.0 바인딩
    port: 5173,
  },
})
