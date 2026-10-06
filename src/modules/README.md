# Modules

One folder per domain module, each owning its collections, business rules and UI
(system-design §4). A module contains `schema.ts`, `repository.ts`, `service.ts`,
`actions.ts` and `components/`.

1. **One way in.** Use a module through its `service.ts`. Nothing outside it touches another
   module's repository or collections.
2. **Repositories are scoped.** Every repository method takes the request context and applies
   `weddingId` itself. There is no unscoped `find`. `getDb()` may only be imported in a
   `repository.ts` or under `src/lib/` (enforced by ESLint).
3. **Server Actions are the boundary.** Each action validates input with Zod, resolves the
   context, checks permission, then calls the service.
4. **Cross-module work goes through events.** When an RSVP changes, guests emits an internal
   event that notifications handles, rather than writing to another module's data.
5. **Themes are presentation only.** All website themes consume the same data shape.
