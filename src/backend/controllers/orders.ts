import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  readCsv, appendCsv, writeCsv,
  ORDERS_FILE, ORDERS_HEADER,
  serializeOrderForCsv, deserializeOrderFromCsv,
  computeTotalFromLunchArray
} from '../storage';
import type { OrderType } from '../types';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const rows = await readCsv(ORDERS_FILE, ORDERS_HEADER)
    const data = rows.map(deserializeOrderFromCsv)
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}

export const createOrder = async (req: Request, res: Response) => {
  try {
    const orderBody = req.body as Partial<OrderType>
    const id = orderBody.id || uuidv4()

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
    };

    await appendCsv(ORDERS_FILE, ORDERS_HEADER, serializeOrderForCsv(order))
    res.status(201).json({ ok: true, order })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const rows = await readCsv(ORDERS_FILE, ORDERS_HEADER)
    const idx = rows.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'not found' })

    const updatedBody = req.body as Partial<OrderType>
    const existing = deserializeOrderFromCsv(rows[idx])

    const mergedLunch = (() => {
      const candidate = updatedBody.lunch ?? existing.lunch ?? []
      return (candidate as any[]).map(it => ({
        id: it.id ?? '',
        title: it.title ?? '',
        imagen: it.imagen ?? '',
        price: typeof it.price === 'number' ? it.price : Number(it.price ?? 0),
        tags: it.tags ?? [],
        quantity: typeof it.quantity === 'number' ? it.quantity : Number((it as any).quantity ?? 1),
      }))
    })()

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
    }

    const serialized = serializeOrderForCsv(merged)
    rows[idx] = serialized
    await writeCsv(ORDERS_FILE, ORDERS_HEADER, rows)

    const deserializedUpdated = deserializeOrderFromCsv(serialized)
    res.json({ ok: true, updated: deserializedUpdated })
  } catch (err: any) {
    console.error('PUT /api/orders/:id error:', err)
    res.status(500).json({ error: err.message || String(err) })
  }
}

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const rows = await readCsv(ORDERS_FILE, ORDERS_HEADER)
    const newRows = rows.filter(r => r.id !== id)
    await writeCsv(ORDERS_FILE, ORDERS_HEADER, newRows)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}
