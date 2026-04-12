const STORAGE_KEY = 'rpg-quest-system-data-v1';

const questForm = document.getElementById('questForm');
const questNameInput = document.getElementById('questName');
const questDescriptionInput = document.getElementById('questDescription');
const questBossInput = document.getElementById('questBoss');
const questList = document.getElementById('questList');
const questCount = document.getElementById('questCount');
const emptyState = document.getElementById('emptyState');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const resetFormBtn = document.getElementById('resetFormBtn');
const questCardTemplate = document.getElementById('questCardTemplate');
const pdfQuestContainer = document.getElementById('pdfQuestContainer');
const pdfDate = document.getElementById('pdfDate');

let quests = loadQuests();
let editingId = null;

renderQuests();

questForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const quest = {
    id: editingId ?? crypto.randomUUID(),
    name: questNameInput.value.trim(),
    description: questDescriptionInput.value.trim(),
    boss: questBossInput.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (!quest.name || !quest.description || !quest.boss) {
    alert('Veuillez remplir tous les champs de la quête.');
    return;
  }

  if (editingId) {
    quests = quests.map((item) => (item.id === editingId ? quest : item));
  } else {
    quests.unshift(quest);
  }

  editingId = null;
  questForm.querySelector('[type="submit"]').textContent = 'Ajouter la quête';
  questForm.reset();
  saveQuests();
  renderQuests();
});

resetFormBtn.addEventListener('click', () => {
  editingId = null;
  questForm.reset();
  questForm.querySelector('[type="submit"]').textContent = 'Ajouter la quête';
});

exportJsonBtn.addEventListener('click', () => {
  const payload = {
    app: 'systeme-de-quete',
    version: 1,
    exportedAt: new Date().toISOString(),
    quests,
  };

  downloadFile(
    JSON.stringify(payload, null, 2),
    `quetes-${getFileDateStamp()}.json`,
    'application/json'
  );
});

importJsonInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const importedQuests = Array.isArray(parsed) ? parsed : parsed.quests;

    if (!Array.isArray(importedQuests)) {
      throw new Error('Format JSON invalide');
    }

    quests = importedQuests.map(normalizeQuest).filter(Boolean);
    editingId = null;
    questForm.reset();
    questForm.querySelector('[type="submit"]').textContent = 'Ajouter la quête';
    saveQuests();
    renderQuests();
    alert('Import JSON réussi.');
  } catch (error) {
    console.error(error);
    alert('Impossible d\'importer ce fichier JSON.');
  } finally {
    importJsonInput.value = '';
  }
});

