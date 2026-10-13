import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  savePattern,
} from '../controllers/projectsController.js';

export const projectsRouter = Router();

projectsRouter.get('/', asyncHandler(listProjects));
projectsRouter.get('/:id', asyncHandler(getProject));
projectsRouter.post('/', upload.single('photo'), asyncHandler(createProject));
projectsRouter.put('/:id', upload.single('photo'), asyncHandler(updateProject));
projectsRouter.delete('/:id', asyncHandler(deleteProject));
projectsRouter.put('/:id/pattern', asyncHandler(savePattern));
