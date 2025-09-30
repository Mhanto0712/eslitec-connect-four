import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// === 全域變數 ===
let scene,
  camera,
  controls,
  renderer,
  composer,
  directionalLight,
  raycaster,
  mouse;
let initWinRatioForCam = 1440 / 900;
let gameOver = false;
let isAnimating = false;
let isDragging = false;
let isComputer = false;
let mouseDownPos = { x: 0, y: 0 };
let previewPiece = null; // 預覽棋子
let previewPlace = null; // 預覽棋子的位置
let uncheckedPiece = null; // 尚未確認的棋
let uncheckedPlace = null; // 尚未確認的棋的位置
let borderGroup; // 棋盤群組
let wireframeGroup; // 棋框群組
let planeGroup; // 棋底群組
let pieceGroup; // 棋子群組
let gridNum = 4; // 初始棋盤為4x4
let borderSize; // 棋盤邊框大小
let gameBoard = initGameBoard(gridNum);
let winningLines = generateWinningLines(gridNum);
let cellToLines = buildCellToLinesMap(winningLines);
let controlsView = ['初始視角', '側視角一', '側視角二', '側視角三', '頂部視角'];
let currentViewIdx = 0; // 追蹤目前的視角 index
let player = '玩家1';
let opponent = '玩家2';
let offensive = '玩家1';
let whosePlaying = ['玩家1', '玩家2'];
let gameMode = 'easy';
let settingWhose = ['與玩家對戰', '與電腦對戰（先手）', '與電腦對戰（後手）'];
let settingGrid = ['4 x 4', '6 x 6', '8 x 8'];
let settingMode = ['簡單模式', '困難模式'];
let settingWhoseIdx = 0;
let settingGridIdx = 0;
let settingModeIdx = 0;

const SPACING = 0.2;
const DRAG_THRESHOLD = 5; // 判斷拖曳的距離（像素）
const RESET_BTN = document.getElementById('resetBtn');
const LOCKVIEW_BTN = document.getElementById('lockViewBtn');
const SETTING = document.getElementById('setting');
const WHOSE_BTN = document.getElementById('whoseBtn');
const WHOSE_LEFT = document.getElementById('whoseLeft');
const WHOSE_RIGHT = document.getElementById('whoseRight');
const GRID_BTN = document.getElementById('gridBtn');
const GRID_LEFT = document.getElementById('gridLeft');
const GRID_RIGHT = document.getElementById('gridRight');
const MODE_BTN = document.getElementById('modeBtn');
const MODE_LEFT = document.getElementById('modeLeft');
const MODE_RIGHT = document.getElementById('modeRight');
const OK_BTN = document.getElementById('okBtn');
const CANCEL_BTN = document.getElementById('cancelBtn');
const CONTROLS_BTN = document.getElementById('controlsBtn');
const CONFIRM_BTN = document.getElementById('confirmBtn');

// RWD
function resizeRenderer() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const winRatio = winW / winH;
  const camPosRatio = 1 / (winRatio / initWinRatioForCam);

  // 更新 renderer, composer
  renderer.setSize(winW, winH);
  renderer.setPixelRatio(window.devicePixelRatio);
  composer.setSize(winW, winH);

  // 更新相機
  camera.aspect = winW / winH;
  currentViewIdx = 0;
  CONTROLS_BTN.innerHTML = controlsView[currentViewIdx];
  updateCameraByView();
  camera.updateProjectionMatrix();
}

