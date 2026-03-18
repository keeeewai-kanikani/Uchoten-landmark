// --- Heartbeat Logic ---
let angle = 0;
let layerStates = [0, 0, 0, 0, 0, 0];
let GU = 20; // Changed to let to allow responsive scaling
const OX = 300, OY = 80;

// --- Hand States ---
let handTargetX = 0, handTargetY = 0, handActive = false, handTimer = 0, handDuration = 100;

// --- Room Data (Grid Units - Scaled to 0.8x) ---
let roomsData = [
  { id: 0, name: "右心房", w: 6.4, h: 8.8, lIdx: 0, link: "#about" },
  { id: 1, name: "右心室", w: 11.2, h: 11.2, lIdx: 1, link: "#projects" },
  { id: 2, name: "左心房", w: 9.6, h: 3.2, lIdx: 2, link: "#about" },
  { id: 3, name: "左心室", w: 12.0, h: 18.4, lIdx: 3, link: "#projects" }
];
let roomHoverScales = [1, 1, 1, 1];
let cr = []; // Computed Rects for connectivity

/**
 * BLUEPRINT SKETCH
 */
const blueprintSk = (p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight).parent('canvas-container');
    p.noFill();
    cr = roomsData.map(() => ({ x: 0, y: 0, vw: 0, vh: 0 }));
  };

  // --- WINDOW COORDINATE HELPERS ---
  const CX = (v) => p.width / 2 + v * GU;  // Center X
  const LX = (v) => v * GU;              // Left X
  const RX = (v) => p.width - v * GU;    // Right X
  const CY = (v) => p.height / 2 + v * GU; // Center Y
  const TY = (v) => v * GU;              // Top Y
  const BY = (v) => p.height - v * GU;   // Bottom Y

  p.draw = () => {
    // Dynamic scaling based on window width
    GU = p.map(p.constrain(p.width, 375, 1200), 375, 1200, 10, 22);

    p.clear();
    // --- 修正後：ガウス関数によるQRS波の近似と恒常性のベース ---

    // 1. 恒常性の基礎となるBPM（ゆくゆくはこれを動的に変化させます）
    let bpm = 60; // 安静時の心拍数
    let beatInterval = 60000 / bpm; // 1拍あたりのミリ秒数（60BPMなら1000ms）

    // 現在の時間を 0.0 〜 1.0 のフェーズ（周期）に正規化
    let t = p.millis() % beatInterval;
    let phase = t / beatInterval;

    // 2. 波形の合成（関数化して各レイヤーで極性を変えずに遅延させられるようにする）
    const getHeartbeat = (p, phase) => {
      const gauss = (x, a, mu, sigma) => a * Math.exp(-Math.pow(x - mu, 2) / (2 * Math.pow(sigma, 2)));
      let qrs = gauss(phase, 1.8, 0.1, 0.05);
      let tW = gauss(phase, 0.8, 0.6, 0.08);
      return (qrs + tW) * 6;
    };

    // 3. 各レイヤーへの適用（位相をずらすことで、振幅を減衰させずに遅延させる）
    for (let i = 0; i < layerStates.length; i++) {
      // 各レイヤーごとに 0.1 ずつフェーズを遅らせる（10%ずれる）
      let layerPhase = (phase - (i * 0.08) + 1.0) % 1.0;
      let baseBeat = getHeartbeat(p, layerPhase);

      // 部屋ごとの有機的な揺らぎ（ノイズ）
      let individualNoise = (p.noise(i * 10, p.millis() * 0.0005) - 0.5) * 3.0;

      layerStates[i] = baseBeat + individualNoise;
    }

    drawGrid(p);
    const SS = (val) => val * GU;

    // --- 1. DYNAMIC RELATIVE LAYOUT ( Sticky Linkage ) ---
    const getLayout = (scales, pulses) => {
      let outCr = [];

      // ROOM 0: 右心房 (Anchor - Responsive)
      let s0 = scales[0], l0 = pulses[0];
      let vw0 = (SS(roomsData[0].w) + l0) * s0;
      let vh0 = (SS(roomsData[0].h) + l0) * s0;
      let rx0 = CX(0);
      let ry0 = TY(8) + vh0 / 2;
      outCr[0] = { x: rx0 - SS(11), y: ry0, vw: vw0, vh: vh0 };

      // ROOM 1: 右心室 (Sticks to Right Atrium Bottom)
      let s1 = scales[1], l1 = pulses[1];
      let vw1 = (SS(roomsData[1].w) + l1) * s1;
      let vh1 = (SS(roomsData[1].h) + l1) * s1;
      let rx1 = outCr[0].x + (SS(1.5) * s0);
      let ry1 = outCr[0].y + outCr[0].vh / 2 + vh1 / 2;
      outCr[1] = { x: rx1, y: ry1, vw: vw1, vh: vh1 };

      // ROOM 2: 左心房 (Sticks Right relative to Right Atrium)
      let s2 = scales[2], l2 = pulses[2];
      let vw2 = (SS(roomsData[2].w) + l2) * s2;
      let vh2 = (SS(roomsData[2].h) + l2) * s2;
      let rx2 = outCr[0].x + outCr[0].vw / 2 + (SS(4) * s0) + vw2 / 2;
      let ry2 = outCr[0].y + (SS(0.25) * s0);
      outCr[2] = { x: rx2, y: ry2, vw: vw2, vh: vh2 };

      // ROOM 3: 左心室 (Sticks to Left Atrium Bottom)
      let s3 = scales[3], l3 = pulses[3];
      let vw3 = (SS(roomsData[3].w) + l3) * s3;
      let vh3 = (SS(roomsData[3].h) + l3) * s3;
      let rx3 = outCr[2].x + (SS(1.75) * s2);
      let ry3 = outCr[2].y + outCr[2].vh / 2 + vh3 / 2;
      outCr[3] = { x: rx3, y: ry3, vw: vw3, vh: vh3 };

      const anc = {
        ra_door_main: { x: outCr[0].x - (SS(0.75) * s0), y: outCr[0].y - outCr[0].vh / 2 },
        ra_stair_left_a: { x: outCr[0].x - outCr[0].vw / 2 + (SS(2.5) * s0), y: outCr[0].y - (SS(4.5) * s0) },
        ra_stair_left_b: { x: outCr[0].x - outCr[0].vw / 2 + (SS(6.5) * s0), y: outCr[0].y - (SS(4.5) * s0) },
        ra_stair_left_c: { x: outCr[0].x - outCr[0].vw / 2 + (SS(4.5) * s0), y: outCr[0].y - (SS(4.5) * s0) },
        ra_entry_top: { x: outCr[0].x + (SS(1.25) * s0), y: TY(0) },
        ra_entry_room: { x: outCr[0].x + (SS(1.25) * s0), y: outCr[0].y - outCr[0].vh / 2 },

        rv_door_entry: { x: outCr[1].x - (SS(1.0) * s1), y: outCr[1].y - outCr[1].vh / 2 },
        rv_door_exit: { x: outCr[1].x + (SS(5.5) * s1), y: outCr[1].y - outCr[1].vh / 2 },
        rv_exit_path: { x: outCr[0].x + (SS(1.25) * s0), y: outCr[1].y + outCr[1].vh / 2 },

        la_door_main: { x: outCr[3].x - outCr[3].vw / 2 + (SS(4) * s2), y: outCr[2].y + (SS(1.5) * s2) },
        la_bridge_start: { x: outCr[3].x - outCr[3].vw / 2 + (SS(0) * s0), y: outCr[1].y - outCr[1].vh / 2 },
        la_bridge_edge: { x: outCr[0].x + outCr[0].vw / 2, y: outCr[1].y - outCr[1].vh / 2 },
        la_bridge_inner: { x: outCr[0].x + outCr[0].vw / 2, y: outCr[0].y - (SS(8.5) * s0) },
        la_bridge_turn: { x: outCr[0].x + outCr[0].vw / 2 + (SS(10) * s0), y: outCr[0].y - (SS(8.5) * s0) },
        la_bridge_end: { x: outCr[0].x + outCr[0].vw / 2 + (SS(10) * s0), y: outCr[0].y - (SS(6.5) * s0) },

        lv_door_main: { x: outCr[3].x - outCr[3].vw / 2, y: outCr[3].y - (SS(6.75) * s3) },
        lv_output_top: { x: outCr[0].x + outCr[0].vw / 2 + (SS(10) * s0), y: outCr[0].y - outCr[0].vh / 2 },
        lv_output_bottom: { x: outCr[0].x + outCr[0].vw / 2 + (SS(10) * s0), y: outCr[3].y + outCr[3].vh / 2 },

        side_path_start: { x: outCr[0].x + outCr[0].vw / 2 + (SS(2) * s0), y: outCr[1].y - outCr[1].vh / 2 - (SS(2) * s1) },
        side_path_node: { x: outCr[0].x + outCr[0].vw / 2 + (SS(2) * s0), y: outCr[0].y - (SS(6.5) * s0) },

        header_door_0: { x: CX(0) - SS(5), y: SS(4) },
        header_door_1: { x: CX(0) - SS(2), y: SS(4) },
        header_door_2: { x: CX(0) + SS(1), y: SS(4) },
        header_door_3: { x: outCr[2].x + outCr[2].vw / 2 - (SS(5.5) * s0), y: outCr[2].y - (SS(1.5) * s0) }
      };
      return { cr: outCr, anchors: anc };
    };

    // Calculate Current vs Baseline for Global Shift
    let current = getLayout(roomHoverScales, layerStates);
    let baseline = getLayout([1, 1, 1, 1], [0, 0, 0, 0, 0, 0]);

    // Find primary hover index
    let hoverIdx = -1, maxH = 1.05;
    roomHoverScales.forEach((s, i) => { if (s > maxH) { hoverIdx = i; maxH = s; } });

    // Apply Global Shift to stick hovered room's center to its rest position
    if (hoverIdx !== -1) {
      let dx = baseline.cr[hoverIdx].x - current.cr[hoverIdx].x;
      let dy = baseline.cr[hoverIdx].y - current.cr[hoverIdx].y;
      current.cr.forEach(rect => { rect.x += dx; rect.y += dy; });
      for (let key in current.anchors) {
        current.anchors[key].x += dx;
        current.anchors[key].y += dy;
      }
    }

    let anchors = current.anchors;
    cr = current.cr;
    let l0 = layerStates[0], l1 = layerStates[1], l2 = layerStates[2], l3 = layerStates[3];

    // --- 2. DRAW ROOMS ---
    cr.forEach((rect, i) => {
      updateHoverScale(p, i, rect.x, rect.y, rect.vw, rect.vh);
      drawRoom(p, rect.x, rect.y, rect.vw / roomHoverScales[i], rect.vh / roomHoverScales[i], layerStates[roomsData[i].lIdx], roomsData[i].name, roomHoverScales[i]);
    });

    // --- 3. DRAW STAIRS ---
    p.strokeWeight(1.2);
    let st = SS(2); // Stair thickness in Grid Units

    // YELLOW: Left Edge Path
    drawStairs(p, [anchors.ra_stair_left_a, { x: LX(0), y: anchors.ra_stair_left_a.y }], st, 1);
    drawStairs(p, [anchors.ra_stair_left_b, anchors.ra_stair_left_c], st, 1);

    // BLUE: Entry (Top)
    drawStairs(p, [anchors.ra_entry_top, anchors.ra_entry_room], st, 1);

    // BLUE (Extra Side Path): Anchored to cr[0] right
    drawStairs(p, [{ x: anchors.la_bridge_end.x, y: anchors.la_bridge_end.y + SS(2) }, { x: anchors.lv_output_top.x, y: cr[2].y - cr[2].vh / 2 }], st, 1);

    // BLUE (Bottom Edge): Anchored to cr[3] bottom
    drawStairs(p, [anchors.lv_output_bottom, { x: anchors.lv_output_bottom.x, y: BY(0) }], st, 1);

    // RED: Core link (Sticky to cr[1] top and cr[0] body)
    drawStairs(p, [
      anchors.la_bridge_start, anchors.la_bridge_edge, anchors.la_bridge_inner, anchors.la_bridge_turn, anchors.la_bridge_end
    ], st, 1);

    drawStairs(p, [anchors.side_path_start, anchors.side_path_node, { x: RX(0), y: anchors.side_path_node.y }], st, 1);

    // BLUE (Bottom Output): Anchored to cr[1] bottom
    drawStairs(p, [anchors.rv_exit_path, { x: anchors.rv_exit_path.x, y: BY(0) }], st, -1);

    // --- 4. DRAW DOORS ---
    drawDoor(p, anchors.ra_door_main.x, anchors.ra_door_main.y, SS(4.0), 0 / 2, l0);
    drawDoor(p, anchors.rv_door_entry.x, anchors.rv_door_entry.y, SS(4.0), 0 / 2, l1);
    drawDoor(p, anchors.rv_door_exit.x, anchors.rv_door_exit.y, SS(4.0), Math.PI, l1, -1);
    drawDoor(p, anchors.la_door_main.x, cr[3].y - cr[3].vh / 2, SS(4.0), 0, l2);
    drawDoor(p, anchors.lv_door_main.x, anchors.la_bridge_start.y, SS(4.0), -Math.PI / 2, l3);


    drawDoor(p, anchors.la_bridge_inner.x + SS(3), anchors.la_bridge_inner.y, SS(4.0), Math.PI, l1);
    drawDoor(p, anchors.la_bridge_inner.x + SS(6), anchors.la_bridge_inner.y, SS(4.0), Math.PI, l2);
    drawDoor(p, anchors.la_bridge_inner.x + SS(9), anchors.la_bridge_inner.y, SS(4.0), Math.PI, l3);

    drawDoor(p, anchors.la_bridge_end.x - SS(2), cr[2].y - cr[2].vh / 2, SS(4.0), 0, l0);



    drawMouseGuides(p, p.width, p.height, cr[0].x, cr[0].y);
  };

  p.mouseClicked = () => {
    roomHoverScales.forEach((scale, i) => {
      if (scale > 1.1) {
        let link = i % 2 === 0 ? "#about" : "#projects";
        const el = document.querySelector(link);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  };

  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
};

/**
 * HOVER HELPERS
 */
function updateHoverScale(p, index, x, y, w, h) {
  let inRoom = p.mouseX > x - w / 2 && p.mouseX < x + w / 2 &&
    p.mouseY > y - h / 2 && p.mouseY < y + h / 2;

  let target = inRoom ? 1.2 : 1.0;
  roomHoverScales[index] = p.lerp(roomHoverScales[index], target, 0.1);
}

function isMouseInRoom(p, index) {
  return roomHoverScales[index] > 1.1;
}

/**
 * HANDS SKETCH (Overlay Layer)
 */
const handSk = (p) => {
  let leftHandImg, rightHandImg;

  p.preload = () => {
    leftHandImg = p.loadImage('assets/images/lefthand.webp');
    rightHandImg = p.loadImage('assets/images/righthand.webp');
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight).parent('hand-container');
  };

  p.draw = () => {
    p.clear();
    if (!handActive) return;

    handTimer++;
    if (handTimer > handDuration) {
      handActive = false;
      return;
    }

    let t = handTimer / handDuration;
    let ease = Math.pow(Math.sin(t * Math.PI), 0.2);

    p.push();
    p.imageMode(p.CENTER);
    let hW = 900;
    let hH = (leftHandImg.height / leftHandImg.width) * hW;
    let maxOff = p.windowWidth > p.windowHeight ? p.windowWidth : p.windowHeight;
    let l_offsetX = p.lerp(-maxOff, -450, ease);
    let r_offsetX = p.lerp(maxOff, 450, ease);

    p.image(leftHandImg, handTargetX + l_offsetX, handTargetY, hW, hH);
    p.image(rightHandImg, handTargetX + r_offsetX, handTargetY, hW, hH);
    p.pop();
  };

  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
};

// Initialize both
new p5(blueprintSk);
new p5(handSk);

// Global Listener for Hands
window.addEventListener('mousedown', (e) => {
  handActive = true;
  handTargetX = e.clientX;
  handTargetY = e.clientY;
  handTimer = 0;
});

/**
 * DRAWING FUNCTIONS
 */
function drawRoom(p, x, y, w, h, pulse, name, hoverScale) {
  p.push();
  p.translate(x, y);
  p.scale(hoverScale);

  // Room Box
  p.stroke(42, 82, 190, 200);
  if (hoverScale > 1.01) {
    p.fill(42, 82, 190, 10); // Subtle highlight on hover
  } else {
    p.noFill();
  }
  p.rect(- w / 2, - h / 2, w, h);

  // Text content
  p.fill(42, 82, 190, 220);
  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);

  // Room Name
  p.textSize(10);
  p.text(name, 0, -10);

  // Jo Count
  let metroScale = GU * 2.25;
  let areaM2 = (w / metroScale) * (h / metroScale);
  let jo = (areaM2 / 1.62).toFixed(1);
  p.textSize(15);
  p.text(jo + "帖", 0, 10);

  p.pop();
}

