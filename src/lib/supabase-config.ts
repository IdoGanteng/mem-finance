export function cleanSupabaseUrl(url?: string): string {
	if (!url) return '';
	let u = url.trim().replace(/^['"]|['"]$/g, '');
	if (u.startsWith('/http')) u = u.substring(1);
	u = u.replace(/\/rest\/v1\/?$/, '');
	return u.replace(/\/+$/, '');
}

export function cleanSupabaseKey(key?: string): string {
	if (!key) return '';
	return key.trim().replace(/^['"]|['"]$/g, '');
}
