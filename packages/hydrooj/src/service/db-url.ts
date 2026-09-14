/* NAFOJ: pure database-mode helpers.
 *
 * Kept free of any import that touches global.Hydro (logger, context, ...) so
 * standalone CLI commands (`hydrooj db`, backup/restore) can use them before
 * the app context is initialized.
 */
export type DbMode = 'mongodb' | 'postgres' | 'sqlite';
export const FERRETDB_VERSION = 'v1.24.2';

export function resolveDbMode(opts: any = {}): DbMode {
    const mode = process.env.HYDRO_DB_MODE || opts.mode || 'mongodb';
    if (mode !== 'mongodb' && mode !== 'postgres' && mode !== 'sqlite') {
        throw new Error(`Unsupported db mode: ${mode} (expected mongodb | postgres | sqlite)`);
    }
    return mode;
}

export interface SidecarTarget {
    host: string;
    port: number;
}

export function sidecarTarget(opts: any = {}): SidecarTarget {
    return {
        host: process.env.FERRETDB_HOST || opts.ferretdbHost || '127.0.0.1',
        port: parseInt(String(process.env.FERRETDB_PORT || opts.ferretdbPort || 27018), 10) || 27018,
    };
}

export function buildMongoUrl(opts: any = {}): string {
    const mode = resolveDbMode(opts);
    if (mode !== 'mongodb') {
        const { host, port } = sidecarTarget(opts);
        const name = opts.name || 'hydro';
        if (opts.username) {
            return `mongodb://${opts.username}:${encodeURIComponent(opts.password || '')}@${host}:${port}/${name}`;
        }
        return `mongodb://${host}:${port}/${name}`;
    }
    if (opts.url || opts.uri) return opts.url || opts.uri;
    let mongourl = `${opts.protocol || 'mongodb'}://`;
    if (opts.username) mongourl += `${opts.username}:${encodeURIComponent(opts.password)}@`;
    mongourl += `${opts.host}:${opts.port}/${opts.name}`;
    return mongourl;
}
