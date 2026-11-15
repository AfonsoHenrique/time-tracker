import { defineConfig } from 'vitest/config'

// Testes que precisam dos emuladores do Firebase (`npm run test:rules`): regras do Firestore
// e a sincronização de ponta a ponta.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firebase/**/*.test.ts'],
    testTimeout: 20_000,
    // Os arquivos usam o mesmo emulador: um por vez.
    fileParallelism: false,
  },
})
