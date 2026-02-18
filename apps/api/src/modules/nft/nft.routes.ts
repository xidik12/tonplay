import type { FastifyInstance } from 'fastify';
import { getCollections, getCollectionItems, getOwnedNfts, equipNft, unequipNft } from './nft.service.js';

export async function nftRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/nft/collections', {
    schema: { description: 'List NFT collections', tags: ['nft'] },
    handler: async (_request, reply) => {
      const data = await getCollections();
      return reply.send({ success: true, data });
    },
  });

  app.get<{ Params: { id: string } }>('/nft/collection/:id/items', {
    schema: {
      description: 'Get collection items', tags: ['nft'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const data = await getCollectionItems(request.params.id);
      return reply.send({ success: true, data });
    },
  });

  app.get('/nft/owned', {
    schema: { description: 'Get owned NFTs', tags: ['nft'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const data = await getOwnedNfts(userId);
      return reply.send({ success: true, data });
    },
  });

  app.post<{ Params: { nftId: string } }>('/nft/equip/:nftId', {
    schema: {
      description: 'Equip an NFT', tags: ['nft'],
      params: { type: 'object', required: ['nftId'], properties: { nftId: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await equipNft(userId, request.params.nftId);
      return reply.send({ success: true });
    },
  });

  app.post<{ Params: { nftId: string } }>('/nft/unequip/:nftId', {
    schema: {
      description: 'Unequip an NFT', tags: ['nft'],
      params: { type: 'object', required: ['nftId'], properties: { nftId: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await unequipNft(userId, request.params.nftId);
      return reply.send({ success: true });
    },
  });
}
