#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a1398f020a3d344a085758e38ddbb76b9da8e9045351b1bceac45fd368f3f108/contract';
import endContract from '../../snapshots/a1398f020a3d344a085758e38ddbb76b9da8e9045351b1bceac45fd368f3f108/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d4beb8c9174667406f9da23807536cc554461f12fb13a0dafcf0564c54689742/contract';
import startContract from '../../snapshots/d4beb8c9174667406f9da23807536cc554461f12fb13a0dafcf0564c54689742/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'addresses',
        columns: [
          col('city', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('complement', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('customer_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('district', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('number', 'character varying(10)', {
            default: lit('S/N'),
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 10 } },
          }),
          col('state', 'character varying(2)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 2 } },
          }),
          col('street', 'character varying(150)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 150 } },
          }),
          col('zip_code', 'character varying(8)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 8 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'addresses',
        constraint: 'addresses_id_key',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'addresses',
        constraint: 'addresses_customer_id_key',
        columns: ['customer_id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