// === 初始化 3D ===
function init() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  // 建立場景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x001122);

  // 建立攝影機
  borderSize = gridNum * 1.8 + SPACING * (gridNum - 1) + 1.2;
  camera = new THREE.PerspectiveCamera(75, winW / winH, 0.1, 1000);
  camera.position.set(borderSize, gridNum - 0.05, borderSize);
  // 開啟兩層渲染 (普通 0, 勝利 1)
  camera.layers.enable(0);
  camera.layers.enable(1);

  // 建立渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(winW, winH);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 後製器效果
  composer = new EffectComposer(renderer);
  // 先正常渲染場景
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // Bloom 特效
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(winW, winH),
    1, // 強度
    0.4, // 半徑
    0.85 // 閾值
  );
  composer.addPass(bloomPass);

  // RWD並渲染
  resizeRenderer();
  document.body.appendChild(renderer.domElement);

  // 滑鼠和射線檢測
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // 建立光源
  createLights();

  // 建立棋盤
  createBoard();

  // 初始化遊戲狀態
  initGameBoard();

  // 簡單的軌道控制
  setupControls();

  // 事件監聽
  window.addEventListener('resize', resizeRenderer);
  CONFIRM_BTN.addEventListener('click', placeRealPiece);
  renderer.domElement.addEventListener('mousedown', (event) => {
    isDragging = false;
    mouseDownPos = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('mousemove', (event) => {
    // 只要超過閾值就當作拖曳
    const dx = Math.abs(event.clientX - mouseDownPos.x);
    const dy = Math.abs(event.clientY - mouseDownPos.y);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      isDragging = true;
    }

    if (!isComputer && !isAnimating) onPreview(event);
  });
  renderer.domElement.addEventListener('mouseup', () => {
    if (!isComputer && !isDragging && !isAnimating) placeUncheckedPiece();
    isDragging = false;
  });

  // 視角監聽
  changeViewEvent();
  lockViewEvent();

  // setting監聽
  RESET_BTN.addEventListener('click', () => {
    SETTING.style.display = 'flex';
  });
  selectLR(WHOSE_BTN, WHOSE_LEFT, WHOSE_RIGHT, settingWhoseIdx, settingWhose);
  selectLR(GRID_BTN, GRID_LEFT, GRID_RIGHT, settingGridIdx, settingGrid);
  selectLR(MODE_BTN, MODE_LEFT, MODE_RIGHT, settingModeIdx, settingMode);
  OK_BTN.addEventListener('click', () => {
    // 更改對手
    switch (settingWhoseIdx) {
      case 0:
        whosePlaying = ['玩家1', '玩家2'];
        break;
      case 1:
        whosePlaying = ['玩家', '電腦'];
        break;
      case 2:
        whosePlaying = ['電腦', '玩家'];
        break;
    }
    // 更改棋盤
    switch (settingGridIdx) {
      case 0:
        gridNum = 4;
        break;
      case 1:
        gridNum = 6;
        break;
      case 2:
        gridNum = 8;
        break;
    }
    // 更改模式
    switch (settingModeIdx) {
      case 0:
        gameMode = 'easy';
        break;
      case 1:
        gameMode = 'hard';
        break;
    }

    resetGame();
    SETTING.style.display = 'none';
  });
  CANCEL_BTN.addEventListener('click', () => {
    SETTING.style.display = 'none';
  });

  // 開始渲染循環
  renderLoop();
}
function createLights() {
  // 環境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  // 方向光
  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(borderSize, borderSize, borderSize);
  directionalLight.castShadow = false;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);
}
function createBoard() {
  borderGroup = new THREE.Group();
  wireframeGroup = new THREE.Group();
  planeGroup = new THREE.Group();
  pieceGroup = new THREE.Group();
  scene.add(borderGroup);
  scene.add(wireframeGroup);
  scene.add(planeGroup);
  scene.add(pieceGroup);

  borderSize = gridNum * 1.8 + SPACING * (gridNum - 1) + 1.2;

  // 建立4x4底面網格
  for (let x = 0; x < gridNum; x++) {
    for (let z = 0; z < gridNum; z++) {
      // 底面平面
      const planeGeometry = new THREE.PlaneGeometry(1.8, 1.8);
      const planeMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });

      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2; // 水平放置
      plane.position.set(
        -borderSize / 2 + 1.5 + (1.8 + SPACING) * x,
        0.2, // 稍微在地面上方
        -borderSize / 2 + 1.5 + (1.8 + SPACING) * z
      );
      plane.receiveShadow = true;

      // 儲存位置資訊
      plane.positionData = { x, z, y: 0 };
      planeGroup.add(plane);

      // 建立垂直的網格線來顯示可能的高度
      for (let y = 0; y < gridNum; y++) {
        const wireGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffaa,
          transparent: true,
          opacity: 0.1,
          wireframe: true,
        });
        const wireFrame = new THREE.Mesh(wireGeometry, wireMaterial);
        wireFrame.position.set(
          -borderSize / 2 + 1.5 + (1.8 + SPACING) * x,
          (1.8 + SPACING) * y + 1.1,
          -borderSize / 2 + 1.5 + (1.8 + SPACING) * z
        );

        wireFrame.positionData = { x, z, y };
        wireFrame.colorData = 'normal';
        wireframeGroup.add(wireFrame);
      }
    }
  }

  // 建立邊框
  const borderGeometry = new THREE.BoxGeometry(borderSize, 0.2, borderSize);
  const borderMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
  const border = new THREE.Mesh(borderGeometry, borderMaterial);
  border.position.set(0, 0, 0);
  border.receiveShadow = true;
  borderGroup.add(border);
}

