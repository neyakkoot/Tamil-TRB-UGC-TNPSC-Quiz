(async function(){
  const footer = document.createElement('div');
  footer.id = 'tq-footer';
  footer.innerHTML = `<div>📚 மொத்த வினாடி–வினா தொகுப்புகள்: <strong id="quizCount">ஏற்றுகிறது...</strong></div><div>இறுதியாகப் புதுப்பிக்கப்பட்டது: <strong id="tq-lastupdate">ஏற்றுகிறது...</strong></div><button id="tq-refresh">🔄 புதுப்பிக்க</button><button id="tq-home" onclick="location.href='index.html'">🏠 முகப்புக்கு செல்ல</button><button id="showScores">📊 எனது மதிப்பெண்கள்</button>`;
  document.body.appendChild(footer);

  const style = document.createElement('style');
  style.textContent = `#tq-footer { position:fixed;bottom:0;left:0;right:0;background:#f9fdfb;border-top:1px solid #cde5d1;text-align:center;padding:10px;font-size:0.9rem;color:#044d2f;box-shadow:0 -2px 8px rgba(0,0,0,0.05);z-index:9999; } #tq-footer button { margin:4px 5px;border:none;padding:6px 10px;border-radius:6px;font-weight:600;cursor:pointer; } #tq-refresh{background:#0b9444;color:white;} #tq-home{background:#0a58ca;color:white;} #showScores{background:#ff8c00;color:white;}`;
  document.head.appendChild(style);

  try {
    const res = await fetch('quiz-list.json', { cache: 'no-cache' });
    const list = await res.json();
    document.getElementById('quizCount').textContent = list.length;
    const lastMod = res.headers.get('Last-Modified');
    const date = lastMod ? new Date(lastMod) : new Date();
    const fmt = date.toLocaleDateString('ta-IN', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
    document.getElementById('tq-lastupdate').textContent = fmt;
  } catch(e) {
    document.getElementById('tq-lastupdate').textContent = "தகவல் இல்லை";
    document.getElementById('quizCount').textContent = "—";
  }

  document.getElementById('tq-refresh').onclick = ()=>location.reload();

  window.saveScore = function(file, score, total, title){
    const rec = { file, title, score, total, pct: ((score/total)*100).toFixed(1), ts: new Date().toISOString() };
    const arr = JSON.parse(localStorage.getItem('quizScores') || '[]');
    arr.unshift(rec);
    localStorage.setItem('quizScores', JSON.stringify(arr.slice(0,100)));
  };

  document.getElementById('showScores').onclick = function(){
    const arr = JSON.parse(localStorage.getItem('quizScores') || '[]');
    let html = `<h3>📊 என் முயற்சிகள்</h3>`;
    if(arr.length===0){ html += "<p>இன்னும் முயற்சிகள் இல்லை.</p>"; }
    else {
      html += `<table border='1' cellspacing='0' cellpadding='5' style='margin:auto;font-size:0.9rem;border-collapse:collapse;'><tr><th>தொகுப்பு</th><th>மதிப்பெண்</th><th>சதவீதம்</th><th>நேரம்</th></tr>`;
      arr.forEach(r=>{ html += `<tr><td>${r.title}</td><td>${r.score}/${r.total}</td><td>${r.pct}%</td><td>${new Date(r.ts).toLocaleString('ta-IN')}</td></tr>`; });
      html += `</table>`;
    }
    const w = window.open("", "_blank", "width=300,height=300");
    w.document.write(`<html><head><title>என் முயற்சிகள்</title></head><body style='font-family:Noto Sans Tamil,sans-serif;'>${html}</body></html>`);
  };
})();
