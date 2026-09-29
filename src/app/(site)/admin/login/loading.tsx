/**
 * Renders nothing so the parent admin/loading.tsx (header + nav) never
 * flashes over the centered sign-in form, e.g. after sign-out or an expired
 * session redirect. A nested loading.tsx replaces the parent's for this
 * segment; null keeps login's behavior identical to before loading.tsx existed.
 */
export default function LoginLoading() {
  return null;
}
