/** Open a clean print window (white paper layout) and trigger the print dialog. */
export function openPrintWindow(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=980,height=760");
  if (!w) { alert("Please allow pop-ups to print the payroll report."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0B1F35; margin: 32px; }
  .hdr { display:flex; align-items:center; gap:12px; border-bottom:3px solid #0A66B2; padding-bottom:12px; margin-bottom:16px; }
  .logo { width:40px; height:40px; border-radius:8px; background:#0A66B2; color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:15px; }
  .brand { font-size:18px; font-weight:800; letter-spacing:.02em; }
  .sub { font-size:12px; color:#5b6b7c; }
  h2 { font-size:15px; margin:20px 0 8px; }
  .meta { font-size:13px; margin:2px 0; }
  .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin:10px 0 4px; }
  .card { border:1px solid #d6dee6; border-radius:8px; padding:8px 10px; }
  .card .l { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#5b6b7c; }
  .card .v { font-size:16px; font-weight:700; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
  th, td { border:1px solid #d6dee6; padding:5px 7px; text-align:left; }
  th { background:#eef3f8; font-size:10px; text-transform:uppercase; letter-spacing:.03em; }
  td.n, th.n { text-align:right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight:700; background:#f6f9fc; }
  .gold { color:#9a7b12; }
  .sign { display:flex; gap:40px; margin-top:40px; }
  .sign div { flex:1; }
  .line { border-top:1px solid #0B1F35; padding-top:4px; font-size:12px; color:#5b6b7c; }
  @media print { body { margin:12mm; } button { display:none; } }
</style></head><body>${bodyHtml}
<script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
</body></html>`);
  w.document.close();
  w.focus();
}

export const printHeader = (titleLine: string) =>
  `<div class="hdr"><div class="logo">52</div><div><div class="brand">5280 COMMAND CENTER</div><div class="sub">${titleLine}</div></div></div>`;

export const printSignature = () =>
  `<div class="sign"><div><div class="line">Signature</div></div><div><div class="line">Date Approved</div></div></div>`;
