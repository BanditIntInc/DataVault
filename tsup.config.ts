import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'lib/index.ts',
    minio: 'lib/minio.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  outDir: 'dist/lib',
  external: ['express', 'ws', 'minio'],
  sourcemap: true,
});
