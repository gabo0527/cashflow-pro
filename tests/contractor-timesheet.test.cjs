const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Test the actual shared validator and server routes without a production
// session or database writes. No additional test framework is needed.
function loadTS(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  const requireMock = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name)
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(requireMock, module, module.exports)
  return module.exports
}
const daily = loadTS('src/lib/timesheet-daily.ts')
const dates = daily.weekDates('2026-10-11')
const projectId = '11111111-1111-4111-8111-111111111111'

test('each day and project retains its own description through draft JSON and submission rows', () => {
  const first = daily.cleanDailyEntry({ '2026-10-05': 2, '2026-10-06': 3.5 }, {
    '2026-10-05': '  Reviewed estimates  ', '2026-10-06': 'Updated schedule',
  }, dates, true)
  const draft = JSON.parse(JSON.stringify(first))
  const rows = daily.dailySubmissionRows(projectId, draft, 125)
  assert.deepEqual(rows.map(row => [row.date, row.description]), [
    ['2026-10-05', 'Reviewed estimates'], ['2026-10-06', 'Updated schedule'],
  ])
  const second = daily.cleanDailyEntry({ '2026-10-05': 1 }, { '2026-10-05': 'Other client work' }, dates, true)
  assert.equal(daily.dailySubmissionRows('other-project', second, 80)[0].description, 'Other client work')
})

test('positive T&M hours reject missing and whitespace descriptions; a weekly note cannot satisfy the rule', () => {
  for (const descriptions of [undefined, {}, { '2026-10-05': ' \n\t ' }]) {
    assert.throws(() => daily.cleanDailyEntry({ '2026-10-05': 0.25 }, descriptions, dates, true), /Add a description/)
  }
})

test('zero and blank timesheets are valid, with no submitted time rows', () => {
  for (const hours of [{}, { '2026-10-05': 0 }, { '2026-10-05': '', '2026-10-06': '0' }]) {
    assert.deepEqual(daily.dailySubmissionRows(projectId, daily.cleanDailyEntry(hours, {}, dates, true), 100), [])
  }
})

test('non-T&M notes are optional; descriptions on temporarily cleared days survive a draft', () => {
  assert.doesNotThrow(() => daily.cleanDailyEntry({ '2026-10-05': 2 }, {}, dates, false))
  const cleared = daily.cleanDailyEntry({ '2026-10-05': '' }, { '2026-10-05': 'Keep my work description' }, dates, true)
  assert.equal(cleared.daily_descriptions['2026-10-05'], 'Keep my work description')
  assert.deepEqual(cleared.daily_hours, {})
})

test('dates, hours and descriptions are validated, including a week across months', () => {
  assert.equal(daily.weekDates('2026-11-01')[0], '2026-10-26')
  assert.throws(() => daily.weekDates('2026-02-30'), /valid Sunday/)
  assert.throws(() => daily.weekDates('2026-10-10'), /valid Sunday/)
  for (const hours of [25, -1, 'abc', Infinity, true, null]) {
    assert.throws(() => daily.cleanDailyEntry({ '2026-10-05': hours }, {}, dates, false), /hours|Hours/)
  }
  assert.throws(() => daily.cleanDailyEntry({ '2026-10-12': 1 }, {}, dates, false), /outside/)
  assert.throws(() => daily.cleanDailyEntry({}, { '2026-10-05': 'x'.repeat(2001) }, dates, false), /characters/)
})

function routes(state) {
  const query = {
    select() { return this }, eq() { return this }, delete() { state.deletes++; return this },
    upsert(value) { state.saved = value; return this },
    single() { return Promise.resolve({ data: state.saved, error: null }) },
    then(resolve) { return Promise.resolve({ error: null }).then(resolve) },
  }
  const supabase = {
    from: () => query,
    rpc: async (name, args) => {
      state.rpc = { name, args }
      return { data: args.p_entries, error: state.rpcError || null }
    },
  }
  const mocks = {
    '@/lib/contractor-auth': {
      readSessionFromCookie: async () => state.session === false ? null : { contractorId: 'session-contractor' },
      getSupabaseAdmin: () => supabase,
    },
    '@/lib/contractor-timesheet-projects': {
      contractorTimesheetProjects: async () => ({
        member: { company_id: 'session-company' },
        permitted: new Map([[projectId, { project_id: projectId, required: true, rate: 125 }]]),
      }),
    },
    '@/lib/timesheet-daily': daily,
  }
  return {
    draft: loadTS('src/app/api/timesheet-drafts/route.ts', mocks),
    submit: loadTS('src/app/api/contractor-timesheets/route.ts', mocks),
  }
}
const request = body => ({ json: async () => body })
const payload = descriptions => ({ project_id: projectId, daily_hours: { '2026-10-05': 2 }, daily_descriptions: descriptions })

