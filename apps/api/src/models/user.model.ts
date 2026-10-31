import type { Models } from "../../prisma/contract";
import { Model } from "./model";

export class UserModel extends Model {
    public async registerUser(userData: Models.public_Users) {
        await this.db.orm.public.Users.create(userData);
    }
}