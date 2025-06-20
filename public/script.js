const LAMBDA_URL =
  "https://ettxuxfbfap75g64meugsbdqpe0tkriy.lambda-url.us-east-2.on.aws/";
const MAX_FILE_SIZE_MB = 25;

const OPERATIONS = [
  {
    id: "resize-image",
    name: "Redimensionar",
    icon: "photo_size_select_large",
    desc: "Alterar dimensões da imagem",
  },
  {
    id: "image-to-bw",
    name: "Preto e Branco",
    icon: "filter_b_and_w",
    desc: "Converter para escala de cinza",
  },
  {
    id: "create-thumbnail",
    name: "Thumbnail",
    icon: "image",
    desc: "Gerar miniatura da imagem",
  },
  {
    id: "enhance-image",
    name: "Melhorar",
    icon: "tonality",
    desc: "Ajustar brilho, contraste e mais",
  },
  {
    id: "image-to-pdf",
    name: "Converter p/ PDF",
    icon: "picture_as_pdf",
    desc: "Salvar imagem como um arquivo PDF",
  },
];

let selectedFile = null;
let processedFiles = [];
let currentOperation = null;
let isProcessing = false;

document.addEventListener("DOMContentLoaded", setupEventListeners);

function setupEventListeners() {
  const fileInput = document.getElementById("fileInput");
  const uploadSection = document.getElementById("uploadSection");
  fileInput.addEventListener("change", handleFileSelect);
  uploadSection.addEventListener("dragover", handleDragOver);
  uploadSection.addEventListener("dragleave", handleDragLeave);
  uploadSection.addEventListener("drop", handleDrop);
  document
    .getElementById("processButton")
    .addEventListener("click", () => processFile());
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) selectFile(file);
}

function handleDrop(event) {
  event.preventDefault();
  document.getElementById("uploadSection").classList.remove("dragover");
  const file = event.dataTransfer.files[0];
  if (file) selectFile(file);
}

function selectFile(file) {
  if (!validateFile(file)) return;
  selectedFile = file;
  document.getElementById("uploadSection").style.display = "none";
  document.getElementById("selectedFileSection").style.display = "block";
  showSelectedFileInfo(file);
  showImagePreview(file);
  renderOperations();
  resetResults();
}

function validateFile(file) {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    showToast(
      "Tipo de arquivo não suportado! Use JPG, PNG ou GIF.",
      "error"
    );
    return false;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    showToast(
      `Arquivo muito grande! Máximo: ${MAX_FILE_SIZE_MB}MB.`,
      "error"
    );
    return false;
  }
  return true;
}

function resetSelection() {
  selectedFile = null;
  currentOperation = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("uploadSection").style.display = "block";
  document.getElementById("selectedFileSection").style.display = "none";
  document.getElementById("optionsContainer").innerHTML = "";
  document.getElementById("processButton").classList.remove("show");
  resetResults();
  showToast("Seleção removida.", "info");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (error) => reject(error);
  });
}

function showSelectedFileInfo(file) {
  document.getElementById("fileName").textContent = file.name;
  document.getElementById("fileDetails").textContent = `Tipo: ${file.type
    } • ${formatFileSize(file.size)}`;
}

function showImagePreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById(
      "imagePreviewContainer"
    ).innerHTML = `<div class="image-preview"><img src="${e.target.result}" alt="Preview"></div>`;
  };
  reader.readAsDataURL(file);
}

function renderOperations() {
  const grid = document.getElementById("operationsGrid");
  grid.innerHTML = OPERATIONS.map(
    (op) => `
          <div class="operation-card" id="op-card-${op.id}" onclick="selectOperation('${op.id}')">
            <div class="operation-icon"><span class="material-icons">${op.icon}</span></div>
            <div class="operation-title">${op.name}</div>
            <div class="operation-desc">${op.desc}</div>
          </div>
        `
  ).join("");
}

function selectOperation(operationId) {
  currentOperation = operationId;

  document
    .querySelectorAll(".operation-card")
    .forEach((card) => card.classList.remove("active"));
  document
    .getElementById(`op-card-${operationId}`)
    .classList.add("active");

  showOperationOptions(operationId);

  const opName = OPERATIONS.find((op) => op.id === operationId).name;
  const processButton = document.getElementById("processButton");
  processButton.innerHTML = `Processar: ${opName}`;
  processButton.classList.add("show");

  showToast(`Operação "${opName}" selecionada.`, "info");
}

