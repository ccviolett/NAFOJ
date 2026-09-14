import { Context, PRIV } from 'hydrooj';

// NAFOJ multi-class isolation.
// Each class lives in its own domain; students must not discover that other
// classes (domains) exist. Lock every cross-domain surface behind
// PRIV_VIEW_ALL_DOMAIN so only site admins can use them.
// (withHandlerClass wraps the already-registered core handlers in place,
// no core code is touched.)
const CROSS_DOMAIN_HANDLERS: Record<string, string[]> = {
    // /domain/search prefix-searches ALL domains by id and name
    DomainSearch: ['get'],
    // /home/domain lists joined domains and shows join/create UI
    HomeDomain: ['get', 'postStar', 'postLeave'],
};

export function apply(ctx: Context) {
    for (const [name, methods] of Object.entries(CROSS_DOMAIN_HANDLERS)) {
        ctx.withHandlerClass(name as any, (HandlerClass: any) => {
            for (const method of methods) {
                const original = HandlerClass.prototype[method];
                if (!original) continue;
                HandlerClass.prototype[method] = function nafojDomainIsolation(...args: any[]) {
                    this.checkPriv(PRIV.PRIV_VIEW_ALL_DOMAIN);
                    return original.apply(this, args);
                };
            }
        });
    }
}
