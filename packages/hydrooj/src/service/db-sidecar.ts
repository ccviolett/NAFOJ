/* NAFOJ: multi-backend database support.
 *
 * Hydro keeps speaking the MongoDB wire protocol, while the actual storage can
 * be one of:
 *   - mongodb : unchanged, direct connection to a real MongoDB server
 *   - postgres: FerretDB sidecar translating to a PostgreSQL database
 *   - sqlite  : FerretDB sidecar translating to a local SQLite directory
 *
 * The sidecar is started on demand (and awaited) before MongoClient.connect,
 * so every entry point (worker / cli / scripts) gets the same behavior.
 * Pure mode/URL helpers live in ./db-url, which has no global.Hydro
 * dependencies and is therefore safe to import from standalone CLI commands.
 */
import { spawn } from 'child_process';
import net from 'net';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { hydroPath } from '../options';
import { Logger } from '../logger';
import { FERRETDB_VERSION, resolveDbMode, sidecarTarget } from './db-url';

export * from './db-url';

const logger = new Logger('db-sidecar');

export function probeTcp(host: string, port: number, timeout = 800): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        const done = (ok: boolean) => {
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeout, () => done(false));
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
    });
}

async function waitForTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop
        if (await probeTcp(host, port)) return true;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
}

export function findFerretDbBin(opts: any = {}): string | null {
    const exe = process.platform === 'win32' ? 'ferretdb.exe' : 'ferretdb';
    const goBin = process.env.GOPATH
        ? path.join(process.env.GOPATH, 'bin')
        : path.join(os.homedir(), 'go', 'bin');
    const candidates = [
        process.env.FERRETDB_BIN,
        opts.ferretdbBin,
        path.join(hydroPath, 'bin', exe),
        path.join(goBin, exe),
    ].filter((c) => !!c);
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

export async function ensureDbSidecar(opts: any = {}) {
    const mode = resolveDbMode(opts);
    if (mode === 'mongodb') return;
    const { host, port } = sidecarTarget(opts);
    if (await probeTcp(host, port)) {
        logger.info('FerretDB sidecar already listening at %s:%d', host, port);
        return;
    }
    const bin = findFerretDbBin(opts);
    if (!bin) {
        throw new Error(
            `db mode is "${mode}" but no ferretdb binary was found. `
            + `Install it with: go install github.com/FerretDB/FerretDB/cmd/ferretdb@${FERRETDB_VERSION} `
            + '(or point FERRETDB_BIN / db.ferretdbBin at one). See install/ferretdb/README.md',
        );
    }
    const args = ['--listen-addr', `${host}:${port}`, '--mode', 'normal', '--debug-addr', '127.0.0.1:0'];
    if (mode === 'sqlite') {
        const dir = process.env.FERRETDB_SQLITE_DIR || opts.sqliteDir || path.join(hydroPath, 'sqlite');
        fs.ensureDirSync(dir);
        const uri = `file:${dir.split(path.sep).join('/')}/`;
        args.push('--handler', 'sqlite', '--sqlite-url', uri);
    } else {
        const pgUrl = process.env.FERRETDB_POSTGRESQL_URL
            || opts.postgresqlUrl
            || 'postgres://127.0.0.1:5432/ferretdb?search_path=hydro';
        args.push('--handler', 'postgresql', '--postgresql-url', pgUrl);
    }
    const logPath = path.join(hydroPath, 'ferretdb.log');
    const logFd = fs.openSync(logPath, 'a');
    logger.info('Starting FerretDB sidecar (%s mode) at %s:%d (log: %s)', mode, host, port, logPath);
    const child = spawn(bin, args, { stdio: ['ignore', logFd, logFd] });
    child.on('exit', (code, signal) => {
        logger.error('FerretDB sidecar exited (code=%s signal=%s). See %s', code, signal, logPath);
    });
    if (!await waitForTcp(host, port, 30000)) {
        throw new Error(`FerretDB sidecar failed to start at ${host}:${port}. Check ${logPath}`);
    }
    logger.success('FerretDB sidecar is up at %s:%d', host, port);
}
