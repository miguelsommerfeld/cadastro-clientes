import type { Varchar } from '@prisma/orm-postgres/target/codec-types';
import { db } from '@db';

export abstract class Model
{
    protected db = db;

    // Casts from string to a Varchar type
    protected toVarchar<Length extends number>(value: string, maxLength: Length): Varchar<Length>
    {
        if ([...value].length > maxLength) {
            throw new RangeError(`Value exceeds the maximum length of ${maxLength}`);
        }

        // The generated Prisma contract brands varchar values by their declared length.
        return value as Varchar<Length>;
    }
}