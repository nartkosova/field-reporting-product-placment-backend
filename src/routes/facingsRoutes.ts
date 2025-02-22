import express from 'express';
import { createPodravkaFacing, createCompetitorFacing } from '../controllers/facingsController';

const router = express.Router();

router.post('/podravka-facing', createPodravkaFacing);
router.post('/competitor-facing', createCompetitorFacing);

export default router;