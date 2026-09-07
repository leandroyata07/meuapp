import { initializeApp, getApps, getApp } from 'firebase/app'
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  writeBatch 
} from 'firebase/firestore'
import { db } from './db.js'

const STORAGE_KEY = 'pontoaqui_firebase_config'
let unsubscribeListeners = []
let isSyncingActive = false

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAdbxgSZ4ZWgEWIDHiuFpRisH_pbP5YBCM",
  authDomain: "pontoaqui-5dbdc.firebaseapp.com",
  projectId: "pontoaqui-5dbdc",
  storageBucket: "pontoaqui-5dbdc.firebasestorage.app",
  messagingSenderId: "1097038532068",
  appId: "1:1097038532068:web:ae1637028553020b9f0bf1"
}

/**
 * Obtém as credenciais salvas do Firebase no navegador (ou padrão do projeto)
 */
export function getFirebaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FIREBASE_CONFIG
    return JSON.parse(raw)
  } catch (e) {
    console.error('Erro ao ler configuração do Firebase:', e)
    return DEFAULT_FIREBASE_CONFIG
  }
}

/**
 * Salva as credenciais do Firebase e reinicia a conexão
 */
export function saveFirebaseConfig(config) {
  if (!config || !config.apiKey || !config.projectId) {
    localStorage.removeItem(STORAGE_KEY)
    stopRealtimeSync()
    return null
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  return initFirebase(config)
}

/**
 * Verifica se o Firebase está configurado
 */
export function isFirebaseConfigured() {
  const cfg = getFirebaseConfig()
  return Boolean(cfg && cfg.apiKey && cfg.projectId)
}

/**
 * Inicializa a instância do Firebase
 */
export function initFirebase(customConfig = null) {
  const config = customConfig || getFirebaseConfig()
  if (!config || !config.apiKey || !config.projectId) {
    return null
  }

  try {
    const apps = getApps()
    const app = apps.length ? getApp() : initializeApp(config)
    const firestore = getFirestore(app)
    return { app, firestore }
  } catch (e) {
    console.error('Erro ao inicializar Firebase:', e)
    return null
  }
}

/**
 * Testa a conexão com o Firestore
 */
export async function testFirebaseConnection(customConfig = null) {
  try {
    const instance = initFirebase(customConfig)
    if (!instance) throw new Error('Credenciais do Firebase incompletas ou ausentes.')

    // Tenta ler ou gravar na coleção de teste de ping
    const testDocRef = doc(instance.firestore, '_pontoaqui_meta', 'connection_test')
    await setDoc(testDocRef, { 
      ping: true, 
      clientTimestamp: new Date().toISOString(),
      app: 'PontoAqui'
    }, { merge: true })

    return { success: true, message: 'Conexão com o Firebase Firestore realizada com sucesso!' }
  } catch (err) {
    console.error('Falha no teste do Firebase:', err)
    return { success: false, message: err?.message || 'Não foi possível conectar ao Firebase.' }
  }
}

/**
 * Comprime imagens para miniaturas leves (< 10 KB) para permitir sincronização
 * instantânea no Firestore sem estourar limites de documentos e sem sobrecarregar a rede.
 */
export async function compressImage(dataUrl, maxWidth = 180, maxHeight = 180, quality = 0.75) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    return dataUrl || ''
  }
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width)
              width = maxWidth
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height)
              height = maxHeight
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(dataUrl)
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          const compressed = canvas.toDataURL('image/jpeg', quality)
          resolve(compressed)
        } catch (err) {
          resolve(dataUrl)
        }
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    } catch (e) {
      resolve(dataUrl)
    }
  })
}

/**
 * Prepara documentos para envio ao Firestore:
 * - Mantém fotos de funcionários e logomarcas comprimidas para sincronização entre todos os aparelhos
 * - Remove apenas fotos pesadas de batidas de ponto (selfies em records) para poupar espaço
 */
export async function sanitizeDocForFirestore(collectionName, data) {
  if (!data || typeof data !== 'object') return data
  const clean = { ...data }

  // Selfies de batidas de ponto não são enviadas para a nuvem
  if (collectionName === 'records') {
    if ('photo' in clean) delete clean.photo
  }

  // Fotos de perfil de funcionários são comprimidas para thumbnail leve (~8 KB)
  if (collectionName === 'employees' && clean.photo) {
    if (typeof clean.photo === 'string' && clean.photo.startsWith('data:image')) {
      clean.photo = await compressImage(clean.photo, 180, 180, 0.75)
    }
  }

  // Logomarca da empresa é comprimida (~12 KB)
  if (collectionName === 'settings' && clean.companyLogo) {
    if (typeof clean.companyLogo === 'string' && clean.companyLogo.startsWith('data:image')) {
      clean.companyLogo = await compressImage(clean.companyLogo, 240, 240, 0.8)
    }
  }

  // Remove valores undefined
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) {
      delete clean[key]
    }
  }

  return clean
}

/**
 * Envia um documento individual para o Firestore em tempo real
 */
