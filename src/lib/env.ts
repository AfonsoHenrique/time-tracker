export type AppEnv = 'prod' | 'hml'

export const APP_ENV: AppEnv = import.meta.env.VITE_APP_ENV === 'hml' ? 'hml' : 'prod'

export const IS_HML = APP_ENV === 'hml'

/**
 * Nome do banco IndexedDB. Produção e homologação ficam na mesma origem
 * (afonsohenrique.github.io), e o IndexedDB é separado por origem, não por caminho.
 * Por isso cada ambiente usa um nome de banco próprio.
 */
export const DB_NAME = IS_HML ? 'ponto-hml' : 'ponto'
