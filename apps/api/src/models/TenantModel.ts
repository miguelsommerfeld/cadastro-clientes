import type { Models } from "../../prisma/contract";
import { Model } from "./Model";

export class TenantModel extends Model {
    public async registerTenant(tenantData: Models.public_Tenants) {
        await this.db.orm.public.Tenants.create(tenantData);
    }
}