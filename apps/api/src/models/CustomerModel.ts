import { db } from '@db';

export class CustomerModel
{
    public registerCustomer(userData: any): void
    {
        db.orm.public.Customers.create({
            data: {
                personType: userData.properties.personType,
                document: userData.properties.document,
                birthDate: userData.properties.birthDate,
                email: userData.properties.email,
                phone: userData.properties.phone,
                // address: {
                //     create: {
                //         zipCode: null,
                //         street: null,
                //         number: null,
                //         complement: null,
                //         district: null,
                //         city: null,
                //         state: null
                //     }
                // }
            }
        });
    }

    public getAllCustomers()
    {
        return db.orm.public.Customers.all();
    }

    // public getCustomerById(id: string)
    // {
    //     return db.orm.public.Customers.where({ id: id }).first();
    // }
}