import { OpcountExceededError } from '../error';
import db from '../service/db';

const coll = db.collection('opcount');

export async function inc(op: string, ident: string, periodSecs: number, maxOperations: number) {
    const now = Date.now();
    const expireAt = new Date(now - (now % (periodSecs * 1000)) + periodSecs * 1000);
    const filter = {
        op, ident, expireAt, opcount: { $lt: maxOperations },
    };
    try {
        const res = await coll.findOneAndUpdate(filter, { $inc: { opcount: 1 } }, { upsert: true, returnDocument: 'after' });
        return res.opcount;
    } catch (e) {
        if (e.message.includes('duplicate')) {
            // Parallel first-in-window requests race the upsert insert; the loser
            // has NOT actually exceeded anything. Retry as a plain update now that
            // the winner created the doc; only a genuine cap hit still throws.
            for (let i = 0; i < 3; i++) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 20));
                // eslint-disable-next-line no-await-in-loop
                try {
                    const res = await coll.findOneAndUpdate(filter, { $inc: { opcount: 1 } }, { returnDocument: 'after' });
                    if (res) return res.opcount;
                } catch (e2) { /* keep retrying */ }
            }
            throw new OpcountExceededError(op, periodSecs, maxOperations);
        }
        throw e;
    }
}

export const apply = () => db.ensureIndexes(
    coll,
    { key: { expireAt: -1 }, name: 'expire', expireAfterSeconds: 0 },
    { key: { op: 1, ident: 1, expireAt: 1 }, name: 'unique', unique: true },
);
global.Hydro.model.opcount = { inc, apply };
