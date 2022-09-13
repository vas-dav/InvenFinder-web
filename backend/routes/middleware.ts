import { Context } from '../deps.ts';

type Next = () => Promise<unknown>;

export async function credentialsPresent(ctx: Context, next: Next) {
	try {
		const body = await ctx.request.body({ type: 'json' }).value;

		if (!body.username?.length) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: 'NO_USERNAME',
				message: 'Username must be provided',
			};
			return;
		} else if (!body.password.length) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: 'NO_PASSWORD',
				message: 'Password must be provided',
			};
			return;
		}

		await next();
	} catch (e) {
		console.error(e);

		ctx.response.status = 400;
		ctx.response.body = {
			error: 'NO_CREDENTIALS',
			message: 'Credentials must be provided',
		};
	}
}

export async function logger(ctx: Context, next: Next) {
	const req = ctx.request;
	console.log(
		`${req.method} ${req.url.pathname} from ${req.ip} on ${
			new Date().toLocaleString()
		}`,
	);
	await next();
}
