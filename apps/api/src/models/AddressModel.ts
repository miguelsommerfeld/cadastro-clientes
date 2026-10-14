import type {
    AddressRequestSchema,
    AddressUpdateData
} from "@packages/contracts/address.schema";
import { randomUUID } from 'node:crypto'
import type { Models } from '../../prisma/contract';
import { Model } from './Model'

export class AddressModel extends Model
{
    public async registerAddress(customerId: string, addressData: AddressRequestSchema)
    {
        const address = {
            id: randomUUID(),
            customerId: this.toVarchar(customerId, customerId.length),
            zipCode: this.toVarchar(addressData.zipCode, 8),
            street: this.toVarchar(addressData.street, 150),
            number: typeof addressData.number === 'string' ? this.toVarchar(addressData.number, 10) : null,
            complement: this.toVarchar(addressData.complement, 100),
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

    public updateAddress(customerId: string, addressData: AddressUpdateData)
    {
        if (addressData.number === undefined) {
            return null;
        }

        return this.db.orm.public.Addresses
            .where({ customerId })
            .update({
                number: addressData.number === null
                    ? null
                    : this.toVarchar(addressData.number, 10)
            });
    }

    public getAllAddresses()
    {
        return this.db.orm.public.Addresses.all();
    }
}