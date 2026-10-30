#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/891a366bb63d48652e8b87217923ad7f3bfc80263699313e692c0c21246aaefb/contract';
import endContract from '../../snapshots/891a366bb63d48652e8b87217923ad7f3bfc80263699313e692c0c21246aaefb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c6302a5320d4e29242101d3ed27552237377ee55d7ff69918fe076ceccb2cd99/contract';
import startContract from '../../snapshots/c6302a5320d4e29242101d3ed27552237377ee55d7ff69918fe076ceccb2cd99/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_document_key',
      }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_tenant_id_document_key',
        columns: ['tenant_id', 'document'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