// 使用 OrbitControls 來簡化控制
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, gridNum - 0.05, 0);
  controls.enableDamping = true; // 平滑阻尼
  controls.enablePan = true; // 開啟平移
}

function selectLR(domBtn, domLeft, domRight, domIdx, option) {
  const change = (dir) => {
    domIdx = (domIdx + dir + option.length) % option.length;
    domBtn.innerHTML = option[domIdx];

    switch (domBtn) {
      case WHOSE_BTN:
        settingWhoseIdx = domIdx;
        break;
      case GRID_BTN:
        settingGridIdx = domIdx;
        break;
      case MODE_BTN:
        settingModeIdx = domIdx;
        break;
    }
  };

  domLeft.addEventListener('click', () => change(-1));
  domRight.addEventListener('click', () => change(1));
}

// 實際切換視角
function updateCameraByView() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const winRatio = winW / winH;
  const camPosRatio = 1 / (winRatio / initWinRatioForCam);
  const centerY = gridNum - 0.05;

  switch (currentViewIdx) {
    case 0: // 初始視角 (斜 45 度)
      if (winRatio <= 5 / 6) {
        camera.position.set(
          borderSize * camPosRatio * 0.5,
          centerY,
          borderSize * camPosRatio * 0.5
        );
      } else {
        camera.position.set(borderSize, centerY, borderSize);
      }
      break;
    case 1: // 側視角一
      if (winRatio <= 5 / 6) {
        camera.position.set(
          borderSize * camPosRatio * 0.5,
          centerY,
          -borderSize * camPosRatio * 0.5
        );
      } else {
        camera.position.set(borderSize, centerY, -borderSize);
      }
      break;
    case 2: // 側視角二
      if (winRatio <= 5 / 6) {
        camera.position.set(
          -borderSize * camPosRatio * 0.5,
          centerY,
          -borderSize * camPosRatio * 0.5
        );
      } else {
        camera.position.set(-borderSize, centerY, -borderSize);
      }
      break;
    case 3: // 側視角三
      if (winRatio <= 5 / 6) {
        camera.position.set(
          -borderSize * camPosRatio * 0.5,
          centerY,
          borderSize * camPosRatio * 0.5
        );
      } else {
        camera.position.set(-borderSize, centerY, borderSize);
      }
      break;
    case 4: // 頂部視角
      if (winRatio <= 5 / 6) {
        camera.position.set(0, centerY * camPosRatio * 2, 0);
      } else {
        camera.position.set(0, centerY * 4, 0);
      }
      break;
  }

  camera.lookAt(0, centerY, 0);
  if (controls) {
    controls.target.set(0, centerY, 0); // 確保 OrbitControls 一樣鎖定中心
  }
  camera.updateProjectionMatrix();
}

// 切換視角監聽
function changeViewEvent() {
  CONTROLS_BTN.innerHTML = controlsView[currentViewIdx];
  updateCameraByView();

  const change = (dir) => {
    currentViewIdx =
      (currentViewIdx + dir + controlsView.length) % controlsView.length;
    CONTROLS_BTN.innerHTML = controlsView[currentViewIdx];
    updateCameraByView();
  };

  CONTROLS_BTN.addEventListener('click', () => change(1));
}

