/* global require, module, process, __dirname */
// Demo Room + a tiny PostgREST/RPC imitation for store screenshots.
const L = {
  en: {
    cur: 'USD',
    f: 1,
    room: 'Flat 4B',
    names: ['Asha', 'Bilal', 'Chen', 'Dina'],
    titles: [
      'Groceries – weekly shop',
      'Electricity bill',
      'Internet (October)',
      'Cooking gas cylinder',
      'Rice & flour',
      'Cleaning supplies',
      'Vegetables & fruit',
      'Drinking water',
    ],
    needs: [
      ['Cooking gas refill', 'Running low since yesterday'],
      ['Dish soap', ''],
      ['Bread & eggs', 'For Friday breakfast'],
    ],
    oldTitle: 'Groceries',
  },
  ar: {
    cur: 'SAR',
    f: 3.75,
    room: 'شقة 4B',
    names: ['عائشة', 'بلال', 'تشين', 'دينا'],
    titles: [
      'مقاضي الأسبوع',
      'فاتورة الكهرباء',
      'الإنترنت (أكتوبر)',
      'أسطوانة غاز',
      'أرز ودقيق',
      'مواد تنظيف',
      'خضار وفواكه',
      'مياه شرب',
    ],
    needs: [
      ['تعبئة الغاز', 'قارب على النفاد منذ أمس'],
      ['سائل غسيل الصحون', ''],
      ['خبز وبيض', 'لفطور الجمعة'],
    ],
    oldTitle: 'مقاضي',
  },
  ur: {
    cur: 'PKR',
    f: 280,
    room: 'فلیٹ 4B',
    names: ['عائشہ', 'بلال', 'چن', 'دینا'],
    titles: [
      'ہفتے کا راشن',
      'بجلی کا بل',
      'انٹرنیٹ (اکتوبر)',
      'گیس سلنڈر',
      'چاول اور آٹا',
      'صفائی کا سامان',
      'سبزی اور پھل',
      'پینے کا پانی',
    ],
    needs: [
      ['گیس بھروانی ہے', 'کل سے کم ہے'],
      ['برتن دھونے کا صابن', ''],
      ['ڈبل روٹی اور انڈے', 'جمعہ کے ناشتے کے لیے'],
    ],
    oldTitle: 'راشن',
  },
  hi: {
    cur: 'INR',
    f: 83,
    room: 'फ़्लैट 4B',
    names: ['आशा', 'बिलाल', 'चेन', 'दीना'],
    titles: [
      'हफ़्ते का राशन',
      'बिजली का बिल',
      'इंटरनेट (अक्टूबर)',
      'गैस सिलेंडर',
      'चावल और आटा',
      'सफ़ाई का सामान',
      'सब्ज़ी और फल',
      'पीने का पानी',
    ],
    needs: [
      ['गैस भरवानी है', 'कल से कम है'],
      ['बर्तन धोने का साबुन', ''],
      ['ब्रेड और अंडे', 'शुक्रवार के नाश्ते के लिए'],
    ],
    oldTitle: 'राशन',
  },
};

