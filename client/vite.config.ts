import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5174,


    cors: false,
    proxy: {
      '/api': 'http://localhost:3050',

      '/f/': 'http://localhost:3050',
      '/s/': 'http://localhost:3050',
      '/t/': 'http://localhost:3050',
      '/socket.io': {
        target: 'http://localhost:3050',
        ws: true,
      },
    },
  },
})
