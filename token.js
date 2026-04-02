(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const canvas = $('tokenCanvas');
  if (!canvas) {
    console.error('Canvas introuvable.');
    return;
  }
  const ctx = canvas.getContext('2d');

  const ui = {
    shapeSelect: $('shapeSelect'),
    colorPicker: $('colorPicker'),
    lineWidth: $('lineWidth'),
    lineWidthValue: $('lineWidthValue'),
    textInput: $('textInput'),
    addText: $('addText'),
    imageUpload: $('imageUpload'),
    imageScale: $('imageScale'),
    imageScaleValue: $('imageScaleValue'),
    bringImageFront: $('bringImageFront'),
    sendImageBack: $('sendImageBack'),
    removeImage: $('removeImage'),
    clearCanvas: $('clearCanvas'),
    saveLocal: $('saveLocal'),
    loadLocal: $('loadLocal'),
    importJSON: $('importJSON'),
    exportJSON: $('exportJSON'),
    exportPNG: $('exportPNG'),
    undoBtn: $('undoBtn'),
    redoBtn: $('redoBtn'),
    undoBtnMobile: $('undoBtnMobile'),
    redoBtnMobile: $('redoBtnMobile'),
    mode2dBtn: $('mode2dBtn'),
    mode3dBtn: $('mode3dBtn'),
    editor2d: $('editor2d'),
    editor3d: $('editor3d'),
    primitiveSelect: $('primitiveSelect'),
    meshColor: $('meshColor'),
    addPrimitive: $('addPrimitive'),
    deleteMesh: $('deleteMesh'),
    extrudeDepth: $('extrudeDepth'),
    extrudeDepthValue: $('extrudeDepthValue'),
    bevelSize: $('bevelSize'),
    bevelSizeValue: $('bevelSizeValue'),
    bevelSegments: $('bevelSegments'),
    bevelSegmentsValue: $('bevelSegmentsValue'),
    applyExtrude: $('applyExtrude'),
    scale3d: $('scale3d'),
    scale3dValue: $('scale3dValue'),
    rotateY3d: $('rotateY3d'),
    rotateY3dValue: $('rotateY3dValue'),
    centerMesh: $('centerMesh'),
    reset3dView: $('reset3dView'),
    threeViewport: $('threeViewport')
  };

  const state2D = {
    tool: 'pencil',
    drawing: false,
    startX: 0,
    startY: 0,
    currentStroke: null,
    items: [],
    background: null,
    dragImage: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    history: [],
    future: []
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function make2DSnapshot() {
    return {
      items: deepClone(state2D.items),
      background: deepClone(state2D.background)
    };
  }

  function push2DHistory() {
    state2D.history.push(make2DSnapshot());
    if (state2D.history.length > 100) state2D.history.shift();
    state2D.future = [];
  }

  function restore2D(snapshot) {
    state2D.items = snapshot && Array.isArray(snapshot.items) ? deepClone(snapshot.items) : [];
    state2D.background = snapshot && snapshot.background ? deepClone(snapshot.background) : null;
    syncImageScaleSlider();
    redraw2D();
  }

  function undo2D() {
    if (!state2D.history.length) return;
    state2D.future.push(make2DSnapshot());
    restore2D(state2D.history.pop());
  }

  function redo2D() {
    if (!state2D.future.length) return;
    state2D.history.push(make2DSnapshot());
    restore2D(state2D.future.pop());
  }

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function drawPath(item) {
    const path = item.path || [];
    if (!path.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Number(item.lineWidth) || 1;
    ctx.strokeStyle = item.type === 'eraser' ? '#ffffff' : item.color;
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i += 1) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawItem(item) {
    if (!item) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = item.color || '#000000';
    ctx.fillStyle = item.color || '#000000';
    ctx.lineWidth = Number(item.lineWidth) || 1;

    switch (item.type) {
      case 'pencil':
      case 'eraser':
        drawPath(item);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(item.x, item.y, Math.max(1, item.radius || 0), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'square': {
        const x = item.width < 0 ? item.x + item.width : item.x;
        const y = item.height < 0 ? item.y + item.height : item.y;
        const w = Math.abs(item.width);
        const h = Math.abs(item.height);
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'line':
        ctx.beginPath();
        ctx.moveTo(item.startX, item.startY);
        ctx.lineTo(item.endX, item.endY);
        ctx.stroke();
        break;
      case 'text':
        ctx.font = `${item.size || 28}px Arial`;
        ctx.fillText(item.text || '', item.x || 0, item.y || 0);
        break;
      default:
        break;
    }
    ctx.restore();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function drawBackground() {
    if (!state2D.background || !state2D.background.src) return;
    try {
      const img = await loadImage(state2D.background.src);
      const bg = state2D.background;
      ctx.drawImage(img, bg.x, bg.y, bg.width, bg.height);
    } catch (error) {
      console.error('Impossible de charger l\'image de fond.', error);
    }
  }

  async function redraw2D() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state2D.background && state2D.background.layer === 'back') {
      await drawBackground();
    }

    state2D.items.forEach(drawItem);
    if (state2D.currentStroke) drawItem(state2D.currentStroke);

    if (state2D.background && state2D.background.layer === 'front') {
      await drawBackground();
    }
  }

  function syncLineWidthLabel() {
    if (ui.lineWidth && ui.lineWidthValue) {
      ui.lineWidthValue.textContent = `${ui.lineWidth.value} px`;
    }
  }

  function syncImageScaleSlider() {
    if (!ui.imageScale || !ui.imageScaleValue) return;
    if (!state2D.background || !state2D.background.naturalWidth) {
      ui.imageScale.value = 100;
      ui.imageScaleValue.textContent = '100 %';
      return;
    }
    const ratio = Math.round((state2D.background.width / state2D.background.naturalWidth) * 100);
    const clamped = Math.max(Number(ui.imageScale.min || 10), Math.min(Number(ui.imageScale.max || 250), ratio));
    ui.imageScale.value = clamped;
    ui.imageScaleValue.textContent = `${clamped} %`;
  }

  function pointInBackground(x, y) {
    const bg = state2D.background;
    if (!bg) return false;
    return x >= bg.x && x <= bg.x + bg.width && y >= bg.y && y <= bg.y + bg.height;
  }

  function setActiveMode(mode) {
    const is2D = mode === '2d';
    if (ui.editor2d) ui.editor2d.classList.toggle('active', is2D);
    if (ui.editor3d) ui.editor3d.classList.toggle('active', !is2D);
    if (ui.mode2dBtn) ui.mode2dBtn.classList.toggle('active', is2D);
    if (ui.mode3dBtn) ui.mode3dBtn.classList.toggle('active', !is2D);
    if (!is2D) init3D();
    resize3DRenderer();
  }

  function save2DLocal() {
    localStorage.setItem('tokenEditorEnhancedData', JSON.stringify(make2DSnapshot()));
    alert('Projet 2D sauvegardé dans le navigateur.');
  }

  function load2DLocal() {
    const raw = localStorage.getItem('tokenEditorEnhancedData');
    if (!raw) {
      alert('Aucune sauvegarde locale trouvée.');
      return;
    }
    try {
      push2DHistory();
      restore2D(JSON.parse(raw));
    } catch (error) {
      console.error(error);
      alert('La sauvegarde locale est invalide.');
    }
  }

  function exportJSON2D() {
    const blob = new Blob([JSON.stringify(make2DSnapshot(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projet-2d-pions.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJSON2D() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          push2DHistory();
          restore2D(data);
        } catch (error) {
          console.error(error);
          alert('Le fichier JSON est invalide.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  async function exportPNG2D() {
    await redraw2D();
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'projet-2d-pions.png';
    link.click();
  }

  canvas.addEventListener('mousedown', (event) => {
    const pos = pointerPos(event);
    state2D.tool = ui.shapeSelect ? ui.shapeSelect.value : 'pencil';

    if (state2D.background && pointInBackground(pos.x, pos.y)) {
      state2D.dragImage = true;
      state2D.dragOffsetX = pos.x - state2D.background.x;
      state2D.dragOffsetY = pos.y - state2D.background.y;
      push2DHistory();
      return;
    }

    push2DHistory();
    state2D.drawing = true;
    state2D.startX = pos.x;
    state2D.startY = pos.y;

    if (state2D.tool === 'pencil' || state2D.tool === 'eraser') {
      state2D.currentStroke = {
        type: state2D.tool,
        color: ui.colorPicker ? ui.colorPicker.value : '#000000',
        lineWidth: ui.lineWidth ? Number(ui.lineWidth.value) : 1,
        path: [pos]
      };
      redraw2D();
    }
  });

  canvas.addEventListener('mousemove', (event) => {
    const pos = pointerPos(event);

    if (state2D.dragImage && state2D.background) {
      state2D.background.x = pos.x - state2D.dragOffsetX;
      state2D.background.y = pos.y - state2D.dragOffsetY;
      redraw2D();
      return;
    }

    if (!state2D.drawing) return;

    if (state2D.currentStroke) {
      state2D.currentStroke.path.push(pos);
      redraw2D();
      return;
    }

    const preview = { color: ui.colorPicker ? ui.colorPicker.value : '#000000', lineWidth: ui.lineWidth ? Number(ui.lineWidth.value) : 1 };
    if (state2D.tool === 'circle') {
      state2D.currentStroke = {
        type: 'circle',
        x: state2D.startX,
        y: state2D.startY,
        radius: Math.hypot(pos.x - state2D.startX, pos.y - state2D.startY),
        ...preview
      };
    } else if (state2D.tool === 'square') {
      state2D.currentStroke = {
        type: 'square',
        x: state2D.startX,
        y: state2D.startY,
        width: pos.x - state2D.startX,
        height: pos.y - state2D.startY,
        ...preview
      };
    } else if (state2D.tool === 'line') {
      state2D.currentStroke = {
        type: 'line',
        startX: state2D.startX,
        startY: state2D.startY,
        endX: pos.x,
        endY: pos.y,
        ...preview
      };
    }
    redraw2D();
  });

  window.addEventListener('mouseup', () => {
    if (state2D.dragImage) {
      state2D.dragImage = false;
      redraw2D();
      return;
    }
    if (!state2D.drawing) return;

    state2D.drawing = false;
    if (state2D.currentStroke) {
      state2D.items.push(deepClone(state2D.currentStroke));
      state2D.currentStroke = null;
      redraw2D();
    }
  });

  if (ui.lineWidth) ui.lineWidth.addEventListener('input', syncLineWidthLabel);

  if (ui.imageScale) {
    ui.imageScale.addEventListener('input', () => {
      if (!ui.imageScaleValue) return;
      ui.imageScaleValue.textContent = `${ui.imageScale.value} %`;
      if (!state2D.background || !state2D.background.naturalWidth || !state2D.background.naturalHeight) return;
      push2DHistory();
      const centerX = state2D.background.x + state2D.background.width / 2;
      const centerY = state2D.background.y + state2D.background.height / 2;
      const ratio = Number(ui.imageScale.value) / 100;
      state2D.background.width = state2D.background.naturalWidth * ratio;
      state2D.background.height = state2D.background.naturalHeight * ratio;
      state2D.background.x = centerX - state2D.background.width / 2;
      state2D.background.y = centerY - state2D.background.height / 2;
      redraw2D();
    });
  }

  if (ui.addText) {
    ui.addText.addEventListener('click', () => {
      const value = ui.textInput ? ui.textInput.value.trim() : '';
      if (!value) return;
      push2DHistory();
      state2D.items.push({
        type: 'text',
        text: value,
        x: 60,
        y: 60,
        size: 30,
        color: ui.colorPicker ? ui.colorPicker.value : '#000000',
        lineWidth: 1
      });
      if (ui.textInput) ui.textInput.value = '';
      redraw2D();
    });
  }

  if (ui.imageUpload) {
    ui.imageUpload.addEventListener('change', () => {
      const file = ui.imageUpload.files && ui.imageUpload.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          push2DHistory();
          const maxRatio = Math.min((canvas.width * 0.7) / img.width, (canvas.height * 0.7) / img.height, 1);
          const width = img.width * maxRatio;
          const height = img.height * maxRatio;
          state2D.background = {
            src: reader.result,
            x: (canvas.width - width) / 2,
            y: (canvas.height - height) / 2,
            width,
            height,
            naturalWidth: img.width,
            naturalHeight: img.height,
            layer: 'back'
          };
          syncImageScaleSlider();
          redraw2D();
          ui.imageUpload.value = '';
        };
        img.onerror = () => alert('Impossible de charger cette image.');
        img.src = reader.result;
      };
      reader.onerror = () => alert('Erreur pendant la lecture du fichier image.');
      reader.readAsDataURL(file);
    });
  }

  if (ui.bringImageFront) ui.bringImageFront.addEventListener('click', () => {
    if (!state2D.background) return;
    push2DHistory();
    state2D.background.layer = 'front';
    redraw2D();
  });

  if (ui.sendImageBack) ui.sendImageBack.addEventListener('click', () => {
    if (!state2D.background) return;
    push2DHistory();
    state2D.background.layer = 'back';
    redraw2D();
  });

  if (ui.removeImage) ui.removeImage.addEventListener('click', () => {
    if (!state2D.background) return;
    push2DHistory();
    state2D.background = null;
    syncImageScaleSlider();
    redraw2D();
  });

  if (ui.clearCanvas) ui.clearCanvas.addEventListener('click', () => {
    push2DHistory();
    state2D.items = [];
    state2D.background = null;
    state2D.currentStroke = null;
    syncImageScaleSlider();
    redraw2D();
  });

  if (ui.saveLocal) ui.saveLocal.addEventListener('click', save2DLocal);
  if (ui.loadLocal) ui.loadLocal.addEventListener('click', load2DLocal);
  if (ui.importJSON) ui.importJSON.addEventListener('click', importJSON2D);
  if (ui.exportJSON) ui.exportJSON.addEventListener('click', exportJSON2D);
  if (ui.exportPNG) ui.exportPNG.addEventListener('click', exportPNG2D);
  [ui.undoBtn, ui.undoBtnMobile].forEach((btn) => btn && btn.addEventListener('click', undo2D));
  [ui.redoBtn, ui.redoBtnMobile].forEach((btn) => btn && btn.addEventListener('click', redo2D));
  if (ui.mode2dBtn) ui.mode2dBtn.addEventListener('click', () => setActiveMode('2d'));
  if (ui.mode3dBtn) ui.mode3dBtn.addEventListener('click', () => setActiveMode('3d'));

  // ===== 3D =====
  let threeReady = false;
  let threeLoading = false;
  const threeState = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    ambient: null,
    light: null,
    grid: null,
    floor: null,
    meshes: [],
    selected: null
  };

  function ensure3DStatus(text) {
    if (!ui.threeViewport) return;
    ui.threeViewport.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:640px;color:#e2e8f0;font:600 16px Arial,sans-serif;text-align:center;padding:24px;">${text}</div>`;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Impossible de charger ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.src = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Impossible de charger ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function buildShape2D(kind) {
    const shape = new THREE.Shape();
    if (kind === 'extrudeStar') {
      const outer = 1.2;
      const inner = 0.55;
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      return shape;
    }
    shape.moveTo(-1.4, -0.6);
    shape.quadraticCurveTo(-1.65, 0, -1.4, 0.6);
    shape.lineTo(-0.3, 0.6);
    shape.quadraticCurveTo(0.0, 1.1, 0.6, 1.1);
    shape.quadraticCurveTo(1.25, 1.1, 1.45, 0.45);
    shape.quadraticCurveTo(1.7, 0.3, 1.7, 0);
    shape.quadraticCurveTo(1.7, -0.35, 1.4, -0.55);
    shape.quadraticCurveTo(1.15, -1.1, 0.55, -1.1);
    shape.quadraticCurveTo(-0.05, -1.1, -0.35, -0.6);
    shape.closePath();
    return shape;
  }

  function createGeometry(kind, params) {
    const depth = Number(params.depth || 0.35);
    const bevelSize = Number(params.bevelSize || 0);
    const bevelSegments = Number(params.bevelSegments || 2);
    switch (kind) {
      case 'box':
        return new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
      case 'cylinder':
        return new THREE.CylinderGeometry(1, 1, 2, 48);
      case 'sphere':
        return new THREE.SphereGeometry(1.2, 48, 32);
      case 'token':
        return new THREE.CylinderGeometry(1.5, 1.5, 0.35, 64);
      case 'extrudeStar':
      case 'extrudeBadge':
        return new THREE.ExtrudeGeometry(buildShape2D(kind), {
          depth,
          bevelEnabled: bevelSize > 0,
          bevelSize,
          bevelThickness: Math.max(0.05, bevelSize * 0.7),
          bevelSegments,
          curveSegments: 32
        });
      default:
        return new THREE.BoxGeometry(2, 2, 2);
    }
  }

  function buildMesh(kind, color, params) {
    const geometry = createGeometry(kind, params || {});
    const material = new THREE.MeshStandardMaterial({ color: color || '#3b82f6', metalness: 0.12, roughness: 0.72 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = kind === 'token' ? 0.2 : 1.2;
    if (kind === 'extrudeStar' || kind === 'extrudeBadge') {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.6;
    }
    mesh.userData.shapeType = kind;
    mesh.userData.params = Object.assign({
      depth: Number(ui.extrudeDepth ? ui.extrudeDepth.value : 18) / 25,
      bevelSize: Number(ui.bevelSize ? ui.bevelSize.value : 3) / 25,
      bevelSegments: Number(ui.bevelSegments ? ui.bevelSegments.value : 3)
    }, params || {});
    return mesh;
  }

  function updateSelectedAppearance() {
    threeState.meshes.forEach((mesh) => {
      mesh.material.emissive.setHex(mesh === threeState.selected ? 0x1d4ed8 : 0x000000);
      mesh.material.emissiveIntensity = mesh === threeState.selected ? 0.25 : 0;
    });
    sync3DControls();
  }

  function sync3DControls() {
    const selected = threeState.selected;
    if (!selected) return;
    if (ui.scale3d && ui.scale3dValue) {
      const scaleValue = Math.round(selected.scale.x * 100);
      ui.scale3d.value = scaleValue;
      ui.scale3dValue.textContent = `${scaleValue} %`;
    }
    if (ui.rotateY3d && ui.rotateY3dValue) {
      let deg = Math.round((selected.rotation.y * 180) / Math.PI);
      deg = ((deg % 360) + 360) % 360;
      ui.rotateY3d.value = deg;
      ui.rotateY3dValue.textContent = `${deg}°`;
    }
  }

  function selectMesh(mesh) {
    threeState.selected = mesh || null;
    updateSelectedAppearance();
  }

  function resize3DRenderer() {
    if (!threeReady || !threeState.renderer || !ui.threeViewport) return;
    const width = Math.max(300, ui.threeViewport.clientWidth || 300);
    const height = Math.max(480, ui.threeViewport.clientHeight || 480);
    threeState.renderer.setSize(width, height);
    threeState.camera.aspect = width / height;
    threeState.camera.updateProjectionMatrix();
  }

  async function init3D() {
    if (threeReady || threeLoading || !ui.threeViewport) return;
    threeLoading = true;
    ensure3DStatus('Chargement du mode 3D...');

    try {
      if (!window.THREE) {
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.min.js');
      }
      if (!window.THREE || !window.THREE.OrbitControls) {
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/js/controls/OrbitControls.js');
      }
    } catch (error) {
      console.error(error);
      ensure3DStatus('Le mode 3D n\'a pas pu être chargé. Vérifie la connexion Internet.');
      threeLoading = false;
      return;
    }

    const THREE = window.THREE;
    ui.threeViewport.innerHTML = '';

    threeState.scene = new THREE.Scene();
    threeState.scene.background = new THREE.Color(0x0f172a);
    threeState.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    threeState.camera.position.set(5, 4, 7);

    threeState.renderer = new THREE.WebGLRenderer({ antialias: true });
    threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    ui.threeViewport.appendChild(threeState.renderer.domElement);

    threeState.controls = new THREE.OrbitControls(threeState.camera, threeState.renderer.domElement);
    threeState.controls.enableDamping = true;
    threeState.controls.target.set(0, 1, 0);

    threeState.ambient = new THREE.AmbientLight(0xffffff, 1.3);
    threeState.scene.add(threeState.ambient);

    threeState.light = new THREE.DirectionalLight(0xffffff, 1.8);
    threeState.light.position.set(8, 10, 6);
    threeState.scene.add(threeState.light);

    threeState.grid = new THREE.GridHelper(20, 20, 0x94a3b8, 0x334155);
    threeState.scene.add(threeState.grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.1, roughness: 0.85, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    threeState.floor = floor;
    threeState.scene.add(floor);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    threeState.renderer.domElement.addEventListener('pointerdown', (event) => {
      const rect = threeState.renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, threeState.camera);
      const hits = raycaster.intersectObjects(threeState.meshes, false);
      if (hits.length) selectMesh(hits[0].object);
    });

    function animate() {
      if (!threeReady) return;
      requestAnimationFrame(animate);
      if (threeState.controls) threeState.controls.update();
      if (threeState.renderer && threeState.scene && threeState.camera) {
        threeState.renderer.render(threeState.scene, threeState.camera);
      }
    }

    threeReady = true;
    threeLoading = false;
    resize3DRenderer();
    animate();
  }

  function addPrimitive3D() {
    if (!threeReady) return;
    const kind = ui.primitiveSelect ? ui.primitiveSelect.value : 'box';
    const color = ui.meshColor ? ui.meshColor.value : '#3b82f6';
    const params = {
      depth: Number(ui.extrudeDepth ? ui.extrudeDepth.value : 18) / 25,
      bevelSize: Number(ui.bevelSize ? ui.bevelSize.value : 3) / 25,
      bevelSegments: Number(ui.bevelSegments ? ui.bevelSegments.value : 3)
    };
    const mesh = buildMesh(kind, color, params);
    mesh.position.x = (threeState.meshes.length % 4) * 2.7 - 4;
    threeState.scene.add(mesh);
    threeState.meshes.push(mesh);
    selectMesh(mesh);
  }

  function deleteSelectedMesh() {
    if (!threeReady || !threeState.selected) return;
    const mesh = threeState.selected;
    threeState.scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    threeState.meshes = threeState.meshes.filter((entry) => entry !== mesh);
    selectMesh(null);
  }

  function applyExtrudeToSelected() {
    if (!threeReady || !threeState.selected) return;
    const mesh = threeState.selected;
    const kind = mesh.userData.shapeType;
    if (!(kind === 'extrudeStar' || kind === 'extrudeBadge')) return;

    const params = {
      depth: Number(ui.extrudeDepth ? ui.extrudeDepth.value : 18) / 25,
      bevelSize: Number(ui.bevelSize ? ui.bevelSize.value : 3) / 25,
      bevelSegments: Number(ui.bevelSegments ? ui.bevelSegments.value : 3)
    };

    const newGeometry = createGeometry(kind, params);
    mesh.geometry.dispose();
    mesh.geometry = newGeometry;
    mesh.userData.params = params;
  }

  if (ui.extrudeDepth && ui.extrudeDepthValue) {
    ui.extrudeDepth.addEventListener('input', () => {
      ui.extrudeDepthValue.textContent = ui.extrudeDepth.value;
    });
  }
  if (ui.bevelSize && ui.bevelSizeValue) {
    ui.bevelSize.addEventListener('input', () => {
      ui.bevelSizeValue.textContent = ui.bevelSize.value;
    });
  }
  if (ui.bevelSegments && ui.bevelSegmentsValue) {
    ui.bevelSegments.addEventListener('input', () => {
      ui.bevelSegmentsValue.textContent = ui.bevelSegments.value;
    });
  }
  if (ui.scale3d && ui.scale3dValue) {
    ui.scale3d.addEventListener('input', () => {
      ui.scale3dValue.textContent = `${ui.scale3d.value} %`;
      if (!threeState.selected) return;
      const value = Number(ui.scale3d.value) / 100;
      threeState.selected.scale.set(value, value, value);
    });
  }
  if (ui.rotateY3d && ui.rotateY3dValue) {
    ui.rotateY3d.addEventListener('input', () => {
      ui.rotateY3dValue.textContent = `${ui.rotateY3d.value}°`;
      if (!threeState.selected) return;
      threeState.selected.rotation.y = (Number(ui.rotateY3d.value) * Math.PI) / 180;
    });
  }
  if (ui.addPrimitive) ui.addPrimitive.addEventListener('click', () => { init3D().then(addPrimitive3D); });
  if (ui.deleteMesh) ui.deleteMesh.addEventListener('click', deleteSelectedMesh);
  if (ui.applyExtrude) ui.applyExtrude.addEventListener('click', applyExtrudeToSelected);
  if (ui.centerMesh) ui.centerMesh.addEventListener('click', () => {
    if (!threeState.selected) return;
    threeState.selected.position.set(0, threeState.selected.position.y, 0);
  });
  if (ui.reset3dView) ui.reset3dView.addEventListener('click', () => {
    if (!threeReady) return;
    threeState.camera.position.set(5, 4, 7);
    threeState.controls.target.set(0, 1, 0);
    threeState.controls.update();
  });
  window.addEventListener('resize', resize3DRenderer);

  syncLineWidthLabel();
  syncImageScaleSlider();
  redraw2D();
})();
