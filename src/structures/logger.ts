export class Logger {
  constructor(public readonly name: string) {}

  log(message: string) {
    console.log(`[${this.name}] ${message}`);
  }
}
