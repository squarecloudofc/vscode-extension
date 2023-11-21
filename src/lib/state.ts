import { StateOnChange, StateOptions } from "./state.interface";

export class State<T extends object> {
  private store: T;
  private onChange?: StateOnChange<T>;

  constructor(initialState: T, options?: StateOptions<T>) {
    this.store = initialState;
    this.onChange = options?.onChange;
  }

  get(): T;
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key?: K): T | T[K] {
    return key ? this.store[key] : this.store;
  }

  set(value: T | Partial<T> | ((previous: T) => T | Partial<T>)) {
    const payload = typeof value === "function" ? value(this.store) : value;
    const store = this.store;

    this.store = Object.assign(store, payload);
    this.onChange?.(this.store, store);
  }
}
