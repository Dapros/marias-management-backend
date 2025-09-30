// src/backend/routes/orders.ts
import express from 'express';
import { getOrders, createOrder, updateOrder, deleteOrder } from '../controllers/orders';
const router = express.Router();

router.get('/', getOrders)
router.post('/', createOrder)
router.put('/:id', updateOrder)
router.delete('/:id', deleteOrder)

export default router
