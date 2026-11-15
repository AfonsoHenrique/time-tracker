export type AppEnv = 'prod' | 'hml'

// Compara direto com `import.meta.env`, que o Vite troca por texto no build: na produção a
// conta vira `false` e o minificador tira do bundle tudo o que depende do modo demo.
export const IS_HML = import.meta.env.VITE_APP_ENV === 'hml'

export const APP_ENV: AppEnv = IS_HML ? 'hml' : 'prod'

/** Chave do `localStorage` que liga o modo demo da homologação (spec 010). */
export const DEMO_FLAG_KEY = 'ponto-hml:demo'

/** Banco dos dados fictícios do modo demo. Fica separado do banco real da homologação. */
export const DEMO_DB_NAME = 'ponto-hml-demo'

function readDemoFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

/** Modo demo ligado. Só existe na homologação; na produção é sempre `false`. */
export const IS_DEMO = import.meta.env.VITE_APP_ENV === 'hml' && readDemoFlag()

/**
 * Nome do banco IndexedDB. Produção e homologação ficam na mesma origem
 * (afonsohenrique.github.io), e o IndexedDB é separado por origem, não por caminho.
 * Por isso cada ambiente usa um nome de banco próprio, e o modo demo usa outro.
 */
export const DB_NAME = import.meta.env.VITE_APP_ENV === 'hml' ? (IS_DEMO ? DEMO_DB_NAME : 'ponto-hml') : 'ponto'
