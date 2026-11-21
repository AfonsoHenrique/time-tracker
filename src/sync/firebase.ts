/**
 * Firebase Auth e Firestore lite (spec 008). Só é carregado com `import()` quando há login,
 * para o app de quem não entra não baixar o SDK (CA1).
 */
import { initializeApp } from 'firebase/app'
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  linkWithPopup,
  OAuthProvider,
  signInWithPopup,
  signOut,
  type AuthProvider,
  type User,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore/lite'
import { providerFromFirebaseId, type ProviderId } from '../lib/account'
import { APP_ENV } from '../lib/env'
import { FIREBASE_CONFIG } from '../lib/firebaseConfig'
import { createFirestoreRemote } from './firestoreRemote'
import type { RemoteStore } from './remote'

export interface AccountUser {
  uid: string
  name: string | null
  email: string | null
  providers: ProviderId[]
}

function toAccountUser(user: User): AccountUser {
  const providers = user.providerData
    .map((info) => providerFromFirebaseId(info.providerId))
    .filter((p): p is ProviderId => p !== null)
  return { uid: user.uid, name: user.displayName, email: user.email, providers }
}

function providerFor(id: ProviderId): AuthProvider {
  if (id === 'google') {
    const google = new GoogleAuthProvider()
    google.setCustomParameters({ prompt: 'select_account' })
    return google
  }
  // Microsoft: contas pessoais e de qualquer empresa (tenant "common").
  const microsoft = new OAuthProvider('microsoft.com')
  microsoft.setCustomParameters({ prompt: 'select_account' })
  return microsoft
}

export function createFirebase() {
  // Um app por ambiente: a sessão fica guardada pelo nome do app, e produção e homologação
  // estão na mesma origem.
  const app = initializeApp(FIREBASE_CONFIG, `ponto-${APP_ENV}`)
  const auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  })
  const firestore = getFirestore(app)

  return {
    /** O usuário da sessão guardada, depois de o Firebase ler a sessão (funciona offline). */
    async currentUser(): Promise<AccountUser | null> {
      await auth.authStateReady()
      return auth.currentUser ? toAccountUser(auth.currentUser) : null
    },

    /** Login por popup: o redirect não funciona fora do domínio do Firebase (ADR 0004). */
    async signIn(provider: ProviderId): Promise<AccountUser> {
      const { user } = await signInWithPopup(auth, providerFor(provider))
      return toAccountUser(user)
    },

    /** Vincula outro provedor à conta atual (R4). */
    async link(provider: ProviderId): Promise<AccountUser> {
      if (!auth.currentUser) throw Object.assign(new Error('Sem login.'), { code: 'auth/no-current-user' })
      const { user } = await linkWithPopup(auth.currentUser, providerFor(provider))
      await user.reload()
      return toAccountUser(auth.currentUser ?? user)
    },

    signOut: () => signOut(auth),

    remote: (uid: string): RemoteStore => createFirestoreRemote(firestore, uid, APP_ENV),
  }
}

export type FirebaseApi = ReturnType<typeof createFirebase>