function build(lang) {
  const c = L[lang];
  // amounts in minor units; round to whole units for big-number currencies
  const amt = (usd) => {
    const v = usd * c.f;
    if (c.f >= 50) return Math.round(v / 10) * 1000;
    return c.f === 1 ? Math.round(v * 100) : Math.round(v) * 100;
  };
  const U = ['u1', 'u2', 'u3', 'u4'];
  const room = {
    id: 'r1',
    name: c.room,
    country_code: 'XX',
    currency: c.cur,
    currency_decimals: 2,
    time_zone: 'Asia/Kolkata',
    settlement_cycle: 'monthly',
    pending_time_zone: null,
    pending_settlement_cycle: null,
    join_code: 'K7Q2MX',
    created_at: '2026-08-01T10:00:00Z',
    deleted_at: null,
  };
  const members = U.map((u, i) => ({
    id: 'm' + (i + 1),
    room_id: 'r1',
    user_id: u,
    role: i === 0 ? 'admin' : 'member',
    status: 'approved',
    requested_at: `2026-08-0${i + 1}T10:00:00Z`,
    joined_on: `2026-08-0${i + 1}`,
    left_on: null,
  }));
  const profiles = U.map((u, i) => ({
    id: u,
    display_name: c.names[i],
    avatar_url: null,
    deleted_at: null,
    purged_at: null,
    consent_version: '9999',
  }));
  const base = [
    [86.4, 0, '2026-10-25'],
    [64.2, 1, '2026-10-22'],
    [40, 2, '2026-10-20'],
    [18.5, 3, '2026-10-18'],
    [32.75, 0, '2026-10-14'],
    [14.3, 1, '2026-10-11'],
    [27.9, 2, '2026-10-08'],
    [12, 3, '2026-10-04'],
  ];
  const expenses = base.map(([usd, who, date], i) => ({
    id: 'e' + (i + 1),
    room_id: 'r1',
    title: c.titles[i],
    amount: amt(usd),
    currency: c.cur,
    category: 'general',
    expense_date: date,
    paid_by: U[who],
    notes: null,
    created_by: U[who],
    created_at: date + 'T12:00:00Z',
    deleted_at: null,
    cycle_id: 'c10',
    receipt_path: null,
    adjusts_expense_id: null,
    split_mode: 'equal',
    is_credit: false,
    updated_at: i === 0 ? '2026-10-25T18:40:00Z' : date + 'T12:00:00Z',
    late_entry_from: null,
  }));
  const splits = [];
  for (const e of expenses) {
    const q = Math.floor(e.amount / 4),
      r = e.amount - q * 4;
    U.forEach((u) => splits.push({ expense_id: e.id, user_id: u, amount: q + (u === e.paid_by ? r : 0) }));
  }
  const bal = (cycle) =>
    U.map((u) => {
      const ex = expenses.filter((e) => e.cycle_id === cycle);
      const paid = ex.filter((e) => e.paid_by === u).reduce((s, e) => s + e.amount, 0);
      const share = splits
        .filter((s) => s.user_id === u && ex.some((e) => e.id === s.expense_id))
        .reduce((s, x) => s + x.amount, 0);
      return { user_id: u, paid, share, net: paid - share };
    });
  const cycles = [
    {
      id: 'c10',
      room_id: 'r1',
      starts_on: '2026-10-01',
      ends_on: '2026-10-31',
      kind: 'monthly',
      time_zone: 'Asia/Kolkata',
      currency: c.cur,
      currency_decimals: 2,
      status: 'open',
      locked_at: null,
      purged_at: null,
    },
    {
      id: 'c9',
      room_id: 'r1',
      starts_on: '2026-09-01',
      ends_on: '2026-09-30',
      kind: 'monthly',
      time_zone: 'Asia/Kolkata',
      currency: c.cur,
      currency_decimals: 2,
      status: 'locked',
      locked_at: '2026-10-01T08:00:00Z',
      purged_at: null,
    },
  ];
  // September settlement: Asha (admin, me) receives; Bilal paid & confirmed; Chen awaiting proof check; Dina pending
  const sep = { u1: [220, 102.5], u2: [40, 102.5], u3: [60, 102.5], u4: [90, 102.5] };
  const lines = U.map((u, i) => {
    const share = amt(sep[u][1]),
      paid = amt(sep[u][0]),
      net = paid - share;
    const owe = Math.max(-net, 0);
    const st = [null, ['paid', owe, 0], ['awaiting', 0, owe], ['pending', 0, 0]][i];
    return {
      line_id: 'l' + (i + 1),
      user_id: u,
      share,
      paid,
      net,
      confirmed: st ? st[1] : 0,
      awaiting: st ? st[2] : 0,
      status: st ? st[0] : 'settled',
    };
  });
  // admin gets the remainder so totals match
  lines[0].paid = lines[0].share + lines.slice(1).reduce((s, l) => s - l.net, 0);
  lines[0].net = lines[0].paid - lines[0].share;
  lines[0].status = 'settled';
  const settlement = {
    id: 's9',
    room_id: 'r1',
    cycle_id: 'c9',
    total: lines.reduce((s, l) => s + l.paid, 0),
    currency: c.cur,
    currency_decimals: 2,
    generated_by: 'u1',
    generated_at: '2026-10-01T08:00:00Z',
  };
  const pay = (id, line, payer, amount, status, method, ref, at, proof) => ({
    id,
    settlement_line_id: line,
    payer_id: payer,
    amount,
    currency: c.cur,
    method,
    reference: ref,
    proof_path: proof,
    note: null,
    status,
    claimed_by: payer,
    claimed_at: at,
    decided_by: status === 'confirmed' ? 'u1' : null,
    decided_at: status === 'confirmed' ? at : null,
    reject_reason: null,
    self_confirmed: false,
    recorded_by_admin: false,
  });
  const payments = [
    pay('p2', 'l3', 'u3', -lines[2].net, 'awaiting', 'bank', 'TXN 48211907', '2026-10-26T09:12:00Z', null),
    pay(
      'p1',
      'l2',
      'u2',
      -lines[1].net,
      'confirmed',
      'wallet',
      'UPI 6620 1183',
      '2026-10-03T19:30:00Z',
      null,
    ),
  ];
  const acks = U.map((u, i) => ({
    settlement_id: 's9',
    user_id: u,
    delivered_at: '2026-10-01T08:00:00Z',
    seen_at: '2026-10-01T09:00:00Z',
    acknowledged_at: i < 3 ? '2026-10-02T09:00:00Z' : null,
  }));
  const needs = [
    {
      id: 'n1',
      room_id: 'r1',
      title: c.needs[0][0],
      note: c.needs[0][1] || null,
      status: 'pending',
      created_by: 'u3',
      created_at: '2026-10-27T07:40:00Z',
      accepted_by: null,
      accepted_at: null,
      completed_at: null,
      expense_id: null,
    },
    {
      id: 'n2',
      room_id: 'r1',
      title: c.needs[1][0],
      note: null,
      status: 'accepted',
      created_by: 'u4',
      created_at: '2026-10-26T16:10:00Z',
      accepted_by: 'u2',
      accepted_at: '2026-10-26T17:00:00Z',
      completed_at: null,
      expense_id: null,
    },
    {
      id: 'n3',
      room_id: 'r1',
      title: c.needs[2][0],
      note: c.needs[2][1] || null,
      status: 'completed',
      created_by: 'u1',
      created_at: '2026-10-23T08:00:00Z',
      accepted_by: 'u4',
      accepted_at: '2026-10-23T09:00:00Z',
      completed_at: '2026-10-23T12:00:00Z',
      expense_id: null,
    },
  ];
  const e1 = expenses[0];
  const audit = [
    {
      id: 3,
      entity_type: 'expenses',
      entity_id: 'e1',
      action: 'update',
      actor_id: 'u1',
      created_at: '2026-10-25T18:40:00Z',
      old_value: { ...e1, title: c.oldTitle, amount: amt(78.4) },
      new_value: { ...e1 },
    },
    {
      id: 2,
      entity_type: 'expenses',
      entity_id: 'e1',
      action: 'create',
      actor_id: 'u1',
      created_at: '2026-10-25T12:00:00Z',
      old_value: null,
      new_value: { ...e1, title: c.oldTitle, amount: amt(78.4) },
    },
  ];
  const b10 = bal('c10');
  const me = b10[0];
  const overview = [
    {
      room_id: 'r1',
      name: c.room,
      currency: c.cur,
      decimals: 2,
      role: 'admin',
      members: 4,
      cycle_id: 'c10',
      starts_on: '2026-10-01',
      ends_on: '2026-10-31',
      total: expenses.reduce((s, e) => s + e.amount, 0),
      my_paid: me.paid,
      my_share: me.share,
      open_needs: 2,
      pending_requests: 0,
    },
  ];
  const tables = {
    rooms: [room],
    room_members: members,
    profiles,
    expenses,
    expense_splits: splits,
    cycles,
    settlements: [settlement],
    payments,
    settlement_acks: acks,
    need_requests: needs,
    flags: [],
    audit_log: audit,
    notifications: [
      {
        id: 'x1',
        room_id: 'r1',
        kind: 'payment_claimed',
        payload: {},
        created_at: '2026-10-26T09:12:00Z',
        read_at: null,
      },
      {
        id: 'x2',
        room_id: 'r1',
        kind: 'need_created',
        payload: {},
        created_at: '2026-10-27T07:40:00Z',
        read_at: null,
      },
    ],
    expense_participants: expenses.flatMap((e) =>
      U.map((u) => ({ expense_id: e.id, user_id: u, active: true })),
    ),
    notification_prefs: [],
    settlement_lines: [],
  };
  const rpc = {
    my_rooms_overview: () => overview,
    my_open_settlements: () => [],
    my_ad_free: () => null,
    room_cycles: () => cycles,
    cycle_balances: (b) => bal(b.p_cycle === 'c9' ? 'c9' : 'c10'),
    room_balances: () => b10,
    room_member_labels: () => profiles.map((p) => ({ user_id: p.id, label: p.display_name })),
    room_former_members: () => [],
    room_member_emails: () => [],
    settlement_status: () => lines,
    mark_settlement_seen: () => null,
  };
  return { tables, rpc };
}

