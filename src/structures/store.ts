import type { ExtensionContext } from "vscode";

export type StoreInitial<T extends Record<string, any>> = (
	store: [set: Store<T>["set"], get: Store<T>["get"]],
) => T;

export type StoreOnChange<T extends Record<string, any>> = (
	store: Store<T>,
) => void;

export type StorePersistConfig = {
	name: string;
	storage?: "global" | "workspace";
	context: ExtensionContext;
};

export class Store<T extends Record<string, any>> {
	private _store: T;
	private _onChange?: StoreOnChange<T>;
	private _persist?: StorePersistConfig;

	/**
	 * Constructs a new Store instance.
	 *
	 * @param initial - The initial value for the store.
	 * @param persist - The configuration for persisting the store.
	 */
	constructor(initial: StoreInitial<T>, persist?: StorePersistConfig) {
		this._persist = persist;
		this._store = initial([this.set.bind(this), this.get.bind(this)]);
	}

	private async emitChange() {
		await this.updatePersistedData();

		if (this._onChange) {
			this._onChange(this);
		}
	}

	private async updatePersistedData() {
		if (!this._persist) {
			return;
		}

		const { name, storage, context } = this._persist;
		const key = `${name}-store`;
		const state =
			storage === "workspace" ? context.workspaceState : context.globalState;
		const value = Object.fromEntries(
			Object.entries(this._store).filter(([_, v]) => typeof v !== "function"),
		);

		await state.update(key, value);
	}

	persist(persist: StorePersistConfig) {
		this._persist = persist;
		this.updatePersistedData();
	}

	subscribe(fn: StoreOnChange<T>) {
		this._onChange = fn;
	}

	set<U extends boolean>(
		value: U extends true
			? T | ((store: Store<T>) => T)
			: Partial<T> | ((store: Store<T>) => Partial<T>),
		override?: U,
	) {
		if (typeof value === "function") {
			value = value(this);
		}

		if (override) {
			this._store = value as T;
		} else {
			this._store = { ...this._store, ...value };
		}

		this.emitChange();
	}

	get(): T;
	get<K extends keyof T>(key: K): T[K];
	get<K extends keyof T, U>(fn: (store: T) => U): U;
	get<K extends keyof T, U>(keyOrFn?: K | ((store: T) => U)): T[K] | T | U {
		if (typeof keyOrFn === "string") {
			return this._store[keyOrFn];
		}

		if (typeof keyOrFn === "function") {
			return keyOrFn({ ...this._store });
		}

		return { ...this._store };
	}
}
