/**
 * Workflow routes
 * Manages agent workflow templates and instances for task-oriented retrieval
 */

import {
  createWorkflowInstance,
  getWorkflowInstance,
  getWorkflowTemplate,
  listWorkflowInstances,
  listWorkflowTemplates,
  updateWorkflowInstance,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const CreateWorkflowSchema = z.object({
  template_id: z.string().uuid().optional(),
  collection_id: z.string().uuid(),
  task_description: z.string().min(1).max(2000),
  task_context: z.record(z.unknown()).optional(),
  session_id: z.string().uuid().optional(),
});

const UpdateWorkflowSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'failed']).optional(),
  current_step_id: z.string().optional().nullable(),
  completed_steps: z.array(z.string()).optional(),
  findings: z
    .array(
      z.object({
        step: z.string(),
        sources: z.array(z.unknown()),
        summary: z.string(),
      })
    )
    .optional(),
  final_output: z.string().optional(),
});

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workflows/templates - List workflow templates
  fastify.get<{ Querystring: { category?: string; tech_stack?: string } }>(
    '/api/workflows/templates',
    async (request, reply) => {
      const { category, tech_stack } = request.query;
      try {
        const templates = await listWorkflowTemplates(category, tech_stack);
        return reply.send({ templates });
      } catch (error) {
        fastify.log.error(error, 'Failed to list workflow templates');
        return reply.code(500).send({ error: 'Failed to list templates' });
      }
    }
  );

  // GET /api/workflows/templates/:id - Get a specific template
  fastify.get<{ Params: { id: string } }>(
    '/api/workflows/templates/:id',
    async (request, reply) => {
      const { id } = request.params;
      try {
        const template = await getWorkflowTemplate(id);
        if (!template) {
          return reply.code(404).send({ error: 'Template not found' });
        }
        return reply.send({ template });
      } catch (error) {
        fastify.log.error(error, 'Failed to get workflow template');
        return reply.code(500).send({ error: 'Failed to get template' });
      }
    }
  );

  // GET /api/workflows - List workflow instances for a collection
  fastify.get<{ Querystring: { collection_id: string; status?: string } }>(
    '/api/workflows',
    async (request, reply) => {
      const { collection_id, status } = request.query;
      if (!collection_id) {
        return reply.code(400).send({ error: 'collection_id is required' });
      }
      try {
        const workflows = await listWorkflowInstances(collection_id, status);
        return reply.send({ workflows });
      } catch (error) {
        fastify.log.error(error, 'Failed to list workflows');
        return reply.code(500).send({ error: 'Failed to list workflows' });
      }
    }
  );

  // GET /api/workflows/:id - Get a specific workflow instance
  fastify.get<{ Params: { id: string } }>('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const workflow = await getWorkflowInstance(id);
      if (!workflow) {
        return reply.code(404).send({ error: 'Workflow not found' });
      }
      return reply.send({ workflow });
    } catch (error) {
      fastify.log.error(error, 'Failed to get workflow');
      return reply.code(500).send({ error: 'Failed to get workflow' });
    }
  });

  // POST /api/workflows - Create a new workflow instance
  fastify.post('/api/workflows', async (request, reply) => {
    const validation = CreateWorkflowSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const data = validation.data;
    try {
      const workflow = await createWorkflowInstance({
        templateId: data.template_id,
        collectionId: data.collection_id,
        taskDescription: data.task_description,
        taskContext: data.task_context,
        sessionId: data.session_id,
      });

      return reply.code(201).send({
        message: 'Workflow created',
        workflow,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to create workflow');
      return reply.code(500).send({ error: 'Failed to create workflow' });
    }
  });

  // PATCH /api/workflows/:id - Update a workflow instance
  fastify.patch<{ Params: { id: string } }>('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params;
    const validation = UpdateWorkflowSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    try {
      const workflow = await updateWorkflowInstance(id, {
        status: validation.data.status,
        currentStepId: validation.data.current_step_id,
        completedSteps: validation.data.completed_steps,
        findings: validation.data.findings,
        finalOutput: validation.data.final_output,
      });

      if (!workflow) {
        return reply.code(404).send({ error: 'Workflow not found' });
      }

      return reply.send({
        message: 'Workflow updated',
        workflow,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to update workflow');
      return reply.code(500).send({ error: 'Failed to update workflow' });
    }
  });

  // POST /api/workflows/:id/step - Execute next step in workflow
  fastify.post<{ Params: { id: string } }>('/api/workflows/:id/step', async (request, reply) => {
    const { id } = request.params;

    try {
      const workflow = await getWorkflowInstance(id);
      if (!workflow) {
        return reply.code(404).send({ error: 'Workflow not found' });
      }

      if (workflow.status !== 'active') {
        return reply.code(400).send({
          error: 'Workflow is not active',
          status: workflow.status,
        });
      }

      // Get template to find steps
      let steps: Array<{ id: string; name: string }> = [];
      if (workflow.template_id) {
        const template = await getWorkflowTemplate(workflow.template_id);
        if (template) {
          steps = template.steps;
        }
      }

      // Find next step
      const completedSteps = workflow.completed_steps || [];
      const nextStep = steps.find((s) => !completedSteps.includes(s.id));

      if (!nextStep) {
        // All steps completed
        await updateWorkflowInstance(id, {
          status: 'completed',
          currentStepId: null,
        });
        return reply.send({
          message: 'Workflow completed',
          workflow_id: id,
          status: 'completed',
        });
      }

      // Update current step
      await updateWorkflowInstance(id, {
        currentStepId: nextStep.id,
      });

      return reply.send({
        message: 'Step started',
        workflow_id: id,
        current_step: nextStep,
        remaining_steps: steps.filter(
          (s) => !completedSteps.includes(s.id) && s.id !== nextStep.id
        ),
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to execute workflow step');
      return reply.code(500).send({ error: 'Failed to execute step' });
    }
  });
};
