import express from 'express';
import { executeCode } from '../controller/codeExecutionController.js';
import { protectRoutes } from '../middlewares/auth.js';

const router = express.Router();

router.post('/execute', protectRoutes, executeCode);

export default router;