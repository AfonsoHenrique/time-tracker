/**
 * Configuração web do projeto Firebase (spec 008). Estes valores são públicos por natureza:
 * vão para o navegador de qualquer um que abra o app. Quem protege os dados são as regras do
 * Firestore (`firebase/firestore.rules`) e os domínios autorizados no Firebase Auth.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBX_nlZBjtcHRwLjT_BBCJf0Ae4iIGkmiY',
  authDomain: 'hofficetimetracker.firebaseapp.com',
  projectId: 'hofficetimetracker',
  storageBucket: 'hofficetimetracker.firebasestorage.app',
  messagingSenderId: '603347902557',
  appId: '1:603347902557:web:efcf55264bef34f1082db4',
} as const
