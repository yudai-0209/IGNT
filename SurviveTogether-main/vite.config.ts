import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
    return {
      base: './',
      server: {
        host: '0.0.0.0',
        port: 5173
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
