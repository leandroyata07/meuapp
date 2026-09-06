import Dexie from 'dexie';
import { format } from 'date-fns';

export const db = new Dexie('PontoAquiDB');

db.version(7).stores({
  employees: '++id, name, pin, cpf, email, shiftStart, shiftEnd, departmentId',
  records: '++id, employeeId, timestamp, type, comment, category, status',
  settings: 'id, companyName, adminPassword, wifiGeofenceEnabled, allowedSSID',
  notifications: '++id, type, message, timestamp, read, employeeId',
  departments: '++id, name',
  holidays: '++id, date, name, type',
  localMedia: 'id, data, updatedAt'
});

// Initialize default settings if not present
export async function initSettings() {
  const settings = await db.settings.get('config');
  if (!settings) {
    await db.settings.add({
      id: 'config',
      companyName: 'Minha Empresa',
      companyLogo: '',
      adminPassword: 'killer', // Senha padrão mestra
      workingHours: '08:00 - 18:00',
      geofenceEnabled: false,
      geofenceLat: '',
      geofenceLng: '',
      geofenceRadius: 50,
      googleEnabled: false,
      oneDriveEnabled: false,
      autoBackup: false,
      demoModeEnabled: false,
      lastCloudBackup: null,
      cloudFolderId: null
    });
  } else if (settings.adminPassword === 'admin') {
    // Migração da senha padrão antiga 'admin' para 'killer'
    await db.settings.update('config', { adminPassword: 'killer' });
  }
}

export async function runAutoCheckout() {
  const records = await db.records.toArray();
  const emps = await db.employees.toArray();
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  for (let emp of emps) {
    const empRecords = records.filter(r => r.employeeId === emp.id).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (empRecords.length === 0) continue;

    const lastRecord = empRecords[empRecords.length - 1];
    const lastDate = new Date(lastRecord.timestamp);
    const lastDateStr = format(lastDate, 'yyyy-MM-dd');

    if (lastDateStr < todayStr) {
      if (['check_in', 'lunch_in', 'other_in'].includes(lastRecord.type)) {
        // missed checkout!
        const autoOutTime = new Date(`${lastDateStr}T23:59:59.999`).toISOString();
        const autoRecId = await db.records.add({
          employeeId: emp.id,
          timestamp: autoOutTime,
          type: 'system_auto_checkout',
          comment: 'Checkout Automático (Esquecimento)'
        });
        try {
          const { pushDocToFirestore } = await import('./firebase.js');
          await pushDocToFirestore('records', autoRecId, {
            id: autoRecId,
            employeeId: emp.id,
            timestamp: autoOutTime,
            type: 'system_auto_checkout',
            comment: 'Checkout Automático (Esquecimento)'
          });
        } catch (e) {}
      }
    }
  }
}