function showOperationOptions(operationId) {
  const container = document.getElementById("optionsContainer");
  let optionsHTML = "";
  switch (operationId) {
    case "resize-image":
      optionsHTML = `<div class="options-section show"><div class="options-title"><span class="material-icons">photo_size_select_large</span>Opções de Redimensionamento</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;"><div class="form-group"><label class="form-label">Largura (px):</label><input type="number" class="form-control" id="resizeWidth" value="1024" min="1"></div><div class="form-group"><label class="form-label">Altura (px):</label><input type="number" class="form-control" id="resizeHeight" value="1024" min="1"></div></div><div class="form-group"><label class="form-label">Manter proporção:</label><select class="form-control" id="maintainRatio"><option value="true" selected>Sim</option><option value="false">Não</option></select></div></div>`;
      break;
    case "enhance-image":
      optionsHTML = `<div class="options-section show"><div class="options-title"><span class="material-icons">tonality</span>Opções de Melhoria</div><div class="form-group"><label class="form-label">Brilho:</label><div class="range-container"><input type="range" class="form-control" id="brightness" min="0.5" max="2" step="0.1" value="1" oninput="updateRangeValue(this, 'brightnessValue')"><span class="range-value" id="brightnessValue">1.0</span></div></div><div class="form-group"><label class="form-label">Contraste:</label><div class="range-container"><input type="range" class="form-control" id="contrast" min="0.5" max="2" step="0.1" value="1" oninput="updateRangeValue(this, 'contrastValue')"><span class="range-value" id="contrastValue">1.0</span></div></div><div class="form-group"><label class="form-label">Saturação:</label><div class="range-container"><input type="range" class="form-control" id="saturation" min="0.5" max="2" step="0.1" value="1" oninput="updateRangeValue(this, 'saturationValue')"><span class="range-value" id="saturationValue">1.0</span></div></div></div>`;
      break;
    case "create-thumbnail":
      optionsHTML = `<div class="options-section show"><div class="options-title"><span class="material-icons">image</span>Opções de Thumbnail</div><div class="form-group"><label class="form-label">Tamanho Máximo (px):</label><select class="form-control" id="thumbnailSize"><option value="128">128</option><option value="256" selected>256</option><option value="512">512</option></select></div></div>`;
      break;
    default:
      optionsHTML = "";
      break;
  }
  container.innerHTML = optionsHTML;
}

function getOperationOptions(operationId) {
  const options = {};
  switch (operationId) {
    case "resize-image":
      options.width =
        parseInt(document.getElementById("resizeWidth")?.value, 10) ||
        1024;
      options.height =
        parseInt(document.getElementById("resizeHeight")?.value, 10) ||
        1024;
      options.maintainRatio =
        document.getElementById("maintainRatio")?.value === "true";
      break;
    case "enhance-image":
      options.brightness =
        parseFloat(document.getElementById("brightness")?.value) || 1.0;
      options.contrast =
        parseFloat(document.getElementById("contrast")?.value) || 1.0;
      options.saturation =
        parseFloat(document.getElementById("saturation")?.value) || 1.0;
      break;
    case "create-thumbnail":
      options.size =
        parseInt(document.getElementById("thumbnailSize")?.value, 10) ||
        256;
      break;
  }
  return options;
}

async function processFile() {
  if (!selectedFile || !currentOperation || isProcessing) return;

  isProcessing = true;
  setProcessingState(true);

  try {
    updateProcessingStatus("Preparando imagem...");
    const fileBase64 = await fileToBase64(selectedFile);
    const options = getOperationOptions(currentOperation);

    updateProcessingStatus("Enviando para a nuvem...");
    const payload = {
      fileName: selectedFile.name,
      fileData: fileBase64,
      operation: currentOperation,
      options: options,
      contentType: selectedFile.type,
    };

    const response = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    updateProcessingStatus("Recebendo resultado...");
    const result = await response.json();

    if (result.success) {
      handleSuccess(result);
    } else {
      if (result.logs) {
        const errorFile = {
          id: Date.now(),
          originalName: selectedFile.name,
          operation: "ERRO",
          fileName: `Erro: ${selectedFile.name}`,
          details: result.message,
          downloadUrl: null,
          resultData: null,
          logs: result.logs,
        };
        processedFiles.unshift(errorFile);
        renderResults();
      }
      throw new Error(result.message || "Erro desconhecido no backend");
    }
  } catch (error) {
    console.error("Erro no Processamento:", error);
    showToast(`Erro: ${error.message}`, "error");
  } finally {
    isProcessing = false;
    setProcessingState(false);
  }
}

