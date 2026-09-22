import { json } from '@sveltejs/kit';
import { gasRequest } from '$lib/data/gas/gas-client';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type Category } from '$lib/domain/entities/category';
import type { RequestHandler } from './$types';

const defaultCategories: Category[] = [
	...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
		id: `cat_exp_${i + 1}`,
		...c,
		isDefault: true,
		flagActive: true
	})),
	...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
		id: `cat_inc_${i + 1}`,
		...c,
		isDefault: true,
		flagActive: true
	}))
];

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.gaSheetId) {
		return json({ success: true, data: defaultCategories });
	}
	try {
		const result = await gasRequest('list', 'categories', { sheetId: locals.gaSheetId, userId: locals.userId });
		if (result.success && Array.isArray(result.data) && result.data.length > 0) {
			return json(result, { status: 200 });
		}
		if (result.success && Array.isArray(result.data) && result.data.length === 0) {
			const seedResult = await gasRequest('seed', 'categories', { sheetId: locals.gaSheetId, userId: locals.userId });
			if (seedResult.success && Array.isArray(seedResult.data) && seedResult.data.length > 0) {
				return json(seedResult, { status: 200 });
			}
		}
	} catch {
		// Fallback to default categories
	}
	return json({ success: true, data: defaultCategories }, { status: 200 });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	try {
		if (locals.gaSheetId) {
			const result = await gasRequest('create', 'categories', { ...body, sheetId: locals.gaSheetId, userId: locals.userId });
			return json(result, { status: result.success ? 201 : 200 });
		}
	} catch {
		// Fallback for offline/local
	}
	return json({ success: true, data: { id: `cat_${Date.now()}`, ...body } }, { status: 201 });
};
