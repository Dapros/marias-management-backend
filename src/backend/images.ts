import path from 'path';
import fse from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { LUNCH_IMAGES_DIR } from './storage';

export const saveBase64Image = async (base64Data: string): Promise<string> => {
  try {
    const match = base64Data.match(/^data:(image\/(png|jpg|jpeg|webp));base64,(.+)$/i)
    if (!match) throw new Error('Formato de imagen inválido')
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
    const data = match[3]
    const buffer = Buffer.from(data, 'base64')
    const filename = `${uuidv4()}.${ext}`
    const filePath = path.join(LUNCH_IMAGES_DIR, filename)
    await fse.outputFile(filePath, buffer)
    return `/uploads/lunches/${filename}`
  } catch (err) {
    throw err
  }
}