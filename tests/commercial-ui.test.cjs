const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
const React = require("react"),
  { create, act } = require("react-test-renderer");
function load(file, mocks = {}) {
  const filename = path.join(__dirname, "..", file),
    module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, {
    filename,
  })(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    module,
    module.exports,
  );
  return module.exports;
}
const commercial = load("src/lib/commercial.ts"),
  dialog = { __esModule: true, default: () => {} };
const fixture = [
  {
    id: "nda",
    title: "Meridian mutual NDA",
    category: "NDA",
    project_id: null,
    tags: [],
    effective_date: "2026-10-01",
    expiry_date: null,
    archived_at: null,
    versions: [
      {
        id: "v1",
        ready: true,
        version: 1,
        uploaded_at: "2026-10-01",
        file_name: "nda.pdf",
      },
      {
        id: "v2",
        ready: true,
        version: 2,
        uploaded_at: "2026-10-02",
        file_name: "nda-v2.pdf",
      },
    ],
  },
  {
    id: "sow",
    title: "VA-1 statement of work",
    category: "SOW",
    project_id: "va",
    tags: ["program"],
    effective_date: "2026-10-01",
    expiry_date: null,
    archived_at: null,
    versions: [
      { id: "vs1", ready: true, version: 1, uploaded_at: "2026-10-01" },
    ],
  },
];
const text = (node) =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(text).join("")
      : node?.children
        ? node.children.map(text).join("")
        : "";
