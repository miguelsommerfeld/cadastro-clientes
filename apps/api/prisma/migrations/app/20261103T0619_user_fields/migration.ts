#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/891a366bb63d48652e8b87217923ad7f3bfc80263699313e692c0c21246aaefb/contract';
import startContract from '../../snapshots/891a366bb63d48652e8b87217923ad7f3bfc80263699313e692c0c21246aaefb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ce84694f2692e5b625433f33d78a6eb78ac1e628e32cdf67d4f484328003c333/contract';
import endContract from '../../snapshots/ce84694f2692e5b625433f33d78a6eb78ac1e628e32cdf67d4f484328003c333/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({ schema: 'public', table: 'addresses', constraint: 'addresses_id_key' }),
      this.dropConstraint({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_email_key',
      }),
      this.dropConstraint({ schema: 'public', table: 'customers', constraint: 'customers_id_key' }),
      this.dropConstraint({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_tenant_id_document_key',
      }),
      this.dropConstraint({ schema: 'public', table: 'tenants', constraint: 'tenants_id_key' }),
      this.dropIndex({ schema: 'public', table: 'users', index: 'users_tenant_id_idx_41c0d441' }),
      this.dropConstraint({ schema: 'public', table: 'users', constraint: 'users_email_key' }),
      this.dropConstraint({ schema: 'public', table: 'users', constraint: 'users_id_key' }),
      this.addColumn({
        schema: 'public',
        table: 'customers',
        column: col('created_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'customers',
        column: col('deleted_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'customers',
        column: col('updated_by', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('is_active', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('last_login_at', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addPrimaryKey({
        schema: 'public',
        table: 'sessions',
        constraint: 'sessions_pkey',
        columns: ['id'],
      }),
      this.addPrimaryKey({
        schema: 'public',
        table: 'tenants',
        constraint: 'tenants_pkey',
        columns: ['id'],
      }),
      this.addPrimaryKey({
        schema: 'public',
        table: 'users',
        constraint: 'users_pkey',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_tenant_id_document_email_key',
        columns: ['tenant_id', 'document', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_tenant_id_email_idx_511e4059',
        columns: ['tenant_id', 'email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
