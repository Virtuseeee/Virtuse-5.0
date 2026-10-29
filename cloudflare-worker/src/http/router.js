// A request goes through an ordered list of steps; the first step that
// returns a Response answers it. Order is behaviour here: public routes run
// before the origin gate, the gate before the site routes.

export const ANY = null;

function methodMatches(methods, method) {
  return methods === ANY || methods.includes(method);
}

function pathMatches(path, pathname) {
  if (path === ANY) return true;
  if (typeof path === 'string') return path === pathname;
  if (Array.isArray(path)) return path.includes(pathname);
  return pathname.startsWith(path.prefix);
}

export function prefix(value) {
  return { prefix: value };
}

// A step that answers only requests matching `methods` (array or ANY) and
// `path` (string, array of strings, prefix(...) or ANY).
export function on(methods, path, handler) {
  return (ctx) => (methodMatches(methods, ctx.method) && pathMatches(path, ctx.path) ? handler(ctx) : undefined);
}

export function pipeline(...steps) {
  return async (ctx) => {
    for (const step of steps) {
      const res = await step(ctx);
      if (res) return res;
    }
    throw new Error(`No step answered ${ctx.method} ${ctx.path}`);
  };
}
