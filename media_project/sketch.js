// ==========================================
// 花火設計・検証＆プロデュース シミュレーター 
// ==========================================

const MAX_ALTITUDE_M = 480.0;
let PPM;

const dt = 1.0 / 60.0;
const G = 9.8;
const RHO = 1.225;
const Cd_SPHERE = 0.47;
const POWDER_DENSITY = 1700;

let fireworks = [];

// UI要素 (設計)
let shellSizeSlider, starSizeSlider;
let layerSelect;
let colorSelects = [];
let binderSlider, windSlider;

// UI要素 (タイムライン入力)
let timeInput, xPosSlider, addTimelineBtn, playBtn, clearBtn;

// タイムライン表示用HTML要素
let timelinePanel, statusDiv, listDiv;

// 大会システム用の変数
let timelineData = []; // ユーザーが作った花火の予約リスト
let activeShowQueue = []; // 再生中に消費していくリスト
let isPlayingShow = false;
let showStartTime = 0;

function setup() {
    let canvas = createCanvas(1000, 800);
    canvas.parent('canvas-container');
    colorMode(HSB, 360, 255, 255, 255);

    PPM = height / MAX_ALTITUDE_M;

    let uiDiv = select('#ui-panel');
    if (!uiDiv) {
        uiDiv = createDiv();
        uiDiv.id('ui-panel');
    }

    createP('【1. 物理的な構造（玉の設計）】').parent('ui-panel');
    createP('花火の号数（3号〜10号: 尺玉）').parent('ui-panel');
    shellSizeSlider = createSlider(3, 10, 5, 1);
    shellSizeSlider.parent('ui-panel');

    createP('星の初期直径 (mm)').parent('ui-panel');
    starSizeSlider = createSlider(5, 25, 15, 0.5);
    starSizeSlider.parent('ui-panel');

    createP('【2. 化学的な配合（星の設計）】').parent('ui-panel');
    createP('星の層構造（変色の回数）').parent('ui-panel');
    layerSelect = createSelect();
    layerSelect.option('1層 (単色)', 1);
    layerSelect.option('2層 (1回変色)', 2);
    layerSelect.option('3層 (2回変色)', 3);
    layerSelect.selected(2);
    layerSelect.parent('ui-panel');

    let colorOptions = [
        'ナトリウム (黄・金)',
        'カルシウム (橙・オレンジ)',
        'ストロンチウム (赤)',
        'バリウム (緑)',
        '銅 (青)',
        '紫 (銅＋ストロンチウム)',
        'マグネシウム・アルミニウム (白・銀)'
    ];
    for (let i = 0; i < 3; i++) {
        createP(`第${i + 1}層の色 ${i === 0 ? '(外側)' : i === 2 ? '(中心)' : ''}`).parent('ui-panel');
        let sel = createSelect();
        for (let opt of colorOptions) sel.option(opt);
        if (i === 0) sel.selected('ナトリウム (黄・金)');
        if (i === 1) sel.selected('バリウム (緑)');
        if (i === 2) sel.selected('ストロンチウム (赤)');
        sel.parent('ui-panel');
        colorSelects.push(sel);
    }

    createP('バインダー(糊)の比率（ばらつき %）').parent('ui-panel');
    binderSlider = createSlider(0, 30, 10, 1);
    binderSlider.parent('ui-panel');

    createP('【環境設定】').parent('ui-panel');
    createP('地上風速 (m/s) ※上空はより強くなります').parent('ui-panel');
    windSlider = createSlider(-6, 6, 0, 1);
    windSlider.parent('ui-panel');

    let launchBtn = createButton('🚀 試し打ち (即時テスト)');
    launchBtn.style('margin-top', '15px');
    launchBtn.parent('ui-panel');
    launchBtn.mousePressed(launchTest);

    // ==========================================
    // タイムライン（シーケンサー）の入力UI
    // ==========================================
    createP('【3. タイムライン（大会の作成）】').parent('ui-panel');

    createP('打ち上げ時間 (大会開始から何秒後？)').parent('ui-panel');
    timeInput = createInput('0.0', 'number');
    timeInput.attribute('step', '0.5');
    timeInput.style('width', '100%');
    timeInput.style('padding', '5px');
    timeInput.parent('ui-panel');

    createP('打ち上げ位置 (左 - 中央 - 右)').parent('ui-panel');
    xPosSlider = createSlider(10, 90, 50, 1);
    xPosSlider.parent('ui-panel');

    addTimelineBtn = createButton('➕ 今の設定をリストに追加');
    addTimelineBtn.style('background-color', '#3498db');
    addTimelineBtn.style('color', '#fff');
    addTimelineBtn.style('border', 'none');
    addTimelineBtn.style('padding', '10px');
    addTimelineBtn.style('cursor', 'pointer');
    addTimelineBtn.parent('ui-panel');
    addTimelineBtn.mousePressed(addToTimeline);

    playBtn = createButton('▶ 花火大会をスタート！');
    playBtn.style('background-color', '#e74c3c');
    playBtn.style('color', '#fff');
    playBtn.style('border', 'none');
    playBtn.style('padding', '15px 10px');
    playBtn.style('font-weight', 'bold');
    playBtn.style('font-size', '16px');
    playBtn.style('margin-top', '10px');
    playBtn.style('cursor', 'pointer');
    playBtn.parent('ui-panel');
    playBtn.mousePressed(startShow);

    clearBtn = createButton('🗑 リストを全てクリア');
    clearBtn.style('margin-top', '5px');
    clearBtn.style('cursor', 'pointer');
    clearBtn.parent('ui-panel');
    clearBtn.mousePressed(() => { timelineData = []; isPlayingShow = false; updateTimelineList(); });

    // ==========================================
    // ★バグ修正：二重定義を削除し、左パネルの底に完全結合
    // ==========================================
    timelinePanel = createDiv();
    timelinePanel.id('timeline-panel');
    timelinePanel.parent(uiDiv); // 操作パネル（左側）の末尾に追加

    // パネル内のデザイン調整
    timelinePanel.style('margin-top', '20px');
    timelinePanel.style('padding', '15px');
    timelinePanel.style('background', 'rgba(255, 255, 255, 0.05)');
    timelinePanel.style('border', '1px solid rgba(255, 255, 255, 0.1)');
    timelinePanel.style('border-radius', '8px');

    statusDiv = createDiv();
    statusDiv.style('font-size', '14px');
    statusDiv.style('margin-bottom', '10px');
    statusDiv.style('border-bottom', '1px solid rgba(255, 255, 255, 0.1)');
    statusDiv.style('padding-bottom', '5px');
    statusDiv.parent(timelinePanel);

    listDiv = createDiv();
    listDiv.parent(timelinePanel);

    updateTimelineList();

    background(0);
}

