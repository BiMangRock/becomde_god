// 오른쪽 정보 패널과 기록
(function () {
  const G = globalThis.G;
  const J = G.JOB;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STATE_TEXT = (h, sim) => {
    const k = h.task && h.task.kind;
    switch (h.state) {
      case 'gather': return `${G.RES_NAME[h.task?.res] || '자원'} 모으는 중`;
      case 'pray': return '기도하는 중';
      case 'rest': return h.emote === '♥' && h.emoteT > 0 ? '연인과 시간을 보내는 중' : '쉬는 중';
      case 'party': return '축제에서 춤추는 중';
      case 'sleep': return '자는 중';
      case 'held': { const b = h.held && sim.tribeById(h.held.tid); return h.held && h.held.forced ? `${b ? b.name + '에 ' : ''}끌려가 강제로 혼인당한 상태` : `${b ? b.name + '에 ' : ''}인질로 잡혀 있음 (몸값 금화 ${h.held ? h.held.ransom : '?'}개)`; }
      case 'hobby': return h.curHobby === '공부' ? '혼자 조용히 공부하는 중' : `${h.curHobby || '취미'}을(를) 즐기는 중`;
      case 'jailed': return `감옥에 갇혀 있음 (남은 형기 ${Math.max(0, h.jail.until - sim.year).toFixed(1)}년)`;
      case 'busy': return h.busy && h.busy.kind === 'till' ? '밭을 일구는 중' : h.busy && h.busy.kind === 'tend' ? '가축을 돌보는 중' : h.busy && h.busy.kind === 'build' ? '집을 짓는 중' : '도구를 만드는 중';
      case 'fight': return `${h.target ? h.target.name + '와(과) ' : ''}싸우는 중`;
      case 'goto':
        if (k === 'gather') return `${G.RES_NAME[h.task.res]} 모으러 가는 중`;
        if (k === 'deposit') return '마을로 짐을 나르는 중';
        if (k === 'eat') return '밥 먹으러 가는 중';
        if (k === 'trade-sell') { const t = sim.tribeById(h.task.to); return `${t ? t.name : '다른 부족'}에 장사하러 가는 중`; }
        if (k === 'raid') { const t = sim.tribeById(h.task.to); return `${t ? t.name : '적'} 마을로 진격하는 중`; }
        if (k === 'pray') return '기도하러 가는 중';
        if (k === 'date') { const o = sim.byId.get(h.task.with); return `${o ? o.name + '와(과) ' : ''}${h.task.place}로 데이트하러 가는 중`; }
        if (k === 'visit') { const o = sim.byId.get(h.task.with); return `${o ? '친구 ' + o.name + '을(를) ' : '친구를 '}만나러 가는 중`; }
        if (k === 'party') return '축제에 가는 중';
        if (k === 'hunt') { const a = sim.animals.find((x) => x.id === h.task.aid); return `${a ? G.Wild.KINDS[a.kind].name : '사냥감'}을(를) 쫓는 중`; }
        if (k === 'arrest') { const o = sim.byId.get(h.task.id); return `수배자 ${o ? o.name : ''}을(를) 쫓는 중`; }
        if (k === 'treat') { const o = sim.byId.get(h.task.pid); return `${o ? o.name : '환자'}을(를) 치료하러 가는 중`; }
        if (k === 'till') return '밭을 일구러 가는 중';
        if (k === 'tame') { const a = sim.animals.find((x) => x.id === h.task.aid); return `${a ? G.Wild.KINDS[a.kind].name : '들짐승'}을(를) 길들이러 가는 중`; }
        if (k === 'tend') return '가축을 돌보러 가는 중';
        if (k === 'fetch') return '불을 끄려고 물을 뜨러 가는 중';
        if (k === 'douse') return h.task.dirt ? '흙을 덮어 불을 끄러 가는 중' : '물을 들고 불을 끄러 가는 중';
        if (k === 'confront') { const o = sim.byId.get(h.task.with); return `연적 ${o ? o.name : ''}에게 따지러 가는 중`; }
        if (k === 'hobby') return h.task.hobby === '공부' ? '조용한 곳으로 공부하러 가는 중' : `${h.task.hobby}을(를) 하러 가는 중`;
        if (k === 'forge') return '대장간으로 가는 중';
        return '걷는 중';
      default: return '생각하는 중';
    }
  };

  class UI {
    constructor(app) {
      this.app = app;
      this.bindTips();
      this.info = document.getElementById('info');
      this.logEl = document.getElementById('log');
      this.view = 'overview'; // overview | archive
      this.holding = false;
      this.lastLogKey = '';
      this.info.addEventListener('pointerdown', () => (this.holding = true));
      window.addEventListener('pointerup', () => setTimeout(() => (this.holding = false), 0));
      this.info.addEventListener('click', (e) => this.onClick(e));
      this.logEl.addEventListener('click', (e) => {
        const el = e.target.closest('.ev');
        if (!el || el.dataset.x === undefined || el.dataset.x === '') return;
        app.focus(+el.dataset.x, +el.dataset.y);
      });
    }

    onClick(e) {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const app = this.app, sim = app.sim, a = el.dataset.act, id = +el.dataset.id;
      if (a === 'human') {
        const h = sim.byId.get(id);
        if (h) { app.select({ type: 'human', h }); app.focus(h.x, h.y); }
        else if (sim.archiveById.get(id)) app.select({ type: 'dead', rec: sim.archiveById.get(id) });
        else app.toast('기록이 남아 있지 않습니다');
      } else if (a === 'tribe') {
        const t = sim.tribes.find((t) => t.id === id);
        if (t && t.alive) { app.select({ type: 'tribe', t }); app.focus(t.cx, t.cy); }
      } else if (a === 'follow') {
        app.follow = !app.follow;
      } else if (a === 'close') {
        app.select(null); this.view = 'overview';
      } else if (a === 'archive') {
        app.select(null); this.view = 'archive';
      } else if (a === 'overview') {
        this.view = 'overview';
      }
      this.render(true);
    }

    personLink(p) {
      if (!p) return '';
      const sim = this.app.sim;
      const alive = sim.byId.get(p.id);
      const known = alive || sim.archiveById.get(p.id);
      const name = esc(p.name || (alive && alive.name) || '?');
      const mark = alive ? '' : ' †';
      return known ? `<span class="link" data-act="human" data-id="${p.id}">${name}${mark}</span>` : `<span class="muted">${name}${mark}</span>`;
    }

    bars(h) {
      const row = (k, v, col) => `<span>${k}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></div><span>${Math.round(v)}</span>`;
      return `<div class="bars">${row('배고픔', h.hunger, '#e8a33d')}${row('건강', h.health, '#5cc46a')}${row('신앙', h.faith, '#f5d76e')}${row('행복', h.happy, '#6fb3ff')}</div>`;
    }

    storyList(story) {
      return `<ul class="story">${story.slice().reverse().map((s) => `<li><span class="yr">${s.y}년</span>${esc(s.t)}</li>`).join('')}</ul>`;
    }

    renderHuman(h) {
      const sim = this.app.sim;
      const t = h.tribe;
      const children = h.children.map((id) => {
        const c = sim.byId.get(id) || sim.archiveById.get(id);
        return c ? this.personLink({ id, name: c.name }) : '';
      }).filter(Boolean);
      return `
        <h2>${esc(h.name)} <span class="muted">${h.gender === 'M' ? '남' : '여'} · ${Math.floor(h.age)}세</span></h2>
        <div>${t ? `<span class="chip link" data-act="tribe" data-id="${t.id}"><span class="dot" style="background:${t.color}"></span> ${esc(t.name)}</span>` : '<span class="chip">부족 없음</span>'}
          <span class="chip" data-tip="${esc(`${h.job}\n${G.JOB_DESC[h.job] || ''}`)}">${esc(h.job)}</span>${h.traits.map((x) => `<span class="chip" data-tip="${esc(this.traitTip(x))}">${esc(x)}</span>`).join('')}
          ${h.jail ? '<span class="chip" style="color:#ffb070">수감 중</span>' : ''}${h.wanted ? '<span class="chip" style="color:#ff6b6b">수배 중</span>' : ''}${h.outlaw ? '<span class="chip" style="color:#bbb">무법자</span>' : ''}${h.branded ? '<span class="chip" style="color:#c99">낙인</span>' : ''}${h.labor ? '<span class="chip" style="color:#d9b26a">강제노역 중</span>' : ''}${h.enslaved ? '<span class="chip" style="color:#ff9a7a">노예</span>' : ''}${h.trek ? '<span class="chip" style="color:#9be36b">이주 중</span>' : ''}${h.hermit ? `<span class="chip" style="color:#d9b26a">${h.hermit.sage ? '현자' : '홀로 사는 사람'}</span>` : ''}${h.lost ? '<span class="chip" style="color:#c9a0ff">길 잃음</span>' : ''}${h.abducted ? '<span class="chip" style="color:#ff8a80">납치됨</span>' : ''}${h.cult ? `<span class="chip" style="color:#c9a0ff">교주 (신자 ${h.cult.followers.length}명)</span>` : ''}</div>
        <p class="muted" style="margin:8px 0">지금 ${STATE_TEXT(h, sim)}${h.pregnant ? ` · <span style="color:#ff9ac1">임신 ${Math.max(1, Math.round((1 - h.pregnant / (G.CFG.TPY * 0.75)) * 9))}개월</span>` : ''}</p>
        ${this.bars(h)}
        ${this.personaBlock(h)}
        ${this.moodBlock(h)}
        ${this.mindBlock(h)}
        ${this.relBlock(h)}
        ${this.crimeBlock(h)}
        ${this.memoryBlock(h)}
        <h4>재산과 가족</h4>
        <div class="kv">
          <span class="k">금화</span><span>${Math.floor(h.gold)}개${h.carry ? ` · ${G.RES_NAME[h.carry] || ''} ${h.carryAmt}개 운반 중` : ''}</span>
          <span class="k">부모</span><span>${h.parents.length ? h.parents.map((p) => this.personLink(p)).join(', ') : '<span class="muted">신이 빚었거나 알 수 없음</span>'}</span>
          <span class="k">배우자</span><span>${h.partner && h.partner.alive ? this.personLink(h.partner) : h.lover && h.lover.alive ? '<span class="muted">미혼 · 연인 </span>' + this.personLink(h.lover) : '<span class="muted">없음</span>'}</span>
          <span class="k">자녀</span><span>${children.length ? children.join(', ') : '<span class="muted">없음</span>'}</span>
          ${h.kills ? `<span class="k">전공</span><span>${h.kills}명을 쓰러뜨림</span>` : ''}
        </div>
        <div class="row-btns">
          <button data-act="follow" class="${this.app.follow ? 'on' : ''}">${this.app.follow ? '따라가는 중' : '따라가기'}</button>
          <button data-act="close">닫기</button>
        </div>
        <h4>${esc(h.name)}의 이야기</h4>
        ${this.storyList(h.story)}`;
    }

    moodBlock(h) {
      const S = G.Social, sim = this.app.sim;
      const lab = S.moodLabel(h);
      const chips = h.moodlets.slice().sort((a, b) => Math.abs(G.MOODS[b.k].v) - Math.abs(G.MOODS[a.k].v)).map((m) => {
        const M = G.MOODS[m.k];
        const col = M.v >= 0 ? '#8fd18f' : '#ff8a80';
        const left = Math.max(0, m.until - sim.year);
        const leftTxt = left >= 1 ? `${left.toFixed(1)}년` : `${Math.ceil(left * 12)}개월`;
        const n = m.n || 1, v = Math.round(M.v * G.Mind2.weight(n));
        const life = h.life && h.life[m.k] > 1 ? ` · 평생 ${h.life[m.k]}번` : '';
        return `<span class="chip" data-tip="${esc(`${M.t}\n${leftTxt} 남음${n > 1 ? `\n· 잇달아 ${n}번 겪어 무게가 ${G.Mind2.weight(n).toFixed(1)}배` : ''}${life ? `\n·${life} 겪음` : ''}`)}"><b style="color:${col}">${v > 0 ? '+' : ''}${v}</b> ${esc(M.t)}${n > 1 ? ` <b>×${n}</b>` : ''}</span>`;
      }).join('');
      return `<h4>기분 · <span style="color:${lab.c}">${lab.t}</span> (${Math.round(h.happy)})</h4><div>${chips || '<span class="muted">특별한 일 없음</span>'}</div>`;
    }

    // 마우스를 올리면 뜨는 설명 상자 (data-tip, 줄바꿈은 \n). 패널이 다시 그려져도 따라가도록 mousemove로 찾는다
    bindTips() {
      const tip = document.createElement('div');
      tip.id = 'tip'; tip.hidden = true;
      document.body.appendChild(tip);
      let cur = null;
      document.addEventListener('mousemove', (e) => {
        const el = e.target.closest && e.target.closest('[data-tip]');
        const text = el && el.dataset.tip;
        if (!text) { tip.hidden = true; cur = null; return; }
        if (text !== cur) {
          cur = text;
          const [head, ...rest] = text.split('\n').filter(Boolean);
          tip.innerHTML = `<b>${esc(head)}</b>` + rest.map((l) => {
            const c = l[0] === '+' ? 'good' : l[0] === '-' ? 'bad' : l[0] === '·' || l[0] === '(' ? 'muted' : '';
            return `<div class="${c}">${esc(l)}</div>`;
          }).join('');
        }
        tip.hidden = false;
        const w = tip.offsetWidth, h = tip.offsetHeight;
        let x = e.clientX + 14, y = e.clientY + 14;
        if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
        if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      });
    }

    // 본 것과 들은 것
    memoryBlock(h) {
      if (!h.memories || !h.memories.length) return '';
      const ACT = { secret: ['비밀로 묻어 둠', '#9fc3ff'], gossip: ['소문 냄', '#ffb070'], told: ['당사자에게 알림', '#8fe0a0'], blackmail: ['협박에 씀', '#ff8a80'], quiet: ['기억만 함', '#a8b3c4'] };
      const what = (m) => m.k === '바람' ? `${m.an}이(가) ${m.bn || '누군가'}와(과) 몰래 만나는 것` : m.k === 'hero' ? `${m.an}이(가) 불을 끄는 것` : `${m.an}이(가) ${m.bn ? m.bn + '에게 ' : ''}${m.k}을(를) 저지르는 것`;
      const list = h.memories.slice().sort((a, b) => b.at - a.at).map((m) => {
        const [t, c] = ACT[m.act] || ACT.quiet;
        const src = m.how === 'heard' ? `${m.from}에게서 ${m.ex ? '부풀려진 ' : ''}소문으로 들음` : '직접 봄';
        return `<li><span class="yr">${m.y}년</span>${esc(what(m))}${m.n > 1 ? ` ×${m.n}` : ''} <span class="muted">· ${esc(src)}</span> <span style="color:${c}">· ${t}</span></li>`;
      }).join('');
      return `<h4>기억 (본 것과 들은 것)</h4><ul class="story">${list}</ul>`;
    }

    traitTip(x) {
      const opp = G.OPP[x];
      return `${x}\n${G.TRAIT_DESC[x] || ''}\n${(G.TRAIT_FX[x] || []).join('\n')}${opp ? `\n(${opp}과(와) 함께 가질 수 없음)` : ''}`;
    }

    personaBlock(h) {
      const P = G.Persona;
      const bar = (k, v, col, tip) => `<span data-tip="${esc(tip || '')}">${k}</span><div class="bar" data-tip="${esc(tip || '')}"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></div><span>${Math.round(v)}</span>`;
      const dims = Object.entries(P.DIMS).map(([k, D]) => bar(D.name, h.p[k], h.p[k] >= 65 ? '#f0b35a' : h.p[k] <= 35 ? '#7aa7e0' : '#9aa6b8',
        `${D.name} ${Math.round(h.p[k])} · ${h.p[k] >= 65 ? '높음' : h.p[k] <= 35 ? '낮음' : '보통'}\n${h.p[k] >= 50 ? D.hi : D.lo}\n${(G.DIM_FX[k] || []).map((x) => '· ' + x).join('\n')}`)).join('');
      const tetoPct = (h.teto + 100) / 2;
      const prefTxt = h.typePref === 'teto' ? '테토 스타일' : h.typePref === 'egen' ? '에겐 스타일' : '스타일 상관없음';
      return `<h4>기질</h4>
        <div class="kv">
          <span class="k">체력</span><span>${P.bodyLabel(h.body)} (${h.body}) · 최대 체력 ${h.maxHp}${h.sick ? ` · <span style="color:#ffb070">${esc(h.sick.name)} 앓는 중</span>` : ''}</span>
          <span class="k">테토/에겐</span><span>${P.tetoLabel(h.teto)} (${h.teto > 0 ? '+' : ''}${h.teto})
            <div class="bar" style="margin-top:3px;background:linear-gradient(90deg,#d98bd0,#555 50%,#e0a050)"><i style="width:3px;margin-left:calc(${tetoPct}% - 1px);background:#fff"></i></div></span>
          <span class="k">외모·매력</span><span>외모 ${h.looks} · 매력 ${P.charm(h)}</span>
          <span class="k">좋아함</span><span>${h.likes.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</span>
          <span class="k">싫어함</span><span><span class="chip" style="color:#ff9a7a">${esc(h.dislike)}</span></span>
          <span class="k">이상형</span><span>${prefTxt} · ${esc(h.wants)}을(를) 봄</span>
          <span class="k">지식</span><span>${h.knowledge.toFixed(1)}${h.discoveries ? ` · 발견 ${h.discoveries}개` : ''} · 학구열 ${Math.round(P.studyZeal(h) * 100)}</span>
          ${h.addiction > 10 ? `<span class="k">중독</span><span style="color:#ffb070">${Math.round(h.addiction)} ${h.addiction > 50 ? '(술과 도박에 빠져 있음)' : ''}</span>` : ''}
        </div>
        <h4 style="margin-top:10px">성격 <span class="muted" style="font-weight:400">(마우스를 올리면 장단점과 효과)</span></h4>
        <div class="bars">${dims}</div>`;
    }

    mindBlock(h) {
      const row = (k, v, col) => `<span>${k}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></div><span>${Math.round(v)}</span>`;
      let cond = '<span class="muted">건강함</span>';
      if (h.mind) {
        const C = G.Mind.CONDITIONS[h.mind.c];
        cond = `<span style="color:${C.color}">${h.mind.c}</span> <span class="muted">· ${C.desc} · ${Math.floor(this.app.sim.year - h.mind.since)}년째</span>`;
      }
      return `<h4>마음</h4><div class="bars">${row('스트레스', h.stress || 0, '#e87a5d')}${row('외로움', h.social || 0, '#9a8fd9')}${h.mind ? row('병의 깊이', h.mind.sev, G.Mind.CONDITIONS[h.mind.c].color) : ''}</div><p style="margin:6px 0 0;font-size:12.5px">정신 건강: ${cond}</p>`;
    }

    crimeBlock(h) {
      if (!h.crimes || (!h.crimes.length && !h.notoriety && !h.convictions && !h.stalking && (h.wg || 0) < 30)) return '';
      const list = h.crimes.slice().reverse().map((c) => {
        const tag = c.fake ? (c.revealed ? '<span style="color:#7fe0a8">· 누명 (벗겨짐)</span>' : '<span style="color:#ffb070">· 누명</span>')
          : c.sanctioned ? '<span class="muted">· 부족의 법이 허락함</span>'
          : c.selfDefense ? '<span style="color:#7fe0a8">· 정당방위 (무죄)</span>'
          : c.acquitted ? '<span style="color:#ffb070">· 증거 부족으로 무죄</span>'
          : c.expired ? '<span class="muted">· 시효가 지나 묻힘</span>'
          : c.known ? (c.punished ? '<span class="muted">· 처벌받음</span>' : '<span style="color:#ff8a80">· 드러남</span>') : '<span style="color:#c9a0ff">· 아무도 모름</span>';
        return `<li><span class="yr">${c.y}년</span>${esc(c.type)}${c.negligent ? ' (과실)' : ''}${c.victim ? ` (${esc(c.victim)})` : ''} ${tag}</li>`;
      }).join('');
      const ex = h.convictions ? (h.redeemed ? '<span style="color:#7fe0a8">갱생함</span>' : `전과자 · 갱생 ${Math.round(h.rehab || 0)}/85`) : '없음';
      const stalk = h.stalking ? (() => { const o = this.app.sim.byId.get(h.stalking); return o ? `<span class="k">집착</span><span style="color:#ff8a80">${esc(o.name)}을(를) 스토킹 중</span>` : ''; })() : '';
      return `<h4>죄와 벌</h4>
        <div class="kv"><span class="k">악명</span><span>${Math.round(h.notoriety)}</span><span class="k">유죄 판결</span><span>${h.convictions}번${h.convictions >= 3 ? ' (상습범)' : ''}</span>
        <span class="k">전과</span><span>${ex}${h.sexOffender ? ' · 성범죄 전과' : ''}</span>${(h.wg || 0) >= 30 ? `<span class="k">세상에 대한 원한</span><span style="color:${h.wg >= 60 ? '#ff8a80' : '#d9b26a'}">${Math.round(h.wg)}</span>` : ''}${h.crimeSkill ? `<span class="k">범죄 솜씨</span><span>${Math.round(h.crimeSkill)}</span>` : ''}${h.murders ? `<span class="k">살인</span><span style="color:#ff6b6b">${h.murders}명</span>` : ''}${stalk}</div>
        <ul class="story">${list}</ul>`;
    }

    relBlock(h) {
      const S = G.Social, sim = this.app.sim;
      const ORDER = ['배우자', '연인', '비밀 연인', '썸', '짝사랑', '부모', '자녀', '형제자매', '스토커', '집착 대상', '협박범', '약점 잡은 사람', '원수', '연적', '감방 동료', '스승', '제자', '은인', '절친', '존경하는 사람', '두려운 사람', '라이벌', '친구', '빚진 사람', '돈 빌려준 사람', '앙숙', '전 배우자', '옛 연인', '먼저 간 배우자', '그리운 사람', '아는 사이'];
      const order = Object.fromEntries(ORDER.map((k, i) => [k, i]));
      const rows = [...h.rel.entries()].map(([id, r]) => ({ id, r, lab: S.label(sim, h, id, r) }))
        .sort((a, b) => (order[a.lab] - order[b.lab]) || (Math.abs(b.r.v) + b.r.love - Math.abs(a.r.v) - a.r.love))
        .slice(0, 14);
      if (!rows.length) return '<h4>관계</h4><p class="muted">아직 아는 사람이 없습니다.</p>';
      const LCOL = { 배우자: '#ff7ab6', 연인: '#ff7ab6', '비밀 연인': '#d77aff', 썸: '#ff9ac1', 짝사랑: '#ffb3d1', 절친: '#8fd18f', 친구: '#a8d8a8', 원수: '#ff6b6b', 앙숙: '#ff9a7a',
        연적: '#ff8fb0', 은인: '#7fe0a8', 스토커: '#ff6b6b', '집착 대상': '#ff9ac1', 협박범: '#ff6b6b', '약점 잡은 사람': '#d9b26a', '감방 동료': '#b0b0b0', 스승: '#f5d76e', 제자: '#f5d76e', '존경하는 사람': '#f5d76e', '두려운 사람': '#c9a0ff', 라이벌: '#ffb070', 형제자매: '#9fc3ff', '빚진 사람': '#d9b26a', '돈 빌려준 사람': '#d9b26a' };
      // 눈에 띄는 수치만 작은 배지로
      const badges = (r) => {
        const b = [];
        if (Math.abs(r.trust || 0) >= 30) b.push(`<span style="color:${r.trust > 0 ? '#7fe0a8' : '#ff8a80'}">신뢰${r.trust > 0 ? '+' : ''}${Math.round(r.trust)}</span>`);
        if ((r.respect || 0) >= 40) b.push(`<span style="color:#f5d76e">존경${Math.round(r.respect)}</span>`);
        if ((r.fear || 0) >= 30) b.push(`<span style="color:#c9a0ff">두려움${Math.round(r.fear)}</span>`);
        if ((r.grudge || 0) >= 20) b.push(`<span style="color:#ff6b6b">원한${Math.round(r.grudge)}</span>`);
        if ((r.jealousy || 0) >= 20) b.push(`<span style="color:#ffb070">질투${Math.round(r.jealousy)}</span>`);
        if (r.owe) b.push(`<span style="color:#d9b26a">빚 ${r.owe}</span>`);
        if (r.lent) b.push(`<span style="color:#d9b26a">빌려줌 ${r.lent}</span>`);
        return b.length ? `<div style="font-size:11px;margin-top:1px">${b.join(' · ')}</div>` : '';
      };
      return `<h4>관계 (${h.rel.size}) <span class="muted" style="font-weight:400">호감 · ♥사랑</span></h4><table class="mini">${rows.map(({ id, r, lab }) => {
        const vcol = r.v >= 0 ? '#8fd18f' : '#ff8a80';
        return `<tr><td>${this.personLink({ id, name: r.name })} <span class="chip" style="color:${LCOL[lab] || '#cfd6e0'}">${lab}</span>${badges(r)}</td>
          <td style="vertical-align:top"><span style="color:${vcol}">${r.v >= 0 ? '+' : ''}${Math.round(r.v)}</span>${r.love >= 10 ? ` <span style="color:#ff7ab6">♥${Math.round(r.love)}</span>` : ''}</td></tr>`;
      }).join('')}</table>`;
    }

    renderDead(r) {
      return `
        <h2>${esc(r.name)} † <span class="muted">${r.gender === 'M' ? '남' : '여'} · ${r.age}세</span></h2>
        <div>${r.tribe ? `<span class="chip"><span class="dot" style="background:${r.color}"></span> ${esc(r.tribe)}</span>` : ''}<span class="chip">${esc(r.job)}</span>${r.traits.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
        <p class="muted">${r.born < 0 ? '태초에' : r.born + '년에'} 태어나 ${r.died}년에 ${esc(G.josa(r.cause, '으로/로'))} 세상을 떠났습니다.</p>
        <div class="kv">
          <span class="k">부모</span><span>${r.parents.length ? r.parents.map((p) => this.personLink(p)).join(', ') : '<span class="muted">알 수 없음</span>'}</span>
          <span class="k">자녀</span><span>${r.children.length}명</span>
          ${r.kills ? `<span class="k">전공</span><span>${r.kills}명</span>` : ''}
          ${r.murders ? `<span class="k">살인</span><span style="color:#ff6b6b">${r.murders}명</span>` : ''}
          ${r.crimes && r.crimes.length ? `<span class="k">죄</span><span>${esc(r.crimes.join(', '))}</span>` : ''}
          ${r.mind ? `<span class="k">마음의 병</span><span>${esc(r.mind)}</span>` : ''}
          ${r.outlaw ? '<span class="k">신분</span><span>무법자로 죽음</span>' : ''}
        </div>
        <div class="row-btns"><button data-act="archive">기록관으로</button><button data-act="close">닫기</button></div>
        <h4>남겨진 이야기 (최근 ${r.story.length}개)</h4>
        ${this.storyList(r.story)}`;
    }

    renderTribe(t) {
      const sim = this.app.sim;
      const others = sim.tribes.filter((o) => o !== t && o.alive);
      const rel = others.map((o) => {
        const v = Math.round(sim.getRel(t, o));
        const war = t.wars.has(o.id);
        const word = war ? '<span class="war">전쟁 중</span>' : v > 30 ? '우호' : v < -30 ? '적대' : '보통';
        return `<tr><td><span class="link" data-act="tribe" data-id="${o.id}"><span class="dot" style="background:${o.color}"></span> ${esc(o.name)}</span></td><td>${word} (${v})</td></tr>`;
      }).join('');
      const jobs = {};
      for (const m of t.members) jobs[m.job] = (jobs[m.job] || 0) + 1;
      const members = t.members.slice().sort((a, b) => b.age - a.age).slice(0, 40)
        .map((m) => this.personLink(m)).join(', ');
      return `
        <h2><span class="dot" style="background:${t.color};width:14px;height:14px"></span>${esc(t.name)}</h2>
        <p class="muted" style="margin:4px 0 8px">${t.founded}년에 세워짐${t.origin ? ` · ${esc(t.origin)}${t.origin === '움막' ? '에서 시작됨' : '에서 갈라져 나옴'}` : ''}${t.temple ? ' · 신전 있음' : ''}</p>
        <div class="kv">
          <span class="k">족장</span><span>${t.chief ? this.personLink(t.chief) : '<span class="muted">없음</span>'}</span>
          <span class="k">인구</span><span>${t.members.length}명 (최대 ${t.peak}명) · 집 ${t.houses.length}채</span>
          <span class="k">금고</span><span>금화 ${Math.floor(t.treasury)}개</span>
          <span class="k">출생/사망</span><span>${t.births} / ${t.deaths}</span>
          ${t.bandit ? '<span class="k">정체</span><span style="color:#ff8a80">무법자들의 도적단</span>' : ''}
          <span class="k">법</span><span>${esc(G.Crime3.lawText(t.law))}</span>
          <span class="k">신앙</span><span>${(() => {
            const g = G.Faith.godOf(t);
            const fac = [t.altar && '제단', t.temple && (t.greatTemple ? '대신전' : '신전'), t.graveyard && `묘지(무덤 ${t.graveyard.graves || 0})`, t.totem && `${t.totem.animal} 토템`].filter(Boolean).join(' · ') || '시설 없음';
            const src = t.faithFrom && t.faithFrom !== t.id ? sim.tribes.find((o) => o.id === t.faithFrom) : null;
            const site = (sim.sacred || []).filter((x) => x.tid === t.id).map((x) => x.name).join(', ');
            return `${g ? `<span data-tip="${esc(g.name + '\n' + g.desc)}" style="color:#ffe9a8">${esc(g.name)}</span>` : '<span class="muted">아직 신의 모습을 모름</span>'} · ${esc(fac)}${src ? ` · ${esc(src.name)}에서 전해진 믿음` : ''}${site ? ` · 성지: ${esc(site)}` : ''}`;
          })()}</span>${t.sacrifice ? '<span class="k">제물</span><span style="color:#ff7050">가뭄을 끝내려 제물을 바치려 합니다 (비나 축복으로 막을 수 있음)</span>' : ''}${t.dread > sim.year ? '<span class="k">공포</span><span style="color:#ff8a80">흉흉한 일이 이어져 사람들이 밤길을 두려워함</span>' : ''}
          <span class="k">도구</span><span>${t.tools}개 (일 효율 +${Math.round(t.toolBonus() * 100)}%) · 밭 ${t.farmCount}칸</span>
          <span class="k">치안</span><span>경비병 ${t.members.filter((m) => m.job === G.JOB.GUARD).length}명 · ${t.jail ? '감옥 있음' : '감옥 없음'}${t.crimeHeat > 1 ? ' · <span style="color:#ff8a80">범죄 잦음</span>' : ''}</span>
          <span class="k">분위기</span><span>${(() => { const a = t.members.reduce((s, m) => s + m.happy, 0) / Math.max(1, t.members.length); return a >= 65 ? '활기참' : a >= 50 ? '평온함' : a >= 35 ? '침울함' : '험악함'; })()} · 부부 ${Math.floor(t.members.filter((m) => m.partner && m.partner.alive).length / 2)}쌍${t.lastFestival ? ` · 마지막 축제 ${Math.floor(t.lastFestival)}년` : ''}</span>
        </div>
        ${(() => {
          const herd = G.Wild.livestock(sim, t);
          const by = {};
          for (const a of herd) { const n = G.Wild.KINDS[a.kind].tame; by[n] = (by[n] || 0) + 1; }
          const lore = t.lore ? `<span class="k">지식</span><span>${Math.floor(t.lore)} · 발견: ${(t.found || []).join(', ') || '아직 없음'}</span>` : '';
          return `<div class="kv" style="margin-top:6px"><span class="k">가축</span><span>${herd.length ? Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · ') : '없음'}${t.pen ? ' · 우리 있음' : ''}</span>${lore}</div>`;
        })()}
        ${(() => {
          const ps = t.prisoners(sim);
          return ps.length ? `<h4>수감자 (${ps.length})</h4><table class="mini">${ps.map((p) => `<tr><td>${this.personLink(p)}</td><td>${esc(p.crimes.filter((c) => c.punished).slice(-2).map((c) => c.type).join(', '))} · 남은 ${Math.max(0, p.jail.until - sim.year).toFixed(1)}년</td></tr>`).join('')}</table>` : '';
        })()}
        <h4>창고와 시장 가격</h4>
        <table class="mini">
          ${['food', 'wood', 'ore'].map((r) => `<tr><td>${G.RES_NAME[r]} ${Math.floor(t.stock[r])}개</td><td>개당 금화 ${t.price(r).toFixed(1)}</td></tr>`).join('')}
        </table>
        <h4>직업</h4>
        <div>${Object.entries(jobs).map(([j, n]) => `<span class="chip">${esc(j)} ${n}</span>`).join('')}</div>
        ${rel ? `<h4>다른 부족과의 관계</h4><table class="mini">${rel}</table>` : ''}
        <h4>구성원</h4>
        <div style="font-size:12.5px;line-height:1.7">${members}${t.members.length > 40 ? ' …' : ''}</div>
        <div class="row-btns"><button data-act="close">닫기</button></div>
        <h4>연대기</h4>
        ${this.storyList(t.chronicle)}`;
    }

    renderTile(tile) {
      const w = this.app.sim.world;
      const i = w.idx(tile.x, tile.y);
      return `
        <h2>${G.TILE_NAMES[w.type[i]]}</h2>
        <p class="muted">(${tile.x}, ${tile.y})</p>
        <div class="kv">
          <span class="k">식량</span><span>${w.food[i].toFixed(1)}</span>
          <span class="k">나무</span><span>${w.wood[i].toFixed(1)}</span>
          <span class="k">광석</span><span>${w.ore[i].toFixed(1)}</span>
          <span class="k">비옥함</span><span>${w.fert[i].toFixed(2)}</span>
        </div>
        <div class="row-btns"><button data-act="close">닫기</button></div>`;
    }

    renderOverview() {
      const sim = this.app.sim;
      const tribes = sim.tribes.filter((t) => t.alive).sort((a, b) => b.members.length - a.members.length);
      const loners = sim.humans.filter((h) => h.alive && !h.tribe).length;
      const gold = sim.humans.reduce((s, h) => s + (h.alive ? h.gold : 0), 0) + tribes.reduce((s, t) => s + t.treasury, 0);
      const couples = { married: 0, lovers: 0, preg: 0 };
      let hs = 0, n = 0;
      for (const h of sim.humans) {
        if (!h.alive) continue;
        if (h.partner && h.partner.alive) couples.married += 0.5;
        if (h.lover && h.lover.alive) couples.lovers += 0.5;
        if (h.pregnant) couples.preg++;
        hs += h.happy; n++;
      }
      couples.married = Math.floor(couples.married); couples.lovers = Math.floor(couples.lovers);
      const avgMood = n ? `${Math.round(hs / n)}` : '-';
      return `
        <h2>세상</h2>
        <p class="muted" style="margin:4px 0 10px">당신은 이 섬의 신입니다. 인간들은 스스로 살아가며 부족을 이루고, 거래하고, 싸웁니다. 왼쪽 권능으로 세상에 손을 대 보세요.</p>
        <div class="kv">
          <span class="k">태어남</span><span>${sim.stats.births}명</span>
          <span class="k">죽음</span><span>${sim.stats.deaths}명</span>
          <span class="k">거래</span><span>${sim.stats.trades}번</span>
          <span class="k">전쟁</span><span>${sim.stats.wars}번</span>
          <span class="k">돈</span><span>세상의 금화 ${Math.floor(gold)}개</span>
          <span class="k">떠돌이</span><span>${loners}명</span>
          <span class="k">사랑</span><span>부부 ${couples.married}쌍 · 연인 ${couples.lovers}쌍 · 임신 ${couples.preg}명</span>
          <span class="k">결혼식</span><span>${sim.stats.weddings || 0}번</span>
          <span class="k">평균 기분</span><span>${avgMood}</span>
          <span class="k">범죄</span><span>절도 ${sim.stats.thefts || 0} · 폭행 ${sim.stats.assaults || 0} · 살인 ${sim.stats.murders || 0} · 미제 ${sim.unsolved.length}</span>
          <span class="k">범죄 종류</span><span style="font-size:12px">${Object.entries(sim.stats.byType || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}</span>
          <span class="k">전과자</span><span>${sim.humans.filter((h) => h.alive && h.convictions).length}명 · 갱생 ${sim.humans.filter((h) => h.alive && h.redeemed).length}명 · 인질 ${sim.humans.filter((h) => h.held).length}명</span>
          <span class="k">사법</span><span>체포 ${sim.stats.arrests || 0} · 수감 중 ${sim.humans.filter((h) => h.jail).length} · 탈옥 ${sim.stats.escapes || 0} · 추방 ${sim.stats.exiles || 0}</span>
          <span class="k">무법자</span><span>${sim.humans.filter((h) => h.alive && h.outlaw).length}명 · 도적단 ${tribes.filter((t) => t.bandit).length}개 · 노예 ${sim.humans.filter((h) => h.alive && h.enslaved).length}명</span>
          <span class="k">이동</span><span>이주 무리 ${(sim.treks || []).length}개 (지금까지 ${sim.stats.treks || 0}번) · 부족 병합 ${sim.stats.merges || 0}번 · 홀로 사는 사람 ${sim.humans.filter((h) => h.alive && h.hermit).length}명 · 길 잃은 사람 ${sim.humans.filter((h) => h.alive && h.lost).length}명 · 납치 ${sim.stats.abductions || 0}건</span>
          <span class="k">신앙</span><span>성지 ${(sim.sacred || []).length}곳${(sim.sacred || []).length ? ` (${(sim.sacred || []).map((x) => esc(x.name)).join(', ')})` : ''} · 순례 ${sim.stats.pilgrims || 0}번 · 대신전 ${tribes.filter((t) => t.greatTemple).length}곳</span>
          <span class="k">자연</span><span>동물 출생 ${sim.stats.animalBirths || 0} · 새끼 밴 동물 ${sim.animals.filter((a) => a.alive && a.preg).length} · 깎여 나간 땅 ${sim.stats.landLost || 0}칸 · 새로 생긴 땅 ${sim.stats.landGained || 0}칸</span>
          <span class="k">무거운 사건</span><span>일가족 살인 ${sim.stats.massacres || 0} · 묻지마 ${sim.stats.randomCrimes || 0} · 학살 ${sim.stats.atrocities || 0} · 사형 ${sim.stats.executions || 0} · 사적 제재 ${sim.stats.lynchings || 0} · 마녀사냥 ${sim.stats.witchHunts || 0} · 인신공양 ${sim.stats.sacrifices || 0}${sim.stats.feuds >= 2 ? ` · 피의 복수 최대 ${sim.stats.feuds}대째` : ''}</span>
          <span class="k">마음의 병</span><span>${sim.humans.filter((h) => h.mind).length}명 앓는 중 · 회복 ${sim.stats.recovered || 0}명</span>
          <span class="k">야생 동물</span><span>${Object.keys(G.Wild.KINDS).map((k) => { const n = sim.animals.filter((a) => a.alive && a.kind === k && !a.tame).length; return n ? `${G.Wild.KINDS[k].name} ${n}` : ''; }).filter(Boolean).join(' · ')}</span>
          <span class="k">가축</span><span>${sim.animals.filter((a) => a.alive && a.tame).length}마리 · 길들임 ${sim.stats.tamed || 0}번</span>
          <span class="k">불</span><span>${sim.fires.size ? `<span style="color:#ff8a3d">지금 ${sim.fires.size}곳이 타는 중</span>` : '없음'}</span>
          <span class="k">세상 크기</span><span>${sim.world.w} × ${sim.world.h}</span>
          <span class="k">시간</span><span>${G.TIME_MODES[sim.timeMode].name} (${G.TIME_MODES[sim.timeMode].desc}) · ${G.SEASONS[sim.season]} ${sim.dayOfYear % 10 + 1}일</span>
          <span class="k">날씨</span><span>${(sim.clouds || []).filter((c) => c.rain).length ? (sim.season === 3 ? '어딘가에 눈이 내리는 중' : '어딘가에 비가 내리는 중') : '맑음'} · 핏자국 ${(sim.blood || []).filter((b) => b.kind !== 'animal').length}곳</span>
        </div>
        <h4>부족 (${tribes.length})</h4>
        ${tribes.length ? tribes.map((t) => `<div class="tribe-row" data-act="tribe" data-id="${t.id}"><span class="dot" style="background:${t.color}"></span><span class="n">${esc(t.name)}</span>${t.wars.size ? '<span class="war">전쟁</span>' : ''}<span class="muted">${t.members.length}명</span></div>`).join('') : '<p class="muted">아직 부족이 없습니다. 사람들이 모여 지내다 보면 부족이 생깁니다.</p>'}
        <div class="row-btns"><button data-act="archive">기록관 (세상을 떠난 사람들)</button></div>`;
    }

    renderArchive() {
      const sim = this.app.sim;
      const list = sim.archive.slice().reverse().slice(0, 120);
      return `
        <h2>기록관</h2>
        <p class="muted" style="margin:4px 0 10px">죽은 사람은 요약된 이야기만 남깁니다. 족장, 영웅, 장수한 사람은 오래 보존됩니다. (최대 ${G.CFG.ARCHIVE_CAP}명)</p>
        <div class="row-btns" style="margin-bottom:8px"><button data-act="overview">세상으로</button></div>
        ${list.length ? `<table class="mini">${list.map((r) => `<tr><td><span class="dot" style="background:${r.color}"></span> <span class="link" data-act="human" data-id="${r.id}">${esc(r.name)}</span>${r.notable ? ' ★' : ''}</td><td>${Math.max(0, r.born)}~${r.died}년 · ${esc(r.cause)}</td></tr>`).join('')}</table>` : '<p class="muted">아직 아무도 죽지 않았습니다.</p>'}`;
    }

    render(force) {
      if (this.holding && !force) return;
      const sel = this.app.selected;
      let html;
      if (sel && sel.type === 'human') {
        if (!sel.h.alive) {
          const rec = this.app.sim.archiveById.get(sel.h.id);
          if (rec) { this.app.selected = { type: 'dead', rec }; html = this.renderDead(rec); }
          else { this.app.selected = null; html = this.renderOverview(); }
          this.app.follow = false;
        } else html = this.renderHuman(sel.h);
      } else if (sel && sel.type === 'dead') html = this.renderDead(sel.rec);
      else if (sel && sel.type === 'tribe') {
        if (!sel.t.alive) { this.app.selected = null; html = this.renderOverview(); }
        else html = this.renderTribe(sel.t);
      } else if (sel && sel.type === 'tile') html = this.renderTile(sel);
      else html = this.view === 'archive' ? this.renderArchive() : this.renderOverview();
      if (html !== this.lastHtml) {
        const st = this.info.scrollTop;
        this.info.innerHTML = html;
        this.info.scrollTop = st;
        this.lastHtml = html;
      }
    }

    renderLog() {
      const ev = this.app.sim.events;
      const key = ev.length + ':' + (ev[0] ? ev[0].t + ev[0].y : '');
      if (key === this.lastLogKey) return;
      this.lastLogKey = key;
      this.logEl.innerHTML = ev.slice(0, 60).map((e) =>
        `<div class="ev" style="border-left-color:${e.c}" data-x="${e.x ?? ''}" data-y="${e.yy ?? ''}"><span class="yr">${e.y}년</span>${esc(e.t)}</div>`).join('');
    }
  }

  G.UI = UI;
})();
