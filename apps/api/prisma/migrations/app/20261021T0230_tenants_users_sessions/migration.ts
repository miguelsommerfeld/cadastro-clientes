#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2f5b92d3beb98084793cccdcc55e41cf99bd6f1378df5babee84df21b6bcfaba/contract';
import endContract from '../../snapshots/2f5b92d3beb98084793cccdcc55e41cf99bd6f1378df5babee84df21b6bcfaba/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a1398f020a3d344a085758e38ddbb76b9da8e9045351b1bceac45fd368f3f108/contract';
import startContract from '../../snapshots/a1398f020a3d344a085758e38ddbb76b9da8e9045351b1bceac45fd368f3f108/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  rawSql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'sessions',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expires_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('refresh_token_hash', 'character varying(253)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 253 } },
          }),
          col('revoked_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('user_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'tenants',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('slug', 'character varying', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'character varying(254)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 254 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'character varying(100)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 100 } },
          }),
          col('password_hash', 'character varying(253)', {
            notNull: true,
            codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 253 } },
          }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenant_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          checkExpression('users_role_check_ad305855', `"role" IN ('ADMIN', 'OPERATOR', 'VIEWER')`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'customers',
        column: col('tenant_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      rawSql({
        id: 'guard.customers.tenant_id_backfill',
        label: 'Require a tenant mapping for existing customers',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: { schema: 'public', objectType: 'table', name: 'customers' },
        },
        precheck: [{ description: 'run tenant mapping guard', sql: 'SELECT true AS "result"', params: [] }],
        execute: [{
          description: 'reject unmapped existing customers',
          sql: `DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM "public"."customers" WHERE "tenant_id" IS NULL) THEN
              RAISE EXCEPTION 'Cannot apply tenant migration: existing customers need an explicit tenant mapping.';
            END IF;
          END $$`,
          params: [],
        }],
        postcheck: [{ description: 'verify tenant mapping guard', sql: 'SELECT true AS "result"', params: [] }],
      }),
      this.setNotNull({ schema: 'public', table: 'customers', column: 'tenant_id' }),
      rawSql({
        id: 'data.addresses.backfill_number',
        label: 'Set the default number for addresses without one',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: { schema: 'public', objectType: 'table', name: 'addresses' },
        },
        precheck: [{
          description: 'find addresses without a number',
          sql: 'SELECT EXISTS (SELECT 1 FROM "public"."addresses" WHERE "number" IS NULL) AS "result"',
          params: [],
        }],
        execute: [{
          description: 'set the default number on existing addresses',
          sql: `UPDATE "public"."addresses"
            SET "number" = 'S/N'
            WHERE "number" IS NULL`,
          params: [],
        }],
        postcheck: [{
          description: 'verify every address has a number',
          sql: 'SELECT NOT EXISTS (SELECT 1 FROM "public"."addresses" WHERE "number" IS NULL) AS "result"',
          params: [],
        }],
      }),
      this.setNotNull({ schema: 'public', table: 'addresses', column: 'number' }),
      this.dropNotNull({ schema: 'public', table: 'addresses', column: 'complement' }),
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_tenant_id_key',
        columns: ['tenant_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'sessions',
        constraint: 'sessions_user_id_key',
        columns: ['user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tenants',
        constraint: 'tenants_id_key',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tenants',
        constraint: 'tenants_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_id_key',
        columns: ['id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_tenant_id_key',
        columns: ['tenant_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
