import {encode as hexEncode, decode as hexDecode} from 'https://deno.land/std@0.144.0/encoding/hex.ts';

import * as Permissions from './permissions.ts';
import dbClientPromise from './db.ts';

const PBKDF2ITERATIONS = 100000;
const DEFAULT_PERMISSIONS = 0;


function buf2hex(buf: Uint8Array): string {
	const dec = new TextDecoder();

	return dec.decode(hexEncode(buf));
}


function hex2buf(str: string): Uint8Array {
	const enc = new TextEncoder();

	return hexDecode(enc.encode(str));
}


async function pbkdf2(password: string, salt: string): Promise<string> {
	const enc = new TextEncoder();
	const dec = new TextDecoder();

	const importedKey = await crypto.subtle.importKey(
		'raw',
		enc.encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);
	const generatedKey = await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: hex2buf(salt),
			iterations: PBKDF2ITERATIONS,
			hash: 'SHA-256'
		},
		importedKey,
		{name: 'AES-GCM', length: 64},
		true,
		[]
	);

	const encodedKey = hexEncode(new Uint8Array(await crypto.subtle.exportKey('raw', generatedKey)));
	return dec.decode(encodedKey);
}


type Props = {
	id: number,
	username: string,
	passwordSalt: string,
	passwordHash: string,
	permissions: number | undefined
}


class User {
	id: number;
	username: string;
	passwordSalt: string;
	passwordHash: string;
	permissions: number;

	#saveHandle: number | undefined;

	constructor(props: Props) {
		this.id = props.id;
		this.username = props.username;
		this.passwordSalt = props.passwordSalt;
		this.passwordHash = props.passwordHash;
		this.permissions = props.permissions ?? DEFAULT_PERMISSIONS;
	}

	static #makeReactive(user: User): User {
		const proxy: ProxyHandler<User> = {
			set(target, propertyKey, value, receiver) {
				clearInterval(target.#saveHandle);

				target.#saveHandle = setInterval(async () => {
					const client = await dbClientPromise;
					await client.execute(
						`insert into invenfinder.users(id,
						                               username,
						                               password_salt,
						                               password_hash,
						                               permissions)
						 values (?, ?, ?, ?, ?)
						 on duplicate key update username = values(username),
						                         password_salt = values(password_salt),
						                         password_hash = values(password_hash),
						                         permissions = values(permissions)`,
						[
							target.id,
							target.username,
							target.passwordSalt,
							target.passwordHash,
							target.permissions,
						],
					);
				});

				return Reflect.set(target, propertyKey, value, receiver);
			},
		};

		return new Proxy(user, proxy);
	}

	static async create(username: string, password: string, permissions: number | undefined): Promise<User> {
		const passwordSalt = buf2hex(crypto.getRandomValues(new Uint8Array(32)));
		const passwordHash = await pbkdf2(password, passwordSalt);

		const client = await dbClientPromise;
		const res = await client.execute(
			`insert into invenfinder.users(username,
			                               password_salt,
			                               password_hash,
			                               permissions)
			 values (?, ?, ?, ?)`,
			[
				username,
				passwordSalt,
				passwordHash,
				permissions,
			],
		);

		return this.#makeReactive(new User({
			id: res.lastInsertId ?? 0,
			username,
			passwordSalt,
			passwordHash,
			permissions: permissions ?? DEFAULT_PERMISSIONS
		}));
	}

	static async getByID(id: number): Promise<User | null> {
		const client = await dbClientPromise;
		const rows = await client.query(
			`select *
			 from invenfinder.users
			 where id=?`,
			[id],
		);

		if (!rows.length) {
			return null;
		} else {
			return this.#makeReactive(new User(rows[0]));
		}
	}

	static async getByUsername(username: string): Promise<User | null> {
		const client = await dbClientPromise;
		const rows = await client.query(
			`select *
			 from invenfinder.users
			 where username=?`,
			[username],
		);

		if (!rows.length) {
			return null;
		}

		return this.#makeReactive(new User(rows[0]));
	}

	static async getAll(): Promise<User[]> {
		const users = [];

		const client = await dbClientPromise;
		const rows = await client.query(`select *
		                                     from invenfinder.users`);

		for (const row of rows) {
			users.push(this.#makeReactive(new User(row)));
		}

		return users;
	}

	async verifyPassword(password: string): Promise<boolean> {
		return this.passwordSalt === await pbkdf2(password, this.passwordSalt);
	}

	async setPassword(password: string): Promise<void> {
		this.passwordSalt = buf2hex(crypto.getRandomValues(new Uint8Array(32)));
		this.passwordHash = await pbkdf2(password, this.passwordSalt);
	}

	hasPermissions(permissions: [Permissions.PERMISSIONS]): boolean {
		const permissionValue = Permissions.getPermissionValue(permissions);

		// noinspection JSBitwiseOperatorUsage
		return ((this.permissions & permissionValue) === permissionValue);
	}

	async delete(): Promise<void> {
		const client = await dbClientPromise;
		await client.execute(
			`delete
			 from invenfinder.users
			 where id=?`,
			[this.id],
		);
	}
}

export default User;
