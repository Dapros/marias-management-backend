import express from 'express'
import { getExpenses, createExpense, deleteExpense } from '../controllers/expenses'
const router = express.Router()

router.get('/', getExpenses)
router.post('/', createExpense)
router.delete('/:id', deleteExpense)

export default router