// 鎖定視角監聽
function lockViewEvent() {
  LOCKVIEW_BTN.addEventListener('click', () => {
    const currentIcon = document.getElementById('lockViewIcon');
    const iconData = currentIcon.getAttribute('data-lucide');

    if (iconData == 'lock-keyhole-open') {
      controls.enabled = false;

      currentIcon.remove();
      LOCKVIEW_BTN.innerHTML =
        '<i id="lockViewIcon" data-lucide="lock-keyhole"></i>';

      CONTROLS_BTN.classList.add('unwork');
      CONTROLS_BTN.style.pointerEvents = 'none';
    } else {
      controls.enabled = true;

      CONTROLS_BTN.classList.remove('unwork');
      CONTROLS_BTN.style.pointerEvents = 'auto';
    }

    lucide.createIcons({ root: LOCKVIEW_BTN });
  });
}

// 棋盤陣列初始化 (3D array)
function initGameBoard(gridNum) {
  return Array.from({ length: gridNum }, () =>
    Array.from({ length: gridNum }, () =>
      Array.from({ length: gridNum }, () => null)
    )
  );
}

// 預先計算所有可能的勝利線
function generateWinningLines(gridNum) {
  const lines = [];
  const dirs = [];

  // 只取必要方向 (正向，避免重複)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dz === 0 && dy === 0) continue; // 排除零向量
        if (dx < 0 || (dx === 0 && dz < 0) || (dx === 0 && dz === 0 && dy < 0))
          continue; // 只取正向
        dirs.push([dx, dz, dy]);
      }
    }
  }

  for (let x = 0; x < gridNum; x++) {
    for (let z = 0; z < gridNum; z++) {
      for (let y = 0; y < gridNum; y++) {
        for (const [dx, dz, dy] of dirs) {
          const line = [];
          for (let i = 0; i < gridNum; i++) {
            const nx = x + dx * i;
            const nz = z + dz * i;
            const ny = y + dy * i;
            if (
              nx < 0 ||
              nx >= gridNum ||
              nz < 0 ||
              nz >= gridNum ||
              ny < 0 ||
              ny >= gridNum
            )
              break;
            line.push([nx, nz, ny]);
          }
          if (line.length === gridNum) lines.push(line);
        }
      }
    }
  }

  return lines;
}

// 建立 cell -> lines 的對應表，加速查詢
function buildCellToLinesMap(winningLines) {
  const map = {};
  winningLines.forEach((line, idx) => {
    line.forEach(([x, z, y]) => {
      const key = `${x},${z},${y}`;
      if (!map[key]) map[key] = [];
      map[key].push(idx);
    });
  });
  return map;
}

// 尋找最低可落子位置
function findLowestEmpty(x, z) {
  for (let y = 0; y < gridNum; y++) {
    if (gameBoard[x][z][y] === null) return y;
  }
  return null;
}

// 根據滑鼠位置預覽棋子下放位置
function onPreview(event) {
  if (gameOver) {
    renderer.domElement.style.cursor = 'default';
    return;
  }

  // 計算滑鼠位置
  mouse.x = event ? (event.clientX / window.innerWidth) * 2 - 1 : mouse.x;
  mouse.y = event ? -(event.clientY / window.innerHeight) * 2 + 1 : mouse.y;

  // 射線檢測底面
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([
    ...planeGroup.children,
    ...pieceGroup.children,
  ]);

  if (intersects.length > 0) {
    const selectedObj = intersects[0].object;
    const { x, z, y } = selectedObj.positionData;

    // 找到該列的最低可用位置
    const previewY = findLowestEmpty(x, z);

    if (previewY !== null) {
      function isSamePlace(a, b) {
        return a.x === b.x && a.y === b.y && a.z === b.z;
      }
      // 更新預覽狀態
      previewPlace = { x, z, y: previewY };
      renderer.domElement.style.cursor = 'pointer';
      if (uncheckedPlace) {
        isSamePlace(previewPlace, uncheckedPlace)
          ? clearPreview()
          : updatePreview();
      } else {
        updatePreview();
      }
    } else {
      renderer.domElement.style.cursor = 'default';
      clearPreview();
    }
  } else {
    renderer.domElement.style.cursor = 'default';
    clearPreview();
  }
}

// 建立預覽或未確認棋子
function createPreOrUnchecked() {
  const geometry = new THREE.SphereGeometry(0.8, 16, 16);
  const material = new THREE.MeshPhongMaterial({
    color: player === offensive ? 0xffffff : 0x000000,
    transparent: true,
    opacity: player === offensive ? 0.6 : 0.9,
  });

  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    -borderSize / 2 + 1.5 + (1.8 + SPACING) * previewPlace.x,
    (1.8 + SPACING) * previewPlace.y + 1.1,
    -borderSize / 2 + 1.5 + (1.8 + SPACING) * previewPlace.z
  );

  scene.add(mesh);

  return mesh;
}

