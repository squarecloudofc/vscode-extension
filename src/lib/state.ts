import { StateOnChange } from "./state.interface";

export class State<T extends object> {
  private store: T;
  private onChangeFunction: StateOnChange<T> = () => [];

  constructor(initialState: T) {
    this.store = initialState;
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
    this.onChangeFunction(this.store, store);
  }

  onChange(fn: StateOnChange<T>) {
    this.onChangeFunction = fn;
  }
}
