import express from 'express';
import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

type LunchType = {
  id: string;
  title: string;
  imagen: string;
  price: number;
  tags: string[];
}

type PayMethod = {
  id: string;
  label: string;
  image: string;
}

type OrderState = "pendiente" | "pagado";

type OrderType = {
  id: string;
  towerNum: string;
  apto: number;
  customer: string;
  phoneNum: number;
  payMethod: PayMethod;
  lunch: LunchType[];
  details: string;
  time: string;
  date: string | Date;
  orderState: OrderState;
  total?: number;
}

// App Express
const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}))

const DATA_DIR = path.join(__dirname, '..', 'data')
const LUNCHES_DIR = path.join(DATA_DIR, 'lunches')
const ORDERS_DIR = path.join(DATA_DIR, 'orders')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const LUNCH_IMAGES_DIR = path.join(UPLOADS_DIR, 'lunches')
const LUNCHES_FILE = path.join(LUNCHES_DIR, 'lunches.csv')
const ORDERS_FILE = path.join(ORDERS_DIR, 'orders.csv')

const LUNCHES_HEADER = [ 'id', 'title', 'imagen', 'price', 'tags' ]
const ORDERS_HEADER = [ 'id', 'towerNum', 'apto', 'customer', 'phoneNum', 'payMethod', 'lunch', 'details', 'time', 'date', 'orderState', 'total' ]

const computeTotalFromLunchArray = (items: any[] = []) => {
  try {
    return items.reduce((sum, it) => {
      const price = typeof it.price === 'number' ? it.price : Number(it.price || 0)
      const qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity || 0)
      return sum + (price * qty)
    }, 0)
  } catch {
    return 0
  }
}


const ensureDirs = async () => {
  await fse.ensureDir(LUNCHES_DIR)
  await fse.ensureDir(ORDERS_DIR)
  await fse.ensureDir(LUNCH_IMAGES_DIR)
}

const ensureFileWithHeader = async (filePath: string, headerColumns: string[]) => {
  if (!fs.existsSync(filePath)) {
    const headerLine = headerColumns.join(',') + '\n'
    await fse.outputFile(filePath, headerLine, 'utf-8')
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

const readCsv = (filePath: string, headers?: string[]) : Promise<Record<string, string>[]> => {
  return new Promise((resolve, reject) => {
    const results: Record<string, string>[] = []
    if (!fs.existsSync(filePath)) return resolve(results)
    const expectedHeader = headers ? headers.join(',') : ''
    const skipLines = headers && fileStartsWithHeader(filePath, expectedHeader) ? 1 : 0
    fs.createReadStream(filePath)
      .pipe(csvParser(headers ? { headers, skipLines } : {} as any))
      .on('data', (data: Record<string, string>) => {
        // Filtrar filas vacías - verificar si todos los campos están vacíos o solo contienen espacios
        const hasContent = Object.values(data).some(value => value && value.trim() !== '')
        if (hasContent) {
          results.push(data)
        }
      })
      .on('error', (err: Error) => reject(err))
      .on('end', () => resolve(results))
  })
}

const writeCsv = async (filePath: string, headers: string[], records: any[]) => {
  const headerObj = headers.map(h => ({ id: h, title: h}))
  const writer = createObjectCsvWriter({
    path: filePath,
    header: headerObj,
    append: false
  })
  await writer.writeRecords(records)
}

const appendCsv = async (filePath: string, headers: string[], record: any) => {
  const headerObj = headers.map(h => ({ id: h, title: h}))
  const writer = createObjectCsvWriter({
    path: filePath,
    header: headerObj,
    append: true
  })
  await writer.writeRecords([record])
}

// serializadores / deserializadores
const serializeLunchForCsv = (lunch: LunchType) => ({
  id: lunch.id,
  title: lunch.title,
  imagen: lunch.imagen,
  price: String(lunch.price),
  tags: JSON.stringify(lunch.tags || [])
});

const deserializeLunchFromCsv = (row: Record<string, string>): LunchType => ({
  id: row.id,
  title: row.title,
  imagen: row.imagen,
  price: Number(row.price),
  tags: (() => {
    try {
      return JSON.parse(row.tags)
    } catch {
      return row.tags ? row.tags.split(';') : []
    }
  })()
});

const serializeOrderForCsv = (order: OrderType) => ({
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
  total: String(typeof order.total === 'number' ? order.total : computeTotalFromLunchArray(order.lunch || []) )
});

const deserializeOrderFromCsv = (row: Record<string, string>): OrderType => ({
  id: row.id,
  towerNum: row.towerNum,
  apto: Number(row.apto),
  customer: row.customer,
  phoneNum: Number(row.phoneNum),
  payMethod: (() => { 
    try { 
      return JSON.parse(row.payMethod);
    } catch { 
      return { id: '', label: '', image: '' }
    }
  })(),
  lunch: (() => { 
    try { 
      return JSON.parse(row.lunch);
    } 
    catch { 
      return [] 
    }
  })(),
  details: row.details,
  time: row.time,
  date: row.date,
  orderState: row.orderState as OrderState,
  total: (() => {
    const t = row.total
    const n = Number(t)
    return isNaN(n) ? computeTotalFromLunchArray((() => {
      try { return JSON.parse(row.lunch) } catch { return [] }
    })()) : n
  })()
});


// Inicialización
(async () => {
  await ensureDirs()
  await ensureFileWithHeader(LUNCHES_FILE, LUNCHES_HEADER)
  await ensureFileWithHeader(ORDERS_FILE, ORDERS_HEADER)
})()

// Servir archivos estáticos subidos
app.use('/uploads', express.static(UPLOADS_DIR))

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend funcionando correctamente', timestamp: new Date().toISOString() })
})

