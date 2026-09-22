import { fail, redirect } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createSupabaseServerClient } from '$lib/server/auth';
import { cleanSupabaseUrl, cleanSupabaseKey } from '$lib/supabase-config';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.userId) {
		throw redirect(303, '/dashboard');
	}
	if (privateEnv.FORCE_AUTH_DISABLED === 'true' && !url.searchParams.has('force')) {
		throw redirect(303, '/dashboard');
	}

	const procEnv = typeof process !== 'undefined' ? process.env : {};
	const supabaseUrl = cleanSupabaseUrl(PUBLIC_SUPABASE_URL || procEnv.PUBLIC_SUPABASE_URL || procEnv.SUPABASE_URL);
	const supabaseKey = cleanSupabaseKey(PUBLIC_SUPABASE_PUBLISHABLE_KEY || procEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY || procEnv.SUPABASE_PUBLISHABLE_KEY || procEnv.SUPABASE_ANON_KEY);

	return {
		serverSupabaseUrl: supabaseUrl,
		serverSupabaseKey: supabaseKey
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = String(formData.get('email') || '').trim();
		const password = String(formData.get('password') || '');

		if (!email || !password) {
			return fail(400, { error: 'Email dan password wajib diisi.' });
		}

		const supabase = createSupabaseServerClient(event);
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			if (error.message?.includes('Invalid login credentials')) {
				return fail(400, { error: 'Password salah atau email tidak terdaftar.' });
			}
			return fail(400, { error: error.message });
		}

		if (data?.session) {
			throw redirect(303, '/dashboard');
		}

		return { success: true };
	}
};
