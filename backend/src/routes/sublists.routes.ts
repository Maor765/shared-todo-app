import { Router } from 'express';
import * as sublistsController from '../controllers/sublists.controller.js';

const router = Router();

router.post('/:listId/sublists', sublistsController.createSublist);
router.patch('/:listId/sublists/:id', sublistsController.updateSublist);
router.delete('/:listId/sublists/:id', sublistsController.deleteSublist);

export default router;
