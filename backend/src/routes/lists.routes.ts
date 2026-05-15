import { Router } from 'express';
import * as listsController from '../controllers/lists.controller.js';

const router = Router();

router.get('/', listsController.getLists);
router.post('/', listsController.createList);
router.get('/:id', listsController.getListDetail);
router.patch('/:id', listsController.updateList);
router.delete('/:id', listsController.deleteList);
router.post('/:id/members', listsController.addListMember);
router.delete('/:id/members/:userId', listsController.removeListMember);

export default router;
