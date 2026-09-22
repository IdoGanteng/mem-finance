<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_TURNSTILE_SITE_KEY } from '$env/static/public';
	import { createBrowserClient } from '@supabase/ssr';
	import Button from '$lib/components/ui/Button.svelte';
	import { cleanSupabaseUrl, cleanSupabaseKey } from '$lib/supabase-config';

	let { data } = $props();

	let activeUrl = $derived(cleanSupabaseUrl(PUBLIC_SUPABASE_URL || data?.serverSupabaseUrl));
	let activeKey = $derived(cleanSupabaseKey(PUBLIC_SUPABASE_PUBLISHABLE_KEY || data?.serverSupabaseKey));

	let supabaseConfigured = $derived(!!activeUrl && !!activeKey);

	let authMethod = $state<'password' | 'otp'>('password');
	let step = $state<'email' | 'otp'>('email');
	let email = $state('aldianridhoku@gmail.com');
	let password = $state('');
	let showPassword = $state(false);

	let otpDigits = $state(['', '', '', '', '', '']);
	let captchaToken = $state('');
	let loading = $state(false);
	let error = $state('');
	let successMessage = $state('');
	let resendCooldown = $state(0);
	let turnstileReady = $state(false);
	let turnstileWidgetId: string | undefined;

	let supabase = $derived(supabaseConfigured ? createBrowserClient(activeUrl, activeKey) : null);

	let emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
	let otpToken = $derived(otpDigits.join(''));
	let otpComplete = $derived(otpToken.length === 6);
	let canResend = $derived(resendCooldown === 0 && !loading);

	let turnstileRequired = $derived(!!PUBLIC_TURNSTILE_SITE_KEY);
	let canSubmitEmail = $derived(emailValid && !loading && (!turnstileRequired || turnstileReady));

	function resetError() { error = ''; }

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const errParam = urlParams.get('error');
		if (errParam === 'unauthorized_email') {
			error = 'Akses ditolak: Akun ini tidak memiliki izin. Hanya aldianridhoku@gmail.com yang diizinkan.';
		} else if (errParam === 'auth_failed') {
			error = 'Autentikasi gagal. Silakan coba lagi.';
		}

		if (PUBLIC_TURNSTILE_SITE_KEY) {
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.onload = () => {
				const el = document.getElementById('turnstile-widget');
				if (el && window.turnstile) {
					turnstileWidgetId = window.turnstile.render('#turnstile-widget', {
						sitekey: PUBLIC_TURNSTILE_SITE_KEY,
						callback: (token: string) => { captchaToken = token; },
						theme: 'light',
						size: 'normal'
					});
					turnstileReady = true;
				}
			};
			document.head.appendChild(script);
			return () => { script.remove(); };
		}
	});

	async function handlePasswordLogin() {
		if (!emailValid || !password || loading || !supabase) return;
		resetError();
		loading = true;

		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		loading = false;

		if (signInError) {
			if (signInError.message?.includes('Invalid login credentials')) {
				error = 'Password salah atau email tidak terdaftar.';
			} else {
				error = signInError.message;
			}
			return;
		}

		if (data?.session) {
			window.location.href = '/dashboard';
		}
	}

	async function handleSendOtp() {
		if (!canSubmitEmail || !supabase) return;
		resetError();
		loading = true;

		const options: { captchaToken?: string } = {};
		if (captchaToken) options.captchaToken = captchaToken;

		const { error: sendError } = await supabase.auth.signInWithOtp({
			email,
			options
		});

		loading = false;

		if (sendError) {
			if (sendError.status === 429) {
				error = 'Terlalu banyak permintaan. Coba lagi nanti.';
			} else {
				error = 'Gagal mengirim kode OTP: ' + sendError.message;
			}
			resetCaptcha();
			return;
		}

		successMessage = `Kode OTP telah dikirim ke ${email}`;
		step = 'otp';
		startResendCooldown();
	}

	async function handleVerifyOtp() {
		if (!otpComplete || loading || !supabase) return;
		resetError();
		loading = true;

		const { data, error: verifyError } = await supabase.auth.verifyOtp({
			email,
			token: otpToken,
			type: 'email'
		});

		if (verifyError) {
			if (verifyError.message?.includes('expired')) {
				error = 'Kode OTP kadaluarsa. Kirim ulang.';
			} else {
				error = 'Kode OTP tidak valid.';
			}
			otpDigits = ['', '', '', '', '', ''];
			loading = false;
			return;
		}

		if (data?.session) {
			window.location.href = '/dashboard';
		}
	}

	function handleOtpInput(index: number, e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value.replace(/\D/g, '');
		if (val.length > 1) {
			target.value = val[val.length - 1];
		}
		otpDigits[index] = target.value.slice(-1);
		if (target.value && index < 5) {
			const next = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
			next?.focus();
		}
		if (otpDigits.join('').length === 6 && index === 5) {
			setTimeout(() => handleVerifyOtp(), 100);
		}
	}

	function handleOtpKeydown(index: number, e: KeyboardEvent) {
		if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
			const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
			prev?.focus();
		}
	}

	function resetCaptcha() {
		if (turnstileWidgetId && window.turnstile) {
			window.turnstile.reset(turnstileWidgetId);
		}
		captchaToken = '';
	}

	function startResendCooldown() {
		resendCooldown = 30;
		const timer = setInterval(() => {
			resendCooldown--;
			if (resendCooldown <= 0) {
				clearInterval(timer);
				resendCooldown = 0;
			}
		}, 1000);
	}

	async function handleResend() {
		if (!canResend) return;
		resetCaptcha();
		await new Promise(r => setTimeout(r, 100));
		handleSendOtp();
	}

	function handleBack() {
		step = 'email';
		otpDigits = ['', '', '', '', '', ''];
		error = '';
		resetCaptcha();
	}
