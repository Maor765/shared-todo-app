import { Router } from 'express';
import * as tasksController from '../controllers/tasks.controller.js';

const router = Router();

router.post('/:listId/tasks', tasksController.createTask);
router.patch('/:listId/tasks/:id', tasksController.updateTask);
router.delete('/:listId/tasks/:id', tasksController.deleteTask);

export default router;
