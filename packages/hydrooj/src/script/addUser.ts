import Schema from 'schemastery';
import { Context } from '../context';
import user from '../model/user';

export const apply = (ctx: Context) => ctx.addScript(
    'addUser', 'create a user, optionally granting super admin',
    Schema.object({
        mail: Schema.string().required(),
        uname: Schema.string().required(),
        password: Schema.string().required(),
        asAdmin: Schema.boolean().default(true),
    }),
    async ({ mail, uname, password, asAdmin }) => {
        const uid = await user.create(mail, uname, password);
        if (asAdmin) await user.setSuperAdmin(uid);
        return true;
    },
);