exportPdfBtn.addEventListener('click', () => {
  if (!quests.length) {
    alert('Ajoutez au moins une quête avant l\'export PDF.');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m  = 16; // margin
    const cw = pw - m * 2;
    let y = 0;

    // ── Couleurs charte graphique ──
    const C = {
      bg:          [15,  13,  19],   // --bg
      bgSoft:      [25,  21,  32],   // --bg-soft
      panel:       [29,  22,  38],   // panel
      gold:        [227, 195, 122],  // --gold
      goldStrong:  [242, 210, 138],  // --gold-strong
      text:        [247, 242, 232],  // --text
      muted:       [203, 189, 160],  // --muted
      accent:      [143,  61,  47],  // --accent
      accentDark:  [ 90,  35,  54],  // --accent-2
      bossBox:     [ 60,  20,  22],
      border:      [ 60,  48,  75],
      cardBg:      [ 33,  24,  45],
    };

    function setFill(c)   { doc.setFillColor(c[0], c[1], c[2]); }
    function setDraw(c)   { doc.setDrawColor(c[0], c[1], c[2]); }
    function setTxt(c)    { doc.setTextColor(c[0], c[1], c[2]); }

    function checkY(h) {
      if (y + h > ph - m) {
        doc.addPage();
        // fond sur nouvelle page
        setFill(C.bg); doc.rect(0, 0, pw, ph, 'F');
        y = m;
      }
    }

    function wrapText(text, x, maxW, fsize, lineH) {
      if (!text) return;
      doc.setFontSize(fsize);
      doc.splitTextToSize(String(text), maxW).forEach(line => {
        checkY(lineH + 1);
        doc.text(line, x, y);
        y += lineH;
      });
    }

    // ══ FOND PAGE ══
    setFill(C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // ══ HEADER HERO ══
    // Bande de fond dorée dégradée simulée avec un rectangle
    setFill(C.panel);
    doc.roundedRect(m, 10, cw, 38, 4, 4, 'F');
    setDraw(C.gold); doc.setLineWidth(0.4);
    doc.roundedRect(m, 10, cw, 38, 4, 4, 'S');

    // Eyebrow
    setTxt(C.goldStrong);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setCharSpace(2);
    doc.text('CHRONIQUES DU ROYAUME', m + 10, 22);
    doc.setCharSpace(0);

    // Titre principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    setTxt(C.text);
    doc.text('Registre des Quêtes', m + 10, 33);

    // Date
    const dateStr = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTxt(C.muted);
    doc.text(dateStr, m + 10, 42);

    // Nombre de quêtes (badge)
    const countLabel = `${quests.length} quête${quests.length > 1 ? 's' : ''}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setTxt(C.goldStrong);
    doc.text(countLabel, pw - m - 2, 42, { align: 'right' });

    y = 56;

    // ══ CARTES DE QUÊTES ══
    quests.forEach((quest, index) => {
      // Estimer la hauteur de la carte
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(quest.description || '', cw - 24).length;
      const bossLines = doc.splitTextToSize(quest.boss || '', cw - 32).length;
      const cardH = 14 + (descLines * 5) + (bossLines * 5) + 32;

      checkY(cardH + 6);

      const cardY = y;

      // Fond de la carte
      setFill(C.cardBg);
      doc.roundedRect(m, cardY, cw, cardH, 4, 4, 'F');

      // Bordure dorée subtile
      setDraw(C.border); doc.setLineWidth(0.3);
      doc.roundedRect(m, cardY, cw, cardH, 4, 4, 'S');

      // Accent gauche coloré (bande verticale)
      setFill(C.accent);
      doc.roundedRect(m, cardY, 4, cardH, 2, 2, 'F');

      // Badge "Quête N°X"
      setFill([50, 35, 70]);
      doc.roundedRect(m + 10, cardY + 8, 28, 7, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      setTxt(C.goldStrong);
      doc.setCharSpace(0.8);
      doc.text(`QUÊTE ${index + 1}`, m + 24, cardY + 13.5, { align: 'center' });
      doc.setCharSpace(0);

      // Titre de la quête
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      setTxt(C.text);
      y = cardY + 22;
      doc.text(quest.name || '', m + 10, y);
      y += 7;

      // Séparateur
      setDraw(C.border); doc.setLineWidth(0.3);
      doc.line(m + 10, y, m + cw - 6, y);
      y += 5;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setTxt([220, 210, 190]);
      doc.splitTextToSize(quest.description || '', cw - 20).forEach(line => {
        doc.text(line, m + 10, y);
        y += 5;
      });

      y += 3;

      // Boss box
      const bossTextLines = doc.splitTextToSize(quest.boss || '', cw - 36);
      const bossBoxH = bossTextLines.length * 5 + 14;
      setFill(C.bossBox);
      doc.roundedRect(m + 8, y, cw - 16, bossBoxH, 3, 3, 'F');
      setDraw([100, 40, 50]); doc.setLineWidth(0.3);
      doc.roundedRect(m + 8, y, cw - 16, bossBoxH, 3, 3, 'S');

      // Label "Boss de fin"
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setTxt([242, 197, 177]);
      doc.setCharSpace(0.6);
      doc.text('BOSS DE FIN', m + 14, y + 7);
      doc.setCharSpace(0);

      // Nom du boss
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      setTxt(C.text);
      bossTextLines.forEach((line, li) => {
        doc.text(line, m + 14, y + 13 + li * 5);
      });

      y = cardY + cardH + 6;
    });

    // ══ FOOTER sur chaque page ══
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      // ligne séparatrice
      setDraw(C.border); doc.setLineWidth(0.3);
      doc.line(m, ph - 12, pw - m, ph - 12);
      // texte footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      setTxt(C.muted);
      doc.text('Chroniques du Royaume — Registre des Quêtes', m, ph - 7);
      doc.text(`${p} / ${totalPages}`, pw - m, ph - 7, { align: 'right' });
    }

    doc.save(`registre-quetes-${getFileDateStamp()}.pdf`);

  } catch (error) {
    console.error(error);
    alert('L\'export PDF a échoué : ' + error.message);
  }
});

clearAllBtn.addEventListener('click', () => {
  if (!quests.length) return;
  const confirmed = confirm('Supprimer toutes les quêtes ?');
  if (!confirmed) return;

  quests = [];
  editingId = null;
  questForm.reset();
  questForm.querySelector('[type="submit"]').textContent = 'Ajouter la quête';
  saveQuests();
  renderQuests();
});

questList.addEventListener('click', (event) => {
  const target = event.target;
  const card = target.closest('.quest-card');
  if (!card) return;

  const questId = card.dataset.id;
  const quest = quests.find((item) => item.id === questId);
  if (!quest) return;

  if (target.classList.contains('delete-btn')) {
    quests = quests.filter((item) => item.id !== questId);
    if (editingId === questId) {
      editingId = null;
      questForm.reset();
      questForm.querySelector('[type="submit"]').textContent = 'Ajouter la quête';
    }
    saveQuests();
    renderQuests();
  }

  if (target.classList.contains('edit-btn')) {
    editingId = questId;
    questNameInput.value = quest.name;
    questDescriptionInput.value = quest.description;
    questBossInput.value = quest.boss;
    questForm.querySelector('[type="submit"]').textContent = 'Enregistrer les modifications';
    questNameInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

function renderQuests() {
  questList.innerHTML = '';
  emptyState.style.display = quests.length ? 'none' : 'block';
  questCount.textContent = `${quests.length} quête${quests.length > 1 ? 's' : ''}`;

  for (const quest of quests) {
    const fragment = questCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.quest-card');
    card.dataset.id = quest.id;
    fragment.querySelector('.quest-title').textContent = quest.name;
    fragment.querySelector('.quest-description').textContent = quest.description;
    fragment.querySelector('.quest-boss').textContent = quest.boss;
    questList.appendChild(fragment);
  }
}

function buildPdfView() {
  pdfQuestContainer.innerHTML = '';
  pdfDate.textContent = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  quests.forEach((quest, index) => {
    const card = document.createElement('article');
    card.className = 'pdf-quest-card';
    card.innerHTML = `
      <h3>${index + 1}. ${escapeHtml(quest.name)}</h3>
      <p>${escapeHtml(quest.description)}</p>
      <p class="pdf-boss">Boss de fin : ${escapeHtml(quest.boss)}</p>
    `;
    pdfQuestContainer.appendChild(card);
  });
}

function loadQuests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeQuest).filter(Boolean);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveQuests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quests));
}

function normalizeQuest(item) {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name ?? '').trim();
  const description = String(item.description ?? '').trim();
  const boss = String(item.boss ?? '').trim();
  if (!name || !description || !boss) return null;

  return {
    id: String(item.id ?? crypto.randomUUID()),
    name,
    description,
    boss,
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  };
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getFileDateStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}${min}`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