// 更新預覽
function updatePreview() {
  // 移除舊的預覽
  clearPreview();

  // 創建新的預覽
  previewPiece = createPreOrUnchecked();

  // 更新UI
  document.getElementById('previewInfo').innerHTML = `預覽位置: (${
    previewPlace.x + 1
  }, ${previewPlace.z + 1}) 第${previewPlace.y + 1}層`;
}

// 清除預覽
function clearPreview() {
  if (previewPiece) {
    scene.remove(previewPiece);
    previewPiece.geometry.dispose();
    previewPiece.material.dispose();
    previewPiece = null;
  }
  document.getElementById('previewInfo').innerHTML = '預覽位置: 無';
}

// 掉落動畫，回傳 Promise
function animateDrop(piece, startY, endY) {
  return new Promise((resolve) => {
    isAnimating = true;

    const startTime = Date.now();
    const realTimeRatio = 250; // Date.now與實際時間的比例
    const bounceHeight = 0.3; // 彈跳高度
    const bounceDuration = 200; // 彈跳時間 0.2 秒

    function fall() {
      const progress = (Date.now() - startTime) / realTimeRatio;
      piece.position.y = startY - 0.5 * 9.8 * Math.pow(progress, 2);

      if (piece.position.y > endY) {
        requestAnimationFrame(fall);
      } else {
        piece.position.y = endY;
        bounce();
      }
    }

    function bounce() {
      const bounceStart = Date.now();

      function updateBounce() {
        const elapsed = Date.now() - bounceStart;
        const progress = Math.min(elapsed / bounceDuration, 1);

        piece.position.y =
          endY + Math.sin(progress * Math.PI) * bounceHeight * (1 - progress);

        if (progress < 1) {
          requestAnimationFrame(updateBounce);
        } else {
          piece.position.y = endY;
          isAnimating = false;
          resolve();
        }
      }

      updateBounce();
    }

    fall();
  });
}

// 清除未確認落子
function clearUnchecked(allClean) {
  if (uncheckedPiece) {
    scene.remove(uncheckedPiece);
    uncheckedPiece.geometry.dispose();
    uncheckedPiece.material.dispose();
    uncheckedPiece = null;
  }
  if (allClean) {
    uncheckedPlace = null;
  }
}

// 未確認落子流程
async function placeUncheckedPiece() {
  if (gameOver || !previewPiece) return;

  const { x, z, y } = previewPlace;
  uncheckedPlace = { x, z, y };

  clearPreview();
  clearUnchecked(false);

  // 更新未確認棋子
  uncheckedPiece = createPreOrUnchecked();

  // 掉落動畫
  const startY = gridNum * (1.8 + SPACING) + 1.1;
  const endY = (1.8 + SPACING) * uncheckedPlace.y + 1.1;
  await animateDrop(uncheckedPiece, startY, endY);

  // 啟用確認按鈕
  CONFIRM_BTN.classList.remove('unwork');
  CONFIRM_BTN.disabled = false;

  // 即使滑鼠當下沒動也即時更新
  onPreview();
}

