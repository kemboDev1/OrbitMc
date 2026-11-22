/** An expected problem. `key` is a translation key shown to the person. */
export class AppError extends Error {
  key: string;
  constructor(key: string) {
    super(key);
    this.key = key;
    this.name = 'AppError';
  }
}

export const fail = (key: string): never => {
  throw new AppError(key);
};