test("real document workspace supports combined grouping, PDF versions, archive/restore and confirmed deletion", async () => {
  const originalFetch = global.fetch,
    documents = structuredClone(fixture),
    actions = [];
  global.fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    if (body) {
      actions.push(body);
      const doc = documents.find((d) => d.id === body.document_id);
      if (body.action === "archive") doc.archived_at = "2026-10-03";
      if (body.action === "restore") doc.archived_at = null;
      if (body.action === "delete") documents.splice(documents.indexOf(doc), 1);
    }
    return {
      ok: true,
      json: async () =>
        url.includes("document-url")
          ? { url: "https://example.test/private-pdf" }
          : { documents: structuredClone(documents), role: "owner" },
    };
  };
  const module = load("src/components/commercial/CommercialDocuments.tsx", {
    "@/lib/supabase": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "verified-session" } },
          }),
        },
      },
    },
    "@/lib/commercial": commercial,
    "./useCommercialDialog": dialog,
  });
  let renderer;
  try {
    await act(async () => {
      renderer = create(
        React.createElement(module.default, {
          clientId: "client",
          clientName: "Meridian",
          projects: [{ id: "va", name: "VA-1" }],
        }),
      );
      await new Promise((r) => setImmediate(r));
    });
    const buttons = () => renderer.root.findAllByType("button"),
      button = (label) => buttons().find((b) => text(b.children) === label);
    assert.ok(button("Upload document"));
    assert.equal(
      buttons().filter((b) => text(b.children) === "Preview").length,
      2,
    );
    assert.equal(renderer.root.findAllByType("select").length, 0);
    const groups = renderer.root.findAllByProps({
      className: "commercial-group",
    });
    assert.equal(groups.length, 2);
    const groupingPicker = renderer.root
      .findAllByProps({ className: "commercial-picker" })
      .find((d) =>
        text(d.findByType("summary").children).includes("Choose levels"),
      );
    await act(async () =>
      groupingPicker
        .findAllByType("input")[1]
        .props.onChange({ target: { checked: true } }),
    );
    assert.equal(
      renderer.root.findAllByProps({ className: "commercial-group" }).length,
      4,
    );
    await act(async () => button("Preview").props.onClick());
    assert.equal(
      renderer.root.findByType("iframe").props.src,
      "https://example.test/private-pdf",
    );
    assert.equal(renderer.root.findByType("select").props.value, "v2");
    await act(async () =>
      renderer.root
        .findByType("select")
        .props.onChange({ target: { value: "v1" } }),
    );
    assert.equal(renderer.root.findByType("select").props.value, "v1");
    await act(async () =>
      renderer.root
        .findByProps({ "aria-label": "Close PDF viewer" })
        .props.onClick(),
    );
    await act(async () => button("Archive").props.onClick());
    assert.equal(
      buttons().filter((b) => text(b.children) === "Preview").length,
      1,
    );
    await act(async () => button("Archived").props.onClick());
    assert.ok(button("Restore"));
    await act(async () => button("Restore").props.onClick());
    await act(async () => button("Active").props.onClick());
    assert.equal(
      buttons().filter((b) => text(b.children) === "Preview").length,
      2,
    );
    await act(async () => button("Delete").props.onClick());
    assert.equal(actions.filter((a) => a.action === "delete").length, 0);
    assert.ok(button("Keep document"));
    await act(async () => button("Delete document").props.onClick());
    assert.equal(actions.filter((a) => a.action === "delete").length, 1);
    assert.equal(
      buttons().filter((b) => text(b.children) === "Preview").length,
      1,
    );
  } finally {
    renderer?.unmount();
    global.fetch = originalFetch;
  }
});
test("executive viewer sees PDFs without document management controls", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ documents: structuredClone(fixture), role: "viewer" }),
  });
  const module = load("src/components/commercial/CommercialDocuments.tsx", {
    "@/lib/supabase": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "verified-session" } },
          }),
        },
      },
    },
    "@/lib/commercial": commercial,
    "./useCommercialDialog": dialog,
  });
  let renderer;
  try {
    await act(async () => {
      renderer = create(
        React.createElement(module.default, {
          clientId: "client",
          clientName: "Meridian",
          projects: [{ id: "va", name: "VA-1" }],
        }),
      );
      await new Promise((r) => setImmediate(r));
    });
    const labels = renderer.root
      .findAllByType("button")
      .map((b) => text(b.children));
    assert.ok(labels.includes("Preview"));
    for (const forbidden of [
      "Upload document",
      "Delete",
      "Archive",
      "Add version",
    ])
      assert.equal(labels.includes(forbidden), false);
  } finally {
    renderer?.unmount();
    global.fetch = originalFetch;
  }
});
test("time tracking combines three employees, five projects and a custom date range", async () => {
  const OriginalDate = global.Date,
    raf = global.requestAnimationFrame,
    cancel = global.cancelAnimationFrame;
  global.Date = class extends OriginalDate {
    constructor(...args) {
      super(...(args.length ? args : ["2026-10-08T12:00:00"]));
    }
    static now() {
      return new OriginalDate("2026-10-08T12:00:00").getTime();
    }
  };
  global.requestAnimationFrame = (callback) => {
    callback(performance.now() + 10000);
    return 1;
  };
  global.cancelAnimationFrame = () => {};
  const members = Array.from({ length: 4 }, (_, i) => ({
    id: "e" + i,
    name: "Employee " + i,
    status: "active",
    cost_type: "hourly",
    cost_amount: 0,
  }));
  const projects = Array.from({ length: 6 }, (_, i) => ({
    id: "p" + i,
    name: "Project " + i,
    client_id: "client",
    budget_type: "time_and_materials",
    billing_model: "per_scope",
    bill_rate: 100,
    start_date: "2026-01-01",
  }));
  const entries = members.flatMap((m) =>
    projects.flatMap((p) =>
      ["2026-10-02", "2026-10-04"].map((date) => ({
        id: m.id + p.id + date,
        contractor_id: m.id,
        project_id: p.id,
        date,
        hours: 1,
        billable_hours: 1,
        status: "submitted",
      })),
    ),
  );
  const fixture = {
    profiles: { company_id: "company" },
    team_members: members,
    projects,
    clients: [{ id: "client", name: "Client One" }],
    time_entries: entries,
  };
  const supabase = {
    from(table) {
      const builder = {
        then(resolve) {
          return Promise.resolve({
            data: fixture[table] || [],
            error: null,
          }).then(resolve);
        },
      };
      for (const method of ["select", "eq", "order", "single"])
        builder[method] = () => builder;
      return builder;
    },
  };
  const pickers = load("src/components/commercial/CommercialDocuments.tsx", {
    "@/lib/supabase": { supabase: {} },
    "@/lib/commercial": commercial,
    "./useCommercialDialog": dialog,
  });
  const icons = new Proxy(
    { __esModule: true },
    { get: (target, name) => (name === "__esModule" ? true : () => null) },
  );
  const Page = load("src/app/time-tracking/page.tsx", {
    "@supabase/supabase-js": { createClient: () => supabase },
    "@/lib/supabase": {
      getCurrentUser: async () => ({ user: { id: "admin" } }),
    },
    "@/components/projects/shared": load("src/components/projects/shared.tsx"),
    "@/components/commercial/CommercialDocuments": pickers,
    "lucide-react": icons,
    recharts: icons,
  }).default;
  let renderer;
  try {
    await act(async () => {
      renderer = create(React.createElement(Page));
      await new Promise((r) => setImmediate(r));
    });
    const button = (label) =>
      renderer.root
        .findAllByType("button")
        .find((b) => text(b.children) === label);
    const picker = (label) =>
      renderer.root
        .findAllByProps({ className: "commercial-picker" })
        .find((p) => text(p.findByType("summary").children).startsWith(label));
    for (const [label, count] of [
      ["Employees", 3],
      ["Projects", 5],
    ]) {
      await act(async () =>
        picker(label)
          .findAllByType("button")
          .find((b) => text(b.children) === "Clear")
          .props.onClick(),
      );
      for (let i = 0; i < count; i++)
        await act(async () =>
          picker(label)
            .findAllByType("input")
            [i].props.onChange({ target: { checked: true } }),
        );
    }
    await act(async () => button("This Month").props.onClick());
    await act(async () => button("Custom Range").props.onClick());
    const dates = renderer.root
      .findAllByType("input")
      .filter((i) => i.props.type === "date");
    await act(async () =>
      dates[0].props.onChange({ target: { value: "2026-10-02" } }),
    );
    await act(async () =>
      dates[1].props.onChange({ target: { value: "2026-10-03" } }),
    );
    await act(async () => button("By Employee").props.onClick());
    const content = text(renderer.toJSON());
    assert.ok(content.includes("3 employees"));
    assert.ok(content.includes("5 projects"));
    for (let i = 0; i < 3; i++)
      assert.ok(
        renderer.root
          .findAllByType("h3")
          .some((n) => text(n.children) === "Employee " + i),
      );
    assert.equal(
      renderer.root
        .findAllByType("h3")
        .some((n) => text(n.children) === "Employee 3"),
      false,
    );
    // Data rows are the actual component's computed, date-filtered employee totals.
    const sections = renderer.root.findAll(
      (n) =>
        n.type &&
        typeof n.type === "function" &&
        n.type.name === "CollapsibleSection",
    );
    const employeeSections = sections.filter(
      (n) =>
        typeof n.props.title === "string" &&
        n.props.title.startsWith("Employee "),
    );
    assert.equal(employeeSections.length, 3);
    for (const section of employeeSections)
      assert.equal(section.props.badge, "5.0 hrs");
  } finally {
    await act(async () => renderer?.unmount());
    global.Date = OriginalDate;
    global.requestAnimationFrame = raf;
    global.cancelAnimationFrame = cancel;
  }
});

