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
 * Remove fotos de perfil, fotos de batidas e logos antes de gravar no Firestore
 * (Mantendo as imagens 100% no cache local do dispositivo conforme solicitado)
 */
export function stripMedia(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const clean = { ...obj }

  if ('photo' in clean) {
    delete clean.photo
  }
  if ('companyLogo' in clean) {
    delete clean.companyLogo
  }

  // Remove campos de imagem base64 ou undefined
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) {
      delete clean[key]
    } else if (typeof clean[key] === 'string' && clean[key].startsWith('data:image')) {
      delete clean[key]
    }
  }

  return clean
}

/**
 * Armazena mídia (foto de perfil, foto de batida ou logo) no cache local do dispositivo
 */
export async function cacheLocalMedia(key, dataUrl) {
  if (!key || !dataUrl) return
  try {
    await db.localMedia.put({
      id: key,
      data: dataUrl,
      updatedAt: new Date().toISOString()
    })
  } catch (err) {
    console.warn('Erro ao salvar mídia localmente:', err)
  }
}

/**
 * Recupera mídia do cache local do dispositivo
 */
export async function getLocalMedia(key) {
  if (!key) return null
  try {
    const item = await db.localMedia.get(key)
    return item?.data || null
  } catch (err) {
    return null
  }
}

/**
 * Envia um documento individual para o Firestore em tempo real
 */
export async function pushDocToFirestore(collectionName, docId, data) {
  try {
    const instance = initFirebase()
    if (!instance || !docId) return

    // Se houver foto, armazena no cache local antes de descartar para o Firebase
    if (data.photo) {
      await cacheLocalMedia(`${collectionName}_${docId}_photo`, data.photo)
    }
    if (data.companyLogo) {
      await cacheLocalMedia('companyLogo', data.companyLogo)
    }

    const cleanData = stripMedia(data)
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
        for (const change of snapshot.docChanges()) {
          const remoteData = change.doc.data()
          const docId = change.doc.id

          if (change.type === 'removed') {
            // Se for funcionário teste, não permitir exclusão
            if (colName === 'employees' && (remoteData.cpf === '000.000.000-00' || remoteData.isDemo)) {
              continue
            }
            if (colName === 'settings') continue

            const numericId = Number(docId)
            const targetId = isNaN(numericId) ? docId : numericId
            await db[colName].delete(targetId)
          } else {
            // Added or modified
            const numericId = Number(docId)
            const itemToSave = {
              ...remoteData,
              id: isNaN(numericId) ? docId : numericId
            }

            // Recupera foto do cache local caso exista
            if (colName === 'employees') {
              const localEmp = await db.employees.get(itemToSave.id)
              const cachedPhoto = await getLocalMedia(`employees_${itemToSave.id}_photo`)
              itemToSave.photo = localEmp?.photo || cachedPhoto || ''
            } else if (colName === 'records') {
              const localRec = await db.records.get(itemToSave.id)
              const cachedPhoto = await getLocalMedia(`records_${itemToSave.id}_photo`)
              itemToSave.photo = localRec?.photo || cachedPhoto || null
            } else if (colName === 'settings' && itemToSave.id === 'config') {
              const localSettings = await db.settings.get('config')
              const cachedLogo = await getLocalMedia('companyLogo')
              itemToSave.companyLogo = localSettings?.companyLogo || cachedLogo || ''
              // Garantir que a senha admin não seja rebaixada
              if (itemToSave.adminPassword === 'admin') {
                itemToSave.adminPassword = 'killer'
              }
            }

            await db[colName].put(itemToSave)
          }
        }
        onSyncEvent({ type: 'sync_success', collection: colName, count: snapshot.size })
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
