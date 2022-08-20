import { Router } from '../deps.ts';

import auth from '../lib/auth.ts';
import { parsePermissions, PERMISSIONS } from '../../common/permissions.ts';
import User from '../lib/user.ts';

const router = new Router({
	prefix: '/users',
});

// Get a list of all users
router.get('/', auth.permissions([PERMISSIONS.MANAGE_USERS]), async (ctx) => {
	const users = await User.getAll();

	ctx.response.status = 200;
	ctx.response.body = users;
});

// Get a user by username
router.get(
	'/:username',
	auth.permissions([PERMISSIONS.MANAGE_USERS]),
	async (ctx) => {
		if (ctx.params.username === undefined) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: 'NO_USERNAME',
				message: 'Username not provided',
			};
			return;
		}

		const user = await User.getByUsername(ctx.params.username);
		if (user === null) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: 'USER_NOT_FOUND',
				message: 'User not found',
			};
			return;
		}

		ctx.response.body = user;
	},
);

// Add a new user
router.post('/', auth.permissions([PERMISSIONS.MANAGE_USERS]), async (ctx) => {
	try {
		const body = await ctx.request.body({ type: 'json' }).value;

		const user = await User.create(
			body.username,
			body.password,
			parsePermissions(body.permissions),
		);

		ctx.response.status = 201;
		ctx.response.body = user;
	} catch {
		ctx.response.status = 400;
		ctx.response.body = {
			error: 'INVALID_REQUEST',
			message: 'Invalid request body',
		};
	}
});

// Edit user
router.patch(
	'/:username',
	auth.permissions([PERMISSIONS.MANAGE_USERS]),
	async (ctx) => {
		try {
			const body = await ctx.request.body({ type: 'json' }).value;
			if (ctx.params.username === undefined) {
				ctx.response.status = 400;
				ctx.response.body = {
					error: 'NO_USERNAME',
					message: 'Username not provided',
				};
				return;
			}

			const user = await User.getByUsername(ctx.params.username);
			if (user === null) {
				ctx.response.status = 400;
				ctx.response.body = {
					error: 'USER_NOT_FOUND',
					message: 'User not found',
				};
				return;
			}

			if (body.username !== undefined) {
				user.username = body.username;
			}
			if (body.password !== undefined) {
				await user.setPassword(body.password);
			}
			const permissions = +body.permissions;
			if (Number.isInteger(permissions)) {
				user.permissions = permissions;
			}

			user.save();

			ctx.response.status = 200;
			ctx.response.body = user;
		} catch {
			ctx.response.status = 400;
			ctx.response.body = {
				error: 'INVALID_REQUEST',
				message: 'Invalid request body',
			};
		}
	},
);

// Delete user
router.delete(
	'/:username',
	auth.permissions([PERMISSIONS.MANAGE_USERS]),
	async (ctx) => {
		try {
			if (ctx.params.username === undefined) {
				ctx.response.status = 400;
				ctx.response.body = {
					error: 'NO_USERNAME',
					message: 'Username not provided',
				};
				return;
			}

			const user = await User.getByUsername(ctx.params.username);
			if (user === null) {
				ctx.response.status = 400;
				ctx.response.body = {
					error: 'USER_NOT_FOUND',
					message: 'User not found',
				};
				return;
			}

			user.delete();

			ctx.response.status = 200;
			ctx.response.body = user;
		} catch {
			ctx.response.status = 400;
			ctx.response.body = {
				error: 'INVALID_REQUEST',
				message: 'Invalid request body',
			};
		}
	},
);

export default router;
