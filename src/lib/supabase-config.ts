export const DEFAULT_SUPABASE_URL = 'https://knawnlginiulbnfobrwv.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_qTQWNQB8R6Fb3qJuxwRcNQ_PXAZ302I';

export function cleanSupabaseUrl(url?: string): string {
	let u = (url || '').trim().replace(/^['"]|['"]$/g, '');
	if (!u) u = DEFAULT_SUPABASE_URL;
	if (u.startsWith('/http')) u = u.substring(1);
	u = u.replace(/\/rest\/v1\/?$/, '');
	return u.replace(/\/+$/, '');
}

export function cleanSupabaseKey(key?: string): string {
	let k = (key || '').trim().replace(/^['"]|['"]$/g, '');
	if (!k) k = DEFAULT_SUPABASE_KEY;
	return k;
}
