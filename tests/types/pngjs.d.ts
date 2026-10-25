// Minimal typing for pngjs (no @types package): what the browser tests use to sample screenshot pixels.
declare module 'pngjs' {
  export class PNG {
    width: number
    height: number
    data: Buffer
    static sync: { read(buffer: Buffer): PNG }
  }
}
