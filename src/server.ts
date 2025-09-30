// src/server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { ensureDirs, ensureFileWithHeader, ensureBackupsDirs, LUNCHES_FILE, ORDERS_FILE, LUNCHES_HEADER, ORDERS_HEADER, EXPENSES_FILE, EXPENSES_HEADER } from './backend/storage';
import lunchesRouter from './backend/routes/lunches'
import ordersRouter from './backend/routes/orders'
import expensesRouter from './backend/routes/expenses'

const app = express()

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// inicializar dirs / archivos (igual que antes)
(async () => {
  await ensureDirs()
  await ensureBackupsDirs()
  await ensureFileWithHeader(LUNCHES_FILE, LUNCHES_HEADER)
  await ensureFileWithHeader(ORDERS_FILE, ORDERS_HEADER)
  await ensureFileWithHeader(EXPENSES_FILE, EXPENSES_HEADER)
})()

// servir uploads (la ruta pública debe apuntar al mismo UPLOADS_DIR que definiste en storage.ts)
const uploadsPath = path.join(__dirname, '..', 'data', 'uploads')
app.use('/uploads', express.static(uploadsPath));

// endpoint simple
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend funcionando correctamente', timestamp: new Date().toISOString() })
})

// registrar rutas
app.use('/api/lunches', lunchesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/expenses', expensesRouter)

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000
app.listen(PORT, () => console.log(`Backend listening http://localhost:${PORT}`))