test('both API routes reject a missing daily description before any write', async () => {
  const state = { deletes: 0 }
  const { draft, submit } = routes(state)
  assert.equal((await draft.POST(request({ ...payload({}), note: 'Old weekly note', week_ending: '2026-10-11' }))).status, 400)
  assert.equal((await submit.POST(request({ week_ending: '2026-10-11', projects: [payload({})] }))).status, 400)
  assert.equal(state.saved, undefined)
  assert.equal(state.rpc, undefined)
  assert.equal(state.deletes, 0)
})

test('draft saves date descriptions privately; submit sends matching daily descriptions and session identity', async () => {
  const state = { deletes: 0 }
  const { draft, submit } = routes(state)
  const project = payload({ '2026-10-05': 'Daily work' })
  assert.equal((await draft.POST(request({ ...project, week_ending: '2026-10-11' }))).status, 200)
  assert.equal(state.saved.daily_descriptions['2026-10-05'], 'Daily work')
  assert.equal(state.saved.team_member_id, 'session-contractor')
  assert.equal(state.rpc, undefined)
  assert.equal((await submit.POST(request({ week_ending: '2026-10-11', contractor_id: 'forged-id', projects: [project] }))).status, 200)
  assert.equal(state.rpc.args.p_contractor_id, 'session-contractor')
  assert.equal(state.rpc.args.p_entries[0].description, 'Daily work')
  assert.equal(state.rpc.args.p_entries[0].date, '2026-10-05')
})

test('empty draft and submission are accepted; submission contains no zero-hour rows', async () => {
  const state = { deletes: 0 }
  const { draft, submit } = routes(state)
  const project = { project_id: projectId, daily_hours: { '2026-10-05': 0 }, daily_descriptions: {} }
  assert.equal((await draft.POST(request({ ...project, week_ending: '2026-10-11' }))).status, 200)
  assert.equal(state.deletes, 1)
  assert.equal((await submit.POST(request({ week_ending: '2026-10-11', projects: [project] }))).status, 200)
  assert.deepEqual(state.rpc.args.p_entries, [])
})

test('submission rejects unassigned, duplicate and omitted projects; auth is required', async () => {
  const state = { deletes: 0 }
  const { submit } = routes(state)
  const project = payload({ '2026-10-05': 'Work' })
  assert.equal((await submit.POST(request({ week_ending: '2026-10-11', projects: [{ ...project, project_id: 'other' }] }))).status, 403)
  assert.equal((await submit.POST(request({ week_ending: '2026-10-11', projects: [project, project] }))).status, 400)
  assert.equal((await submit.POST(request({ week_ending: '2026-10-11', projects: [] }))).status, 400)
  assert.equal(state.rpc, undefined)
  state.session = false
  assert.equal((await submit.POST(request({}))).status, 401)
})

test('failed replacement reports failure without browser-side deletes', async () => {
  const state = { deletes: 0, rpcError: { message: 'insert failed' } }
  const { submit } = routes(state)
  const response = await submit.POST(request({ week_ending: '2026-10-11', projects: [payload({ '2026-10-05': 'Work' })] }))
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /preserved/)
  assert.equal(state.deletes, 0)
})