// 今のスライダーの値を「設計図（レシピ）」として保存する関数
function getCurrentConfig() {
    let numLayers = parseInt(layerSelect.value());
    let activeColors = [];
    for (let i = 0; i < numLayers; i++) {
        activeColors.push(colorSelects[i].value());
    }

    return {
        sSize: shellSizeSlider.value(),
        starDia_m: starSizeSlider.value() / 1000.0,
        binderVariance: binderSlider.value() / 100.0,
        numLayers: numLayers,
        activeColors: activeColors,
        burstForce: calculateAutoBurstForce()
    };
}

// タイムラインに予約を追加
function addToTimeline() {
    let t = parseFloat(timeInput.value());
    if (isNaN(t) || t < 0) t = 0;

    let xPct = xPosSlider.value() / 100.0;
    let skyWidth_px = width - 300;
    let launchX_m = (skyWidth_px * xPct) / PPM;

    let config = getCurrentConfig();

    timelineData.push({
        time: t,
        x: launchX_m,
        config: config
    });

    timelineData.sort((a, b) => a.time - b.time);

    updateTimelineList();

    timeInput.value((t + 1.0).toFixed(1));
}

// リストをHTMLで再構築する関数
function updateTimelineList() {
    listDiv.html('');

    if (timelineData.length === 0) {
        let p = createP('登録されていません');
        p.style('color', '#888');
        p.style('font-size', '13px');
        p.style('margin', '0');
        p.parent(listDiv);
        return;
    }

    for (let i = 0; i < timelineData.length; i++) {
        let ev = timelineData[i];

        let itemRow = createDiv();
        itemRow.style('display', 'flex');
        itemRow.style('justify-content', 'space-between');
        itemRow.style('align-items', 'center');
        itemRow.style('margin-bottom', '8px');
        itemRow.style('font-size', '14px');
        itemRow.style('border-bottom', '1px solid rgba(255,255,255,0.1)');
        itemRow.style('padding-bottom', '5px');
        itemRow.parent(listDiv);

        let colorMark = ev.config.activeColors[0].charAt(0);
        let textSpan = createSpan(`[${ev.time.toFixed(1)}s] ${ev.config.sSize}号 (${colorMark})`);
        textSpan.parent(itemRow);

        let delBtn = createButton('×');
        delBtn.style('background-color', '#e74c3c');
        delBtn.style('color', '#fff');
        delBtn.style('border', 'none');
        delBtn.style('border-radius', '4px');
        delBtn.style('cursor', 'pointer');
        delBtn.style('padding', '2px 8px');
        delBtn.style('font-weight', 'bold');
        delBtn.parent(itemRow);

        delBtn.mousePressed(() => {
            timelineData.splice(i, 1);
            updateTimelineList();
        });
    }
}