// Utilidad para guardar imagen base64
const saveBase64Image = async (base64Data: string): Promise<string> => {
  // base64 esperado: data:image/png;base64,xxxx
  try {
    const match = base64Data.match(/^data:(image\/(png|jpg|jpeg|webp));base64,(.+)$/i)
    if (!match) throw new Error('Formato de imagen inválido')
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
    const data = match[3]
    const buffer = Buffer.from(data, 'base64')
    const filename = `${uuidv4()}.${ext}`
    const filePath = path.join(LUNCH_IMAGES_DIR, filename)
    await fse.outputFile(filePath, buffer)
    // ruta pública para el cliente
    return `/uploads/lunches/${filename}`
  } catch (err) {
    throw err
  }
}

// --- Endpoints lunches ---
app.get('/api/lunches', async (req, res) => {
  try {
    const rows = await readCsv(LUNCHES_FILE, LUNCHES_HEADER)
    const data = rows.map(deserializeLunchFromCsv)
    res.json(data)
  } catch (err : any) {
    res.status(500).json({ error: err.message || String(err) })
  }
});

app.post('/api/lunches', async (req, res) => {
  try {
    console.log('POST /api/lunches - Body received:', {
      title: req.body.title,
      price: req.body.price,
      hasImage: !!req.body.imagen,
      imageType: req.body.imagen ? req.body.imagen.substring(0, 50) + '...' : 'none'
    })
    
    const lunch = req.body as Partial<LunchType>
    const id = lunch.id || uuidv4();
    let imagen = lunch.imagen || ''
    
    if (imagen && /^data:image\//i.test(imagen)) {
      console.log('Processing base64 image...')
      try {
        imagen = await saveBase64Image(imagen)
        console.log('Image saved to:', imagen)
      } catch (imgErr) {
        console.error('Error saving image:', imgErr)
        throw imgErr
      }
    }
    
    const toSave = {
      id,
      title: lunch.title || '',
      imagen,
      price: lunch.price ?? 0,
      tags: lunch.tags ?? []
    } as LunchType;
    
    console.log('Saving lunch:', toSave)
    await appendCsv(LUNCHES_FILE, LUNCHES_HEADER, serializeLunchForCsv(toSave));
    res.status(201).json({ ok: true, lunch: toSave })
  } catch (err : any) {
    console.error('Error in POST /api/lunches:', err)
    res.status(500).json({ error: err.message || String(err) })
  }
});

app.put('/api/lunches/:id', async (req, res) => {
  try {
    const id = req.params.id
    const rows = await readCsv(LUNCHES_FILE, LUNCHES_HEADER)
    const idx = rows.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'not found'})
    const updatedBody = req.body as Partial<LunchType>
    let imagenValue: string
    if (typeof updatedBody.imagen === 'string' && /^data:image\//i.test(updatedBody.imagen)) {
      imagenValue = await saveBase64Image(updatedBody.imagen)
    } else if (typeof updatedBody.imagen === 'string') {
      imagenValue = updatedBody.imagen
    } else {
      imagenValue = rows[idx].imagen
    }
    const updated: LunchType = {
      id,
      title: updatedBody.title ?? rows[idx].title,
      imagen: imagenValue,
      price: Number(updatedBody.price ?? rows[idx].price),
      tags: updatedBody.tags ?? (() => { 
        try { 
          return JSON.parse(rows[idx].tags)
        } catch { 
          return []
        }
      })()
    };
    rows[idx] = serializeLunchForCsv(updated)
    await writeCsv(LUNCHES_FILE, LUNCHES_HEADER, rows)
    res.json({ ok: true, updated})
  } catch (err : any) {
    res.status(500).json({ error: err.message || String(err) })
  }
});

