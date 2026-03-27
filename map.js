const STAGE_WIDTH = 1400;
const STAGE_HEIGHT = 850;

const stage = new Konva.Stage({
  container: "stageContainer",
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT
});

const backgroundLayer = new Konva.Layer();
const gridLayer = new Konva.Layer();
const zonesLayer = new Konva.Layer();
const uiLayer = new Konva.Layer();

stage.add(backgroundLayer);
stage.add(gridLayer);
stage.add(zonesLayer);
stage.add(uiLayer);

let selectedNode = null;
let backgroundImageNode = null;
let currentBackgroundSrc = null;
let zoneIdCounter = 1;

const transformer = new Konva.Transformer({
  rotateEnabled: false,
  anchorSize: 10,
  borderStroke: "#2563eb",
  anchorStroke: "#1d4ed8",
  anchorFill: "#ffffff",
  anchorCornerRadius: 4,
  anchorStrokeWidth: 2,
  keepRatio: false,
  enabledAnchors: [
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right"
  ]
});

uiLayer.add(transformer);
uiLayer.draw();

const $ = (id) => document.getElementById(id);

const gridTypeInput = $("gridType");
const gridSizeInput = $("gridSize");
const showGridInput = $("showGrid");
const snapToGridInput = $("snapToGrid");
const applyGridBtn = $("applyGridBtn");
const gridSizeValue = $("gridSizeValue");

const bgUpload = $("bgUpload");
const bgUrl = $("bgUrl");
const loadBgUrlBtn = $("loadBgUrlBtn");
const clearBgBtn = $("clearBgBtn");

const zoneNameInput = $("zoneName");
const zoneTypeInput = $("zoneType");
const addRectZoneBtn = $("addRectZoneBtn");
const addCircleZoneBtn = $("addCircleZoneBtn");

const selectionEmpty = $("selectionEmpty");
const selectionEditor = $("selectionEditor");
const selectedZoneNameInput = $("selectedZoneName");
const selectedZoneTypeInput = $("selectedZoneType");
const selectedZoneShapeInput = $("selectedZoneShape");

const duplicateSelectedBtn = $("duplicateSelectedBtn");
const bringForwardBtn = $("bringForwardBtn");
const sendBackwardBtn = $("sendBackwardBtn");
const deleteSelectedBtn = $("deleteSelectedBtn");

const saveProjectBtn = $("saveProjectBtn");
const loadProjectInput = $("loadProjectInput");
const exportBtn = $("exportBtn");

const zoneStyles = {
  combat: {
    fill: "rgba(220, 38, 38, 0.22)",
    stroke: "#b91c1c",
    pill: "#7f1d1d",
    label: "Combat"
  },
  draw: {
    fill: "rgba(37, 99, 235, 0.20)",
    stroke: "#1d4ed8",
    pill: "#1e3a8a",
    label: "Pioche"
  },
  objective: {
    fill: "rgba(22, 163, 74, 0.20)",
    stroke: "#15803d",
    pill: "#166534",
    label: "Objectif"
  },
  spawn: {
    fill: "rgba(124, 58, 237, 0.20)",
    stroke: "#7c3aed",
    pill: "#5b21b6",
    label: "Apparition"
  },
  danger: {
    fill: "rgba(245, 158, 11, 0.22)",
    stroke: "#d97706",
    pill: "#92400e",
    label: "Danger"
  },
  custom: {
    fill: "rgba(100, 116, 139, 0.20)",
    stroke: "#475569",
    pill: "#334155",
    label: "Personnalisée"
  }
};