test('real portal opens only the selected project/day, closes on Enter, and expands the week on request', async () => {
  const React = require('react')
  const { create, act } = require('react-test-renderer')
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1))
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const firstDay = iso(monday)
  const tuesday = new Date(monday); tuesday.setDate(tuesday.getDate() + 1)
  const secondDay = iso(tuesday)
  const rows = [
    { id: 'a', project_id: projectId, date: firstDay, hours: 2, description: 'Monday work', status: 'submitted' },
    { id: 'b', project_id: projectId, date: secondDay, hours: 3, description: 'Tuesday work', status: 'submitted' },
    { id: 'c', project_id: 'project-two', date: firstDay, hours: 1, description: 'Other client work', status: 'submitted' },
  ]
  const fixture = {
    team_members: { id: 'fixture-contractor', name: 'Test Contractor', email: 'test@example.test', company_id: 'company', status: 'active', onboarding_status: 'completed' },
    clients: [{ id: 'client-one', name: 'Client One' }, { id: 'client-two', name: 'Client Two' }],
    bill_rates: [{ client_id: 'client-one', cost_type: 'hourly', rate: 125 }, { client_id: 'client-two', cost_type: 'hourly', rate: 100 }],
    projects: [{ id: projectId, name: 'Project One', client_id: 'client-one', company_id: 'company' }, { id: 'project-two', name: 'Project Two', client_id: 'client-two', company_id: 'company' }],
    team_project_assignments: [{ project_id: projectId, payment_type: 'tm' }, { project_id: 'project-two', payment_type: 'tm' }],
    time_entries: rows,
  }
  const supabase = { from(table) {
    const builder = { then(resolve) { return Promise.resolve({ data: fixture[table] || [], error: null }).then(resolve) } }
    for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'single']) builder[method] = () => builder
    return builder
  } }
  const originalFetch = global.fetch
  global.fetch = async url => ({ ok: true, status: 200, json: async () => url === '/api/contractor-auth/me'
    ? { authenticated: true, contractor: { email: 'test@example.test' } } : { drafts: [] } })
  const icons = new Proxy({ __esModule: true }, { get: (target, name) => name === '__esModule' ? true : () => null })
  const Page = loadTS('src/app/contractor-portal/page.tsx', {
    '@supabase/supabase-js': { createClient: () => supabase },
    './OnboardingWizard': () => null, './ExpensesTab': () => null,
    '@/components/IdleLogout': () => null, '@/lib/timesheet-daily': daily,
    'lucide-react': icons, recharts: icons,
  }).default
  let renderer
  try {
    await act(async () => { renderer = create(React.createElement(Page)); await new Promise(resolve => setImmediate(resolve)) })
    const notes = () => renderer.root.findAll(node => node.type === 'textarea' && node.props.className === 'cp-note')
    const hours = () => renderer.root.findAll(node => node.type === 'input' && node.props.className?.includes('cp-cell'))
    assert.equal(notes().length, 0)
    await act(async () => { hours()[0].props.onFocus() })
    assert.equal(notes().length, 1)
    assert.equal(notes()[0].props.value, 'Monday work')
    await act(async () => { hours()[1].props.onFocus() })
    assert.equal(notes().length, 1)
    assert.equal(notes()[0].props.value, 'Tuesday work')
    await act(async () => { hours()[7].props.onFocus() })
    assert.equal(notes().length, 1)
    assert.equal(notes()[0].props.value, 'Other client work')
    await act(async () => { notes()[0].props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false }, preventDefault() {} }) })
    assert.equal(notes().length, 0)
    const toggle = () => renderer.root.findAllByType('button').find(button => button.props['aria-pressed'] !== undefined)
    await act(async () => { toggle().props.onClick() })
    assert.equal(notes().length, 3)
    // Moving to another day restores the default single-entry view.
    await act(async () => { hours()[1].props.onFocus() })
    assert.equal(notes().length, 1)
    await act(async () => { notes()[0].props.onChange({ target: { value: '   ' } }) })
    const save = () => renderer.root.findAllByType('button').find(button => button.children.includes('Save draft'))
    assert.equal(save().props.disabled, true)
    await act(async () => { notes()[0].props.onChange({ target: { value: 'Specific Tuesday description' } }) })
    assert.equal(save().props.disabled, false)
    await act(async () => { hours()[0].props.onFocus() })
    assert.equal(notes()[0].props.value, 'Monday work')
  } finally {
    if (renderer) act(() => renderer.unmount())
    global.fetch = originalFetch
  }
})