</script>

<svelte:head><title>Login — MemFinance</title></svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8faf8] p-4 dark:bg-gray-950">
	<div class="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary-100/70 blur-3xl dark:bg-primary-950/40" aria-hidden="true"></div>
	<div class="relative w-full max-w-md" transition:fade={{ duration: 180 }}>
		<div class="mb-7 text-center" transition:fly={{ y: -8, duration: 220 }}>
			<a href="/" class="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-gray-950 dark:text-white">
				<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm" aria-hidden="true">
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M5 19V7l7-3 7 3v12l-7 3-7-3Z" />
						<path d="M8 9h8M8 13h5" />
					</svg>
				</span>
				MemFinance
			</a>
			<p class="mt-3 text-sm text-gray-600 dark:text-gray-400">Portal Keuangan Pribadi yang Aman & Rahasia</p>
		</div>

		{#if !supabaseConfigured}
			<div class="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
				<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Autentikasi belum dikonfigurasi</p>
				<p class="text-xs text-gray-500 dark:text-gray-400">Silakan konfigurasikan kunci Supabase di file .env.</p>
			</div>
		{:else}
			<div class="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/60 sm:p-8 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
				<div>
					<h1 class="text-xl font-bold tracking-tight text-gray-950 dark:text-white">Selamat datang kembali</h1>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Hanya akun terdaftar (<span class="font-medium text-primary-600 dark:text-primary-400">aldianridhoku@gmail.com</span>) yang dapat mengakses.
					</p>
				</div>

				<!-- Tab Pemilihan Metode Login -->
				<div class="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800 text-xs font-semibold">
					<button
						type="button"
						onclick={() => { authMethod = 'password'; resetError(); }}
						class="flex-1 rounded-lg py-2 transition {authMethod === 'password' ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}"
					>
						🔑 Password Akun
					</button>
					<button
						type="button"
						onclick={() => { authMethod = 'otp'; resetError(); }}
						class="flex-1 rounded-lg py-2 transition {authMethod === 'otp' ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}"
					>
						✉️ Kode OTP Email
					</button>
				</div>

				{#if authMethod === 'password'}
					<!-- Form Password -->
					<form onsubmit={(e) => { e.preventDefault(); handlePasswordLogin(); }} class="space-y-4">
						<div>
							<label for="login-email" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email Anda</label>
							<input
								id="login-email"
								type="email"
								placeholder="aldianridhoku@gmail.com"
								bind:value={email}
								oninput={resetError}
								class="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								required
							/>
						</div>

						<div>
							<label for="login-password" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
							<div class="relative">
								<input
									id="login-password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Masukkan password Anda"
									bind:value={password}
									oninput={resetError}
									class="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									required
								/>
								<button
									type="button"
									onclick={() => showPassword = !showPassword}
									class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
									tabindex="-1"
								>
									{#if showPassword}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
									{:else}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
									{/if}
								</button>
							</div>
						</div>

						{#if error}
							<p class="text-xs text-red-500" transition:fade>{error}</p>
						{/if}

						<Button variant="primary" class="w-full" type="submit" disabled={!emailValid || !password || loading} loading={loading}>
							{loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
						</Button>
					</form>
				{:else}
					<!-- Form OTP -->
					{#if step === 'email'}
						<div class="space-y-3">
							<div>
								<label for="login-email-otp" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
								<input
									id="login-email-otp"
									type="email"
									placeholder="aldianridhoku@gmail.com"
									bind:value={email}
									oninput={resetError}
									class="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>
							<div id="turnstile-widget" class="flex justify-center"></div>
							{#if error}
								<p class="text-xs text-red-500" transition:fade>{error}</p>
							{/if}
							<Button variant="primary" class="w-full" onclick={handleSendOtp} disabled={!canSubmitEmail} loading={loading}>
								{loading ? 'Mengirim...' : 'Kirim Kode OTP'}
							</Button>
						</div>
					{:else}
						<div class="space-y-4" transition:fly={{ y: 10, duration: 200 }}>
							{#if successMessage}
								<p class="text-sm text-green-600 dark:text-green-400 text-center" transition:fade>{successMessage}</p>
							{/if}
							<div>
								<p id="otp-label" class="mb-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Masukkan 6 digit kode OTP</p>
								<div class="flex justify-center gap-1 sm:gap-2">
									{#each otpDigits as _, i}
										<input
											id="otp-{i}"
											type="text"
											inputmode="numeric"
											maxlength="1"
											value={otpDigits[i]}
											oninput={(e) => handleOtpInput(i, e)}
											onkeydown={(e) => handleOtpKeydown(i, e)}
											aria-label="Digit OTP {i + 1}"
											class="h-11 w-9 max-w-12 rounded-xl border border-gray-300 bg-white text-center text-base font-bold text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:h-14 sm:w-12 sm:text-lg"
										/>
									{/each}
								</div>
							</div>
							{#if error}
								<p class="text-xs text-red-500 text-center" transition:fade>{error}</p>
							{/if}
							<Button variant="primary" class="w-full" onclick={handleVerifyOtp} disabled={!otpComplete || loading} loading={loading}>
								{loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
							</Button>
							<div class="flex items-center justify-between text-xs">
								<button type="button" onclick={handleBack} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← Kembali</button>
								<button
									type="button"
									onclick={handleResend}
									disabled={!canResend}
									class="text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
								>
									{#if resendCooldown > 0}
										Kirim ulang ({resendCooldown}s)
									{:else}
										Kirim ulang OTP
									{/if}
								</button>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</div>
