import { Router } from 'express';
import * as workspaceController from '../controllers/workspace.controller.js';

const router = Router();

router.get('/', workspaceController.getWorkspace);
router.patch('/', workspaceController.updateWorkspace);

export default router;
