/* جدول بيانات: بحث، تصفية، فرز، ترقيم صفحات، تصدير CSV، وعرض كبطاقات على الجوال */
import { useMemo, useState } from 'react';
import { normAr, fmtNum } from '../lib/utils.js';
import { Icon, Empty, cx } from './ui.jsx';
import { exportText } from './modals.jsx';

export default function DataTable({ id = 'dt', rows, columns, filters = [], search = true, searchPh = 'بحث...', searchText, pageSize = 12, exportName, unit = 'سجل', toolbar, onRow, defaultSort = null, defaultDir = 1, empty = 'لا توجد نتائج مطابقة', cards = true }) {
  const cols = columns.filter(Boolean);
  const [q, setQ] = useState('');
  const [f, setF] = useState(() => Object.fromEntries(filters.map((x, i) => [i, x.value || ''])));
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState(defaultDir);
  const [page, setPage] = useState(0);
  const colText = (c, r) => c.text ? c.text(r) : c.sort ? c.sort(r) : r[c.key];
  const list = useMemo(() => {
    let rs = rows;
    if (q) { const nq = normAr(q); rs = rs.filter(r => normAr(searchText ? searchText(r) : cols.map(c => colText(c, r)).join(' ')).includes(nq)); }
    filters.forEach((x, i) => { if (f[i]) rs = rs.filter(r => x.test(r, f[i])); });
    if (sort != null && cols[sort]) { const c = cols[sort]; const val = c.sort || (r => r[c.key]); rs = [...rs].sort((a, b) => { const x = val(a), y = val(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * dir; }); }
    return rs;
  }, [rows, q, f, sort, dir]);
  const pages = Math.max(1, Math.ceil(list.length / pageSize)); const pg = Math.min(page, pages - 1);
  const slice = list.slice(pg * pageSize, pg * pageSize + pageSize);
  function csv() {
    const cs = cols.filter(c => c.csv !== false);
    const esc = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [cs.map(c => esc(c.label)).join(','), ...list.map(r => cs.map(c => esc(c.csv ? c.csv(r) : colText(c, r))).join(','))].join('\r\n');
  }
  return <div className="dt">
    <div className="dt-bar">
      {search && <div className="search-in"><Icon name="search" size={16} /><input type="search" className="input" id={id + '-q'} placeholder={searchPh} aria-label="بحث" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} /></div>}
      {filters.map((x, i) => <select key={i} className="select sm" id={id + '-f' + i} aria-label={x.label} value={f[i]} onChange={e => { setF({ ...f, [i]: e.target.value }); setPage(0); }}><option value="">{x.label}</option>{x.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
      <div className="grow" />
      <span className="dt-count">{fmtNum(list.length)} {unit}</span>
      {exportName && <button className="btn ghost sm" onClick={() => exportText(exportName + '.csv', '﻿' + csv(), 'text/csv')}><Icon name="download" size={15} />CSV</button>}
      {toolbar}
    </div>
    <div className="tbl-wrap"><table className={cx('tbl', cards && 'cards')}>
      <thead><tr>{cols.map((c, i) => <th key={i} scope="col" className={cx(c.cls, c.sortable !== false && 'sortable')} onClick={c.sortable === false ? undefined : () => { if (sort === i) setDir(-dir); else { setSort(i); setDir(c.desc ? -1 : 1); } }}>{c.label}{sort === i && <span className="sort-ind">{dir > 0 ? '▲' : '▼'}</span>}</th>)}</tr></thead>
      <tbody>{slice.length ? slice.map((r, ri) => <tr key={r.id || r.key || ri} className={onRow ? 'clickable' : ''} onClick={onRow ? e => { if (e.target.closest('button,a,input,select,label')) return; onRow(r); } : undefined}>
        {cols.map((c, i) => <td key={i} className={c.cls} data-label={c.label}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
      </tr>) : <tr><td colSpan={cols.length} className="empty-cell"><Empty text={empty} ic="search" /></td></tr>}</tbody>
    </table></div>
    {pages > 1 && <div className="pager"><button className="btn ghost sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}>السابق</button><span>صفحة {fmtNum(pg + 1)} من {fmtNum(pages)}</span><button className="btn ghost sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>التالي</button></div>}
  </div>;
}
