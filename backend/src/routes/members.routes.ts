import { Router } from 'express';
import * as membersController from '../controllers/members.controller.js';

const router = Router();

router.get('/', membersController.getMembers);
router.get('/invites', membersController.getInvites);
router.post('/invite', membersController.inviteMember);
router.delete('/invites/:inviteId', membersController.deleteInvite);
router.patch('/:userId/status', membersController.updateStatus);
router.delete('/:userId', membersController.removeMember);

export default router;
