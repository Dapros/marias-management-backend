import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import os from 'os';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import type { LunchType, OrderType } from './types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
export const LUNCHES_DIR = path.join(DATA_DIR, 'lunches')
export const ORDERS_DIR = path.join(DATA_DIR, 'orders')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
export const LUNCH_IMAGES_DIR = path.join(UPLOADS_DIR, 'lunches')
export const LUNCHES_FILE = path.join(LUNCHES_DIR, 'lunches.csv')
export const ORDERS_FILE = path.join(ORDERS_DIR, 'orders.csv')

// backups automaticos
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups')
export const BACKUP_LUNCHES_DIR = path.join(BACKUPS_DIR, 'lunches')
export const BACKUP_ORDERS_DIR = path.join(BACKUPS_DIR, 'orders')

export const LUNCHES_HEADER = [ 'id', 'title', 'imagen', 'price', 'tags' ]
export const ORDERS_HEADER = [ 'id', 'towerNum', 'apto', 'customer', 'phoneNum', 'payMethod', 'lunch', 'details', 'time', 'date', 'orderState', 'total' ]

export const computeTotalFromLunchArray = (items: any[] = []) => {
  try {
    return items.reduce((sum, it) => {
      const price = typeof it.price === 'number' ? it.price : Number(it.price || 0)
      const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity || 0)
      return sum + (price * qty);
    }, 0);
  } catch {
    return 0;
  }
}

// ensure dirs para backups
export const ensureBackupsDirs = async () => {
  await fse.ensureDir(BACKUPS_DIR)
  await fse.ensureDir(BACKUP_LUNCHES_DIR)
  await fse.ensureDir(BACKUP_ORDERS_DIR)
}

// ensure dirs principales
export const ensureDirs = async () => {
  await fse.ensureDir(LUNCHES_DIR)
  await fse.ensureDir(ORDERS_DIR)
  await fse.ensureDir(LUNCH_IMAGES_DIR)
}

export const ensureFileWithHeader = async (filePath: string, headerColumns: string[]) => {
  if (!fs.existsSync(filePath)) {
    const headerLine = headerColumns.join(',') + '\n'
    await fse.outputFile(filePath, headerLine, 'utf-8')
  }
}

