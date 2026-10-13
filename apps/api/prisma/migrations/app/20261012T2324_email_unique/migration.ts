#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a9d7a3963268a13cfb36a8bfa31eb6f431d23c9c2cbeefb3d4ae6453234df575/contract';
import startContract from '../../snapshots/a9d7a3963268a13cfb36a8bfa31eb6f431d23c9c2cbeefb3d4ae6453234df575/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d4beb8c9174667406f9da23807536cc554461f12fb13a0dafcf0564c54689742/contract';
import endContract from '../../snapshots/d4beb8c9174667406f9da23807536cc554461f12fb13a0dafcf0564c54689742/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addUnique({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
