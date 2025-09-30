import express from 'express';
import { getLunches, createLunch, updateLunch, deleteLunch } from '../controllers/lunches';
const router = express.Router();

router.get('/', getLunches)
router.post('/', createLunch)
router.put('/:id', updateLunch)
router.delete('/:id', deleteLunch)

export default router
