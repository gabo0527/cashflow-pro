// Invoice reads/writes go through a verified server session, including portal users.
// The small chainable adapter preserves the existing screens' query behavior.
export function createInvoiceStore(auth: { auth: { getSession: () => Promise<any> } }, portal = false) {
  return {
    from(table: string) {
      const body: any = { table, operation: 'select', filters: [], portal }
      let single = false
      const query: any = {
        select(columns = '*') { body.columns = columns; return query },
        insert(values: any) { body.operation = 'insert'; body.values = values; return query },
        update(values: any) { body.operation = 'update'; body.values = values; return query },
        delete() { body.operation = 'delete'; return query },
        eq(column: string, value: any) { body.filters.push({ op: 'eq', column, value }); return query },
        gte(column: string, value: any) { body.filters.push({ op: 'gte', column, value }); return query },
        lte(column: string, value: any) { body.filters.push({ op: 'lte', column, value }); return query },
        order(column: string, options: any = {}) { body.order = { column, ascending: options.ascending !== false }; return query },
        limit(count: number) { body.limit = count; return query },
        single() { single = true; return query },
        async then(resolve: any, reject: any) {
          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (!portal) {
              const { data } = await auth.auth.getSession()
              if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
            }
            const res = await fetch('/api/contractor-invoices', { method: 'POST', headers, body: JSON.stringify(body) })
            const result = await res.json()
            if (!res.ok) return resolve({ data: null, error: { message: result.error || 'Invoice request failed' } })
            const data = single ? result.data?.[0] || null : result.data
            return resolve({ data, count: result.count ?? result.data?.length ?? 0, error: single && !data ? { message: 'Invoice not found or changed by another administrator. Refresh and try again.' } : null })
          } catch (e) { return resolve({ data: null, error: { message: e instanceof Error ? e.message : 'Invoice request failed' } }) }
        },
      }
      return query
    },
  }
}
