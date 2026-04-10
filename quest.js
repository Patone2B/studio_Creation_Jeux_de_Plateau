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

exportPdfBtn.addEventListener('click', async () => {
  if (!quests.length) {
    alert('Ajoutez au moins une quête avant l\'export PDF.');
    return;
  }

  buildPdfView();

  const element = document.getElementById('pdfExportArea');
  const options = {
    margin: 0,
    filename: `registre-quetes-${getFileDateStamp()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  };

  try {
    await html2pdf().set(options).from(element.firstElementChild).save();
  } catch (error) {
    console.error(error);
    alert('L\'export PDF a échoué.');
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
