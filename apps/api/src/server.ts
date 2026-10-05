import Fastify from 'fastify'
import { serializerCompiler } from '@fastify/type-provider-zod';
import healthCheck from './routes/health_check.ts'

const server = Fastify({logger: true})

server.setSerializerCompiler(serializerCompiler);

server.register(healthCheck)

server.listen({ port: 3000, host: '127.0.0.1' }, function (err: any, address: any) {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})

