import { NextResponse, type NextRequest } from "next/server";
import { siteSlugFromHost } from "@/lib/site-host";

// Wedding sites are served on <slug>.<root domain> (system-design §5). The slug is
// resolved from the Host header and the site's root is rewritten to (public)/[slug].
export function proxy(request: NextRequest) {
  const slug = siteSlugFromHost(request.headers.get("host"), process.env.APP_ROOT_DOMAIN);
  if (slug && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|images|favicon.ico).*)"],
};
