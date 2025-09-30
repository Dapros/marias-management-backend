import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  readCsv,
  appendCsv,
  writeCsv,
  EXPENSES_FILE,
  EXPENSES_HEADER,
  serializeExpenseForCsv,
  deserializeExpenseFromCsv
} from '../storage'
import type { ExpenseType } from '../types'

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const rows = await readCsv(EXPENSES_FILE, EXPENSES_HEADER)
    const data = rows.map(deserializeExpenseFromCsv)
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}

export const createExpense = async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<ExpenseType>
    // validación mínima
    if (!body.kind || !['purchase','third-party'].includes(body.kind)) {
      return res.status(400).json({ error: 'Tipo no válido o faltante (purchase|third-party)' })
    }
    if (!body.title || typeof body.title !== 'string') {
      return res.status(400).json({ error: 'Título faltante' })
    }
    const amount = Number(body.amount ?? 0)
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Cantidad no válida' })
    }

    const id = body.id || uuidv4()
    const expense: ExpenseType = {
      id,
      kind: body.kind as any,
      title: body.title,
      description: body.description ?? '',
      amount,
      time: body.time ?? '',
      date: body.date ?? new Date().toISOString()
    }

    await appendCsv(EXPENSES_FILE, EXPENSES_HEADER, serializeExpenseForCsv(expense))
    res.status(201).json({ ok: true, expense })
  } catch (err: any) {
    console.error('POST /api/expenses error:', err)
    res.status(500).json({ error: err.message || String(err) })
  }
}

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const rows = await readCsv(EXPENSES_FILE, EXPENSES_HEADER)
    const newRows = rows.filter(r => r.id !== id)
    await writeCsv(EXPENSES_FILE, EXPENSES_HEADER, newRows)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}
