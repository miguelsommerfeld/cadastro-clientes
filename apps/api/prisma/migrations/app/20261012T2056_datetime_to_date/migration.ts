#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a9d7a3963268a13cfb36a8bfa31eb6f431d23c9c2cbeefb3d4ae6453234df575/contract';
import endContract from '../../snapshots/a9d7a3963268a13cfb36a8bfa31eb6f431d23c9c2cbeefb3d4ae6453234df575/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ec67bfb054406d9b7cdbfc72583d1b8718dda90097ebc98b4220c4e1432da7a7/contract';
import startContract from '../../snapshots/ec67bfb054406d9b7cdbfc72583d1b8718dda90097ebc98b4220c4e1432da7a7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.alterColumnType({
        schema: 'public',
        table: 'customers',
        column: 'birth_date',
        options: {
          qualifiedTargetType: 'date',
          formatTypeExpected: 'date',
          rawTargetTypeForLabel: 'date',
          using: `("birth_date" AT TIME ZONE 'UTC')::date`,
        },
      }),
      this.dropNotNull({ schema: 'public', table: 'customers', column: 'updated_at' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