test("missing commercial access shows a recovery state without an upload invitation or false empty count", async () => {
  const originalFetch = global.fetch;
  let allowed = false;
  global.fetch = async () => ({
    ok: allowed,
    json: async () =>
      allowed
        ? { documents: [], role: "owner" }
        : { error: "You do not have commercial access for this client." },
  });
  const module = load("src/components/commercial/CommercialDocuments.tsx", {
    "@/lib/supabase": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "verified-session" } },
          }),
        },
      },
    },
    "@/lib/commercial": commercial,
    "./useCommercialDialog": dialog,
  });
  let renderer;
  try {
    await act(async () => {
      renderer = create(
        React.createElement(module.default, {
          clientId: "client",
          clientName: "Meridian",
          projects: [],
        }),
      );
      await new Promise((r) => setImmediate(r));
    });
    const buttons = () => renderer.root.findAllByType("button");
    assert.equal(
      buttons().find((b) => text(b.children).trim() === "Upload document").props
        .disabled,
      true,
    );
    assert.ok(
      JSON.stringify(renderer.toJSON()).includes("Commercial access required"),
    );
    assert.equal(
      renderer.root.findAllByProps({ className: "commercial-list-caption" })
        .length,
      0,
    );
    assert.equal(
      buttons().some(
        (b) => text(b.children).trim() === "Upload your first agreement",
      ),
      false,
    );
    allowed = true;
    await act(async () => {
      await buttons()
        .find((b) => text(b.children).trim() === "Check access again")
        .props.onClick();
    });
    assert.ok(
      buttons().find((b) => text(b.children).trim() === "Upload document") &&
        !buttons().find((b) => text(b.children).trim() === "Upload document")
          .props.disabled,
    );
    assert.ok(
      buttons().find(
        (b) => text(b.children).trim() === "Upload your first agreement",
      ),
    );
  } finally {
    renderer?.unmount();
    global.fetch = originalFetch;
  }
});

