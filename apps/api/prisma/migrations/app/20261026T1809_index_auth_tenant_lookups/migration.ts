#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2f5b92d3beb98084793cccdcc55e41cf99bd6f1378df5babee84df21b6bcfaba/contract';
import startContract from '../../snapshots/2f5b92d3beb98084793cccdcc55e41cf99bd6f1378df5babee84df21b6bcfaba/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c6302a5320d4e29242101d3ed27552237377ee55d7ff69918fe076ceccb2cd99/contract';
import endContract from '../../snapshots/c6302a5320d4e29242101d3ed27552237377ee55d7ff69918fe076ceccb2cd99/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_tenant_id_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'sessions',
        constraint: 'sessions_user_id_key',
      }),
      this.dropConstraint({ schema: 'public', table: 'users', constraint: 'users_tenant_id_key' }),
      this.createIndex({
        schema: 'public',
        table: 'customers',
        index: 'customers_tenant_id_idx_41c0d441',
        columns: ['tenant_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_refresh_token_hash_idx_703bb9a0',
        columns: ['refresh_token_hash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sessions',
        index: 'sessions_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'users',
        index: 'users_tenant_id_idx_41c0d441',
        columns: ['tenant_id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
