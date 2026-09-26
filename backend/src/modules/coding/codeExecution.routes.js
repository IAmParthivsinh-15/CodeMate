import express from 'express';
import { executeCode } from './codeExecution.controller.js';
import { protectRoutes } from '../../middleware/auth.js';

const router = express.Router();

router.post('/execute', protectRoutes, executeCode);

export default router;