// 花火大会を再生開始
function startShow() {
    if (timelineData.length === 0) return;

    activeShowQueue = JSON.parse(JSON.stringify(timelineData));
    isPlayingShow = true;
    showStartTime = millis();
}

function draw() {
    fill(0, 0, 0, 40);
    noStroke();
    rect(300, 0, width - 300, height);

    drawBlueprint();

    let baseWindSpeed = windSlider.value();

    if (isPlayingShow) {
        let elapsedSec = (millis() - showStartTime) / 1000.0;
        statusDiv.html(`<b>【大会プログラム】</b><br><span style="color:#ff6666; font-weight:bold;">▶ 再生中: ${elapsedSec.toFixed(1)} 秒</span>`);

        for (let i = activeShowQueue.length - 1; i >= 0; i--) {
            let ev = activeShowQueue[i];
            if (elapsedSec >= ev.time) {
                fireworks.push(new Firework(ev.x, ev.config));
                activeShowQueue.splice(i, 1);
            }
        }

        if (activeShowQueue.length === 0 && fireworks.length === 0) {
            isPlayingShow = false;
        }
    } else {
        statusDiv.html(`<b>【大会プログラム】</b><br><span style="color:#aaa;">■ 停止中</span>`);
    }

    for (let i = fireworks.length - 1; i >= 0; i--) {
        fireworks[i].update(baseWindSpeed);
        fireworks[i].show();
        if (fireworks[i].done()) {
            fireworks.splice(i, 1);
        }
    }
}

function launchTest() {
    let skyWidth_px = 700;
    let launchX_m = (skyWidth_px / 2) / PPM;
    fireworks.push(new Firework(launchX_m, getCurrentConfig()));
}

function mousePressed() {
    if (mouseX > 300 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
        let relativeX_px = mouseX - 300;
        let launchX_m = relativeX_px / PPM;
        fireworks.push(new Firework(launchX_m, getCurrentConfig()));
    }
}

// ----------------------------------------------------
// 計算ロジック・描画関連
// ----------------------------------------------------

function getColorFromName(val) {
    if (val === 'ストロンチウム (赤)') return color(0, 255, 255);             // 赤
    if (val === 'カルシウム (橙・オレンジ)') return color(21, 255, 255);       // 橙（色相18）
    if (val === 'ナトリウム (黄・金)') return color(42, 255, 255);            // 黄・金（色相38）
    if (val === 'バリウム (緑)') return color(120, 255, 255);                 // 緑
    if (val === '銅 (青)') return color(240, 255, 255);                       // 青
    if (val === '紫 (銅＋ストロンチウム)') return color(280, 255, 255);         // 紫
    if (val === 'マグネシウム・アルミニウム (白・銀)') return color(0, 0, 255); // 白・銀
    return color(0, 0, 255); // デフォルト（白）
}

function getTargetRadius(size) {
    if (size <= 3) return 60;
    if (size === 4) return 72.5;
    if (size === 5) return 85;
    if (size === 10) return 160;
    return map(size, 5, 10, 85, 160);
}

function calculateAutoBurstForce() {
    let sSize = shellSizeSlider.value();
    let numLayers = parseInt(layerSelect.value());
    let targetRadius = getTargetRadius(sSize);
    let baseForce = targetRadius * 0.75;
    let layerMultiplier = 1.0 + ((numLayers - 1) * 0.15);
    return baseForce * layerMultiplier;
}

