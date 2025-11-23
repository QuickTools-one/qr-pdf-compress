import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'workers/compression.worker': resolve(__dirname, 'src/workers/compression.worker.ts'),
        'workers/merge.worker': resolve(__dirname, 'src/workers/merge.worker.ts'),
      },
      name: 'QRPDFCompress',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['pdf-lib'],
      output: {
        globals: {
          'pdf-lib': 'PDFLib',
        },
      },
    },
    sourcemap: true,
    target: 'es2020',
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  worker: {
    format: 'es',
  },
});