function handleSuccess(result) {
  const opName = OPERATIONS.find((op) => op.id === currentOperation).name;
  processedFiles.unshift({
    id: Date.now(),
    originalName: selectedFile.name,
    operation: opName,
    fileName: result.processedFile || `${opName}`,
    details: result.processingDetails,
    downloadUrl:
      result.downloadUrl || result.s3Info?.processed?.downloadUrl,
    resultData: result.resultData,
    logs: result.logs || ["Nenhum log retornado do backend."], // Adiciona os logs ao objeto
  });
  renderResults();
  showToast("Processamento concluído com sucesso! 🎉", "success");
}

function setProcessingState(isProcessing) {
  document
    .getElementById("processingIndicator")
    .classList.toggle("show", isProcessing);
  document.getElementById("processButton").disabled = isProcessing;
  if (isProcessing) {
    document
      .getElementById(`op-card-${currentOperation}`)
      ?.classList.add("processing");
  } else {
    document
      .querySelector(".operation-card.processing")
      ?.classList.remove("processing");
  }
}

function renderResults() {
  const section = document.getElementById("resultsSection");
  const list = document.getElementById("resultsList");
  section.classList.add("show");

  list.innerHTML = processedFiles
    .map((file) => {
      const isExif = !!file.resultData;
      const isError = file.operation === "ERRO";
      return `
            <div class="result-item ${isError ? "error-item" : ""}">
              <div class="result-item-header" onclick="toggleResultDetails(${file.id
        })">
                <span class="material-icons result-icon">${isError ? "error" : isExif ? "description" : "check_circle"
        }</span>
                <div class="result-info">
                  <div class="result-name">${file.fileName}</div>
                  <div class="result-operation">${file.operation} • ${file.originalName
        }</div>
                </div>
                <span class="material-icons download-arrow" id="arrow_${file.id
        }">expand_more</span>
              </div>
              <div class="result-details" id="details_${file.id}">
                <div class="file-info-content" style="margin-bottom: 15px;">
                  <strong>Detalhes:</strong> ${file.details}
                </div>
                ${isExif
          ? `<pre class="json-viewer">${JSON.stringify(
            file.resultData,
            null,
            2
          )}</pre>`
          : file.downloadUrl
            ? `<a href="${file.downloadUrl}" class="download-button" target="_blank"><span class="material-icons">download</span>Baixar Resultado</a>`
            : isError
              ? '<p style="color:#ff6b6b;">❌ Processamento falhou - verifique os logs abaixo.</p>'
              : '<p style="color:#666;">O download não está disponível (S3 não configurado).</p>'
        }
                
                <div class="logs-section">
                  <strong>📋 Logs de Execução do Backend:</strong>
                  <pre class="logs-viewer">${Array.isArray(file.logs) ? file.logs.join("\n") : file.logs
        }</pre>
                </div>
              </div>
            </div>
          `;
    })
    .join("");
}

function toggleResultDetails(fileId) {
  const details = document.getElementById(`details_${fileId}`);
  const arrow = document.getElementById(`arrow_${fileId}`);
  const isShown = details.classList.toggle("show");
  arrow.textContent = isShown ? "expand_less" : "expand_more";
}

function resetResults() {
  processedFiles = [];
  document.getElementById("resultsSection").classList.remove("show");
  document.getElementById("resultsList").innerHTML = "";
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("uploadSection").classList.add("dragover");
}
function handleDragLeave(e) {
  document.getElementById("uploadSection").classList.remove("dragover");
}
function updateProcessingStatus(status) {
  document.getElementById("processingStatus").textContent = status;
}
function updateRangeValue(input, outputId, unit = "") {
  document.getElementById(outputId).textContent = `${parseFloat(
    input.value
  )}${unit}`;
}
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}