const portfolio = load("src/components/clients/ClientPortfolio.tsx", {
  "./client-portfolio.css": {},
  "next/link": {
    __esModule: true,
    default: ({ children, ...props }) =>
      React.createElement("a", props, children),
  },
});
const portfolioFixture = [
  {
    id: "a",
    name: "Alpha",
    status: "active",
    payment_terms: "net_30",
    tm: 1,
    ls: 1,
    active: 2,
    resources: ["Brian"],
    hours: 12,
    scopes: [{ id: "va", name: "VA-1" }],
  },
  {
    id: "b",
    name: "Beta",
    status: "active",
    payment_terms: "net_60",
    tm: 0,
    ls: 1,
    active: 1,
    resources: ["Travis"],
    hours: 24,
    scopes: [{ id: "tx", name: "TX-1" }],
  },
  {
    id: "c",
    name: "Archived",
    status: "archived",
    payment_terms: "net_30",
    tm: 0,
    ls: 0,
    active: 0,
    resources: [],
    hours: 0,
    scopes: [],
  },
];
test("client portfolio combines lifecycle, billing, scope and people search without duplicating mixed clients", () => {
  const filters = {
    search: "Brian",
    lifecycle: "current",
    billing: "fee",
    work: "scopes",
    sort: "hours",
    groups: ["status", "billing"],
  };
  assert.deepEqual(
    portfolio.selectPortfolio(portfolioFixture, filters).map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(
    portfolio
      .selectPortfolio(portfolioFixture, {
        ...filters,
        search: "",
        billing: "all",
      })
      .map((c) => c.id),
    ["b", "a"],
  );
  assert.deepEqual(
    portfolio
      .selectPortfolio(portfolioFixture, {
        ...filters,
        search: "",
        lifecycle: "archived",
        billing: "all",
        work: "none",
      })
      .map((c) => c.id),
    ["c"],
  );
  assert.equal(
    portfolio.selectPortfolio(portfolioFixture, {
      ...filters,
      search: "VA-1",
      billing: "tm",
    }).length,
    1,
  );
});
test("portfolio supports ordered multiple grouping, comparison and direct client/document/scope navigation", () => {
  const previousWindow = global.window;
  global.window = { addEventListener() {}, removeEventListener() {} };
  let renderer;
  try {
    act(() => {
      renderer = create(
        React.createElement(portfolio.default, {
          clients: portfolioFixture,
          totals: { scopes: 3, resources: 2, hours: 36 },
          onAdd() {},
          onExport() {},
          onEdit() {},
          onStatus() {},
          onDelete() {},
        }),
      );
    });
    const button = (label) =>
      renderer.root
        .findAllByType("button")
        .find(
          (b) =>
            text(b.toJSON ? b.toJSON() : { children: b.children }).trim() ===
            label,
        );
    assert.equal(renderer.root.findAllByType("article").length, 2);
    const hrefs = renderer.root.findAllByType("a").map((a) => a.props.href);
    assert.ok(hrefs.includes("/clients/a?tab=documents"));
    assert.ok(hrefs.includes("/projects?project=va"));
    act(() => button("Status").props.onClick());
    act(() => button("Billing model").props.onClick());
    assert.deepEqual(
      renderer.root
        .findAll(
          (n) => n.type === "h3" && n.props.className === "cp-group-title",
        )
        .map((n) => text({ children: n.children })),
      ["Active / Mixed billing1 clients", "Active / Monthly fee1 clients"],
    );
    act(() => button("Compare").props.onClick());
    assert.equal(renderer.root.findAllByType("article").length, 0);
    assert.equal(renderer.root.findAllByType("table").length, 2);
    act(() => renderer.unmount());
  } finally {
    global.window = previousWindow;
  }
});
