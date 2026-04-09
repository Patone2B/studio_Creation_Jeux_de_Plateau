(function () {
  'use strict';

  /* ─── Helpers ─── */
  const $ = (id) => document.getElementById(id);

  /* ─── 2D Canvas ─── */
  const canvas = $('tokenCanvas');
  if (!canvas) { console.error('Canvas #tokenCanvas introuvable.'); return; }
  const ctx = canvas.getContext('2d');

  /* ─── UI refs ─── */
  const ui = {
    shapeSelect:       $('shapeSelect'),
    colorPicker:       $('colorPicker'),
    lineWidth:         $('lineWidth'),
    lineWidthValue:    $('lineWidthValue'),
    textInput:         $('textInput'),
    addText:           $('addText'),
    imageUpload:       $('imageUpload'),
    imageScale:        $('imageScale'),
    imageScaleValue:   $('imageScaleValue'),
    bringImageFront:   $('bringImageFront'),
    sendImageBack:     $('sendImageBack'),
    removeImage:       $('removeImage'),
    clearCanvas:       $('clearCanvas'),
    saveLocal:         $('saveLocal'),
    loadLocal:         $('loadLocal'),
    importJSON:        $('importJSON'),
    exportJSON:        $('exportJSON'),
    exportPNG:         $('exportPNG'),
    undoBtn:           $('undoBtn'),
    redoBtn:           $('redoBtn'),
    undoBtnMobile:     $('undoBtnMobile'),
    redoBtnMobile:     $('redoBtnMobile'),
    mode2dBtn:         $('mode2dBtn'),
    mode3dBtn:         $('mode3dBtn'),
    editor2d:          $('editor2d'),
    editor3d:          $('editor3d'),
    primitiveSelect:   $('primitiveSelect'),
    meshColor:         $('meshColor'),
    addPrimitive:      $('addPrimitive'),
    deleteMesh:        $('deleteMesh'),
    extrudeDepth:      $('extrudeDepth'),
    extrudeDepthValue: $('extrudeDepthValue'),
    bevelSize:         $('bevelSize'),
    bevelSizeValue:    $('bevelSizeValue'),
    bevelSegments:     $('bevelSegments'),
    bevelSegmentsValue:$('bevelSegmentsValue'),
    applyExtrude:      $('applyExtrude'),
    scale3d:           $('scale3d'),
    scale3dValue:      $('scale3dValue'),
    rotateY3d:         $('rotateY3d'),
    rotateY3dValue:    $('rotateY3dValue'),
    centerMesh:        $('centerMesh'),
    reset3dView:       $('reset3dView'),
    threeViewport:     $('threeViewport'),
    threePlaceholder:  $('three-placeholder')
  };

  /* ══════════════════════════════════════════
     2D STATE
  ══════════════════════════════════════════ */
  const state2D = {
    tool: 'pencil', drawing: false,
    startX: 0, startY: 0, currentStroke: null,
    items: [], background: null,
    dragImage: false, dragOffsetX: 0, dragOffsetY: 0,
    history: [], future: []
  };

  const deepClone   = (v) => JSON.parse(JSON.stringify(v));
  const make2DSnap  = () => ({ items: deepClone(state2D.items), background: deepClone(state2D.background) });

  function push2DHistory() {
    state2D.history.push(make2DSnap());
    if (state2D.history.length > 100) state2D.history.shift();
    state2D.future = [];
  }

  function restore2D(snap) {
    state2D.items      = (snap && Array.isArray(snap.items)) ? deepClone(snap.items) : [];
    state2D.background = (snap && snap.background) ? deepClone(snap.background) : null;
    syncImageScaleSlider();
    redraw2D();
  }

  function undo2D() { if (!state2D.history.length) return; state2D.future.push(make2DSnap()); restore2D(state2D.history.pop()); }
  function redo2D() { if (!state2D.future.length)  return; state2D.history.push(make2DSnap()); restore2D(state2D.future.pop()); }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function drawPath(item) {
    const p = item.path || []; if (!p.length) return;
    ctx.save();
    ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth   = Number(item.lineWidth) || 1;
    ctx.strokeStyle = item.type === 'eraser' ? '#ffffff' : item.color;
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke(); ctx.restore();
  }

  function drawItem(item) {
    if (!item) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = item.color || '#000'; ctx.fillStyle = item.color || '#000';
    ctx.lineWidth   = Number(item.lineWidth) || 1;
    switch (item.type) {
      case 'pencil': case 'eraser': drawPath(item); break;
      case 'circle':
        ctx.beginPath(); ctx.arc(item.x, item.y, Math.max(1, item.radius || 0), 0, Math.PI * 2); ctx.stroke(); break;
      case 'square': {
        const x = item.width  < 0 ? item.x + item.width  : item.x;
        const y = item.height < 0 ? item.y + item.height : item.y;
        ctx.strokeRect(x, y, Math.abs(item.width), Math.abs(item.height)); break;
      }
      case 'line':
        ctx.beginPath(); ctx.moveTo(item.startX, item.startY); ctx.lineTo(item.endX, item.endY); ctx.stroke(); break;
      case 'text':
        ctx.font = `${item.size || 28}px Arial`; ctx.fillText(item.text || '', item.x || 0, item.y || 0); break;
    }
    ctx.restore();
  }

  const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  async function drawBackground() {
    const bg = state2D.background; if (!bg || !bg.src) return;
    try { ctx.drawImage(await loadImage(bg.src), bg.x, bg.y, bg.width, bg.height); } catch (e) { console.error(e); }
  }

  async function redraw2D() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state2D.background && state2D.background.layer === 'back')  await drawBackground();
    state2D.items.forEach(drawItem);
    if (state2D.currentStroke) drawItem(state2D.currentStroke);
    if (state2D.background && state2D.background.layer === 'front') await drawBackground();
  }

  function syncLineWidthLabel() { if (ui.lineWidth && ui.lineWidthValue) ui.lineWidthValue.textContent = `${ui.lineWidth.value} px`; }

  function syncImageScaleSlider() {
    if (!ui.imageScale || !ui.imageScaleValue) return;
    if (!state2D.background || !state2D.background.naturalWidth) { ui.imageScale.value = 100; ui.imageScaleValue.textContent = '100 %'; return; }
    const v = Math.max(10, Math.min(250, Math.round((state2D.background.width / state2D.background.naturalWidth) * 100)));
    ui.imageScale.value = v; ui.imageScaleValue.textContent = `${v} %`;
  }

  const pointInBG = (x, y) => { const b = state2D.background; return b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height; };

  /* ─── 2D Mouse ─── */
  canvas.addEventListener('mousedown', (e) => {
    const pos = pointerPos(e);
    state2D.tool = ui.shapeSelect ? ui.shapeSelect.value : 'pencil';
    if (state2D.background && pointInBG(pos.x, pos.y)) {
      state2D.dragImage = true; state2D.dragOffsetX = pos.x - state2D.background.x; state2D.dragOffsetY = pos.y - state2D.background.y;
      push2DHistory(); return;
    }
    push2DHistory(); state2D.drawing = true; state2D.startX = pos.x; state2D.startY = pos.y;
    if (state2D.tool === 'pencil' || state2D.tool === 'eraser') {
      state2D.currentStroke = { type: state2D.tool, color: ui.colorPicker ? ui.colorPicker.value : '#000', lineWidth: Number(ui.lineWidth ? ui.lineWidth.value : 4), path: [pos] };
      redraw2D();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = pointerPos(e);
    if (state2D.dragImage && state2D.background) { state2D.background.x = pos.x - state2D.dragOffsetX; state2D.background.y = pos.y - state2D.dragOffsetY; redraw2D(); return; }
    if (!state2D.drawing) return;
    if (state2D.currentStroke) { state2D.currentStroke.path.push(pos); redraw2D(); return; }
    const preview = { color: ui.colorPicker ? ui.colorPicker.value : '#000', lineWidth: Number(ui.lineWidth ? ui.lineWidth.value : 4) };
    if      (state2D.tool === 'circle') state2D.currentStroke = { type: 'circle', x: state2D.startX, y: state2D.startY, radius: Math.hypot(pos.x - state2D.startX, pos.y - state2D.startY), ...preview };
    else if (state2D.tool === 'square') state2D.currentStroke = { type: 'square', x: state2D.startX, y: state2D.startY, width: pos.x - state2D.startX, height: pos.y - state2D.startY, ...preview };
    else if (state2D.tool === 'line')   state2D.currentStroke = { type: 'line', startX: state2D.startX, startY: state2D.startY, endX: pos.x, endY: pos.y, ...preview };
    redraw2D();
  });

  window.addEventListener('mouseup', () => {
    if (state2D.dragImage) { state2D.dragImage = false; redraw2D(); return; }
    if (!state2D.drawing) return;
    state2D.drawing = false;
    if (state2D.currentStroke) { state2D.items.push(deepClone(state2D.currentStroke)); state2D.currentStroke = null; redraw2D(); }
  });

  /* ─── 2D Controls ─── */
  if (ui.lineWidth)   ui.lineWidth.addEventListener('input', syncLineWidthLabel);
  if (ui.imageScale)  ui.imageScale.addEventListener('input', () => {
    ui.imageScaleValue.textContent = `${ui.imageScale.value} %`;
    if (!state2D.background || !state2D.background.naturalWidth) return;
    push2DHistory();
    const cx = state2D.background.x + state2D.background.width / 2;
    const cy = state2D.background.y + state2D.background.height / 2;
    const r  = Number(ui.imageScale.value) / 100;
    state2D.background.width  = state2D.background.naturalWidth  * r;
    state2D.background.height = state2D.background.naturalHeight * r;
    state2D.background.x = cx - state2D.background.width  / 2;
    state2D.background.y = cy - state2D.background.height / 2;
    redraw2D();
  });

  if (ui.addText) ui.addText.addEventListener('click', () => {
    const v = ui.textInput ? ui.textInput.value.trim() : ''; if (!v) return;
    push2DHistory();
    state2D.items.push({ type: 'text', text: v, x: 60, y: 60, size: 30, color: ui.colorPicker ? ui.colorPicker.value : '#000', lineWidth: 1 });
    if (ui.textInput) ui.textInput.value = '';
    redraw2D();
  });

  if (ui.imageUpload) ui.imageUpload.addEventListener('change', () => {
    const file = ui.imageUpload.files && ui.imageUpload.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        push2DHistory();
        const ratio = Math.min((canvas.width * 0.7) / img.width, (canvas.height * 0.7) / img.height, 1);
        const w = img.width * ratio, h = img.height * ratio;
        state2D.background = { src: reader.result, x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, width: w, height: h, naturalWidth: img.width, naturalHeight: img.height, layer: 'back' };
        syncImageScaleSlider(); redraw2D(); ui.imageUpload.value = '';
      };
      img.onerror = () => alert('Impossible de charger cette image.');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  if (ui.bringImageFront) ui.bringImageFront.addEventListener('click', () => { if (!state2D.background) return; push2DHistory(); state2D.background.layer = 'front'; redraw2D(); });
  if (ui.sendImageBack)   ui.sendImageBack.addEventListener('click',   () => { if (!state2D.background) return; push2DHistory(); state2D.background.layer = 'back';  redraw2D(); });
  if (ui.removeImage)     ui.removeImage.addEventListener('click',     () => { if (!state2D.background) return; push2DHistory(); state2D.background = null; syncImageScaleSlider(); redraw2D(); });
  if (ui.clearCanvas)     ui.clearCanvas.addEventListener('click',     () => { push2DHistory(); state2D.items = []; state2D.background = null; state2D.currentStroke = null; syncImageScaleSlider(); redraw2D(); });

  if (ui.saveLocal)  ui.saveLocal.addEventListener('click',  () => { localStorage.setItem('tokenData', JSON.stringify(make2DSnap())); alert('Projet 2D sauvegardé !'); });
  if (ui.loadLocal)  ui.loadLocal.addEventListener('click',  () => { const r = localStorage.getItem('tokenData'); if (!r) { alert('Aucune sauvegarde.'); return; } try { push2DHistory(); restore2D(JSON.parse(r)); } catch (e) { alert('Sauvegarde invalide.'); } });
  if (ui.exportJSON) ui.exportJSON.addEventListener('click', () => { const b = new Blob([JSON.stringify(make2DSnap(), null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pion.json'; a.click(); });
  if (ui.importJSON) ui.importJSON.addEventListener('click', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { push2DHistory(); restore2D(JSON.parse(r.result)); } catch (e) { alert('JSON invalide.'); } }; r.readAsText(f); }; inp.click(); });
  if (ui.exportPNG)  ui.exportPNG.addEventListener('click',  async () => { await redraw2D(); const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'pion.png'; a.click(); });

  [ui.undoBtn, ui.undoBtnMobile].forEach((b) => b && b.addEventListener('click', undo2D));
  [ui.redoBtn, ui.redoBtnMobile].forEach((b) => b && b.addEventListener('click', redo2D));

  /* ─── Mode switch ─── */
  function setActiveMode(mode) {
    const is2D = mode === '2d';
    if (ui.editor2d) ui.editor2d.classList.toggle('active', is2D);
    if (ui.editor3d) ui.editor3d.classList.toggle('active', !is2D);
    if (ui.mode2dBtn) ui.mode2dBtn.classList.toggle('active', is2D);
    if (ui.mode3dBtn) ui.mode3dBtn.classList.toggle('active', !is2D);
    if (!is2D) init3D();
  }
  if (ui.mode2dBtn) ui.mode2dBtn.addEventListener('click', () => setActiveMode('2d'));
  if (ui.mode3dBtn) ui.mode3dBtn.addEventListener('click', () => setActiveMode('3d'));


  /* ══════════════════════════════════════════
     3D — Three.js est déjà chargé dans <head>
  ══════════════════════════════════════════ */
  let threeReady = false;
  const T = { scene: null, camera: null, renderer: null, controls: null, meshes: [], selected: null };

  function showPlaceholder(html) {
    if (!ui.threeViewport) return;
    if (ui.threePlaceholder) { ui.threePlaceholder.innerHTML = html; ui.threePlaceholder.style.display = 'flex'; }
  }

  function hidePlaceholder() {
    if (ui.threePlaceholder) ui.threePlaceholder.style.display = 'none';
  }

  function resize3D() {
    if (!threeReady || !T.renderer || !ui.threeViewport) return;
    const w = Math.max(300, ui.threeViewport.clientWidth);
    const h = Math.max(480, ui.threeViewport.clientHeight);
    T.renderer.setSize(w, h);
    T.camera.aspect = w / h;
    T.camera.updateProjectionMatrix();
  }

  function init3D() {
    if (threeReady) return;

    /* Vérification que THREE est bien disponible (chargé via <script> dans <head>) */
    if (typeof THREE === 'undefined') {
      showPlaceholder('<i class="fas fa-triangle-exclamation" style="color:#f59e0b;font-size:2rem;margin-bottom:12px"></i><p>Three.js n\'a pas pu être chargé.<br>Vérifie ta connexion Internet et recharge la page.</p>');
      console.error('THREE est undefined. Vérifie que les <script> CDN dans <head> se chargent correctement.');
      return;
    }

    hidePlaceholder();

    /* Scene */
    T.scene = new THREE.Scene();
    T.scene.background = new THREE.Color(0x0f172a);
    T.scene.fog = new THREE.FogExp2(0x0f172a, 0.022);

    /* Camera */
    T.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    T.camera.position.set(5, 4, 7);

    /* Renderer */
    T.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    T.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    T.renderer.shadowMap.enabled = true;
    T.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    T.renderer.outputEncoding = THREE.sRGBEncoding;
    ui.threeViewport.appendChild(T.renderer.domElement);

    /* OrbitControls */
    T.controls = new THREE.OrbitControls(T.camera, T.renderer.domElement);
    T.controls.enableDamping = true;
    T.controls.dampingFactor = 0.08;
    T.controls.target.set(0, 1, 0);
    T.controls.update();

    /* Lights */
    T.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 14, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); T.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6699ff, 0.5);
    fill.position.set(-6, 4, -5); T.scene.add(fill);

    /* Grid + floor */
    T.scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.receiveShadow = true;
    T.scene.add(floor);

    /* Click-to-select */
    const raycaster = new THREE.Raycaster(), ptr = new THREE.Vector2();
    T.renderer.domElement.addEventListener('pointerdown', (e) => {
      const r = T.renderer.domElement.getBoundingClientRect();
      ptr.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
      ptr.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
      raycaster.setFromCamera(ptr, T.camera);
      const hits = raycaster.intersectObjects(T.meshes, false);
      selectMesh(hits.length ? hits[0].object : null);
    });

    /* Animate */
    threeReady = true;
    resize3D();
    (function loop() {
      requestAnimationFrame(loop);
      T.controls.update();
      T.renderer.render(T.scene, T.camera);
    })();
  }

  /* ─── Geometry builder ─── */
  function buildShape(kind) {
    const s = new THREE.Shape();
    if (kind === 'extrudeStar') {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1.2 : 0.55;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        i === 0 ? s.moveTo(Math.cos(a)*r, Math.sin(a)*r) : s.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      s.closePath(); return s;
    }
    s.moveTo(-1.4,-0.6); s.quadraticCurveTo(-1.65,0,-1.4,0.6);
    s.lineTo(-0.3,0.6);  s.quadraticCurveTo(0,1.1,0.6,1.1);
    s.quadraticCurveTo(1.25,1.1,1.45,0.45); s.quadraticCurveTo(1.7,0.3,1.7,0);
    s.quadraticCurveTo(1.7,-0.35,1.4,-0.55); s.quadraticCurveTo(1.15,-1.1,0.55,-1.1);
    s.quadraticCurveTo(-0.05,-1.1,-0.35,-0.6); s.closePath(); return s;
  }

  function getParams() {
    return {
      depth:         Number(ui.extrudeDepth  ? ui.extrudeDepth.value  : 18) / 25,
      bevelSize:     Number(ui.bevelSize     ? ui.bevelSize.value     : 3)  / 25,
      bevelSegments: Number(ui.bevelSegments ? ui.bevelSegments.value : 3)
    };
  }

  function createGeometry(kind, p) {
    switch (kind) {
      case 'box':      return new THREE.BoxGeometry(2, 2, 2);
      case 'cylinder': return new THREE.CylinderGeometry(1, 1, 2, 48);
      case 'sphere':   return new THREE.SphereGeometry(1.2, 48, 32);
      case 'token':    return new THREE.CylinderGeometry(1.5, 1.5, 0.35, 64);
      case 'extrudeStar':
      case 'extrudeBadge':
        return new THREE.ExtrudeGeometry(buildShape(kind), {
          depth: p.depth, bevelEnabled: p.bevelSize > 0,
          bevelSize: p.bevelSize, bevelThickness: Math.max(0.05, p.bevelSize * 0.7),
          bevelSegments: p.bevelSegments, curveSegments: 32
        });
      default: return new THREE.BoxGeometry(2, 2, 2);
    }
  }

  function buildMesh(kind, color, p) {
    const geo  = createGeometry(kind, p);
    const mat  = new THREE.MeshStandardMaterial({ color: color || '#3b82f6', metalness: 0.2, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.y = (kind === 'token') ? 0.2 : 1.2;
    if (kind === 'extrudeStar' || kind === 'extrudeBadge') { mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.6; }
    mesh.userData.shapeType = kind;
    mesh.userData.params    = { ...p };
    return mesh;
  }

  /* ─── Selection ─── */
  function updateEmissive() {
    T.meshes.forEach((m) => {
      m.material.emissive    = new THREE.Color(m === T.selected ? 0x1d4ed8 : 0x000000);
      m.material.emissiveIntensity = m === T.selected ? 0.35 : 0;
    });
    if (T.selected) {
      if (ui.scale3d && ui.scale3dValue) { const v = Math.round(T.selected.scale.x * 100); ui.scale3d.value = v; ui.scale3dValue.textContent = `${v} %`; }
      if (ui.rotateY3d && ui.rotateY3dValue) { let d = Math.round((T.selected.rotation.y * 180) / Math.PI); d = ((d % 360) + 360) % 360; ui.rotateY3d.value = d; ui.rotateY3dValue.textContent = `${d}°`; }
    }
  }

  function selectMesh(m) { T.selected = m || null; updateEmissive(); }

  /* ─── 3D Button actions ─── */
  function addPrimitive3D() {
    if (!threeReady) return;
    const kind  = ui.primitiveSelect ? ui.primitiveSelect.value : 'box';
    const color = ui.meshColor ? ui.meshColor.value : '#3b82f6';
    const mesh  = buildMesh(kind, color, getParams());
    mesh.position.x = (T.meshes.length % 5) * 2.8 - 5.6;
    T.scene.add(mesh); T.meshes.push(mesh); selectMesh(mesh);
  }

  if (ui.addPrimitive) ui.addPrimitive.addEventListener('click', () => { init3D(); if (threeReady) addPrimitive3D(); });

  if (ui.deleteMesh) ui.deleteMesh.addEventListener('click', () => {
    if (!threeReady || !T.selected) return;
    const m = T.selected; T.scene.remove(m); m.geometry.dispose(); m.material.dispose();
    T.meshes = T.meshes.filter((x) => x !== m); selectMesh(null);
  });

  if (ui.applyExtrude) ui.applyExtrude.addEventListener('click', () => {
    if (!threeReady || !T.selected) return;
    const m = T.selected, kind = m.userData.shapeType;
    if (kind !== 'extrudeStar' && kind !== 'extrudeBadge') return;
    const p = getParams(); const ng = createGeometry(kind, p);
    m.geometry.dispose(); m.geometry = ng; m.userData.params = p;
  });

  if (ui.centerMesh) ui.centerMesh.addEventListener('click', () => {
    if (!T.selected) return; T.selected.position.set(0, T.selected.position.y, 0);
  });

  if (ui.reset3dView) ui.reset3dView.addEventListener('click', () => {
    if (!threeReady) return;
    T.camera.position.set(5, 4, 7); T.controls.target.set(0, 1, 0); T.controls.update();
  });

  /* ─── 3D Sliders ─── */
  const bindSlider = (el, lbl, fmt, fn) => { if (!el) return; el.addEventListener('input', () => { if (lbl) lbl.textContent = fmt(el.value); fn(el.value); }); };
  bindSlider(ui.extrudeDepth,  ui.extrudeDepthValue,  (v) => v,       () => {});
  bindSlider(ui.bevelSize,     ui.bevelSizeValue,     (v) => v,       () => {});
  bindSlider(ui.bevelSegments, ui.bevelSegmentsValue, (v) => v,       () => {});
  bindSlider(ui.scale3d,       ui.scale3dValue,       (v) => `${v} %`, (v) => { if (!T.selected) return; const s = Number(v)/100; T.selected.scale.set(s,s,s); });
  bindSlider(ui.rotateY3d,     ui.rotateY3dValue,     (v) => `${v}°`,  (v) => { if (!T.selected) return; T.selected.rotation.y = Number(v) * Math.PI / 180; });

  window.addEventListener('resize', resize3D);

  /* ─── Init 2D ─── */
  syncLineWidthLabel();
  syncImageScaleSlider();
  redraw2D();
})();
