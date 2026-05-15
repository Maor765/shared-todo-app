import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', notificationsController.getNotifications);
router.patch('/:id/read', notificationsController.markRead);
router.post('/read-all', notificationsController.markAllRead);

export default router;