// 真正落子流程
async function placeRealPiece() {
  if (
    gameOver ||
    (!isComputer && !uncheckedPiece) ||
    (!isComputer && CONFIRM_BTN.disabled)
  )
    return;

  clearUnchecked(false);

  // 點擊之後，按鈕恢復不可用
  CONFIRM_BTN.classList.add('unwork');
  CONFIRM_BTN.disabled = true;

  const { x, z, y } = uncheckedPlace;
  gameBoard[x][z][y] = player;

  resetLastMoveColor();

  // 建立棋子
  const geometry = new THREE.SphereGeometry(0.8, 16, 16);
  const material = new THREE.MeshPhongMaterial({
    color: player === offensive ? 0xffffff : 0x000000,
    transparent: true,
  });

  const piece = new THREE.Mesh(geometry, material);
  const startY = gridNum * (1.8 + SPACING) + 1.1;
  const endY = (1.8 + SPACING) * uncheckedPlace.y + 1.1;
  piece.castShadow = true;
  piece.receiveShadow = true;
  piece.position.set(
    -borderSize / 2 + 1.5 + (1.8 + SPACING) * uncheckedPlace.x,
    startY,
    -borderSize / 2 + 1.5 + (1.8 + SPACING) * uncheckedPlace.z
  );
  piece.playerData = player;
  piece.positionData = { x, z, y };

  pieceGroup.add(piece);

  // 掉落動畫
  await animateDrop(piece, startY, endY);

  // 刪掉對應位置的 wireframe
  const wireframeTarget = wireframeGroup.children.find((w) => {
    const { x: wx, z: wz, y: wy } = w.positionData;
    return wx == x && wz == z && wy == y;
  });
  wireframeGroup.remove(wireframeTarget);
  wireframeTarget.geometry.dispose();
  wireframeTarget.material.dispose();

  // 動畫完成後檢查勝利
  const winLine = checkWin([x, z, y]);
  if (winLine) {
    gameOver = true;
    isComputer = false;
    document.getElementById('gameStatus').innerHTML = `🎉 ${player} (${
      player === offensive ? '白方' : '黑方'
    }) 獲勝！`;
    celebrateWin(winLine);
  } else if (isBoardFull()) {
    gameOver = true;
    isComputer = false;
    document.getElementById('gameStatus').innerHTML = '🤝 平局！棋盤已滿';
  } else {
    // 切換玩家
    player = player == whosePlaying[0] ? whosePlaying[1] : whosePlaying[0];
    opponent = opponent == whosePlaying[0] ? whosePlaying[1] : whosePlaying[0];
    if (player != '電腦' && gameMode == 'easy') {
      showLastMoveColor();
    }
    updateHUD();
  }

  // 即使滑鼠當下沒動也即時更新
  if (player == '電腦') {
    isComputer = true;
    computerMove();
  } else {
    isComputer = false;
    onPreview();
  }
}

// 更新回合介面
function updateHUD() {
  document.getElementById('currentPlayer').innerHTML = `${player} (${
    player === offensive ? '白方' : '黑方'
  }) 的回合`;

  if (!gameOver) {
    document.getElementById('gameStatus').innerHTML =
      '將滑鼠移到底面網格上預覽位置';
  }
}

function updateRule() {
  document.getElementById(
    'instructions'
  ).innerHTML = `<strong>遊戲規則:</strong><br />
      • ${gridNum}x${gridNum} 底面，最高${gridNum}層<br />
      • 棋子會掉落到最低可用位置<br />
      • 連成${gridNum}子獲勝（任何方向）<br />
      • 點擊底面網格或棋子本身來投放棋子<br />
      • 滑鼠拖拽旋轉視角`;
}

// 找出玩家只差一顆就能完成的落子位置
function findAlmostWinningMoves(targetPlayer) {
  const moves = [];

  for (const line of winningLines) {
    // 取得該線上每個格子的值
    const values = line.map(([x, z, y]) => gameBoard[x][z][y]);

    // 計算該玩家的棋子數量與空格數
    const playerCount = values.filter((v) => v === targetPlayer).length;
    const emptyCount = values.filter((v) => v === null).length;

    if (playerCount === gridNum - 1 && emptyCount === 1) {
      // 找到唯一空格索引
      const emptyIdx = values.findIndex((v) => v === null);
      const [x, z, y] = line[emptyIdx];

      // 確保是最低可落子
      if (findLowestEmpty(x, z) === y) {
        moves.push([x, z, y]);
      }
    }
  }

  return moves;
}

// 回傳雙方差一顆就贏的位置
function returnLastMove() {
  const result = {
    player: findAlmostWinningMoves(player),
    opponent: findAlmostWinningMoves(opponent),
  };

  return result;
}