function bindIfExists(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function getGridSettings() {
  return {
    type: gridTypeInput ? gridTypeInput.value : "square",
    size: gridSizeInput ? parseInt(gridSizeInput.value, 10) : 50,
    show: showGridInput ? showGridInput.checked : true,
    snap: snapToGridInput ? snapToGridInput.checked : false
  };
}

function updateGridSizeLabel() {
  if (gridSizeValue && gridSizeInput) {
    gridSizeValue.textContent = `${gridSizeInput.value} px`;
  }
}

function clearSelection() {
  selectedNode = null;
  transformer.nodes([]);
  updateSelectionPanel();
  uiLayer.draw();
}

function selectNode(node) {
  selectedNode = node;
  transformer.nodes([node]);
  updateSelectionPanel();
  uiLayer.draw();
}

function updateSelectionPanel() {
  if (!selectionEmpty || !selectionEditor || !selectedZoneNameInput || !selectedZoneTypeInput || !selectedZoneShapeInput) {
    return;
  }

  if (!selectedNode) {
    selectionEmpty.classList.remove("hidden");
    selectionEditor.classList.add("hidden");
    selectedZoneNameInput.value = "";
    selectedZoneTypeInput.value = "combat";
    selectedZoneShapeInput.value = "";
    return;
  }

  selectionEmpty.classList.add("hidden");
  selectionEditor.classList.remove("hidden");
  selectedZoneNameInput.value = selectedNode.getAttr("zoneName") || "";
  selectedZoneTypeInput.value = selectedNode.getAttr("zoneType") || "custom";
  selectedZoneShapeInput.value = selectedNode.getAttr("zoneShape") || "";
}

function makeSelectable(node) {
  node.on("click tap", (e) => {
    e.cancelBubble = true;
    selectNode(node);
  });

  node.on("dragstart transformstart", () => {
    selectNode(node);
  });

  node.on("dragmove", () => {
    applySnapToNode(node);
  });

  node.on("dragend", () => {
    applySnapToNode(node, true);
    clearSelection();
  });

  node.on("transformend", () => {
    normalizeGroupChildren(node);
    applySnapToNode(node, true);
    clearSelection();
  });
}

function snapValue(value, step) {
  return Math.round(value / step) * step;
}

function applySnapToNode(node, forceDraw = false) {
  const settings = getGridSettings();

  if (!settings.snap || settings.type === "free") {
    return;
  }

  if (settings.type === "square") {
    node.x(snapValue(node.x(), settings.size));
    node.y(snapValue(node.y(), settings.size));
  }

  if (settings.type === "hex") {
    const stepX = Math.max(20, Math.round(Math.sqrt(3) * (settings.size / 2)));
    const stepY = Math.max(20, Math.round((2 * (settings.size / 2)) * 0.75));
    node.x(snapValue(node.x(), stepX));
    node.y(snapValue(node.y(), stepY));
  }

  if (forceDraw) {
    zonesLayer.draw();
  }
}

function normalizeGroupChildren(group) {
  if (!(group instanceof Konva.Group)) return;

  const scaleX = group.scaleX();
  const scaleY = group.scaleY();

  if (scaleX === 1 && scaleY === 1) return;

  const shapeType = group.getAttr("zoneShape");
  const frame = group.findOne(".zone-frame");
  const nameText = group.findOne(".zone-name");
  const badgeText = group.findOne(".zone-badge");

  if (frame && shapeType === "rect") {
    frame.width(Math.max(80, frame.width() * scaleX));
    frame.height(Math.max(60, frame.height() * scaleY));
  }

  if (frame && shapeType === "circle") {
    const avgScale = (scaleX + scaleY) / 2;
    frame.radius(Math.max(30, frame.radius() * avgScale));
  }

  if (nameText) {
    nameText.fontSize(Math.max(12, nameText.fontSize() * Math.min(scaleX, scaleY)));
  }

  if (badgeText) {
    badgeText.fontSize(Math.max(10, badgeText.fontSize() * Math.min(scaleX, scaleY)));
  }

  relayoutZone(group);

  group.scale({ x: 1, y: 1 });
  zonesLayer.draw();
}

function drawGrid() {
  gridLayer.destroyChildren();

  const { type, size, show } = getGridSettings();

  if (!show || type === "free") {
    gridLayer.draw();
    return;
  }

  if (type === "square") {
    for (let x = 0; x <= STAGE_WIDTH; x += size) {
      gridLayer.add(new Konva.Line({
        points: [x, 0, x, STAGE_HEIGHT],
        stroke: "rgba(15, 23, 42, 0.14)",
        strokeWidth: 1
      }));
    }

    for (let y = 0; y <= STAGE_HEIGHT; y += size) {
      gridLayer.add(new Konva.Line({
        points: [0, y, STAGE_WIDTH, y],
        stroke: "rgba(15, 23, 42, 0.14)",
        strokeWidth: 1
      }));
    }
  }

  if (type === "hex") {
    const hexRadius = size / 2;
    const hexWidth = Math.sqrt(3) * hexRadius;
    const hexHeight = 2 * hexRadius;
    const verticalSpacing = hexHeight * 0.75;

    for (let row = 0; row < STAGE_HEIGHT / verticalSpacing + 2; row++) {
      for (let col = 0; col < STAGE_WIDTH / hexWidth + 2; col++) {
        const offsetX = row % 2 ? hexWidth / 2 : 0;
        const x = col * hexWidth + offsetX;
        const y = row * verticalSpacing;

        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i - 30);
          points.push(x + hexRadius * Math.cos(angle));
          points.push(y + hexRadius * Math.sin(angle));
        }

        gridLayer.add(new Konva.Line({
          points,
          closed: true,
          stroke: "rgba(15, 23, 42, 0.14)",
          strokeWidth: 1
        }));
      }
    }
  }

  gridLayer.draw();
}

