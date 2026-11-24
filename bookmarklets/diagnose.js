/*
  워크라인 화면 진단 북마클릿 (소스)
  - bookmarklet.html 이 이 파일을 읽어 javascript: 링크로 만들어 줍니다.
  - 주의: 한 줄 주석(//) 쓰지 말 것. 북마크 URL로 변환될 때 줄바꿈이 사라지면 뒤 코드가 전부 주석이 됩니다.
  - 고객정보 보호: 표 샘플의 숫자는 #, 고객명/연락처 등 민감 컬럼의 글자는 ○ 로 가립니다.
*/
(function () {
  var SAMPLE_ROWS = 3;
  var SENS = /고객|성명|이름|유치자|주소|연락|전화|휴대|핸드폰|생년|주민|명의|메일|계좌|카드/;
  var GRID_LIBS = ['IBSheet', 'AUIGrid', 'RealGrid', 'RealGridJS', 'agGrid', 'Handsontable', 'Tabulator', 'w2ui', 'kendo', 'dhtmlXGridObject', 'wijmo', 'Ext', 'Slick', 'SBGrid', 'nexacro'];

  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…(' + s.length + '자)' : s; }
  function mask(v, sensitive) {
    v = clip(v, 80).replace(/[0-9]/g, '#');
    if (sensitive) {
      v = v.split(/(쿠폰|선납)/).map(function (p, i) { return i % 2 ? p : p.replace(/[가-힣A-Za-z]/g, '○'); }).join('');
    }
    return v;
  }
  function maskUrl(u) { return String(u || '').replace(/\d{6,}/g, '######'); }
  function cellTexts(tr) { return Array.prototype.map.call(tr.querySelectorAll('th,td'), function (c) { return c.innerText != null ? c.innerText : c.textContent; }); }

  function funcSource(win, name) {
    try { var f = win[name]; if (typeof f === 'function') return clip(f.toString(), 2500); } catch (e) { }
    return null;
  }
  function handlerInfo(win, el) {
    var out = {};
    var oc = el.getAttribute && el.getAttribute('onclick');
    var href = el.getAttribute && el.getAttribute('href');
    if (oc) out.onclick = clip(oc, 300);
    if (href) out.href = clip(maskUrl(href), 300);
    var code = (oc || '') + ' ' + (href && /^javascript:/i.test(href) ? href : '');
    var re = /([A-Za-z_$][\w$]*)\s*\(/g, m, fns = {};
    while ((m = re.exec(code))) { var src = funcSource(win, m[1]); if (src) fns[m[1]] = src; }
    try {
      var jq = win.jQuery || win.$;
      var ev = jq && jq._data && jq._data(el, 'events');
      if (ev && ev.click) fns['(jQuery click)'] = ev.click.map(function (h) { return clip(h.handler.toString(), 2500); });
    } catch (e) { }
    if (Object.keys(fns).length) out.functions = fns;
    return out;
  }
  function formInfo(form) {
    if (!form) return null;
    return {
      id: form.id || '', name: form.getAttribute('name') || '',
      action: maskUrl(form.getAttribute('action') || ''), method: (form.getAttribute('method') || 'get').toUpperCase(),
      fields: Array.prototype.slice.call(form.elements, 0, 60).filter(function (f) { return f.name && f.type !== 'password'; }).map(function (f) {
        var v = f.value || '';
        if (f.type === 'hidden' && v.length > 30) return { name: f.name, type: f.type, value: '(길이 ' + v.length + ')' };
        return { name: f.name, type: f.type, value: mask(v, SENS.test(f.name)) };
      })
    };
  }

  function analyzeDoc(win, doc, path) {
    var r = { frame: path, url: maskUrl(win.location.href), title: clip(doc.title, 100) };

    r.tables = Array.prototype.filter.call(doc.querySelectorAll('table'), function (t) { return t.rows && t.rows.length >= 2; })
      .map(function (t, ti) {
        var rows = Array.prototype.slice.call(t.rows);
        var hi = 0;
        for (var i = 0; i < Math.min(rows.length, 5); i++) { if (rows[i].querySelector('th')) { hi = i; break; } }
        var header = cellTexts(rows[hi]).map(function (h) { return clip(h, 40); });
        var sensCols = header.map(function (h) { return SENS.test(h); });
        var body = rows.slice(hi + 1);
        return {
          index: ti, id: t.id || '', cls: clip(t.className, 60),
          rowCount: rows.length, colCount: header.length,
          header: header,
          sample: body.slice(0, SAMPLE_ROWS).map(function (tr) { return cellTexts(tr).map(function (v, ci) { return mask(v, sensCols[ci]); }); })
        };
      })
      .sort(function (a, b) { return b.rowCount - a.rowCount; }).slice(0, 8);

    r.gridLibs = GRID_LIBS.filter(function (n) { try { return !!win[n]; } catch (e) { return false; } });
    try { if (win.jQuery && win.jQuery.fn && win.jQuery.fn.jqGrid) r.gridLibs.push('jqGrid'); } catch (e) { }
    try { if (win.tui && win.tui.Grid) r.gridLibs.push('tui.Grid'); } catch (e) { }
    try { r.jQuery = win.jQuery ? win.jQuery.fn.jquery : null; } catch (e) { }

    var gridCls = {};
    Array.prototype.forEach.call(doc.querySelectorAll('[class*="grid" i],[id*="grid" i],[class*="sheet" i],[id*="sheet" i]'), function (el) {
      var k = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className || '').split(/\s+/)[0];
      gridCls[k] = (gridCls[k] || 0) + 1;
    });
    r.gridElements = Object.keys(gridCls).slice(0, 25);

    r.excelButtons = Array.prototype.filter.call(doc.querySelectorAll('a,button,input[type=button],input[type=submit],input[type=image],img,span,div'), function (el) {
      if (el.children && el.children.length > 2) return false;
      if (/^(SPAN|DIV)$/.test(el.tagName) && (el.innerText || '').trim().length > 30) return false;
      var t = [el.innerText || '', el.value || '', el.title || '', el.alt || '', el.getAttribute('src') || '', el.getAttribute('onclick') || ''].join(' ');
      return /엑셀|excel|xls|다운로드|download/i.test(t);
    }).slice(0, 10).map(function (el) {
      var o = { tag: el.tagName.toLowerCase(), text: clip(el.innerText || el.value || el.title || el.alt || '', 40), id: el.id || '', cls: clip(el.className, 60) };
      var h = handlerInfo(win, el); for (var k in h) o[k] = h[k];
      var f = el.closest && el.closest('form'); if (f) o.form = f.id || f.getAttribute('name') || '(이름없음)';
      return o;
    });

    r.forms = Array.prototype.slice.call(doc.forms, 0, 6).map(formInfo);

    try {
      r.ajaxRequests = win.performance.getEntriesByType('resource')
        .filter(function (e) { return /xmlhttprequest|fetch/.test(e.initiatorType); })
        .slice(-30).map(function (e) { return e.initiatorType + ' ' + maskUrl(e.name); });
    } catch (e) { r.ajaxRequests = []; }
    r.scripts = Array.prototype.map.call(doc.scripts, function (s) { return s.src ? maskUrl(s.src.replace(/^https?:\/\/[^/]+/, '')) : null; }).filter(Boolean).slice(0, 30);

    return r;
  }

  var frames = [];
  function walk(win, path) {
    var doc;
    try { doc = win.document; doc.body; } catch (e) { frames.push({ frame: path, crossOrigin: true }); return; }
    if (!doc || !doc.body) return;
    frames.push(analyzeDoc(win, doc, path));
    for (var i = 0; i < win.frames.length; i++) {
      var name = ''; try { name = win.frames[i].name; } catch (e) { }
      walk(win.frames[i], path + ' > ' + i + (name ? '(' + name + ')' : ''));
    }
  }
  walk(window, 'top');

  var result = JSON.stringify({ tool: 'workline-diagnose', v: 1, at: new Date().toISOString(), host: location.host, frames: frames }, null, 1);

  var old = document.getElementById('__wl_diag__'); if (old) old.remove();
  var box = document.createElement('div');
  box.id = '__wl_diag__';
  box.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#fff;color:#1f2430;border:2px solid #2f6fed;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;padding:16px;font:13px "Malgun Gothic",sans-serif;';
  box.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
    + '<b style="font-size:15px">워크라인 화면 진단 결과</b>'
    + '<span style="color:#6b7280">고객정보는 가려져 있어요. 전체 복사해서 Claude에게 붙여넣어 주세요.</span>'
    + '<span style="flex:1"></span>'
    + '<button data-a="copy" style="background:#2f6fed;color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px">전체 복사</button>'
    + '<button data-a="close" style="background:#fff;color:#2f6fed;border:1px solid #2f6fed;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px">닫기</button></div>'
    + '<div data-a="msg" style="color:#177a3a;min-height:18px;margin-bottom:4px"></div>'
    + '<textarea readonly style="flex:1;width:100%;font:12px Consolas,monospace;border:1px solid #e2e5ea;border-radius:6px;padding:8px;resize:none"></textarea>';
  var ta = box.querySelector('textarea'); ta.value = result;
  var msg = box.querySelector('[data-a=msg]');
  msg.textContent = '프레임 ' + frames.length + '개, 표 ' + frames.reduce(function (n, f) { return n + (f.tables ? f.tables.length : 0); }, 0) + '개 확인 (' + result.length.toLocaleString() + '자)';
  box.querySelector('[data-a=close]').onclick = function () { box.remove(); };
  box.querySelector('[data-a=copy]').onclick = function () {
    function done() { msg.textContent = '복사됐어요! Claude 대화창에 붙여넣기(Ctrl+V) 해주세요.'; }
    ta.focus(); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
    if (ok) return done();
    if (navigator.clipboard) navigator.clipboard.writeText(result).then(done, function () { msg.textContent = '자동 복사가 막혔어요. 글상자 안을 클릭 → Ctrl+A → Ctrl+C 해주세요.'; });
    else msg.textContent = '글상자 안을 클릭 → Ctrl+A → Ctrl+C 해주세요.';
  };
  document.body.appendChild(box);
})();
