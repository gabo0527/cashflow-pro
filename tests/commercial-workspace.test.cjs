const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function loadTS(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file),
    module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename,
  })(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    module,
    module.exports,
  )
  return module.exports
}
const commercial = loadTS('src/lib/commercial.ts')
const shared = loadTS('src/components/projects/shared.tsx')
const client = '11111111-1111-4111-8111-111111111111',
  projectId = '22222222-2222-4222-8222-222222222222'
const project = {
  id: projectId,
  client_id: client,
  budget_type: 't_m',
  start_date: '2026-01-01',
  bill_rate: 100,
  billing_model: 'per_scope',
}
const phase = (terms, start, end, extra = {}) => ({
  project_id: projectId,
  terms,
  effective_start: start,
  effective_end: end,
  ...extra,
})
const entry = (date, hours = 1, extra = {}) => ({
  project_id: projectId,
  date,
  hours,
  is_billable: true,
  ...extra,
})

test('dated budget → open → monthly fee retains prior hours and avoids pricing fee hours twice', () => {
  const phases = [
    phase('tm_nte', '2026-01-01', '2026-02-28', { nte_amount: 1000 }),
    phase('tm_open', '2026-03-01', '2026-03-31'),
    phase('lump_sum', '2026-04-01', null, { monthly_fee: 2500 }),
  ]
  const months = shared.commercialRevenueByMonth(
    project,
    phases,
    [
      entry('2026-02-01', 2),
      entry('2026-03-15', 3),
      entry('2026-04-15', 100),
      entry('2026-05-02', 100),
    ],
    {},
    {},
    '2026-04-30',
  )
  assert.deepEqual(months, { '2026-02': 200, '2026-03': 300, '2026-04': 2500 })
  assert.equal(shared.phaseForDate(phases, '2026-02-28').terms, 'tm_nte')
  assert.equal(shared.phaseForDate(phases, '2026-03-01').terms, 'tm_open')
  assert.equal(
    shared.calcProjectRevenue(
      project,
      [
        entry('2026-02-01', 2),
        entry('2026-03-15', 3),
        entry('2026-04-15', 100),
      ],
      {},
      {},
      '2026-04-30',
      phases,
    ).recognized,
    3000,
  )
})
test('overall budget counts full-phase consumption through range end with a single denominator', () => {
  const p = phase('tm_nte', '2026-01-01', null, {
    nte_amount: 1000,
    budget_cadence: 'overall',
  })
  const burn = shared.calcNteBurn(
    p,
    project,
    [entry('2026-01-15', 4), entry('2026-02-15', 7), entry('2026-03-15', 9)],
    {},
    {},
    '2026-02-01',
    '2026-02-28',
  )
  assert.equal(burn.billed, 1100)
  assert.equal(burn.denom, 1000)
  assert.ok(Math.abs(burn.pct - 110) < 1e-9)
  assert.equal(burn.over, true)
  assert.equal(burn.worst, null)
})
test('monthly budgets retain period denominators, overruns and nonbillable exclusion', () => {
  const p = phase('tm_nte', '2026-01-01', null, {
    nte_amount: 1000,
    budget_cadence: 'monthly',
  })
  const entries = [
    entry('2026-01-15', 11),
    entry('2026-02-15', 2),
    entry('2026-02-16', 100, { is_billable: false }),
  ]
  const burn = shared.calcNteBurn(
    p,
    project,
    entries,
    {},
    {},
    '2026-01-01',
    '2026-02-28',
  )
  assert.equal(burn.billed, 1300)
  assert.equal(burn.denom, 2000)
  assert.equal(burn.pct, 65)
  assert.equal(burn.worst.mk, '2026-01')
  assert.ok(Math.abs(burn.worst.pct - 110) < 1e-9)
  assert.equal(
    shared.calcNteBurn(
      phase('tm_open', '2026-01-01', null),
      project,
      entries,
      {},
      {},
      '2026-01-01',
      '2026-02-28',
    ).pct,
    null,
  )
})
test('future monthly fees and future work do not inflate recognized revenue', () => {
  const phases = [
    phase('tm_open', '2026-01-01', '2026-10-31'),
    phase('lump_sum', '2026-11-01', null, { monthly_fee: 5000 }),
  ]
  assert.deepEqual(
    shared.commercialRevenueByMonth(
      project,
      phases,
      [entry('2026-10-05', 2), entry('2026-10-30', 9)],
      {},
      {},
      '2026-10-08',
    ),
    { '2026-10': 200 },
  )
})
test('document metadata rejects invalid dates, cross-scope identifiers and malformed categories', () => {
  const input = {
    title: 'Executed NDA',
    category: 'NDA',
    effective_date: '2026-10-01',
    tags: [],
  }
  assert.equal(commercial.documentInput(input).expiry_date, null)
  for (const patch of [
    { effective_date: '2026-02-30' },
    { expiry_date: '2026-09-30' },
    { category: 'Draft' },
    { project_id: 'another-client' },
    { tags: ['x'.repeat(41)] },
  ])
    assert.throws(() => commercial.documentInput({ ...input, ...patch }))
  assert.equal(commercial.canManageCommercial('viewer'), false)
})
function server(state = {}) {
  const db = {
    auth: {
      getUser: async (token) => ({
        data: { user: state.badToken ? null : { id: 'verified-user' } },
        error: state.badToken ? {} : null,
      }),
    },
    from(table) {
      const q = {
        select() {
          return q
        },
        eq() {
          return q
        },
        single: async () => ({
          data: state.missingClient
            ? null
            : { id: client, company_id: 'company' },
        }),
        maybeSingle: async () => ({
          data:
            table === 'commercial_access'
              ? state.noAccess
                ? null
                : { role: state.role || 'admin' }
              : state.wrongScope
                ? null
                : { id: projectId },
          error: state.missingSetup ? {} : null,
        }),
      }
      return q
    },
  }
  return loadTS('src/lib/commercial-server.ts', {
    '@/lib/contractor-auth': { getSupabaseAdmin: () => db },
    './commercial': commercial,
  })
}
const request = (token = 'valid-token') => ({
  headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
})
test('commercial access validates real auth and membership instead of caller-supplied roles', async () => {
  await assert.rejects(
    () => server().commercialContext(request(''), client),
    (e) => e.status === 401,
  )
  await assert.rejects(
    () => server({ badToken: true }).commercialContext(request(), client),
    (e) => e.status === 401,
  )
  await assert.rejects(
    () => server({ noAccess: true }).commercialContext(request(), client),
    (e) => e.status === 403,
  )
  await assert.rejects(
    () => server({ missingSetup: true }).commercialContext(request(), client),
    (e) => e.status === 503,
  )
  assert.equal(
    (await server({ role: 'viewer' }).commercialContext(request(), client))
      .role,
    'viewer',
  )
  await assert.rejects(
    () => server({ role: 'viewer' }).commercialContext(request(), client, true),
    (e) => e.status === 403,
  )
  const denied = server({ wrongScope: true })
  const context = await denied.commercialContext(request(), client)
  await assert.rejects(
    () => denied.assertScope(context.db, client, projectId),
    (e) => e.status === 403,
  )
})
