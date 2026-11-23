// Runs only for the paths listed in /_routes.json (everything else is served straight from the static files).
// 1. Keeps the repository's private working files (notes, build scripts, source) from being served as web pages.
// 2. Serves the office app (office.fakes.com) from the /office/ folder.
const PRIVATE = [/^\/claude\.md$/i, /^\/readme\.md$/i, /^\/build\.py$/i, /^\/_routes\.json$/i,
  /^\/(tools|lib|content|functions|\.github)(\/|$)/i];

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const path = url.pathname;
  if (PRIVATE.some(re => re.test(path))) {
    const page = await ctx.env.ASSETS.fetch(new URL("/404.html", url));
    return new Response(page.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const office = url.hostname === "office.fakes.com";
  if (office && path === "/") {
    return ctx.env.ASSETS.fetch(new URL("/office/", url));
  }
  return ctx.next();
}