function drawDoor(p, x, y, size, baseAngle, pulse, dir = 1) {
  // Gaussian pulse + noise can peak around 10-12.
  // We constrain the input and map to a max of 90 degrees (HALF_PI) to avoid "over-extended Pac-Man" feel.
  let openAngle = p.map(p.constrain(pulse, 0, 10), 0, 10, p.radians(5), p.HALF_PI) * dir;
  p.stroke(0, 0, 0, 120);
  p.noFill();
  let start = baseAngle;
  let stop = baseAngle + openAngle;
  if (dir < 0) {
    start = baseAngle + openAngle;
    stop = baseAngle;
  }
  p.arc(x, y, size, size, start, stop);
  let doorX = x + Math.cos(baseAngle + openAngle) * (size / 2);
  let doorY = y + Math.sin(baseAngle + openAngle) * (size / 2);
  p.line(x, y, doorX, doorY);
}

function drawMouseGuides(p, w, h, cx, cy) {
  let metroScale = GU * 2.25;
  let mX = p.mouseX / metroScale;
  let mY = p.mouseY / metroScale;
  p.fill(42, 82, 190, 200);
  p.noStroke();
  p.textSize(9);
  p.textAlign(p.LEFT, p.TOP);
  p.text(`横 ${mX.toFixed(2)}m\n縦 ${mY.toFixed(2)}m`, p.mouseX + 15, p.mouseY + 15);
  p.stroke(42, 82, 190, 60);
  p.line(0, p.mouseY, p.mouseX, p.mouseY);
  p.line(p.mouseX, 0, p.mouseX, p.mouseY);
  let ra = 8;
  p.stroke(42, 82, 190, 180);
  p.line(p.mouseX - ra, p.mouseY, p.mouseX - ra, p.mouseY - ra);
  p.line(p.mouseX, p.mouseY - ra, p.mouseX - ra, p.mouseY - ra);
}

