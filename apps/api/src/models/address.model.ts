import type {
    AddressRequestSchema,
    AddressUpdateData
} from "@packages/contracts/address.schema";
import { randomUUID } from 'node:crypto'
import type { Models } from '../../prisma/contract';
import { Model } from './model'

export class AddressModel extends Model
{
    public async registerAddress(customerId: string, addressData: AddressRequestSchema)
    {
        const address = {
            id: randomUUID(),
            customerId: this.toVarchar(customerId, customerId.length),
            zipCode: this.toVarchar(addressData.zipCode, 8),
            street: this.toVarchar(addressData.street, 150),
            number: this.toVarchar(addressData.number ?? "S/N", 10),
            complement: addressData.complement === null
                ? null
                : this.toVarchar(addressData.complement, 100),
            district: this.toVarchar(addressData.district, 100),
            city: this.toVarchar(addressData.city, 100),
            state: this.toVarchar(addressData.state, 2)
        } satisfies Models.public_Addresses;

        return this.db.orm.public.Addresses.create(address);
    }

    public getAddress(customerId: string)
    {
        return this.db.orm.public.Addresses.where({ customerId }).first();
    }

    public async updateAddress(customerId: string, addressData: AddressUpdateData)
    {
        const updates: Partial<Pick<
            Models.public_Addresses,
            "zipCode" | "street" | "number" | "complement" | "district" | "city" | "state"
        >> = {};

        if (addressData.zipCode !== undefined) {
            updates.zipCode = this.toVarchar(addressData.zipCode, 8);
        }
        if (addressData.street !== undefined) {
            updates.street = this.toVarchar(addressData.street, 150);
        }
        if (addressData.number !== undefined) {
            updates.number = this.toVarchar(addressData.number, 10);
        }
        if (addressData.complement !== undefined) {
            updates.complement = addressData.complement === null
                ? null
                : this.toVarchar(addressData.complement, 100);
        }
        if (addressData.district !== undefined) {
            updates.district = this.toVarchar(addressData.district, 100);
        }
        if (addressData.city !== undefined) {
            updates.city = this.toVarchar(addressData.city, 100);
        }
        if (addressData.state !== undefined) {
            updates.state = this.toVarchar(addressData.state, 2);
        }

        if (Object.keys(updates).length === 0) {
            return null;
        }

        return this.db.orm.public.Addresses
            .where({ customerId })
            .update(updates);
    }

    public deleteAddress(customerId: string)
    {
        return this.db.orm.public.Addresses.where({ customerId }).deleteAll();
    }

    public getAllAddresses(customerIds: string[])
    {
        if (customerIds.length === 0) return Promise.resolve([]);
        return this.db.orm.public.Addresses
            .where((address) => address.customerId.in(customerIds))
            .all();
    }
}