import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { 
  listCollections, 
  getCollection, 
  createCollection,
  listDocuments 
} from '@synthesis/db';

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const collectionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/collections - List all collections
  fastify.get('/api/collections', async (request, reply) => {
    try {
      fastify.log.info('Attempting to list collections');
      const collections = await listCollections();
      fastify.log.info({ count: collections.length }, 'Collections retrieved');
      return reply.send({ collections });
    } catch (error) {
      fastify.log.error(error, 'Failed to list collections');
      return reply.code(500).send({ error: 'Failed to list collections' });
    }
  });

  // GET /api/collections/:id - Get collection by ID
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id',
    async (request, reply) => {
      try {
        const collection = await getCollection(request.params.id);
        
        if (!collection) {
          return reply.code(404).send({ error: 'Collection not found' });
        }

        return reply.send({ collection });
      } catch (error) {
        fastify.log.error(error, 'Failed to get collection');
        return reply.code(500).send({ error: 'Failed to get collection' });
      }
    }
  );

  // POST /api/collections - Create new collection
  fastify.post('/api/collections', async (request, reply) => {
    try {
      const validation = CreateCollectionSchema.safeParse(request.body);
      
      if (!validation.success) {
        return reply.code(400).send({ 
          error: 'Invalid request', 
          details: validation.error.issues 
        });
      }

      const { name, description } = validation.data;
      const collection = await createCollection(name, description);

      return reply.code(201).send({ collection });
    } catch (error) {
      fastify.log.error(error, 'Failed to create collection');
      return reply.code(500).send({ error: 'Failed to create collection' });
    }
  });

  // GET /api/collections/:id/documents - Get documents in collection
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/documents',
    async (request, reply) => {
      try {
        const documents = await listDocuments(request.params.id);
        return reply.send({ documents });
      } catch (error) {
        fastify.log.error(error, 'Failed to list documents');
        return reply.code(500).send({ error: 'Failed to list documents' });
      }
    }
  );
};
