document.addEventListener('DOMContentLoaded', () => {
    // Récupération des éléments
    const canvas = document.getElementById('tokenCanvas');
    const ctx = canvas.getContext('2d');
    const shapeSelect = document.getElementById('shapeSelect');
    const colorPicker = document.getElementById('colorPicker');
    const lineWidth = document.getElementById('lineWidth');
    const textInput = document.getElementById('textInput');
    const addText = document.getElementById('addText');
    const imageUpload = document.getElementById('imageUpload');
    const clearCanvas = document.getElementById('clearCanvas');
    const saveLocal = document.getElementById('saveLocal');
    const loadLocal = document.getElementById('loadLocal');
    const importJSON = document.getElementById('importJSON');
    const exportJSON = document.getElementById('exportJSON');
    const exportPNG = document.getElementById('exportPNG');

    // Variables globales
    let isDrawing = false;
    let currentTool = 'pencil';
    let startX, startY;
    let tokens = [];
    let currentImage = null;

    // Charger depuis le localStorage
    function loadFromLocalStorage() {
        const savedData = localStorage.getItem('tokenEditorData');
        if (savedData) {
            tokens = JSON.parse(savedData);
            redrawCanvas();
        }
    }

    // Sauvegarder dans le localStorage
    function saveToLocalStorage() {
        localStorage.setItem('tokenEditorData', JSON.stringify(tokens));
        alert('Projet sauvegardé dans le navigateur !');
    }

    // Redessiner le canvas
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tokens.forEach(token => {
            ctx.strokeStyle = token.color;
            ctx.fillStyle = token.color;
            ctx.lineWidth = token.lineWidth;

            switch (token.type) {
                case 'pencil':
                    drawPencilPath(token.path);
                    break;
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(token.x, token.y, token.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    if (token.fill) ctx.fill();
                    break;
                case 'square':
                    ctx.beginPath();
                    ctx.rect(token.x, token.y, token.width, token.height);
                    ctx.stroke();
                    if (token.fill) ctx.fill();
                    break;
                case 'line':
                    ctx.beginPath();
                    ctx.moveTo(token.startX, token.startY);
                    ctx.lineTo(token.endX, token.endY);
                    ctx.stroke();
                    break;
                case 'text':
                    ctx.font = `${token.size}px Arial`;
                    ctx.fillStyle = token.color;
                    ctx.fillText(token.text, token.x, token.y);
                    break;
                case 'image':
                    const img = new Image();
                    img.src = token.src;
                    img.onload = () => ctx.drawImage(img, token.x, token.y, token.width, token.height);
                    break;
            }
        });
    }

    // Dessiner un chemin (crayon)
    function drawPencilPath(path) {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
    }

    // Événements de dessin
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        startX = e.offsetX;
        startY = e.offsetY;

        if (currentTool === 'pencil' || currentTool === 'eraser') {
            tokens.push({
                type: currentTool,
                color: currentTool === 'eraser' ? '#FFFFFF' : colorPicker.value,
                lineWidth: lineWidth.value,
                path: [{ x: startX, y: startY }]
            });
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;

        const currentX = e.offsetX;
        const currentY = e.offsetY;

        if (currentTool === 'pencil' || currentTool === 'eraser') {
            const currentToken = tokens[tokens.length - 1];
            currentToken.path.push({ x: currentX, y: currentY });
            redrawCanvas();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;

        const endX = e.offsetX;
        const endY = e.offsetY;

        switch (currentTool) {
            case 'circle':
                const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                tokens.push({
                    type: 'circle',
                    x: startX,
                    y: startY,
                    radius: radius,
                    color: colorPicker.value,
                    lineWidth: lineWidth.value,
                    fill: false
                });
                break;
            case 'square':
                const width = endX - startX;
                const height = endY - startY;
                tokens.push({
                    type: 'square',
                    x: startX,
                    y: startY,
                    width: width,
                    height: height,
                    color: colorPicker.value,
                    lineWidth: lineWidth.value,
                    fill: false
                });
                break;
            case 'line':
                tokens.push({
                    type: 'line',
                    startX: startX,
                    startY: startY,
                    endX: endX,
                    endY: endY,
                    color: colorPicker.value,
                    lineWidth: lineWidth.value
                });
                break;
        }

        redrawCanvas();
    });

    // Ajouter du texte
    addText.addEventListener('click', () => {
        if (textInput.value.trim() === '') return;
        tokens.push({
            type: 'text',
            text: textInput.value,
            x: 50,
            y: 50,
            size: 20,
            color: colorPicker.value
        });
        textInput.value = '';
        redrawCanvas();
    });

    // Charger une image
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    tokens.push({
                        type: 'image',
                        src: event.target.result,
                        x: 50,
                        y: 50,
                        width: img.width / 2,
                        height: img.height / 2
                    });
                    redrawCanvas();
                };
            };
            reader.readAsDataURL(file);
        }
    });

    // Effacer le canvas
    clearCanvas.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment tout effacer ?')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            tokens = [];
        }
    });

    // Sauvegarder dans le localStorage
    saveLocal.addEventListener('click', saveToLocalStorage);

    // Charger depuis le localStorage
    loadLocal.addEventListener('click', loadFromLocalStorage);

    // Importer un fichier JSON
    importJSON.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    tokens = JSON.parse(event.target.result);
                    redrawCanvas();
                };
                reader.readAsText(file);
            }
        };
        input.click();
    });

    // Exporter en JSON
    exportJSON.addEventListener('click', () => {
        const data = JSON.stringify(tokens, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'pions_jetons_des.json';
        link.href = url;
        link.click();
    });

    // Exporter en PNG
    exportPNG.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'pions_jetons_des.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    // Charger les données sauvegardées au démarrage
    loadFromLocalStorage();
});
