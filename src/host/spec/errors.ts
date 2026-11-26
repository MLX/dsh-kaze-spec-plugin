/** Domain errors raised by the native Kaze spec engine. */
export class SpecError extends Error {
  readonly code: string

  constructor(message: string, code = 'KAZE_SPEC') {
    super(message)
    this.name = 'SpecError'
    this.code = code
  }
}
