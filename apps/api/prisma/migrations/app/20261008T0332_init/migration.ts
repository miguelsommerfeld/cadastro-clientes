#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ec67bfb054406d9b7cdbfc72583d1b8718dda90097ebc98b4220c4e1432da7a7/contract';
import endContract from '../../snapshots/ec67bfb054406d9b7cdbfc72583d1b8718dda90097ebc98b4220c4e1432da7a7/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'customers',
        columns: [
          col('birth_date', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('deleted_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('document', 'character varying(14)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 14 } },
          }),
          col('email', 'character varying(254)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 254 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'character varying(150)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 150 } },
          }),
          col('person_type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'character varying(11)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 11 } },
          }),
          col('trade_name', 'character varying(150)', {
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 150 } },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'customers_person_type_check_5522ac3e',
            `"person_type" IN ('INDIVIDUAL', 'COMPANY')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_id_key',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_document_key',
        columns: ['document'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
