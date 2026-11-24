// 사람의 동작(자세): 지금 하는 일에 따라 팔·다리·몸 기울기·도구·작은 효과를 정한다.
// 그리기는 render.js가 하고, 여기서는 "어떤 자세인가"만 계산한다.
//  팔 각도 θ: 0 = 아래로 늘어뜨림, π/2 = 앞으로 뻗음, π = 머리 위
//  legs: stand(서거나 걷기) · sit(앉기) · crouch(쪼그려 앉기) · kneel(무릎 꿇기) · spread(다리 벌리기)
(function () {
  const G = globalThis.G;
  const J = G.JOB;
  const A = (G.Anim = {});
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  // 사람마다 박자가 조금씩 어긋나도록 id를 섞는다
  const cyc = (frame, speed, id) => (((frame * speed + id * 0.37) % 1) + 1) % 1;
  // 들어 올렸다가 내리치는 동작 (도끼·곡괭이·괭이·망치)
  const swing = (t, low, high, upShare = 0.62) => (t < upShare ? lerp(low, high, t / upShare) : lerp(high, low, (t - upShare) / (1 - upShare)));

  A.pose = (h, sim, frame) => {
    const P = { legs: 'stand', drop: 0, lean: 0, jump: 0, back: null, front: null, tool: null, fx: null, fxT: 0, prop: null, lookUp: false };
    const id = h.id;
    const w = sim.world;
    const kid = h.age < 14;

    // 물 붓기는 무엇보다 먼저
    if (h.pourT > 0) { P.front = 1.9; P.back = 1.6; P.lean = 0.6; P.tool = 'pour'; P.fx = 'water'; P.fxT = (30 - h.pourT) / 30; return P; }
    if (h.treatT > 0) { P.legs = 'kneel'; P.front = 1.5 + Math.sin(frame * 0.15 + id) * 0.2; P.back = 1.2; P.tool = 'herb'; return P; }

    switch (h.state) {
      case 'gather': {
        const res = h.task && h.task.res, tile = h.task && h.task.tile;
        if (res === 'wood') {
          const t = cyc(frame, 0.03, id);
          P.front = swing(t, 0.9, 2.8); P.back = P.front - 0.25; P.tool = 'axe'; P.lean = t < 0.62 ? -0.4 : 0.9;
          if (t > 0.9 || t < 0.04) { P.fx = 'chips'; P.fxT = t > 0.9 ? (t - 0.9) / 0.14 : (t + 0.1) / 0.14; }
        } else if (res === 'ore') {
          const t = cyc(frame, 0.032, id);
          P.front = swing(t, 0.45, 2.9); P.back = P.front - 0.2; P.tool = 'pick'; P.lean = t < 0.62 ? -0.3 : 1.2;
          if (t > 0.9 || t < 0.04) { P.fx = 'sparks'; P.fxT = t > 0.9 ? (t - 0.9) / 0.14 : (t + 0.1) / 0.14; }
        } else if (res === 'fish') {
          P.legs = 'sit'; P.front = 2.0; P.back = 1.5; P.tool = 'rod'; P.fx = 'bobber'; P.fxT = cyc(frame, 0.01, id);
        } else if (res === 'food' && tile != null && w.farm[tile]) {
          if (w.food[tile] >= 3) {
            // 다 자란 곡식을 낫으로 벤다
            const t = cyc(frame, 0.045, id);
            P.legs = 'crouch'; P.front = 1.0 + Math.sin(t * TAU) * 0.55; P.back = 0.7; P.tool = 'sickle'; P.lean = 0.8;
            if (t > 0.8) { P.fx = 'grain'; P.fxT = (t - 0.8) / 0.2; }
          } else {
            // 덜 자란 밭은 물을 주고 김을 맨다
            const t = cyc(frame, 0.02, id);
            P.front = 1.4; P.back = 1.0; P.tool = 'can'; P.lean = 0.5; P.fx = 'drip'; P.fxT = t;
          }
        } else {
          // 채집: 허리를 굽혀 열매와 풀을 줍는다
          const t = cyc(frame, 0.04, id);
          P.legs = 'crouch'; P.front = 0.8 + Math.sin(t * TAU) * 0.55; P.back = 0.5; P.lean = 0.9; P.tool = 'basket';
        }
        break;
      }
      case 'busy': {
        const b = h.busy && h.busy.kind;
        if (b === 'till') {
          const t = cyc(frame, 0.035, id);
          P.front = swing(t, 0.55, 2.7); P.back = P.front - 0.15; P.tool = 'hoe'; P.lean = t < 0.62 ? -0.2 : 1;
          if (t > 0.9 || t < 0.05) { P.fx = 'dirt'; P.fxT = t > 0.9 ? (t - 0.9) / 0.15 : (t + 0.1) / 0.15; }
        } else if (b === 'tend') {
          P.legs = 'crouch'; P.front = 1.3 + Math.sin(frame * 0.12 + id) * 0.3; P.back = 0.9; P.lean = 0.6;
          if (cyc(frame, 0.01, id) > 0.85) { P.fx = 'heart'; P.fxT = (cyc(frame, 0.01, id) - 0.85) / 0.15; }
        } else if (b === 'forge' || b === 'build') {
          const t = cyc(frame, 0.05, id);
          P.front = swing(t, 1.0, 2.5, 0.55); P.back = 1.1; P.tool = 'hammer';
          if (b === 'forge') P.prop = 'anvil';
          if (t > 0.88 || t < 0.04) { P.fx = b === 'forge' ? 'sparks' : 'dust'; P.fxT = t > 0.88 ? (t - 0.88) / 0.16 : (t + 0.12) / 0.16; }
        }
        break;
      }
      case 'pray': P.legs = 'kneel'; P.front = 2.85 + Math.sin(frame * 0.06 + id) * 0.12; P.back = P.front; break;
      case 'party': {
        const s = Math.sin(frame * 0.22 + id);
        P.front = 2.2 + s * 0.7; P.back = 2.2 - s * 0.7; P.jump = Math.abs(s) * 3;
        break;
      }
      case 'hobby': A.hobby(P, h, frame, id); break;
      case 'rest': A.idle(P, h, frame, id, kid); break;
      case 'fight': {
        const t = (h.timer || 0) / 20;
        P.front = t > 0.7 ? 1.65 : 0.8 + t; P.back = 0.9; P.lean = t > 0.7 ? 0.9 : 0.2;
        break;
      }
      case 'goto':
      case 'idle':
        // 아이는 뛰어다닌다
        if (kid && h.moving) P.jump = Math.abs(Math.sin(h.walk * 1.5)) * 1.6;
        break;
    }
    // 언덕과 산을 오를 때는 앞으로 숙이고 걷는다
    if (h.moving && h.state === 'goto') {
      const ty = w.typeAt(h.x, h.y);
      if (ty === G.T.HILL || ty === G.T.MOUNTAIN || ty === G.T.SNOW) { P.lean = ty === G.T.HILL ? 0.6 : 1.1; P.climb = true; }
    }
    return P;
  };

  // 취미의 동작
  A.hobby = (P, h, frame, id) => {
    const t = cyc(frame, 0.03, id), s = Math.sin(frame * 0.12 + id);
    switch (h.curHobby) {
      case '노래': P.front = 1.7 + s * 0.15; P.back = 0.5; P.fx = 'notes'; P.fxT = cyc(frame, 0.012, id); break;
      case '춤': P.front = 2.2 + s * 0.7; P.back = 2.2 - s * 0.7; P.jump = Math.abs(Math.sin(frame * 0.22 + id)) * 3; break;
      case '이야기': P.legs = 'sit'; P.front = 1.3 + Math.max(0, Math.sin(frame * 0.09 + id)) * 0.9; P.back = 0.6; break;
      case '요리': P.legs = 'crouch'; P.front = 1.25 + Math.sin(frame * 0.15 + id) * 0.2; P.back = 0.9; P.prop = 'pot'; P.fx = 'steam'; P.fxT = cyc(frame, 0.015, id); break;
      case '낚시': P.legs = 'sit'; P.front = 2.0; P.back = 1.5; P.tool = 'rod'; P.fx = 'bobber'; P.fxT = cyc(frame, 0.01, id); break;
      case '별보기': P.legs = 'sit'; P.front = 0.4; P.back = 0.4; P.lookUp = true; P.fx = 'twinkle'; P.fxT = cyc(frame, 0.02, id); break;
      case '그림': P.front = 1.6 + Math.sin(frame * 0.2 + id) * 0.25; P.back = 0.4; P.tool = 'brush'; P.prop = 'canvas'; break;
      case '운동': {
        const up = cyc(frame, 0.06, id) < 0.5;
        P.front = up ? 2.9 : 0.25; P.back = P.front; P.legs = up ? 'spread' : 'stand'; P.jump = up ? 1.5 : 0;
        break;
      }
      case '도박': P.legs = 'sit'; P.front = t < 0.25 ? lerp(1.0, 2.2, t / 0.25) : 1.0; P.back = 0.8; P.fx = 'dice'; P.fxT = t; break;
      case '술': P.legs = 'sit'; P.front = t < 0.2 ? 2.5 : 1.3; P.back = 0.7; P.tool = 'cup'; P.drunk = h.drunk > 0; break;
      case '공부': P.legs = 'sit'; P.front = 1.15; P.back = 1.15; P.tool = 'book'; break;
      default: P.front = 0.3; P.back = 0.3;
    }
  };

  // 쉬는 동작: 앉기, 뒷짐 지고 두리번거리기, 기지개, 팔짱, 아이들 깡충깡충
  A.idle = (P, h, frame, id, kid) => {
    if (kid) { const s = Math.sin(frame * 0.18 + id); P.jump = Math.abs(s) * 2.2; P.front = 2.4 + s * 0.4; P.back = 2.4 - s * 0.4; return; }
    const v = h.age >= 55 ? 0 : id % 5;
    const t = cyc(frame, 0.006, id);
    if (v === 0 || v === 3) { P.legs = 'sit'; P.front = 0.9; P.back = 0.7; if (v === 3 && t > 0.7) P.front = 1.6; return; }
    if (v === 1) { P.front = -0.5; P.back = -0.5; P.look = t > 0.5 ? -1 : 1; return; } // 뒷짐 지고 두리번
    if (v === 2) { if (t > 0.8) { P.front = 2.9; P.back = 2.9; P.jump = 0.5; } else { P.front = 0.2; P.back = 0.2; } return; } // 기지개
    P.front = 1.1; P.back = 1.1; P.crossed = true; // 팔짱
  };
})();
