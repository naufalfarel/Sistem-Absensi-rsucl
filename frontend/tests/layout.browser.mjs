// Read-only UI smoke tests against a local dev server. All API responses use fixtures;
// no real account, attendance, approval or report data is read or changed.
// Start Edge headless with --remote-debugging-port=9333 and an isolated profile,
// then run: node --experimental-websocket tests/layout.browser.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.UI_TEST_ORIGIN || 'http://127.0.0.1:5173';
const out = new URL('../node_modules/.cache/ui-qa/', import.meta.url);
await mkdir(out, { recursive: true });
const target = await fetch('http://127.0.0.1:9333/json/new?' + origin, { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task?.reject(new Error(JSON.stringify(message.error)));
    else task?.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

function fixtures(role, tab) {
  localStorage.clear();
  window.__uiFixtureReady = role + ':' + tab;
  const user = { id: 9999, employee_id: 9999, role, name: 'Nadia Putri', username: 'preview-only', email: 'preview@example.invalid', nik_ktp: '0000000000000000', department: 'Rawat Inap', department_id: 1, position: 'Staf Keperawatan', pj_bagian_department: 'Rawat Inap', pj_bagian_department_id: 1, gender: 'Perempuan', join_date: '2022-01-01' };
  if (role !== 'public') {
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('rsucl_token', 'local-fixture-not-a-real-token');
  }
  localStorage.setItem('admin_active_tab', tab);
  localStorage.setItem('employee_active_tab', tab);
  localStorage.setItem('pj_active_tab', tab);
  const departments = [{ id: 1, name: 'Rawat Inap' }, { id: 2, name: 'Laboratorium' }, { id: 3, name: 'Instalasi Bedah Sentral' }];
  const employees = ['Nadia Putri', 'Muhammad Rizki Pratama', 'Siti Nur Aisyah', 'Ahmad Fauzan', 'dr. Putri Andini, Sp.PD', 'Nurul Hidayati'].map((name, i) => ({ ...user, id: i + 1, name, department: departments[i % 3].name, department_id: i % 3 + 1, status: 'active', today_attendance: { check_in: '08:3' + i, check_out: i === 2 ? '15:00' : null, status: i === 1 ? 'telat' : 'hadir', schedule_name: 'Pagi' } }));
  const summary = {
    total_employees: 456, today: { hadir: 115, telat: 43, alpha: 293, cuti: 5, belum: 0 },
    this_month: { hadir: 5915, telat: 1724, alpha: 0, cuti: 77 },
    trends: { presence: 3, late: -2, alpha: 0, cuti: 1 }, pending_leave: 12,
    daily_chart: ['Kam 24/9', 'Jum 25/9', 'Sab 26/9', 'Min 27/9', 'Sen 28/9', 'Sel 29/9', 'Rab 30/9'].map((label, i) => ({ date: '2026-09-' + (24 + i), label, hadir: [274, 291, 247, 92, 285, 281, 158][i], alpha: 0 })),
    monthly_trend: [], composition: [], weekly_late: [],
    dept_attendance: departments.map((d, i) => ({ dept: d.name, persen: 100 - i })),
    diligence_ranking: { daily: [], monthly: [] },
  };
  const nativeFetch = window.fetch.bind(window);
  window.__uiFixtureRequests = [];
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    const path = url.pathname.slice(4);
    window.__uiFixtureRequests.push(path);
    let result = { success: false, data: [], message: 'Data pratinjau kosong.' };
    if (path === '/auth/me' || path === '/me') result = { success: true, data: user };
    if (path === '/settings') result = { success: true, data: { hospital_name: 'RSU Cempaka Lima', latitude: 5.55, longitude: 95.32, radius: 150, work_start_time: '08:30', work_end_time: '17:00' } };
    if (path === '/employees') result = { success: true, data: employees };
    if (path === '/employees/meta') result = { success: true, data: { departments, positions: [{ id: 1, name: 'Staf Keperawatan' }] } };
    if (path === '/departments') result = { success: true, data: departments };
    if (path === '/reports/summary') result = { success: true, data: summary };
    if (path === '/notifications') result = { success: true, data: { notifications: [], unread_count: 3 } };
    if (path === '/attendance/overtimes/summary') result = { success: true, data: { pending: 4, draft: 0, approved: 0, rejected: 0 } };
    if (path === '/attendance/today') result = { success: true, data: null, today_records: [], today_shifts: [], summary: { hadir: 20, telat: 0, cuti: 0, sakit: 0 } };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

const pages = {
  admin: ['dashboard', 'reports', 'employees', 'onboarding', 'departments', 'pj_bagian', 'attendance', 'history', 'schedule', 'shift_approval', 'holidays', 'leave', 'overtime', 'assignment', 'resignation', 'disciplinary', 'notifications', 'settings'],
  super_admin: ['super_admin_management'],
  employee: ['dashboard', 'attendance', 'history', 'schedule', 'leave', 'overtime', 'assignment', 'resignation', 'notifications', 'profile', 'guide', 'disciplinary'],
  pj_bagian: ['dashboard', 'approvals', 'shift_proposals', 'staff_attendance', 'attendance', 'history', 'overtime_personal', 'leave', 'assignment', 'resignation', 'notifications', 'profile', 'guide', 'disciplinary'],
  public: ['login'],
};
const actions = {
  'admin:employees': 'Tambah Pegawai',
  'admin:departments': 'Tambah Unit kerja',
  'admin:pj_bagian': 'Tugaskan PJ Baru',
  'admin:schedule': 'Tambah Shift',
  'admin:leave': 'Catat Cuti Pegawai',
  'admin:disciplinary': 'Kirim Surat Peringatan / Sanksi',
  'employee:overtime': 'Ajukan Lembur',
  'employee:assignment': 'Ajukan Surat Tugas',
};
await cdp('Page.enable');
await cdp('Runtime.enable');
let initScript;
const results = [];
const widths = process.env.UI_TEST_WIDTHS?.split(',').map(Number) || [390, 1440];
const roleFilter = process.env.UI_TEST_ROLE;
const tabFilter = process.env.UI_TEST_TAB;
for (const width of widths) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 768 });
  for (const [role, tabs] of Object.entries(pages)) {
    if (roleFilter && roleFilter !== role) continue;
    for (const tab of tabs) {
      if (tabFilter && tabFilter !== tab) continue;
      const action = process.env.UI_TEST_ACTIONS ? actions[role + ':' + tab] : null;
      if (process.env.UI_TEST_ACTIONS && !action) continue;
      if (initScript) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: initScript });
      initScript = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures})(${JSON.stringify(role)}, ${JSON.stringify(tab)})` })).identifier;
      errors.length = 0;
      await cdp('Page.navigate', { url: origin });
      for (let i = 0; i < 80; i++) {
        await pause(100);
        if (await evaluate(`window.__uiFixtureReady === ${JSON.stringify(role + ':' + tab)} && !!document.querySelector(${JSON.stringify(role === 'public' ? 'input' : '.app-main')})`)) break;
      }
      await pause(450);
      let actionOpened = true;
      if (action) {
        actionOpened = await evaluate(`(() => {
          const button = [...document.querySelectorAll('.app-main button')].find(el => el.textContent.trim().includes(${JSON.stringify(action)}));
          if (!button) return false;
          button.click(); return true;
        })()`);
        await pause(250);
        actionOpened = actionOpened && await evaluate('!!document.querySelector(".fixed input, .fixed select, .fixed textarea, .app-main form input")');
      }
      const layout = await evaluate(`(() => {
        const main = document.querySelector('.app-main') || (${role === 'public'} ? document.body : null);
        const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
        const elements = main ? [...new Set([...main.querySelectorAll('*'), ...document.querySelectorAll('.rs-app > .fixed *')])] : [];
        const overflowing = elements.filter(el => {
          if (!visible(el) || el.closest('.overflow-x-auto, .overflow-auto, table, svg, .leaflet-container')) return false;
          if (el.closest('.app-sidebar, .app-bottom-nav')) return false;
          // Fixed overlays are relative to the viewport, not the narrower main column.
          const overlay = el.closest('.fixed');
          const r = el.getBoundingClientRect(), m = main.getBoundingClientRect();
          if (overlay) return r.right > innerWidth + 2 || r.left < -2;
          return r.right > m.right + 2 || r.left < m.left - 2;
        }).slice(0, 8).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 90) }));
        return { mounted: !!main, bodyWidth: document.documentElement.scrollWidth, viewport: innerWidth, mainWidth: main?.clientWidth, mainScroll: main?.scrollWidth, overflowing, text: document.body.innerText.slice(0, 140) };
      })()`);
      const result = { role, tab, width, ...layout, action, actionOpened, errors: [...errors] };
      results.push(result);
      console.log(JSON.stringify(result));
      if (tab === 'dashboard' || tab === 'reports' || action) {
        const shot = await cdp('Page.captureScreenshot', { format: 'png' });
        await writeFile(new URL(`${role}-${tab}-${width}.png`, out), Buffer.from(shot.data, 'base64'));
      }
    }
  }
}
await writeFile(new URL(process.env.UI_TEST_ACTIONS ? 'form-results.json' : 'layout-results.json', out), JSON.stringify(results, null, 2));
socket.close();
await fetch('http://127.0.0.1:9333/json/close/' + target.id);
const failures = results.filter(r => !r.mounted || !r.actionOpened || r.bodyWidth > r.viewport + 2 || r.mainScroll > r.mainWidth + 2 || r.overflowing.length || r.errors.length);
console.log(`LAYOUT RESULT: ${results.length - failures.length}/${results.length} passed; ${failures.length} need review.`);
process.exitCode = failures.length ? 1 : 0;