function drawGrid(p) {
  p.stroke(42, 82, 190, 30);
  for (let i = 0; i < p.width; i += GU) p.line(i, 0, i, p.height);
  for (let j = 0; j < p.height; j += GU) p.line(0, j, p.width, j);
  p.fill(42, 82, 190, 120);
  p.noStroke();
  p.textSize(14);
  p.textAlign(p.LEFT, p.TOP);
  for (let i = 0; i < p.width; i += 100) p.text(i / 50, i + 3, 3);
  for (let j = 100; j < p.height; j += 100) p.text(j / 50, 3, j + 3);
}

function drawStairs(p, vertices, thickness, direction) {
  if (vertices.length < 2) return;
  let stepGap = thickness / 3;
  let speed = 0.8;
  let flowSegments = [];
  let totalFlowLength = 0;

  // 1. Calculate angles and corner offsets
  let angles = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    angles.push(p.atan2(vertices[i + 1].y - vertices[i].y, vertices[i + 1].x - vertices[i].x));
  }

  let cornerOffsets = new Array(vertices.length).fill(0);
  for (let i = 1; i < vertices.length - 1; i++) {
    let diff = angles[i] - angles[i - 1];
    while (diff > p.PI) diff -= p.TWO_PI;
    while (diff < -p.PI) diff += p.TWO_PI;
    if (p.abs(diff) > 0.01) {
      // Offset required to shorten the lines for a clean miter
      cornerOffsets[i] = thickness * p.abs(p.tan(diff / 2));
    }
  }

  // 2. Build adjusted segments
  for (let i = 0; i < vertices.length - 1; i++) {
    let p1 = p.createVector(vertices[i].x, vertices[i].y);
    let p2 = p.createVector(vertices[i + 1].x, vertices[i + 1].y);
    let ang = angles[i];

    // Shorten start if previous vertex was a corner
    if (cornerOffsets[i] > 0) {
      p1.x += p.cos(ang) * cornerOffsets[i];
      p1.y += p.sin(ang) * cornerOffsets[i];
    }
    // Shorten end if current vertex is a corner
    if (cornerOffsets[i + 1] > 0) {
      p2.x -= p.cos(ang) * cornerOffsets[i + 1];
      p2.y -= p.sin(ang) * cornerOffsets[i + 1];
    }

    let d = p1.dist(p2);
    if (d > 0) {
      flowSegments.push({ type: 'LINE', length: d, p1: p1, angle: ang });
      totalFlowLength += d;
    }

    // Add Corner Fan after the line (at the vertex)
    if (cornerOffsets[i + 1] > 0 && i < vertices.length - 2) {
      let diff = angles[i + 1] - angles[i];
      while (diff > p.PI) diff -= p.TWO_PI;
      while (diff < -p.PI) diff += p.TWO_PI;

      // The flow length here accounts for the "gap" created by shortening the lines
      let cornerLen = cornerOffsets[i + 1] * 1.5; // Visual spacing adjustment
      flowSegments.push({
        type: 'SQUARE_FAN',
        length: cornerLen,
        center: p.createVector(vertices[i + 1].x, vertices[i + 1].y),
        startAng: ang,
        diff: diff
      });
      totalFlowLength += cornerLen;
    }
  }

  // --- Draw Boundaries ---
  p.stroke(42, 82, 190, 120);
  p.noFill();

  // Inner Boundary
  p.beginShape();
  for (let v of vertices) p.vertex(v.x, v.y);
  p.endShape();

  // Outer Boundary (Mitered)
  p.beginShape();
  for (let i = 0; i < vertices.length; i++) {
    let n;
    if (i === 0) {
      n = p5.Vector.fromAngle(angles[0] + p.HALF_PI).mult(thickness);
      p.vertex(vertices[0].x + n.x, vertices[0].y + n.y);
    } else if (i === vertices.length - 1) {
      n = p5.Vector.fromAngle(angles[angles.length - 1] + p.HALF_PI).mult(thickness);
      p.vertex(vertices[i].x + n.x, vertices[i].y + n.y);
    } else {
      let diff = angles[i] - angles[i - 1];
      while (diff > p.PI) diff -= p.TWO_PI;
      while (diff < -p.PI) diff += p.TWO_PI;
      let halfDiff = diff / 2;
      let miterDist = thickness / p.cos(halfDiff);
      let miterAngle = angles[i - 1] + halfDiff + p.HALF_PI;
      p.vertex(vertices[i].x + p.cos(miterAngle) * miterDist, vertices[i].y + p.sin(miterAngle) * miterDist);
    }
  }
  p.endShape();

  // --- Draw Steps ---
  let timeOffset = (p.frameCount * speed * direction) % stepGap;
  if (timeOffset < 0) timeOffset += stepGap;

  p.stroke(42, 82, 190, 180);
  for (let d = -stepGap + timeOffset; d < totalFlowLength; d += stepGap) {
    if (d < 0) continue;
    let curD = d;
    let seg = null;
    for (let j = 0; j < flowSegments.length; j++) {
      if (curD <= flowSegments[j].length) {
        seg = flowSegments[j];
        break;
      }
      curD -= flowSegments[j].length;
    }
    if (!seg) continue;

    let t = curD / seg.length;
    if (seg.type === 'LINE') {
      let x = p.lerp(seg.p1.x, seg.p1.x + p.cos(seg.angle) * seg.length, t);
      let y = p.lerp(seg.p1.y, seg.p1.y + p.sin(seg.angle) * seg.length, t);
      p.line(x, y, x + p.cos(seg.angle + p.HALF_PI) * thickness, y + p.sin(seg.angle + p.HALF_PI) * thickness);
    } else if (seg.type === 'SQUARE_FAN') {
      let t = curD / seg.length;
      let halfTurn = seg.diff / 2;

      // Determine if the turn is "inward" (towards the offset) or "outward"
      // Thickness offset is globally +HALF_PI (Right). 
      // Diff > 0 means a right turn.
      let isRightTurn = seg.diff > 0;

      let pivot, targetEdgeDist, currentAng;

      if (!isRightTurn) {
        // On a left turn, the vertex is the pivot.
        pivot = seg.center;
        currentAng = seg.startAng + (seg.diff * t) + p.HALF_PI;
        let relAng = (seg.diff * t) - halfTurn;
        targetEdgeDist = thickness / p.cos(p.abs(halfTurn) - p.abs(relAng));
        p.line(pivot.x, pivot.y, pivot.x + p.cos(currentAng) * targetEdgeDist, pivot.y + p.sin(currentAng) * targetEdgeDist);
      } else {
        // Right Turn: The offset side is the tighter "inner" pivot.
        let miterDist = thickness / p.cos(halfTurn);
        let miterAngle = seg.startAng + halfTurn + p.HALF_PI;
        pivot = p.createVector(
          seg.center.x + p.cos(miterAngle) * miterDist,
          seg.center.y + p.sin(miterAngle) * miterDist
        );

        currentAng = seg.startAng + (seg.diff * t) + p.HALF_PI + p.PI;
        let relAng = (seg.diff * t) - halfTurn;
        targetEdgeDist = thickness / p.cos(p.abs(halfTurn) - p.abs(relAng));

        p.line(pivot.x, pivot.y, pivot.x + p.cos(currentAng) * targetEdgeDist, pivot.y + p.sin(currentAng) * targetEdgeDist);
      }
    }
  }
}
