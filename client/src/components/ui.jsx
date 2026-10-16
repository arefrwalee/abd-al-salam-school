/* =====================================================================
   مكوّنات الواجهة الأساسية: أيقونات، شارات، بطاقات، مؤشرات، رسوم بيانية SVG
   ===================================================================== */
import { useState } from 'react';
import { ICONS } from './icons.js';
import { fmtNum, fmtPct, clamp, sum, DAYS, MONTHS, addDays, dow, fmtDate, parseISO } from '../lib/utils.js';
import { Settings } from '../lib/store.js';
import { ATT_LABEL } from '../lib/domain.js';
import { QR } from '../lib/qr.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Icon({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] || ICONS.info} /></svg>;
}
export const Badge = ({ children, tone = '', plain, title }) => <span className={cx('badge', tone, plain && 'plain')} title={title}>{children}</span>;
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join(' ');
const hashTone = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return 't' + (x % 4); };
export const Avatar = ({ name, lg }) => <span className={cx('av', hashTone(name), lg && 'lg')} aria-hidden="true">{initials(name)}</span>;
export function Person({ name, sub, href }) {
  return <div className="person"><Avatar name={name} /><div style={{ minWidth: 0 }}>{href ? <a href={href} className="nm">{name}</a> : <div className="nm">{name}</div>}{sub && <div className="sub">{sub}</div>}</div></div>;
}
export function PageHead({ title, sub, children }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="page-actions">{children}</div></div>;
}
export function Card({ title, sub, actions, flush, className, children }) {
  return <section className={cx('card', className)}>
    {title && <div className="card-h"><h3>{title}{sub && <span className="sub">{'  ·  ' + sub}</span>}</h3>{actions && <div className="row">{actions}</div>}</div>}
    <div className={cx('card-b', flush && 'flush')}>{children}</div>
  </section>;
}
export function Kpi({ label, value, sub, tone = '', ic = 'chart', extra }) {
  return <div className={cx('kpi', tone)}><div className="kpi-top"><span>{label}</span><span className="kpi-ic"><Icon name={ic} size={17} /></span></div><div className="kpi-v">{value}</div>{sub != null && <div className="kpi-s">{sub}</div>}{extra}</div>;
}
export const Empty = ({ text, action, ic = 'info' }) => <div className="empty"><div className="empty-ic"><Icon name={ic} size={22} /></div><div>{text}</div>{action}</div>;
export function Progress({ p, tone }) { const t = tone ?? (p >= 90 ? 'ok' : p >= 75 ? '' : p >= 60 ? 'warn' : 'bad'); return <div className={cx('prog', t)}><i style={{ width: clamp(p || 0, 0, 100) + '%' }} /></div>; }
export const PctCell = ({ p, tone }) => p == null ? <span className="muted">—</span> : <div className="pct-cell"><b className="tabnum">{fmtPct(p, 0)}</b><Progress p={p} tone={tone} /></div>;
export function Select({ options, value, onChange, label, id }) {
  return <select className="select sm" id={id} aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
export function Seg({ options, value, onChange }) {
  return <div className="seg" role="tablist">{options.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export function Tabs({ items, initial }) {
  const list = items.filter(Boolean); const [cur, setCur] = useState(initial || list[0].key);
  const it = list.find(i => i.key === cur) || list[0];
  return <div>
    <div className="tabs" role="tablist">{list.map(i => <button key={i.key} type="button" role="tab" aria-selected={i.key === it.key} className={i.key === it.key ? 'on' : ''} onClick={() => setCur(i.key)}>{i.label}</button>)}</div>
    <div style={{ paddingTop: 16 }}>{it.render()}</div>
  </div>;
}
export const KV = ({ pairs }) => <dl className="kv">{pairs.filter(Boolean).map(([k, v], i) => <FragmentPair key={i} k={k} v={v} />)}</dl>;
const FragmentPair = ({ k, v }) => <><dt>{k}</dt><dd>{v == null || v === '' ? '—' : v}</dd></>;
export const Banner = ({ tone = '', ic = 'info', children }) => <div className={cx('banner', tone)}><Icon name={ic} size={17} /><div>{children}</div></div>;
export const Spinner = ({ text }) => <div className="boot"><div className="boot-card"><div className="spinner" />{text && <div className="muted">{text}</div>}</div></div>;
export const Crest = ({ lg, style }) => <div className={cx('crest', lg && 'lg')} style={style} aria-hidden="true"><i /><i /><i /></div>;

/* ---------- Charts (pure SVG, one scale per chart) ---------- */
export function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
export const shortNum = v => v >= 1e6 ? fmtNum(v / 1e6, v % 1e6 ? 1 : 0) + 'م' : v >= 1e3 ? fmtNum(v / 1e3, 0) + 'ألف' : fmtNum(v, v < 10 && v % 1 ? 1 : 0);
const Legend = ({ series }) => series.length > 1 ? <div className="legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div> : null;

export function BarChart({ labels, series, height = 230, fmt = shortNum, tip = fmtNum, max, yTicks = 4, showVals }) {
  const W = 640, H = height, pl = 52, pr = 10, pt = 14, pb = 36;
  const vmax = max ?? niceMax(Math.max(1, ...series.flatMap(s => s.values.map(v => v || 0))));
  const iw = W - pl - pr, ih = H - pt - pb, n = labels.length, g = iw / Math.max(1, n);
  const bw = Math.min(30, (g * 0.72) / series.length); const step = n > 14 ? Math.ceil(n / 12) : 1;
  return <div className="chart-box"><Legend series={series} />
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" direction="ltr">
      {Array.from({ length: yTicks + 1 }, (_, i) => { const v = vmax * i / yTicks, y = pt + ih - ih * i / yTicks; return <g key={'t' + i}><line x1={pl} x2={W - pr} y1={y} y2={y} className="grid" /><text x={pl - 8} y={y + 4} className="tick" textAnchor="end">{fmt(v)}</text></g>; })}
      {labels.map((lb, i) => { const cxp = pl + g * i + g / 2; return <g key={'b' + i}>
        {series.map((s, j) => { const v = s.values[i] || 0; const bh = ih * Math.min(v, vmax) / vmax; const x = cxp - (bw * series.length) / 2 + j * bw; return <g key={j}><rect x={x + 1} y={pt + ih - bh} width={Math.max(1, bw - 2)} height={Math.max(0, bh)} rx="3" fill={s.color || 'var(--c1)'}><title>{`${lb}${s.name ? ' — ' + s.name : ''}: ${tip(v)}`}</title></rect>{showVals && v ? <text x={x + bw / 2} y={pt + ih - bh - 5} className="val" textAnchor="middle">{fmt(v)}</text> : null}</g>; })}
        {i % step === 0 && <text x={cxp} y={H - 14} className="tick" textAnchor="middle">{lb}</text>}
      </g>; })}
      <line x1={pl} x2={W - pr} y1={pt + ih} y2={pt + ih} className="axis" />
    </svg></div>;
}
export function LineChart({ labels, series, height = 230, fmt = v => fmtNum(v), tip, min = 0, max, yTicks = 4, area = true }) {
  const W = 640, H = height, pl = 46, pr = 14, pt = 16, pb = 36; tip = tip || fmt;
  const vals = series.flatMap(s => s.values.filter(v => v != null));
  const vmax = max ?? niceMax(Math.max(1, ...vals)); const vmin = min;
  const iw = W - pl - pr, ih = H - pt - pb, n = labels.length;
  const X = i => pl + (n <= 1 ? iw / 2 : iw * i / (n - 1)); const Y = v => pt + ih - ih * (v - vmin) / (vmax - vmin || 1);
  const step = Math.max(1, Math.ceil(n / 8));
  return <div className="chart-box"><Legend series={series} />
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" direction="ltr">
      {Array.from({ length: yTicks + 1 }, (_, i) => { const v = vmin + (vmax - vmin) * i / yTicks, y = Y(v); return <g key={'t' + i}><line x1={pl} x2={W - pr} y1={y} y2={y} className="grid" /><text x={pl - 8} y={y + 4} className="tick" textAnchor="end">{fmt(v)}</text></g>; })}
      {labels.map((lb, i) => ((i % step === 0 && n - 1 - i >= step * 0.7) || i === n - 1) && <text key={'l' + i} x={X(i)} y={H - 14} className="tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{lb}</text>)}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(clamp(v, vmin, vmax))]).filter(Boolean); if (!pts.length) return null;
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
        return <g key={si}>
          {area && series.length === 1 && <path d={d + `L${pts[pts.length - 1][0]},${pt + ih}L${pts[0][0]},${pt + ih}Z`} fill={s.color} fillOpacity=".12" stroke="none" />}
          <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          {s.values.map((v, i) => v == null ? null : <circle key={i} cx={X(i)} cy={Y(clamp(v, vmin, vmax))} r={i === s.values.length - 1 ? 4.5 : 3} fill={i === s.values.length - 1 ? s.color : 'var(--surface)'} stroke={s.color} strokeWidth="2"><title>{`${labels[i]}${s.name ? ' — ' + s.name : ''}: ${tip(v)}`}</title></circle>)}
        </g>;
      })}
      <line x1={pl} x2={W - pr} y1={pt + ih} y2={pt + ih} className="axis" />
    </svg></div>;
}
export function Donut({ items, size = 168, thick = 24, center, sub, fmt = fmtNum }) {
  const total = sum(items.map(i => i.value)); const r = size / 2 - thick / 2; const C = 2 * Math.PI * r; let off = 0;
  const gap = items.filter(i => i.value > 0).length > 1 ? 2 : 0;
  return <div className="donut-wrap">
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={thick} />
      {items.map((it, i) => { if (!total || !it.value) return null; const len = C * it.value / total; const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={thick} strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}><title>{`${it.label}: ${fmt(it.value)}`}</title></circle>; off += len; return el; })}
      {center != null && <><text x={size / 2} y={size / 2 + (sub ? 3 : 8)} textAnchor="middle" className="donut-c">{center}</text>{sub && <text x={size / 2} y={size / 2 + 22} textAnchor="middle" className="donut-s">{sub}</text>}</>}
    </svg>
    <ul className="donut-legend">{items.map(it => <li key={it.label}><i style={{ background: it.color }} /><span>{it.label}</span><b className="tabnum">{fmt(it.value) + (total ? ' · ' + fmtPct(it.value / total * 100) : '')}</b></li>)}</ul>
  </div>;
}
export function HBars({ rows, max, fmt = v => fmtPct(v, 0), color }) {
  const m = max ?? Math.max(1, ...rows.map(r => r.value || 0));
  return <div className="hbars">{rows.map(r => <div className="hbar" key={r.label} title={`${r.label}: ${fmt(r.value)}`}><span className="lb">{r.label}</span><div className="tr"><i style={{ width: clamp((r.value || 0) / m * 100, 0, 100) + '%', background: r.color || color || 'var(--c1)' }} /></div><b className="tabnum">{r.value == null ? '—' : fmt(r.value)}</b></div>)}</div>;
}
export function Spark({ values, color = 'var(--c1)', w = 96, h = 26 }) {
  const v = values.filter(x => x != null);
  if (v.length < 2) return <svg width={w} height={h} className="spark" />;
  const mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
  const pts = v.map((x, i) => [i * (w - 4) / (v.length - 1) + 2, h - 3 - (x - mn) / rg * (h - 6)]);
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark"><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" /><circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} /></svg>;
}
export function Gauge({ score, tone }) {
  const color = tone === 'bad' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : 'var(--green)';
  const r = 48, c0 = 59, cy = 58, C = Math.PI * r;
  return <div className="gauge" title="درجة الخطر من 100"><svg width="118" height="66" viewBox="0 0 118 66">
    <path d={`M${c0 - r},${cy} A${r},${r} 0 0 1 ${c0 + r},${cy}`} fill="none" stroke="var(--sunken)" strokeWidth="10" strokeLinecap="round" />
    <path d={`M${c0 - r},${cy} A${r},${r} 0 0 1 ${c0 + r},${cy}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * clamp(score, 0, 100) / 100} ${C}`} />
  </svg><b className="tabnum" style={{ color }}>{fmtNum(score)}</b></div>;
}
export function AttCalendar({ recs, from, to }) {
  const map = new Map(recs.map(r => [r.date, r])); const days = Settings.get().schoolDays;
  let d = from; while (dow(d) !== days[0]) d = addDays(d, -1);
  const cells = [];
  while (d <= to) { if (days.includes(dow(d))) { const r = map.get(d); const dt = parseISO(d); cells.push(<div key={d} className={cx('d', r && r.status, d < from && 'out')} title={fmtDate(d) + (r ? ' — ' + ATT_LABEL[r.status] + (r.reason ? ' (' + r.reason + ')' : '') : ' — لم يُسجَّل')}><b>{dt.getDate()}</b><span>{MONTHS[dt.getMonth()].split(' ')[0]}</span></div>); } d = addDays(d, 1); }
  const sw = { present: 'var(--green-soft)', absent: 'var(--red)', late: 'var(--amber-soft)', excused: 'var(--blue-soft)' };
  return <div className="stack"><div className="cal">{days.map(x => <div key={'h' + x} className="hd">{DAYS[x]}</div>)}{cells}</div>
    <div className="cal-legend">{Object.entries(ATT_LABEL).map(([k, l]) => <span key={k}><i style={{ background: sw[k] }} />{l}</span>)}<span><i style={{ background: 'var(--sunken)' }} />لم يُسجَّل</span></div></div>;
}
export function QRCode({ text, size = 112 }) {
  const M = QR.encode(text), n = M.length, q = 4, s = n + q * 2; let d = '';
  M.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q},${y + q}h1v1h-1z`; }));
  return <svg viewBox={`0 0 ${s} ${s}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="رمز QR للتحقق"><rect width={s} height={s} fill="#ffffff" /><path d={d} fill="#000000" /></svg>;
}