function filterRows(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^(eq|in|is|neq)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, op, val] = m;
    if (op === 'eq') out = out.filter((r) => String(r[k]) === val);
    if (op === 'neq') out = out.filter((r) => String(r[k]) !== val);
    if (op === 'is') out = out.filter((r) => (val === 'null' ? r[k] == null : String(r[k]) === val));
    if (op === 'in') {
      const set = val
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((s) => s.replace(/"/g, ''));
      out = out.filter((r) => set.includes(String(r[k])));
    }
  }
  const lim = params.get('limit');
  return lim ? out.slice(0, Number(lim)) : out;
}

async function handle(route, db, log) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname;
  let body = [];
  let status = 200;
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'content-range',
  };
  if (req.method() === 'OPTIONS')
    return route.fulfill({
      status: 200,
      headers: { ...headers, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
    });
  if (p.startsWith('/rest/v1/rpc/')) {
    const name = p.slice(13);
    const fn = db.rpc[name];
    if (!fn && log) log('UNMOCKED RPC ' + name);
    body = fn ? fn(JSON.parse(req.postData() || '{}')) : null;
  } else if (p.startsWith('/rest/v1/')) {
    const t = p.slice(9);
    if (!db.tables[t] && log) log('UNMOCKED TABLE ' + t);
    const rows = filterRows(db.tables[t] || [], url.searchParams);
    if (req.method() === 'HEAD') {
      headers['content-range'] = `0-0/${rows.length}`;
      return route.fulfill({ status: 200, headers, body: '' });
    }
    body = (req.headers()['accept'] || '').includes('vnd.pgrst.object') ? rows[0] : rows;
    if (body === undefined) {
      status = 406;
      body = { message: 'no rows' };
    }
  } else if (p.startsWith('/auth/v1/user')) {
    body = db.user;
  } else if (p.startsWith('/storage/')) {
    status = 404;
    body = {};
  } else {
    if (log) log('OTHER ' + p);
    body = {};
  }
  return route.fulfill({ status, headers, body: JSON.stringify(body) });
}

module.exports = { build, handle, L };
