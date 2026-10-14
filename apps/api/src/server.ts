import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from '@fastify/type-provider-zod'
import dependencies from '../config/dependencies.ts'
import healthcheck from './routes/healthcheck.ts'
import customersRoutes from './routes/customers.ts'

const server = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

// Type Settings
server.setValidatorCompiler(validatorCompiler)
server.setSerializerCompiler(serializerCompiler)

// Registering dependencies and routes
server.register(dependencies)
server.register(healthcheck)
server.register(customersRoutes, { prefix: '/api/v1/' })

server.listen({ port: 3333, host: '0.0.0.0'}, (err: any, address: any) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})

