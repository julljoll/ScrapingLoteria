import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        animalitos: resolve(__dirname, 'animalitos.html'),
        tuazar: resolve(__dirname, 'tuazar.html')
      }
    }
  }
})
