import type { NextConfig } from "next";

// Content-Security-Policy (production only; the dev server needs inline eval for hot reload).
//   - Scripts and styles come from this site. 'unsafe-inline' stays because Next injects small inline
//     scripts and styles without a per-request nonce; the rest of the policy is what matters: no
//     third-party script can load, nothing can be sent to or pulled from another host except our own
//     photo storage, nobody can frame the site, and forms and plug-ins are locked down.
//   - Photos live in Cloudflare R2 and are loaded and uploaded straight from the browser, so only
//     that host is allowed besides this site. data: and blob: cover the QR codes and downloads.
//   - The only thing framed is the privacy-friendly YouTube player used for the live stream.
const R2 = "https://*.r2.cloudflarestorage.com";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${R2}`,
  "font-src 'self' data:",
  `connect-src 'self' ${R2}`,
  "media-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

// In development the policy stays as small as it was, so hot reload and the dev tools keep working.
const devCsp =
  "frame-src https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: process.env.NODE_ENV === "production" ? csp : devCsp,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The camera is needed on this site only, for scanning entry codes at the gate.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
