import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readCsv, appendCsv, writeCsv, LUNCHES_FILE, LUNCHES_HEADER, serializeLunchForCsv, deserializeLunchFromCsv } from '../storage';
import { saveBase64Image } from '../images';
import type { LunchType } from '../types';

export const getLunches = async (req: Request, res: Response) => {
  try {
    const rows = await readCsv(LUNCHES_FILE, LUNCHES_HEADER)
    const data = rows.map(deserializeLunchFromCsv)
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
};

export const createLunch = async (req: Request, res: Response) => {
  try {
    const lunch = req.body as Partial<LunchType>
    const id = lunch.id || uuidv4()
    let imagen = lunch.imagen || ''

    if (imagen && /^data:image\//i.test(imagen)) {
      imagen = await saveBase64Image(imagen)
    }

    const toSave: LunchType = {
      id,
      title: lunch.title || '',
      imagen,
      price: lunch.price ?? 0,
      tags: lunch.tags ?? []
    };

    await appendCsv(LUNCHES_FILE, LUNCHES_HEADER, serializeLunchForCsv(toSave))
    res.status(201).json({ ok: true, lunch: toSave })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
};

export const updateLunch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const rows = await readCsv(LUNCHES_FILE, LUNCHES_HEADER)
    const idx = rows.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'not found' })

    const updatedBody = req.body as Partial<LunchType>;
    let imagenValue: string;
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
        try { return JSON.parse(rows[idx].tags); } catch { return [] }
      })()
    }

    rows[idx] = serializeLunchForCsv(updated)
    await writeCsv(LUNCHES_FILE, LUNCHES_HEADER, rows)
    res.json({ ok: true, updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}

export const deleteLunch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const rows = await readCsv(LUNCHES_FILE, LUNCHES_HEADER)
    const newRows = rows.filter(r => r.id !== id)
    await writeCsv(LUNCHES_FILE, LUNCHES_HEADER, newRows)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) })
  }
}