function addBackgroundImage(src) {
  const imageObj = new Image();
  imageObj.crossOrigin = "anonymous";

  imageObj.onload = () => {
    if (backgroundImageNode) {
      backgroundImageNode.destroy();
      backgroundImageNode = null;
    }

    currentBackgroundSrc = src;

    const scale = Math.max(STAGE_WIDTH / imageObj.width, STAGE_HEIGHT / imageObj.height);
    const width = imageObj.width * scale;
    const height = imageObj.height * scale;
    const x = (STAGE_WIDTH - width) / 2;
    const y = (STAGE_HEIGHT - height) / 2;

    backgroundImageNode = new Konva.Image({
      image: imageObj,
      x,
      y,
      width,
      height,
      listening: false
    });

    backgroundLayer.add(backgroundImageNode);
    backgroundLayer.draw();
  };

  imageObj.src = src;
}

function getZoneStyle(type) {
  return zoneStyles[type] || zoneStyles.custom;
}

function createZoneGroup(config) {
  const {
    zoneName = "Nouvelle zone",
    zoneType = "custom",
    zoneShape = "rect",
    x = 180,
    y = 140,
    width = 240,
    height = 150,
    radius = 90
  } = config;

  const style = getZoneStyle(zoneType);

  const group = new Konva.Group({
    x,
    y,
    draggable: true,
    name: "smart-zone"
  });

  group.setAttr("zoneId", config.zoneId || `zone-${zoneIdCounter++}`);
  group.setAttr("zoneName", zoneName);
  group.setAttr("zoneType", zoneType);
  group.setAttr("zoneShape", zoneShape);

  let frame;

  if (zoneShape === "rect") {
    frame = new Konva.Rect({
      width,
      height,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 3,
      cornerRadius: 18,
      shadowColor: "rgba(15, 23, 42, 0.14)",
      shadowBlur: 12,
      shadowOffsetY: 4,
      name: "zone-frame"
    });
  } else {
    frame = new Konva.Circle({
      radius,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 3,
      shadowColor: "rgba(15, 23, 42, 0.14)",
      shadowBlur: 12,
      shadowOffsetY: 4,
      name: "zone-frame"
    });
  }

  const nameText = new Konva.Text({
    text: zoneName,
    fontSize: 18,
    fontFamily: "Inter",
    fontStyle: "700",
    fill: "#0f172a",
    align: "center",
    name: "zone-name"
  });

  const badgeText = new Konva.Text({
    text: style.label.toUpperCase(),
    fontSize: 12,
    fontFamily: "Inter",
    fontStyle: "700",
    fill: style.pill,
    align: "center",
    name: "zone-badge"
  });

  group.add(frame);
  group.add(nameText);
  group.add(badgeText);

  relayoutZone(group);
  makeSelectable(group);
  zonesLayer.add(group);
  applySnapToNode(group, true);

  return group;
}

function relayoutZone(group) {
  const frame = group.findOne(".zone-frame");
  const nameText = group.findOne(".zone-name");
  const badgeText = group.findOne(".zone-badge");
  const zoneShape = group.getAttr("zoneShape");

  if (!frame || !nameText || !badgeText) return;

  const zoneType = group.getAttr("zoneType");
  const zoneName = group.getAttr("zoneName");
  const style = getZoneStyle(zoneType);

  nameText.text(zoneName);
  badgeText.text(style.label.toUpperCase());

  if (zoneShape === "rect") {
    const width = frame.width();
    const height = frame.height();

    frame.fill(style.fill);
    frame.stroke(style.stroke);

    nameText.width(Math.max(80, width - 24));
    nameText.x(12);
    nameText.y(Math.max(14, height / 2 - 26));
    nameText.align("center");

    badgeText.width(Math.max(80, width - 24));
    badgeText.x(12);
    badgeText.y(nameText.y() + 28);
    badgeText.align("center");
    badgeText.fill(style.pill);
  }

  if (zoneShape === "circle") {
    const radius = frame.radius();
    const diameter = radius * 2;

    frame.fill(style.fill);
    frame.stroke(style.stroke);

    nameText.width(diameter - 24);
    nameText.x(-radius + 12);
    nameText.y(-10);
    nameText.align("center");

    badgeText.width(diameter - 24);
    badgeText.x(-radius + 12);
    badgeText.y(18);
    badgeText.align("center");
    badgeText.fill(style.pill);
  }

  zonesLayer.draw();
}

