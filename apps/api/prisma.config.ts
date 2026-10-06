/// <reference types="node" />

import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/contract.prisma",

    migrations: {
      dir: "./prisma/migrations",
    },

    db: {
      connection: process.env['DB_URL']!,
    },
    
  }),
});