// 凸顯雙方差一顆就贏的位置
function showLastMoveColor() {
  const result = returnLastMove();
  const playerLastMove = result.player;
  const opponentLastMove = result.opponent;

  // 更改對應位置 wireframe 的顏色
  // 勝利顏色
  if (playerLastMove.length > 0) {
    for (let i = 0; i < playerLastMove.length; i++) {
      const wireframeTarget = wireframeGroup.children.find((w) => {
        const playerLastMoveTarget = playerLastMove[i];
        const { x: wx, z: wz, y: wy } = w.positionData;
        return (
          wx == playerLastMoveTarget[0] &&
          wz == playerLastMoveTarget[1] &&
          wy == playerLastMoveTarget[2]
        );
      });
      wireframeTarget.material.color.setHex('0xFFFF00');
      wireframeTarget.material.opacity = 1;
      wireframeTarget.colorData = 'winning';
    }
  }

  // 危險顏色
  if (opponentLastMove.length > 0) {
    for (let i = 0; i < opponentLastMove.length; i++) {
      const wireframeTarget = wireframeGroup.children.find((w) => {
        const opponentLastMoveTarget = opponentLastMove[i];
        const { x: wx, z: wz, y: wy } = w.positionData;
        return (
          wx == opponentLastMoveTarget[0] &&
          wz == opponentLastMoveTarget[1] &&
          wy == opponentLastMoveTarget[2]
        );
      });
      wireframeTarget.material.color.setHex('0xFF00000');
      wireframeTarget.material.opacity = 1;
      wireframeTarget.colorData = 'danger';
    }
  }
}

function resetLastMoveColor() {
  wireframeGroup.children.forEach((w) => {
    w.material.color.setHex('0x00ffaa');
    w.material.opacity = 0.1;
    w.colorData = 'normal';
  });
}

// 確認是否還有空位落子
function isBoardFull() {
  for (let x = 0; x < gridNum; x++) {
    for (let z = 0; z < gridNum; z++) {
      if (gameBoard[x][z][gridNum - 1] === null) {
        return false;
      }
    }
  }
  return true;
}

// 檢查是否勝利
function checkWin(cell) {
  const key = `${cell[0]},${cell[1]},${cell[2]}`;

  const relatedLines = cellToLines[key];

  for (const lineIdx of relatedLines) {
    const line = winningLines[lineIdx];

    if (line.every(([x, z, y]) => gameBoard[x][z][y] === player)) {
      return line;
    }
  }
  return false;
}

// 勝利動畫
function celebrateWin(winLine) {
  pieceGroup.children.forEach((piece, index) => {
    const piecePlayer = piece.playerData;
    const { x: pieceX, z: pieceZ, y: pieceY } = piece.positionData;
    // 如果在 winLine 中
    const isWinPiece = winLine.some(
      ([x, z, y]) => x === pieceX && z === pieceZ && y === pieceY
    );

    if (piecePlayer != player) {
      // 對手棋子變透明
      piece.material.opacity = piecePlayer == offensive ? 0.1 : 0.7;
    } else if (isWinPiece) {
      // 勝利棋子：加 emissive + bloom layer並進入 layer 1
      if (player == offensive) {
        piece.material.emissive.setHex(0xffffff);
        piece.material.emissiveIntensity = 1;
      } else {
        piece.material.emissive.setHex(0x2894ff);
        piece.material.emissiveIntensity = 5;
      }
      piece.layers.enable(1);
    }

    setTimeout(() => {
      animateAllPiece(piece);
    }, index * 50);
  });
}
function animateAllPiece(piece) {
  const startY = piece.position.y;
  const startTime = Date.now();

  function bounce() {
    if (!gameOver) return;

    const elapsed = Date.now() - startTime;
    const time = elapsed * 0.005;
    piece.position.y = startY + Math.sin(time) * 0.3;
    piece.rotation.y += 0.05;

    requestAnimationFrame(bounce);
  }
  bounce();
}