function drawBlueprint() {
    fill(20);
    noStroke();
    rect(0, 0, 300, height);

    fill(255);
    textSize(18);
    textAlign(CENTER);
    text("花火玉 断面設計図", 150, 40);

    let cx = 150;
    let cy = 300;

    let sSize = shellSizeSlider.value();
    let shellR = map(sSize, 3, 10, 60, 130);

    stroke(150, 100, 50);
    strokeWeight(4);
    fill(30);
    circle(cx, cy, shellR * 2);

    let autoBurstForce = calculateAutoBurstForce();
    let burstR = map(autoBurstForce, 40, 150, shellR * 0.3, shellR * 0.75);
    burstR = min(burstR, shellR * 0.85);

    noStroke();
    fill(100);
    circle(cx, cy, burstR * 2);

    let starTotalR_mm = starSizeSlider.value() / 2;
    let visualScale = 3.0;
    let visualStarR = starTotalR_mm * visualScale;

    let numStars = int(map(sSize, 3, 10, 12, 36));
    let arrangeR = burstR + (shellR - burstR) / 2;
    let numLayers = parseInt(layerSelect.value());

    for (let i = 0; i < numStars; i++) {
        let angle = map(i, 0, numStars, 0, TWO_PI);
        let sx = cx + cos(angle) * arrangeR;
        let sy = cy + sin(angle) * arrangeR;

        for (let l = 0; l < numLayers; l++) {
            let layerR = visualStarR * ((numLayers - l) / numLayers);
            let layerColor = getColorFromName(colorSelects[l].value());
            fill(layerColor);
            circle(sx, sy, layerR * 2);
        }
    }

    fill(200);
    textSize(14);
    textAlign(LEFT);
    let ty = 480;
    text(`号数: ${sSize}号`, 20, ty); ty += 25;
    text(`星の直径: ${starSizeSlider.value()} mm`, 20, ty); ty += 25;
    text(`星の構造: ${numLayers}層`, 20, ty); ty += 25;

    fill(100, 255, 150);
    let targetR = getTargetRadius(sSize);
    text(`目標開花半径: 約 ${int(targetR)} m`, 20, ty); ty += 25;

    fill(255, 200, 0);
    text(`割薬初速(自動計算): ${int(autoBurstForce)} m/s`, 20, ty); ty += 25;

    fill(200);
    text(`バインダー: ${binderSlider.value()} %`, 20, ty); ty += 25;
    text(`地上風速: ${windSlider.value()} m/s`, 20, ty); ty += 25;

    fill(100, 200, 255);
    text(`表示限界高度: 約 ${int(MAX_ALTITUDE_M)} m`, 20, ty + 10);
}

class Firework {
    constructor(launchX_m, config) {
        this.config = config;

        let shellMass = map(this.config.sSize, 3, 10, 0.2, 1.5);
        let launchVel = map(this.config.sSize, 3, 10, 50, 82);

        this.shell = new Particle(launchX_m, 0, 0, [], true, shellMass, 0.1);
        this.shell.vel = createVector(0, launchVel, 0);

        this.exploded = false;
        this.particles = [];
    }

    done() {
        return this.exploded && this.particles.length === 0;
    }

    update(baseWindSpeed) {
        if (!this.exploded) {
            this.shell.update(baseWindSpeed);
            if (this.shell.vel.y <= 0) {
                this.exploded = true;
                this.explode();
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(baseWindSpeed);
            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }
    }

    explode() {
        let numStars = int(map(this.config.sSize, 3, 10, 80, 400));
        let r_m = this.config.starDia_m / 2;
        let starMass = POWDER_DENSITY * (4.0 / 3.0) * PI * r_m * r_m * r_m;

        for (let i = 0; i < numStars; i++) {
            let variance = random(1.0 - this.config.binderVariance, 1.0 + this.config.binderVariance);

            let p = new Particle(this.shell.pos.x, this.shell.pos.y, this.shell.pos.z, this.config.activeColors, false, starMass, this.config.starDia_m, variance);

            let speed = this.config.burstForce * random(0.8, 1.2);
            p.vel = p5.Vector.random3D();
            p.vel.mult(speed);

            p.vel.x += this.shell.vel.x;
            p.vel.y += this.shell.vel.y;
            p.vel.z += this.shell.vel.z;

            this.particles.push(p);
        }
    }

    show() {
        if (!this.exploded) this.shell.show();
        for (let i = 0; i < this.particles.length; i++) this.particles[i].show();
    }
}

class Particle {
    constructor(x, y, z, colorNamesArray, isShell, initialMass, initialDiameter, variance = 1.0) {
        this.pos = createVector(x, y, z);
        this.vel = createVector(0, 0, 0);
        this.acc = createVector(0, 0, 0);

        this.isShell = isShell;
        this.initialDiameter = initialDiameter;
        this.diameter = initialDiameter;
        this.mass = initialMass;

        if (!this.isShell) {
            this.layerColors = [];
            for (let name of colorNamesArray) {
                this.layerColors.push(getColorFromName(name));
            }
            this.numLayers = this.layerColors.length;

            let baseBurnTime = map(initialDiameter * 1000, 5, 25, 1.0, 3.5);
            this.totalBurnTime = baseBurnTime * variance;
            this.age = 0;

            this.titaniumLayers = [];
            for (let i = 0; i < this.numLayers; i++) {
                if (colorNamesArray[i] && colorNamesArray[i] === 'マグネシウム・アルミニウム (白・銀)') {
                    this.titaniumLayers.push(i);
                }
            }
        }
    }