function createRectZone() {
  const zoneName = zoneNameInput ? zoneNameInput.value.trim() || "Nouvelle zone" : "Nouvelle zone";
  const zoneType = zoneTypeInput ? zoneTypeInput.value : "custom";

  const group = createZoneGroup({
    zoneName,
    zoneType,
    zoneShape: "rect",
    x: 180,
    y: 140,
    width: 240,
    height: 150
  });

  selectNode(group);
}

function createCircleZone() {
  const zoneName = zoneNameInput ? zoneNameInput.value.trim() || "Nouvelle zone" : "Nouvelle zone";
  const zoneType = zoneTypeInput ? zoneTypeInput.value : "custom";

  const group = createZoneGroup({
    zoneName,
    zoneType,
    zoneShape: "circle",
    x: 360,
    y: 260,
    radius: 90
  });

  selectNode(group);
}

function updateSelectedZoneFromInputs() {
  if (!selectedNode || !selectedZoneNameInput || !selectedZoneTypeInput) return;

  selectedNode.setAttr("zoneName", selectedZoneNameInput.value.trim() || "Nouvelle zone");
  selectedNode.setAttr("zoneType", selectedZoneTypeInput.value);

  relayoutZone(selectedNode);
  updateSelectionPanel();
}

function deleteSelectedZone() {
  if (!selectedNode) return;
  selectedNode.destroy();
  clearSelection();
  zonesLayer.draw();
}

function exportPNG() {
  clearSelection();

  const dataURL = stage.toDataURL({
    pixelRatio: 2
  });

  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "plateau.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

stage.on("click tap", (e) => {
  if (e.target === stage) {
    clearSelection();
  }
});

/* Zoom / dézoom molette ou trackpad */
stage.on("wheel", (e) => {
  e.evt.preventDefault();

  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  const scaleBy = 1.06;
  const direction = e.evt.deltaY > 0 ? -1 : 1;
  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
  const clampedScale = Math.max(0.3, Math.min(3, newScale));

  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale
  };

  stage.scale({ x: clampedScale, y: clampedScale });

  const newPos = {
    x: pointer.x - mousePointTo.x * clampedScale,
    y: pointer.y - mousePointTo.y * clampedScale
  };

  stage.position(newPos);
  stage.batchDraw();
});

bindIfExists(applyGridBtn, "click", drawGrid);

bindIfExists(gridSizeInput, "input", () => {
  updateGridSizeLabel();
  drawGrid();
});

bindIfExists(showGridInput, "change", drawGrid);
bindIfExists(gridTypeInput, "change", drawGrid);

bindIfExists(bgUpload, "change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => addBackgroundImage(e.target.result);
  reader.readAsDataURL(file);
});

bindIfExists(loadBgUrlBtn, "click", () => {
  const url = bgUrl ? bgUrl.value.trim() : "";
  if (!url) return;
  addBackgroundImage(url);
});

bindIfExists(clearBgBtn, "click", () => {
  if (backgroundImageNode) {
    backgroundImageNode.destroy();
    backgroundImageNode = null;
  }
  currentBackgroundSrc = null;
  backgroundLayer.draw();
});

bindIfExists(addRectZoneBtn, "click", createRectZone);
bindIfExists(addCircleZoneBtn, "click", createCircleZone);

bindIfExists(selectedZoneNameInput, "input", updateSelectedZoneFromInputs);
bindIfExists(selectedZoneTypeInput, "change", updateSelectedZoneFromInputs);

bindIfExists(deleteSelectedBtn, "click", deleteSelectedZone);
bindIfExists(exportBtn, "click", exportPNG);

updateGridSizeLabel();
drawGrid();
updateSelectionPanel();