// 與電腦對戰
function computerMove() {
  let move;

  const winningMoves = returnLastMove();
  const playerLastMove = winningMoves.player;
  const opponentLastMove = winningMoves.opponent;

  if (gameMode == 'easy') {
    // 簡單模式
    if (playerLastMove.length > 0) {
      // 先看自己差一顆的位置
      move = playerLastMove[Math.floor(Math.random() * playerLastMove.length)];
    } else {
      // 隨機空位
      const emptyCells = [];
      for (let x = 0; x < gridNum; x++) {
        for (let z = 0; z < gridNum; z++) {
          const y = findLowestEmpty(x, z);
          if (y !== null) emptyCells.push([x, z, y]);
        }
      }
      move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
  } else if (gameMode == 'hard') {
    // 困難模式
    if (playerLastMove.length > 0) {
      // 1. 先看自己差一顆的位置
      move = playerLastMove[Math.floor(Math.random() * playerLastMove.length)];
    } else {
      // 2. 擋對手差一顆的位置
      if (opponentLastMove.length > 0) {
        move =
          opponentLastMove[Math.floor(Math.random() * opponentLastMove.length)];
      } else {
        // 3. 找最佳空位（最多可用 winning line）
        let bestScore = -1;
        let bestMoves = [];

        for (let x = 0; x < gridNum; x++) {
          for (let z = 0; z < gridNum; z++) {
            const y = findLowestEmpty(x, z);
            if (y === null) continue;

            const key = `${x},${z},${y}`;
            const lines = cellToLines[key] || [];
            let score = 0;

            for (const lineIdx of lines) {
              const line = winningLines[lineIdx];
              if (
                line.some(([lx, lz, ly]) => gameBoard[lx][lz][ly] === opponent)
              )
                continue;
              const myCount = line.filter(
                ([lx, lz, ly]) => gameBoard[lx][lz][ly] === player
              ).length;
              score += myCount + 1;
            }

            if (score > bestScore) {
              bestScore = score;
              bestMoves = [[x, z, y]];
            } else if (score === bestScore) {
              bestMoves.push([x, z, y]);
            }
          }
        }

        if (bestMoves.length > 0) {
          move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        }
      }
    }
  }

  // 將 move 放入 placeRealPiece 流程
  uncheckedPlace = { x: move[0], z: move[1], y: move[2] };
  setTimeout(placeRealPiece, 300);
}

function resetGame() {
  // 移除舊群組
  scene.remove(borderGroup, wireframeGroup, planeGroup, pieceGroup);

  // 清除舊物件
  borderGroup.children.forEach((obj) => disposeObj(obj));
  wireframeGroup.children.forEach((obj) => disposeObj(obj));
  planeGroup.children.forEach((obj) => disposeObj(obj));
  pieceGroup.children.forEach((obj) => disposeObj(obj));
  if (previewPiece) {
    scene.remove(previewPiece);
    previewPiece.geometry.dispose();
    previewPiece.material.dispose();
  }
  if (uncheckedPiece) {
    scene.remove(uncheckedPiece);
    uncheckedPiece.geometry.dispose();
    uncheckedPiece.material.dispose();
  }

  function disposeObj(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  }

  // 更新棋盤大小
  borderSize = gridNum * 1.8 + SPACING * (gridNum - 1) + 1.2;

  // 重新建立棋盤
  createBoard();

  // 重新生成遊戲狀態
  gameBoard = initGameBoard(gridNum);
  winningLines = generateWinningLines(gridNum);
  cellToLines = buildCellToLinesMap(winningLines);

  // 重置遊戲狀態
  gameOver = false;
  player = whosePlaying[0];
  offensive = whosePlaying[0];
  previewPiece = null;
  previewPlace = null;
  uncheckedPiece = null;
  uncheckedPlace = null;
  updateHUD();
  updateRule();

  // 調整燈光
  directionalLight.position.set(borderSize, borderSize, borderSize);

  // 攝影機回到初始視角
  currentViewIdx = 0;
  updateCameraByView();

  // 開始遊戲
  if (player == '電腦') {
    isComputer = true;
    computerMove();
  }
}

function renderLoop() {
  requestAnimationFrame(renderLoop);

  const time = Date.now() * 0.001;

  // 呼吸效果
  planeGroup.children.forEach((plane, index) => {
    const brightness = 0.7 + Math.sin(time + index * 0.2) * 0.2;
    plane.material.opacity = brightness;
  });

  // 預覽棋子漂浮
  function floating(piece) {
    piece.position.y += Math.sin(time * 3) * 0.005;
    piece.rotation.y = time * 0.5;
  }

  if (!isComputer) {
    if (previewPiece) {
      floating(previewPiece);
    }
    if (uncheckedPiece) {
      floating(uncheckedPiece);
    }
  }

  controls.update();

  composer.render();
}

// 啟動遊戲
init();