app.delete('/api/lunches/:id', async (req, res) => {
  try {
    const id = req.params.id
    const rows = await readCsv(LUNCHES_FILE, LUNCHES_HEADER)
    const newRows = rows.filter(r => r.id !== id)
    await writeCsv(LUNCHES_FILE, LUNCHES_HEADER, newRows)
    res.json({ ok: true })
  } catch (err : any) {
    res.status(500).json({ error: err.message || String(err) })
  }
});

// --- Endpoints orders ---
app.get('/api/orders', async (req, res) => {
  try {
    const rows = await readCsv(ORDERS_FILE, ORDERS_HEADER)
    const data = rows.map(deserializeOrderFromCsv)
    res.json(data)
  } catch (err : any) {
    res.status(500).json({ error: err.message || String(err) })
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderBody = req.body as Partial<OrderType>
    const id = orderBody.id || uuidv4()
    // asegurar que lunch tenga quantity por item
    const lunchItems = (orderBody.lunch || []).map((it: any) => ({
      ...it,
      quantity: typeof it.quantity === 'number' ? it.quantity : Number(it.quantity || 1)
    }))
    const total = computeTotalFromLunchArray(lunchItems)
    const order: OrderType = {
      id,
      towerNum: orderBody.towerNum || '',
      apto: orderBody.apto ?? 0,
      customer: orderBody.customer || '',
      phoneNum: orderBody.phoneNum ?? 0,
      payMethod: orderBody.payMethod || { id: '', label: '', image: ''},
      lunch: lunchItems,
      details: orderBody.details || '',
      time: orderBody.time || '',
      date: orderBody.date || new Date().toISOString(),
      orderState: orderBody.orderState || 'pendiente',
      total
    }
    await appendCsv(ORDERS_FILE, ORDERS_HEADER, serializeOrderForCsv(order))
    res.status(201).json({ ok: true, order})
  } catch (err : any) {
    res.status(500).json({ error: err.message || String(err) })
  }
});


app.put('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await readCsv(ORDERS_FILE, ORDERS_HEADER);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    const updatedBody = req.body as Partial<OrderType>;
    // recuperar la representación actual
    const existing = deserializeOrderFromCsv(rows[idx]);
    // normalizar lunch: tomar updatedBody.lunch si existe, si no existing.lunch
    const mergedLunch = (() => {
      const candidate = updatedBody.lunch ?? existing.lunch ?? [];
      return (candidate as any[]).map(it => ({
        id: it.id ?? (it as any).id ?? '',
        title: it.title ?? '',
        imagen: it.imagen ?? '',
        price: typeof it.price === 'number' ? it.price : Number(it.price ?? 0),
        tags: it.tags ?? [],
        quantity: typeof it.quantity === 'number' ? it.quantity : Number((it as any).quantity ?? 1),
      }));
    })();
    // construir merged: mezclar existing con updatedBody (con cuidado para tipos)
    const merged: OrderType = {
      id,
      towerNum: updatedBody.towerNum ?? existing.towerNum,
      apto: updatedBody.apto ?? existing.apto,
      customer: updatedBody.customer ?? existing.customer,
      phoneNum: updatedBody.phoneNum ?? existing.phoneNum,
      payMethod: updatedBody.payMethod ?? existing.payMethod ?? { id: '', label: '', image: '' },
      lunch: mergedLunch,
      details: updatedBody.details ?? existing.details ?? '',
      time: updatedBody.time ?? existing.time ?? '',
      date: updatedBody.date ?? existing.date ?? new Date().toISOString(),
      orderState: updatedBody.orderState ?? existing.orderState ?? 'pendiente',
      total: typeof updatedBody.total === 'number' ? updatedBody.total : computeTotalFromLunchArray(mergedLunch)
    };
    // asegurarse fecha serializada como ISO al escribir
    const serialized = serializeOrderForCsv(merged);
    rows[idx] = serialized;
    await writeCsv(ORDERS_FILE, ORDERS_HEADER, rows);
    // devolver la versión deserializada (tal como espera el frontend)
    const deserializedUpdated = deserializeOrderFromCsv(serialized);
    res.json({ ok: true, updated: deserializedUpdated });
  } catch (err: any) {
    console.error('PUT /api/orders/:id error:', err);
    res.status(500).json({ error: err.message || String(err) })
  }
});


app.delete('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id
    const rows = await readCsv(ORDERS_FILE, ORDERS_HEADER)
    const newRows = rows.filter(r => r.id !== id)
    await writeCsv(ORDERS_FILE, ORDERS_HEADER, newRows)
    res.json({ ok: true })
  } catch (err : any) {
    res.status(500).json({ error: err.message || String(err) })
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000
app.listen(PORT, () => console.log(`Backend listening http://localhost:${PORT}`))
