/**
 * Typed escape hatch: until `supabase gen types` is run,
 * table queries are typed as `never`. This helper casts
 * the admin client to `any` so we can build without generated types.
 * Replace with the generated Database type once the schema is applied.
 */
import { adminClient } from "./admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db(): any {
  return adminClient();
}