// HELPER para generar timestamp legible
const timestampNow = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const YYYY = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const DD = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${YYYY}${MM}${DD}-${hh}${mm}${ss}`
}

// funcion para hacer la copia de backup
export const backupCsvAtomic = async (filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return;
    const base = path.basename(filePath);
    const ts = timestampNow();
    let destDir = BACKUPS_DIR;
    if (/lunches\.csv$/i.test(base)) destDir = BACKUP_LUNCHES_DIR;
    else if (/orders\.csv$/i.test(base)) destDir = BACKUP_ORDERS_DIR;

    const nameNoExt = base.replace(/\.csv$/i, '');
    const destName = `${nameNoExt}-${ts}.csv`;
    const destPath = path.join(destDir, destName);
    const tmpPath = path.join(os.tmpdir(), `${destName}.tmp`);

    // copiar a tmp file primero
    await fse.copy(filePath, tmpPath, { overwrite: true });
    // renombrar (movimiento atómico en la mayoría de FS locales)
    await fse.move(tmpPath, destPath, { overwrite: true });

    // opcional: cleanupOldBackups(destDir, 20)
    return destPath;
  } catch (err) {
    console.error('Error creando backup CSV (atomic):', err);
    return;
  }
}

// mantener solo N backups más recientes en un directorio
export const cleanupOldBackups = async (dir: string, keep = 10) => {
  try {
    const files = await fse.readdir(dir)
    const csvFiles = files.filter(f => f.endsWith('.csv')).map(f => ({ f, p: path.join(dir, f) }))
    if (csvFiles.length <= keep) return
    // ordenar por nombre (timestamp en el nombre hace que ordenar por nombre funcione)
    csvFiles.sort((a, b) => a.f.localeCompare(b.f))
    const toRemove = csvFiles.slice(0, csvFiles.length - keep)
    await Promise.all(toRemove.map(item => fse.remove(item.p)))
  } catch (err) {
    console.error('Error limpiando backups:', err)
  }
}

// restaurar una copia de backup puntual (sobrescribe destino)
export const restoreCsvFromBackup = async (backupFilePath: string, destFilePath: string) => {
  try {
    if (!fs.existsSync(backupFilePath)) throw new Error('Backup no existe: ' + backupFilePath)
    await fse.copy(backupFilePath, destFilePath, { overwrite: true })
    return true
  } catch (err) {
    console.error('Error restaurando backup:', err)
    throw err
  }
}


const fileStartsWithHeader = (filePath: string, expectedHeader: string): boolean => {
  try {
    if (!fs.existsSync(filePath)) return false
    const fd = fs.openSync(filePath, 'r')
    const buffer = Buffer.alloc(256)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0)
    fs.closeSync(fd)
    const start = buffer.slice(0, bytesRead).toString('utf-8').split('\n')[0].trim()
    return start === expectedHeader
  } catch {
    return false
  }
}

export const readCsv = (filePath: string, headers?: string[]) : Promise<Record<string, string>[]> => {
  return new Promise((resolve, reject) => {
    const results: Record<string, string>[] = []
    if (!fs.existsSync(filePath)) return resolve(results)
    const expectedHeader = headers ? headers.join(',') : ''
    const skipLines = headers && fileStartsWithHeader(filePath, expectedHeader) ? 1 : 0
    fs.createReadStream(filePath)
      .pipe(csvParser(headers ? { headers, skipLines } : {} as any))
      .on('data', (data: Record<string, string>) => {
        const hasContent = Object.values(data).some(value => value && value.trim() !== '')
        if (hasContent) results.push(data)
      })
      .on('error', (err: Error) => reject(err))
      .on('end', () => resolve(results))
  })
}

export const writeCsv = async (filePath: string, headers: string[], records: any[]) => {
  const headerObj = headers.map(h => ({ id: h, title: h }))
  const writer = createObjectCsvWriter({
    path: filePath,
    header: headerObj,
    append: false
  })
  await writer.writeRecords(records)

  // Backup despues de escribir con exito
  try {
    await backupCsvAtomic(filePath)
  } catch (err) {
    console.error('backupCsv falló después de writeCsv para', filePath, err)
  }
}

export const appendCsv = async (filePath: string, headers: string[], record: any) => {
  const headerObj = headers.map(h => ({ id: h, title: h }))
  const writer = createObjectCsvWriter({
    path: filePath,
    header: headerObj,
    append: true
  })
  await writer.writeRecords([record])

  // backup tras append 
  try {
    await backupCsvAtomic(filePath)
  } catch (err) {
    console.error('backupCsv falló después de appendCsv para', filePath, err)
  }
}

// serializadores / deserializadores
export const serializeLunchForCsv = (lunch: LunchType) => ({
  id: lunch.id,
  title: lunch.title,
  imagen: lunch.imagen,
  price: String(lunch.price),
  tags: JSON.stringify(lunch.tags || [])
})

export const deserializeLunchFromCsv = (row: Record<string, string>): LunchType => ({
  id: row.id,
  title: row.title,
  imagen: row.imagen,
  price: Number(row.price),
  tags: (() => {
    try { return JSON.parse(row.tags) } catch { return row.tags ? row.tags.split(';') : [] }
  })()
})

export const serializeOrderForCsv = (order: OrderType) => ({
  id: order.id,
  towerNum: order.towerNum,
  apto: String(order.apto),
  customer: order.customer ?? '',
  phoneNum: String(order.phoneNum ?? 0),
  payMethod: JSON.stringify(order.payMethod || {}),
  lunch: JSON.stringify(order.lunch || []),
  details: order.details || '',
  time: order.time || '',
  date: (order.date instanceof Date) ? order.date.toISOString() : String(order.date || ''),
  orderState: order.orderState || '',
  total: String(typeof order.total === 'number' ? order.total : computeTotalFromLunchArray(order.lunch || []))
})


export const deserializeOrderFromCsv = (row: Record<string, string>): OrderType => ({
  id: row.id,
  towerNum: row.towerNum,
  apto: Number(row.apto),
  customer: row.customer,
  phoneNum: Number(row.phoneNum),
  payMethod: (() => { 
    try { return JSON.parse(row.payMethod) } catch { return { id: '', label: '', image: '' } }
  })(),
  lunch: (() => { 
    try { return JSON.parse(row.lunch) } catch { return [] }
  })(),
  details: row.details,
  time: row.time,
  date: row.date,
  orderState: row.orderState as any,
  total: (() => {
    const t = row.total
    const n = Number(t)
    if (!isNaN(n)) return n
    try { return computeTotalFromLunchArray(JSON.parse(row.lunch)) } catch { return 0; }
  })()
})
