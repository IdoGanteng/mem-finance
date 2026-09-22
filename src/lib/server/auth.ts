import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import { cleanSupabaseUrl, cleanSupabaseKey } from '$lib/supabase-config';

export function createSupabaseServerClient(event: RequestEvent) {
	const url = cleanSupabaseUrl(PUBLIC_SUPABASE_URL);
	const key = cleanSupabaseKey(PUBLIC_SUPABASE_PUBLISHABLE_KEY);

	return createServerClient(
		url,
		key,
		{
			cookies: {
				getAll() {
					const cookies: { name: string; value: string }[] = [];
					for (const { name, value } of event.cookies.getAll()) {
						cookies.push({ name, value });
					}
					return cookies;
				},
				setAll(cookiesToSet) {
					for (const { name, value, options } of cookiesToSet) {
						event.cookies.set(name, value, {
							...options,
							path: options.path ?? '/'
						});
					}
				}
			}
		}
	);
}