    applyForce(force) {
        let f = p5.Vector.div(force, this.mass);
        this.acc.add(f);
    }

    update(baseWindSpeed) {
        let currentAltitude = max(this.pos.y, 1.0);
        let alpha = 0.14;
        let altitudeMultiplier = pow(currentAltitude / 10.0, alpha);

        let noiseVal = noise(this.pos.x * 0.02, this.pos.y * 0.02, frameCount * 0.01);
        let gustMultiplier = map(noiseVal, 0, 1, 0.5, 1.5);

        let realWindSpeed = baseWindSpeed * altitudeMultiplier * gustMultiplier;
        let realWind = createVector(realWindSpeed, 0, 0);

        let v_rel = p5.Vector.sub(this.vel, realWind);
        let speed = v_rel.mag();
        let area = PI * (this.diameter / 2) * (this.diameter / 2);
        let dragMag = 0.5 * RHO * speed * speed * Cd_SPHERE * area;
        let dragForce = v_rel.copy().normalize().mult(-dragMag);
        this.applyForce(dragForce);

        let gravityForce = createVector(0, -G * this.mass, 0);
        this.applyForce(gravityForce);

        this.vel.add(p5.Vector.mult(this.acc, dt));
        this.pos.add(p5.Vector.mult(this.vel, dt));
        this.acc.mult(0);

        if (!this.isShell) {
            this.age += dt;
            let burnProgress = this.age / this.totalBurnTime;
            if (burnProgress > 1.0) burnProgress = 1.0;

            this.diameter = this.initialDiameter * (1.0 - burnProgress);
            let r = this.diameter / 2;
            this.mass = POWDER_DENSITY * (4.0 / 3.0) * PI * r * r * r;
            if (this.mass < 0.00001) this.mass = 0.00001;
        }
    }

    show() {
        let px = 300 + (this.pos.x * PPM);
        let py = height - this.pos.y * PPM;

        if (this.isShell) {
            let alpha = 255;
            let fadeThreshold = 12.0;

            if (this.vel.y < fadeThreshold) {
                alpha = map(this.vel.y, 0, fadeThreshold, 0, 255);
                alpha = constrain(alpha, 0, 255);
            }

            strokeWeight(3);
            stroke(40, 255, 255, alpha);
            point(px, py);
        } else {
            let burnProgress = this.age / this.totalBurnTime;
            let lifeRatio = 1.0 - burnProgress;

            let currentLayerIndex = floor(burnProgress * this.numLayers);
            currentLayerIndex = constrain(currentLayerIndex, 0, this.numLayers - 1);

            let currentColor = this.layerColors[currentLayerIndex];

            if (this.titaniumLayers.includes(currentLayerIndex)) {
                if (random(1) < 0.3) stroke(0, 0, 255);
                else stroke(0, 0, 150);
            }

            let depthScale = map(this.pos.z, -100, 100, 0.7, 1.3);
            depthScale = constrain(depthScale, 0.5, 1.5);

            let baseRenderSize = map(this.diameter, 0, this.initialDiameter, 1, 5);
            strokeWeight(baseRenderSize * depthScale);

            let alpha = lifeRatio < 0.1 ? map(lifeRatio, 0, 0.1, 0, 255) : 255;
            let h = hue(currentColor);
            let s = saturation(currentColor);
            let b = brightness(currentColor);

            if (!this.titaniumLayers.includes(currentLayerIndex)) {
                stroke(h, s, b, alpha);
            }

            point(px, py);
        }
    }

    isDead() {
        if (this.isShell) return false;
        return this.age >= this.totalBurnTime;
    }
}