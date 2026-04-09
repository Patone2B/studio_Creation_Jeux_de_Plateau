let modules = [];

function addModule() {
  modules.push({ name: "", desc: "", links: [] });
  render();
}

function addLink(index) {
  modules[index].links.push("");
  render();
}

function updateModule(index, field, value) {
  modules[index][field] = value;
}

function updateLink(mIndex, lIndex, value) {
  modules[mIndex].links[lIndex] = value;
}

function getYouTubeThumbnail(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/0.jpg`;
  }
  return null;
}

function render() {
  const container = document.getElementById("modules");
  container.innerHTML = "";

  modules.forEach((mod, i) => {
    let div = document.createElement("div");
    div.className = "module";

    div.innerHTML = `
      <input placeholder="Nom" value="${mod.name}" 
        oninput="updateModule(${i}, 'name', this.value)">
      <textarea placeholder="Description"
        oninput="updateModule(${i}, 'desc', this.value)">${mod.desc}</textarea>

      <div>
        ${mod.links.map((link, j) => {
          const thumb = getYouTubeThumbnail(link);
          return `
            <div class="link">
              <input value="${link}" 
                oninput="updateLink(${i}, ${j}, this.value)">
              ${thumb ? `<div class="preview"><img src="${thumb}"></div>` : ""}
            </div>
          `;
        }).join("")}
      </div>

      <button onclick="addLink(${i})">+ lien</button>
    `;

    container.appendChild(div);
  });

  localStorage.setItem("modules", JSON.stringify(modules));
}

function exportJSON() {
  const data = JSON.stringify(modules, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "modules.json";
  a.click();
}

function importJSON(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    modules = JSON.parse(e.target.result);
    render();
  };
  reader.readAsText(file);
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 10;

  modules.forEach(mod => {
    doc.text(mod.name, 10, y);
    y += 5;
    doc.text(mod.desc, 10, y);
    y += 5;

    mod.links.forEach(link => {
      doc.text(link, 10, y);
      y += 5;
    });

    y += 10;
  });

  doc.save("modules.pdf");
}

window.onload = () => {
  const saved = localStorage.getItem("modules");
  if (saved) {
    modules = JSON.parse(saved);
  }
  render();
};
