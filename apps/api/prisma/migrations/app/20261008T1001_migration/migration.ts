#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/64486d1cb6ed92929cbc0e3cc5aed5e31efbb2f84882fdc7e9a73a33168df698/contract';
import endContract from '../../snapshots/64486d1cb6ed92929cbc0e3cc5aed5e31efbb2f84882fdc7e9a73a33168df698/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ec67bfb054406d9b7cdbfc72583d1b8718dda90097ebc98b4220c4e1432da7a7/contract';
import startContract from '../../snapshots/ec67bfb054406d9b7cdbfc72583d1b8718dda90097ebc98b4220c4e1432da7a7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, placeholder } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dataTransform(endContract, 'typechange-customers-document', {
        check: () => placeholder('typechange-customers-document:check'),
        run: () => placeholder('typechange-customers-document:run'),
      }),
      this.alterColumnType({
        schema: 'public',
        table: 'customers',
        column: 'document',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'customers',
        constraint: 'customers_document_check_1c70a9e7',
        expression: `"document" IN ('INDIVIDUAL', 'COMPANY')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
