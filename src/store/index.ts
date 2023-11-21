export type StoreInitial<T extends Record<string, any>> = (store: Store<T>) => T;

export type StoreOnChange<T extends Record<string, any>> = (store: Store<T>) => void;

export class Store<T extends Record<string, any>> {
  private _store: T;
  private _onChange?: StoreOnChange<T>;

  constructor(initial: StoreInitial<T>) {
    this._store = initial(this);
  }

  private notifyChange() {
    if (this._onChange) {
      this._onChange(this);
    }
  }

  subscribe(fn: StoreOnChange<T>) {
    this._onChange = fn;
  }

  set(value: Partial<T> | ((store: Store<T>) => Partial<T>)) {
    if (typeof value === "function") {
      value = value(this);
    }
    this._store = { ...this._store, ...value };
    this.notifyChange();
  }

  get(): T;
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key?: K): T[K] | T {
    if (key) {
      return this._store[key];
    } else {
      return { ...this._store };
    }
  }
}
