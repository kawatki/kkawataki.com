declare module "cloudflare:workers" {
  type D1Result<T = unknown> = {
    results?: T[]
    success: boolean
  }

  type D1PreparedStatement = {
    bind(...values: unknown[]): D1PreparedStatement
    first<T = Record<string, unknown>>(): Promise<T | null>
    run<T = unknown>(): Promise<D1Result<T>>
  }

  type D1Database = {
    prepare(query: string): D1PreparedStatement
  }

  export const env: {
    RATE_LIMIT_DB?: D1Database
  }
}