test('actual Time Tracking Detailed view displays the correct daily descriptions and opens the matching note', async () => {
  const React = require('react')
  const { create, act } = require('react-test-renderer')
  const originalRAF = global.requestAnimationFrame
  const originalCancelRAF = global.cancelAnimationFrame
  const OriginalDate = global.Date
  // Keep the page's month-to-date filter stable when rerunning these fixtures.
  global.Date = class extends OriginalDate {
    constructor(...args) { if (args.length) super(...args); else super('2026-10-06T12:00:00') }
    static now() { return new OriginalDate('2026-10-06T12:00:00').getTime() }
  }
  global.requestAnimationFrame = callback => { callback(performance.now() + 10000); return 1 }
  global.cancelAnimationFrame = () => {}
  const fixture = {
    profiles: { company_id: 'company' },
    team_members: [{ id: 'contractor', name: 'Test Contractor', status: 'active', cost_type: 'hourly', cost_amount: 50 }],
    projects: [{ id: projectId, name: 'Project One', client_id: 'client', company_id: 'company', budget_type: 'tm' }],
    clients: [{ id: 'client', name: 'Client One' }],
    time_entries: [
      { id: 'monday-row', contractor_id: 'contractor', project_id: projectId, date: '2026-10-05', hours: 2, billable_hours: 2, bill_rate: 100, description: 'Monday estimate review', status: 'submitted' },
      { id: 'tuesday-row', contractor_id: 'contractor', project_id: projectId, date: '2026-10-06', hours: 3, billable_hours: 3, bill_rate: 100, description: 'Tuesday schedule update\nCompleted milestones', status: 'submitted' },
    ],
  }
  const supabase = { from(table) {
    const builder = { then(resolve) { return Promise.resolve({ data: fixture[table] || [], error: null }).then(resolve) } }
    for (const method of ['select', 'eq', 'order', 'single']) builder[method] = () => builder
    return builder
  } }
  const icons = new Proxy({ __esModule: true }, { get: (target, name) => name === '__esModule' ? true : () => null })
  const Page = loadTS('src/app/time-tracking/page.tsx', {
    '@supabase/supabase-js': { createClient: () => supabase },
    '@/lib/supabase': { getCurrentUser: async () => ({ user: { id: 'admin' } }) },
    '@/components/projects/shared': loadTS('src/components/projects/shared.tsx'),
    '@/components/commercial/CommercialDocuments': loadTS('src/components/commercial/CommercialDocuments.tsx', { '@/lib/supabase': {supabase:{}}, '@/lib/commercial': loadTS('src/lib/commercial.ts'), './useCommercialDialog': {__esModule:true,default:()=>{}} }),
    'lucide-react': icons, recharts: icons,
  }).default
  let renderer
  try {
    await act(async () => { renderer = create(React.createElement(Page)); await new Promise(resolve => setImmediate(resolve)) })
    const buttons = () => renderer.root.findAllByType('button')
    const detailed = buttons().find(button => button.children.includes('Detailed'))
    assert.ok(detailed, 'Detailed tab should exist')
    await act(async () => detailed.props.onClick())
    const expand = buttons().find(button => button.children.includes('Expand all'))
    await act(async () => expand.props.onClick())
    const descriptions = buttons().filter(button => button.props['aria-label']?.startsWith('View description for'))
    assert.equal(descriptions.length, 2)
    const monday = descriptions.find(button => button.children.includes('Monday estimate review'))
    const tuesday = descriptions.find(button => button.children.includes('Tuesday schedule update\nCompleted milestones'))
    assert.ok(monday.props['aria-label'].includes('Oct 5'))
    assert.ok(tuesday.props['aria-label'].includes('Oct 6'))
    await act(async () => tuesday.props.onClick())
    const note = renderer.root.findAllByType('p').find(p => p.props.className?.includes('whitespace-pre-wrap'))
    assert.equal(note.children.join(''), 'Tuesday schedule update\nCompleted milestones')
  } finally {
    if (renderer) act(() => renderer.unmount())
    global.requestAnimationFrame = originalRAF
    global.cancelAnimationFrame = originalCancelRAF
    global.Date = OriginalDate
  }
})

test('contractor timesheet APIs reach their own session checks without an admin-session redirect', async () => {
  let adminChecks = 0
  const { middleware } = loadTS('src/middleware.ts', {
    '@supabase/auth-helpers-nextjs': { createMiddlewareClient() { adminChecks++; throw new Error('Should not check admin session for contractor APIs') } },
    '@/lib/admin-allowlist': { isAdminEmail: () => false },
  })
  for (const pathname of ['/api/contractor-timesheets', '/api/timesheet-drafts']) {
    const response = await middleware({ nextUrl: { pathname } })
    assert.equal(response.headers.get('x-middleware-next'), '1')
    assert.equal(response.headers.get('location'), null)
  }
  assert.equal(adminChecks, 0)
})
