export interface StateOptions<T> {
  onChange?: StateOnChange<T>;
}

export type StateOnChange<T> = (newState: T, oldState: T) => void;