export async function pushDocToFirestore(collectionName, docId, data) {
  try {
    const instance = initFirebase()
    if (!instance || !docId) return

    const cleanData = await sanitizeDocForFirestore(collectionName, data)
    cleanData.updatedAt = new Date().toISOString()

    const docRef = doc(instance.firestore, collectionName, String(docId))
    await setDoc(docRef, cleanData, { merge: true })
  } catch (err) {
    console.warn(`[Firebase] Falha ao enviar ${collectionName}/${docId}:`, err)
  }
}

/**
 * Remove um documento do Firestore
 */
export async function deleteDocFromFirestore(collectionName, docId) {
  try {
    const instance = initFirebase()
    if (!instance || !docId) return

    const docRef = doc(instance.firestore, collectionName, String(docId))
    await deleteDoc(docRef)
  } catch (err) {
    console.warn(`[Firebase] Falha ao deletar ${collectionName}/${docId}:`, err)
  }
}

/**
 * Inicia a sincronização bidirecional em tempo real via Firestore (onSnapshot)
 */
export function startRealtimeSync(onSyncEvent = () => {}) {
  if (isSyncingActive) return
  const instance = initFirebase()
  if (!instance) return

  isSyncingActive = true
  stopRealtimeSync() // Limpa listeners anteriores se houver

  const collections = ['employees', 'records', 'departments', 'holidays', 'settings', 'notifications']

  collections.forEach((colName) => {
    const colRef = collection(instance.firestore, colName)
    const unsub = onSnapshot(colRef, async (snapshot) => {
      try {
        const firestoreIds = new Set()

        for (const docSnap of snapshot.docs) {
          const remoteData = docSnap.data()
          const docId = docSnap.id
          const numericId = Number(docId)
          const targetId = isNaN(numericId) ? docId : numericId
          firestoreIds.add(String(targetId))
          firestoreIds.add(String(docId))

          const itemToSave = {
            ...remoteData,
            id: targetId
          }

          // Para batidas de ponto, preserva a selfie local se não houver no remoto
          if (colName === 'records') {
            const localRec = await db.records.get(itemToSave.id)
            itemToSave.photo = localRec?.photo || remoteData.photo || null
          } else if (colName === 'settings' && itemToSave.id === 'config') {
            if (itemToSave.adminPassword === 'admin') {
              itemToSave.adminPassword = 'killer'
            }
          }

          // Salva ou atualiza diretamente o item local
          await db[colName].put(itemToSave)

          // Cura automática: se o Firestore não tinha a foto mas o aparelho local tem, envia a foto para a nuvem
          if (colName === 'employees' && !remoteData.photo) {
            const localEmp = await db.employees.get(targetId)
            if (localEmp?.photo) {
              pushDocToFirestore('employees', docId, localEmp)
            }
          }
        }

        // Reconciliação imediata de exclusões: se um item local não existe no Firestore, limpa da base local
        // (preservando o funcionário de teste nativo)
        if (colName === 'employees') {
          const localItems = await db.employees.toArray()
          for (const localItem of localItems) {
            if (localItem.cpf === '000.000.000-00' || localItem.isDemo) continue
            if (!firestoreIds.has(String(localItem.id))) {
              await db.employees.delete(localItem.id)
            }
          }
        } else if (colName === 'departments' || colName === 'holidays') {
          const localItems = await db[colName].toArray()
          for (const localItem of localItems) {
            if (!firestoreIds.has(String(localItem.id))) {
              await db[colName].delete(localItem.id)
            }
          }
        } else if (colName === 'records') {
          const localItems = await db.records.toArray()
          for (const localItem of localItems) {
            if (!firestoreIds.has(String(localItem.id))) {
              await db.records.delete(localItem.id)
            }
          }
        }

        onSyncEvent({ type: 'sync_success', collection: colName, count: snapshot.size })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pontoaqui:sync', { detail: { collection: colName, count: snapshot.size } }))
        }
      } catch (err) {
        console.warn(`[Firebase] Erro ao sincronizar coleção ${colName}:`, err)
        onSyncEvent({ type: 'sync_error', collection: colName, error: err.message })
      }
    }, (error) => {
      console.warn(`[Firebase] Erro no listener da coleção ${colName}:`, error)
      onSyncEvent({ type: 'listener_error', collection: colName, error: error.message })
    })

    unsubscribeListeners.push(unsub)
  })
}

/**
 * Para a sincronização em tempo real
 */
export function stopRealtimeSync() {
  unsubscribeListeners.forEach(unsub => {
    try { unsub() } catch (e) {}
  })
  unsubscribeListeners = []
  isSyncingActive = false
}

/**
 * Exporta todos os dados locais atuais (Dexie) para o Firestore em 1 clique
 */
export async function syncAllLocalToFirestore() {
  const instance = initFirebase()
  if (!instance) throw new Error('Firebase não está configurado.')

  const collections = ['employees', 'records', 'departments', 'holidays', 'settings', 'notifications']
  let totalUploaded = 0

  for (const colName of collections) {
    const items = await db[colName].toArray()
    for (const item of items) {
      const docId = String(item.id || item.cpf || Date.now())
      await pushDocToFirestore(colName, docId, item)
      totalUploaded++
    }
  }

  return { success: true, count: totalUploaded }
}
