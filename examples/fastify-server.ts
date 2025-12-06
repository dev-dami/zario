import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import { Logger, ConsoleTransport } from '../src';

const logger = new Logger({
    prefix: '[FastifyServer]',
    transports: [new ConsoleTransport()]
});

const fastify = Fastify();
fastify.decorate('logger', logger);
declare module 'fastify' {
    interface FastifyInstance {
        logger: Logger;
    }
    interface FastifyRequest {
        logger: Logger;
    }
}

fastify.addHook('onRequest', async (req: FastifyRequest, reply) => {
    req.logger = logger.createChild({
        prefix: `[${req.method} ${req.url}]`
    });

    req.logger.info('Incoming request');
});

fastify.get('/', async (req: FastifyRequest, reply) => {
    req.logger.info('Handling home route');
    return { hello: 'world' };
});

fastify.get('/error', async (req: FastifyRequest, reply) => {
    req.logger.error('Something went wrong', { errorCode: 500 });
    return { error: true };
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000 });
        logger.info('Server running at http://localhost:3000');
    } catch (err) {
        logger.error('Failed to start server', { error: err });
        process.exit(1);
    }
};

start();