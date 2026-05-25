// gameData.js
let currentQuestions = {};
let currentBonusInfo = [];
let currentQuestionCount = 1;
let currentBadgeDataUrl = "";
let renderDebounceTimer = null;

// Debounce re-render to prevent excessive DOM updates
function debouncedRenderQuestions() {
  clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(() => {
    renderQuestions();
  }, 100);
}

export async function loadGameData() {
  const level = document.getElementById("levelSelect").value;
  const editor = document.getElementById("gameDataEditor");
  const loader = document.getElementById("gameDataLoading");

  editor.classList.add("hidden");
  loader.classList.remove("hidden");

  try {
    const response = await fetch(`/api/admin/gamedata/${level}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        showNotification(`No game data found for ${level}.`, "warning");
        loader.classList.add("hidden");
        return;
      }
      const errorBody = await response.json().catch(() => null);
      throw new Error(
        errorBody?.message || `Failed to fetch data for ${level}`,
      );
    }

    const data = await response.json();

    document.getElementById("levelHint").value = data.hint || "";
    document.getElementById("levelLoupeLink").value = data.loupeLink || "";
    currentQuestionCount =
      Number(data.questionCount) ||
      Object.keys(data.questions || {}).length ||
      1;
    document.getElementById("levelQuestionCount").value = currentQuestionCount;

    currentBadgeDataUrl = data.badgeUrl || "";
    document.getElementById("levelBadgeUrl").value = currentBadgeDataUrl;
    updateLevelBadgePreview();

    currentBonusInfo = Array.isArray(data.bonusInfo) ? data.bonusInfo : [];
    renderBonusInfo();

    currentQuestions = normalizeQuestions(
      data.questions || {},
      currentQuestionCount,
    );
    renderQuestions();

    loader.classList.add("hidden");
    editor.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    showNotification(error.message, "error");
    loader.classList.add("hidden");
  }
}

function normalizeQuestions(questions = {}, count = 1) {
  const normalized = {};
  for (let i = 1; i <= count; i++) {
    const key = `q${i}`;
    normalized[key] = normalizeQuestion(questions[key]);
  }
  return normalized;
}

function normalizeQuestion(source = {}) {
  const answers =
    Array.isArray(source.a) && source.a.length > 0
      ? source.a.slice()
      : ["", "", "", ""];
  const feedbacks = Array.isArray(source.feedbacks)
    ? source.feedbacks.slice()
    : [];

  while (feedbacks.length < answers.length) {
    feedbacks.push({
      text: "",
      imgs: [],
      audio: "",
      lyricsTitle: "",
      lyrics: "",
    });
  }

  return {
    q: source.q || "",
    imgs: Array.isArray(source.imgs) ? source.imgs : [],
    audio: source.audio || "",
    lyricsTitle: source.lyricsTitle || "",
    lyrics: source.lyrics || "",
    a: answers,
    c: Array.isArray(source.c) ? source.c : [0],
    feedbacks: feedbacks.map((item) => ({
      text: item?.text || "",
      imgs: Array.isArray(item?.imgs) ? item.imgs : [],
      audio: item?.audio || "",
      lyricsTitle: item?.lyricsTitle || "",
      lyrics: item?.lyrics || "",
    })),
  };
}

function createEmptyQuestion() {
  return {
    q: "",
    imgs: [],
    audio: "",
    lyricsTitle: "",
    lyrics: "",
    a: ["", "", "", ""],
    c: [0],
    feedbacks: [{ text: "", imgs: [], audio: "", lyricsTitle: "", lyrics: "" }],
  };
}

function renderQuestions() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";

  if (currentQuestionCount <= 0) {
    container.innerHTML =
      '<p class="text-muted">Set at least one question for this level.</p>';
    return;
  }

  for (let index = 1; index <= currentQuestionCount; index++) {
    const qKey = `q${index}`;
    const qData = currentQuestions[qKey] || createEmptyQuestion();

    const qCard = document.createElement("div");
    qCard.className = "question-card";

    const qHeader = document.createElement("div");
    qHeader.className = "question-header";
    qHeader.innerHTML = `<span>Question ${index} (${qKey})</span><span>▼</span>`;
    qHeader.onclick = () => toggleAccordion(qHeader);

    const qBody = document.createElement("div");
    qBody.className = "question-body";

    qBody.innerHTML = `
      <div class="form-group">
        <label>📝 Question Text</label>
        <input id="qText-${qKey}" type="text" class="form-control" value="${escapeHtml(qData.q)}" />
      </div>
      <div class="form-group">
        <label>🖼️ Question Images</label>
        <input id="qImages-${qKey}" type="file" class="form-control-file" accept="image/*" multiple />
        <div id="qImagesPreview-${qKey}" class="image-preview"></div>
      </div>
      <div class="form-group">
        <label>🔊 Question Audio File</label>
        <input id="qAudio-${qKey}" type="file" class="form-control-file" accept="audio/*" />
        <div id="qAudioPreview-${qKey}"></div>
      </div>
      <div class="form-group">
        <label>🎵 Lyrics Title</label>
        <input id="qLyricsTitle-${qKey}" type="text" class="form-control" value="${escapeHtml(qData.lyricsTitle || "")}" placeholder="e.g., Pathology Notes" />
      </div>
      <div class="form-group">
        <label>📄 Lyrics/Transcript</label>
        <textarea id="qLyrics-${qKey}" class="form-control" rows="3" placeholder="Enter lyrics or transcript...">${escapeHtml(qData.lyrics || "")}</textarea>
      </div>
      <div class="options-container">
        <h4>Answers & Feedback</h4>
      </div>
    `;

    const qTextInput = qBody.querySelector(`#qText-${qKey}`);
    qTextInput.addEventListener("change", (event) =>
      updateQuestionText(qKey, event.target.value),
    );

    const qImagesInput = qBody.querySelector(`#qImages-${qKey}`);
    qImagesInput.addEventListener("change", (event) =>
      handleQuestionImagesUpload(qKey, event.target.files),
    );
    renderImagePreview(
      qBody.querySelector(`#qImagesPreview-${qKey}`),
      qData.imgs,
      null,
    );

    const qAudioInput = qBody.querySelector(`#qAudio-${qKey}`);
    qAudioInput.addEventListener("change", (event) =>
      handleQuestionAudioUpload(qKey, event.target.files),
    );

    const qLyricsTitleInput = qBody.querySelector(`#qLyricsTitle-${qKey}`);
    qLyricsTitleInput.addEventListener("change", (event) =>
      updateQuestionLyricsTitle(qKey, event.target.value),
    );

    const qLyricsInput = qBody.querySelector(`#qLyrics-${qKey}`);
    qLyricsInput.addEventListener("change", (event) =>
      updateQuestionLyrics(qKey, event.target.value),
    );

    const optsContainer = qBody.querySelector(".options-container");
    qData.a.forEach((ans, aIndex) => {
      const isCorrect = qData.c.includes(aIndex);
      const feedback = qData.feedbacks[aIndex] || { text: "", imgs: [] };

      const optItem = document.createElement("div");
      optItem.className = `option-item ${isCorrect ? "correct-option" : ""}`;
      optItem.innerHTML = `
        <div class="option-header">
          <label class="correct-toggle">
            <input id="correct-${qKey}-${aIndex}" type="checkbox" ${isCorrect ? "checked" : ""} />
            <span>✓ Correct</span>
          </label>
          <input id="option-${qKey}-${aIndex}" type="text" class="form-control" value="${escapeHtml(ans)}" placeholder="Enter answer option" />
        </div>
        <div class="form-group mt-10">
          <label>📝 Feedback Text</label>
          <textarea id="feedbackText-${qKey}-${aIndex}" class="form-control" rows="2" placeholder="Provide feedback for this answer...">${escapeHtml(feedback.text)}</textarea>
        </div>
        <div class="form-group">
          <label>🖼️ Feedback Images</label>
          <input id="feedbackImages-${qKey}-${aIndex}" type="file" class="form-control-file" accept="image/*" multiple />
          <div id="feedbackImagesPreview-${qKey}-${aIndex}" class="image-preview"></div>
        </div>
      `;

      optsContainer.appendChild(optItem);

      const correctInput = optItem.querySelector(`#correct-${qKey}-${aIndex}`);
      correctInput.addEventListener("change", (event) =>
        toggleCorrectAnswer(qKey, aIndex, event.target.checked),
      );

      const answerInput = optItem.querySelector(`#option-${qKey}-${aIndex}`);
      answerInput.addEventListener("change", (event) =>
        updateOptionText(qKey, aIndex, event.target.value),
      );

      const feedbackText = optItem.querySelector(
        `#feedbackText-${qKey}-${aIndex}`,
      );
      feedbackText.addEventListener("change", (event) =>
        updateFeedbackText(qKey, aIndex, event.target.value),
      );

      const feedbackImagesInput = optItem.querySelector(
        `#feedbackImages-${qKey}-${aIndex}`,
      );
      feedbackImagesInput.addEventListener("change", (event) =>
        handleFeedbackImagesUpload(qKey, aIndex, event.target.files),
      );

      // Render feedback images with metadata
      const feedbackImagesPreview = optItem.querySelector(
        `#feedbackImagesPreview-${qKey}-${aIndex}`,
      );
      renderFeedbackImagePreview(
        feedbackImagesPreview,
        qKey,
        aIndex,
        feedback.imgs,
      );
    });

    qCard.appendChild(qHeader);
    qCard.appendChild(qBody);
    container.appendChild(qCard);
  }

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-success mt-20";
  saveBtn.innerText = "Save All Game Data";
  saveBtn.style.width = "100%";
  saveBtn.addEventListener("click", saveGameData);
  container.appendChild(saveBtn);
}

function toggleAccordion(headerElement) {
  headerElement.classList.toggle("open");
  const body = headerElement.nextElementSibling;
  if (body) body.classList.toggle("open");
  const span = headerElement.querySelectorAll("span")[1];
  if (span)
    span.textContent = headerElement.classList.contains("open") ? "▲" : "▼";
}

function renderImagePreview(container, images, onRemove) {
  container.innerHTML = "";
  if (!Array.isArray(images) || images.length === 0) {
    return;
  }

  images.forEach((imgSrc, imageIndex) => {
    const previewCard = document.createElement("div");
    previewCard.className = "image-chip";

    const previewImg = document.createElement("img");
    const resolvedSrc =
      typeof imgSrc === "string"
        ? imgSrc
        : imgSrc && (imgSrc.src || imgSrc.path)
          ? imgSrc.src || imgSrc.path
          : "";
    previewImg.src = resolvedSrc;
    previewImg.alt = `Image ${imageIndex + 1}`;
    previewImg.loading = "lazy";

    if (typeof imgSrc === "object" && imgSrc !== null && imgSrc.title) {
      previewImg.title = imgSrc.title;
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove-image";
    removeBtn.innerText = "×";
    removeBtn.title = "Remove image";
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Just remove locally - don't trigger full re-render
      images.splice(imageIndex, 1);
      renderImagePreview(container, images, onRemove);
    });

    previewCard.appendChild(previewImg);
    previewCard.appendChild(removeBtn);
    container.appendChild(previewCard);
  });
}

function renderFeedbackImagePreview(container, qKey, answerIndex, images) {
  container.innerHTML = "";
  if (!Array.isArray(images) || images.length === 0) {
    return;
  }

  const imagesList = document.createElement("div");
  imagesList.className = "feedback-images-list";

  images.forEach((imgData, imageIndex) => {
    const imgCard = document.createElement("div");
    imgCard.className = "feedback-image-card";

    const imgSrc =
      typeof imgData === "string"
        ? imgData
        : imgData?.src || imgData?.path || "";
    const imgTitle = typeof imgData === "object" ? imgData?.title || "" : "";
    const imgSource = typeof imgData === "object" ? imgData?.source || "" : "";
    const imgDescription =
      typeof imgData === "object" ? imgData?.description || "" : "";

    imgCard.innerHTML = `
      <div class="image-preview-wrapper">
        <img src="${imgSrc}" alt="Feedback ${imageIndex + 1}" class="feedback-image-thumb" />
        <button type="button" class="btn-remove-image" onclick="removeFeedbackImageWithMeta('${qKey}', ${answerIndex}, ${imageIndex})">×</button>
      </div>
      <div class="image-metadata">
        <div class="form-group mt-5">
          <label>Image Title</label>
          <input type="text" class="form-control form-control-sm" value="${escapeHtml(imgTitle)}" 
                 onchange="updateFeedbackImageMeta('${qKey}', ${answerIndex}, ${imageIndex}, 'title', this.value)" placeholder="e.g., Histology" />
        </div>
        <div class="form-group mt-5">
          <label>Source</label>
          <input type="text" class="form-control form-control-sm" value="${escapeHtml(imgSource)}" 
                 onchange="updateFeedbackImageMeta('${qKey}', ${answerIndex}, ${imageIndex}, 'source', this.value)" placeholder="e.g., WHO Classification" />
        </div>
        <div class="form-group mt-5">
          <label>Description</label>
          <textarea class="form-control form-control-sm" rows="2" onchange="updateFeedbackImageMeta('${qKey}', ${answerIndex}, ${imageIndex}, 'description', this.value)" placeholder="Explain the image...">${escapeHtml(imgDescription)}</textarea>
        </div>
      </div>
    `;

    imagesList.appendChild(imgCard);
  });

  container.appendChild(imagesList);
}

window.updateQuestionCount = (value) => {
  const count = Math.max(1, Math.min(20, Number(value) || 1));
  currentQuestionCount = count;
  document.getElementById("levelQuestionCount").value = currentQuestionCount;
  currentQuestions = normalizeQuestions(currentQuestions, currentQuestionCount);
  debouncedRenderQuestions();
};

window.handleLevelBadgeUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  currentBadgeDataUrl = await readFileAsDataUrl(file);
  document.getElementById("levelBadgeUrl").value = currentBadgeDataUrl;
  updateLevelBadgePreview();
};

function updateLevelBadgePreview() {
  const preview = document.getElementById("levelBadgePreview");
  if (!preview) return;
  preview.innerHTML = "";
  if (!currentBadgeDataUrl) return;

  const img = document.createElement("img");
  img.src = currentBadgeDataUrl;
  img.alt = "Level Badge";
  img.className = "preview-image";
  preview.appendChild(img);
}

window.handleQuestionImagesUpload = async (qKey, files) => {
  if (!files || files.length === 0) return;
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].imgs = await readFilesAsDataUrls(files);
  debouncedRenderQuestions();
};

window.handleQuestionAudioUpload = async (qKey, files) => {
  if (!files || files.length === 0) return;
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].audio = await readFileAsDataUrl(files[0]);
};

window.updateQuestionLyricsTitle = (qKey, val) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].lyricsTitle = val;
};

window.updateQuestionLyrics = (qKey, val) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].lyrics = val;
};

window.handleFeedbackImagesUpload = async (qKey, answerIndex, files) => {
  if (!files || files.length === 0) return;
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  if (!currentQuestions[qKey].feedbacks) currentQuestions[qKey].feedbacks = [];
  if (!currentQuestions[qKey].feedbacks[answerIndex]) {
    currentQuestions[qKey].feedbacks[answerIndex] = { text: "", imgs: [] };
  }
  currentQuestions[qKey].feedbacks[answerIndex].imgs =
    await readFilesAsDataUrls(files);
  debouncedRenderQuestions();
};

window.removeQuestionImage = (qKey, imageIndex) => {
  if (currentQuestions[qKey]?.imgs) {
    currentQuestions[qKey].imgs.splice(imageIndex, 1);
  }
};

window.removeFeedbackImage = (qKey, answerIndex, imageIndex) => {
  if (currentQuestions[qKey]?.feedbacks?.[answerIndex]?.imgs) {
    currentQuestions[qKey].feedbacks[answerIndex].imgs.splice(imageIndex, 1);
  }
};

window.removeFeedbackImageWithMeta = (qKey, answerIndex, imageIndex) => {
  if (currentQuestions[qKey]?.feedbacks?.[answerIndex]?.imgs) {
    currentQuestions[qKey].feedbacks[answerIndex].imgs.splice(imageIndex, 1);
    debouncedRenderQuestions();
  }
};

window.updateFeedbackImageMeta = (
  qKey,
  answerIndex,
  imageIndex,
  metaField,
  value,
) => {
  const img =
    currentQuestions[qKey]?.feedbacks?.[answerIndex]?.imgs?.[imageIndex];
  if (!img) return;

  // Convert string to object if needed
  if (typeof img === "string") {
    currentQuestions[qKey].feedbacks[answerIndex].imgs[imageIndex] = {
      src: img,
      title: "",
      source: "",
      description: "",
    };
  }

  currentQuestions[qKey].feedbacks[answerIndex].imgs[imageIndex][metaField] =
    value;
};

window.updateQuestionText = (qKey, val) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].q = val;
};

window.updateOptionText = (qKey, aIndex, val) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].a[aIndex] = val;
};

window.updateFeedbackText = (qKey, aIndex, val) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  if (!currentQuestions[qKey].feedbacks) currentQuestions[qKey].feedbacks = [];
  if (!currentQuestions[qKey].feedbacks[aIndex]) {
    currentQuestions[qKey].feedbacks[aIndex] = { text: "", imgs: [] };
  }
  currentQuestions[qKey].feedbacks[aIndex].text = val;
};

window.toggleCorrectAnswer = (qKey, aIndex, isChecked) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  const cArr = Array.isArray(currentQuestions[qKey].c)
    ? currentQuestions[qKey].c
    : [];
  if (isChecked) {
    if (!cArr.includes(aIndex)) cArr.push(aIndex);
  } else {
    const idx = cArr.indexOf(aIndex);
    if (idx > -1) cArr.splice(idx, 1);
  }
  currentQuestions[qKey].c = cArr;

  // Update visual indicator
  const optionItem = document
    .querySelector(`div:has(#correct-${qKey}-${aIndex})`)
    ?.closest(".option-item");
  if (optionItem) {
    if (isChecked) {
      optionItem.classList.add("correct-option");
    } else {
      optionItem.classList.remove("correct-option");
    }
  }
};

window.addBonusInfoSection = () => {
  currentBonusInfo.push({ content: [] });
  debouncedRenderBonusInfo();
};

window.addContentBlock = (sectionIndex, blockType) => {
  if (!currentBonusInfo[sectionIndex]) {
    currentBonusInfo[sectionIndex] = { content: [] };
  }
  if (!Array.isArray(currentBonusInfo[sectionIndex].content)) {
    currentBonusInfo[sectionIndex].content = [];
  }

  const newBlock = {
    type: blockType,
    value: blockType === "text" ? "" : [],
  };

  currentBonusInfo[sectionIndex].content.push(newBlock);
  debouncedRenderBonusInfo();
};

window.removeContentBlock = (sectionIndex, blockIndex) => {
  if (
    currentBonusInfo[sectionIndex] &&
    Array.isArray(currentBonusInfo[sectionIndex].content)
  ) {
    currentBonusInfo[sectionIndex].content.splice(blockIndex, 1);
    debouncedRenderBonusInfo();
  }
};

window.removeBonusInfoSection = (index) => {
  currentBonusInfo.splice(index, 1);
  debouncedRenderBonusInfo();
};

window.updateContentBlock = (sectionIndex, blockIndex, blockType, value) => {
  if (
    currentBonusInfo[sectionIndex] &&
    Array.isArray(currentBonusInfo[sectionIndex].content)
  ) {
    currentBonusInfo[sectionIndex].content[blockIndex].value = value;
  }
};

window.handleBonusImageUpload = async (sectionIndex, blockIndex, files) => {
  if (!files || files.length === 0) return;
  if (!currentBonusInfo[sectionIndex]) return;
  if (!Array.isArray(currentBonusInfo[sectionIndex].content)) return;

  const imageUrls = await readFilesAsDataUrls(files);
  currentBonusInfo[sectionIndex].content[blockIndex].value = imageUrls;
  debouncedRenderBonusInfo();
};

function renderBonusInfo() {
  const container = document.getElementById("bonusInfoContainer");
  if (!container) return;
  container.innerHTML = "";

  if (currentBonusInfo.length === 0) {
    container.innerHTML =
      '<p class="text-muted" style="padding: 20px; text-align: center;">No bonus info sections added yet.</p>';
    return;
  }

  currentBonusInfo.forEach((section, sectionIndex) => {
    const card = document.createElement("div");
    card.className = "bonus-info-section";
    card.innerHTML = `
      <div class="bonus-section-header">
        <div class="bonus-section-title">
          <span class="bonus-section-number">${sectionIndex + 1}</span>
          <h4>Bonus Info Section ${sectionIndex + 1}</h4>
        </div>
        <button type="button" class="btn-danger btn-sm" onclick="removeBonusInfoSection(${sectionIndex})">
          <span>🗑️</span> Remove
        </button>
      </div>
      <div id="contentBlocks-${sectionIndex}" class="content-blocks" data-section-index="${sectionIndex}"></div>
      <div class="bonus-controls mt-10">
        <button type="button" class="btn-secondary btn-sm" onclick="addContentBlock(${sectionIndex}, 'text')">
          <span>📝</span> Add Text Block
        </button>
        <button type="button" class="btn-secondary btn-sm" onclick="addContentBlock(${sectionIndex}, 'images')">
          <span>🖼️</span> Add Image(s)
        </button>
      </div>
    `;

    container.appendChild(card);

    // Render content blocks
    const contentContainer = card.querySelector(
      `#contentBlocks-${sectionIndex}`,
    );
    const content = Array.isArray(section.content) ? section.content : [];

    if (content.length === 0) {
      contentContainer.innerHTML =
        '<p class="text-muted" style="text-align: center; padding: 20px;">No content blocks added. Add text or images below.</p>';
    } else {
      content.forEach((block, blockIndex) => {
        renderContentBlock(contentContainer, sectionIndex, blockIndex, block);
      });
    }
  });
}

function renderContentBlock(container, sectionIndex, blockIndex, block) {
  const blockEl = document.createElement("div");
  blockEl.className = `content-block content-block-${block.type}`;
  blockEl.id = `block-${sectionIndex}-${blockIndex}`;
  blockEl.draggable = true;

  const blockHeader = document.createElement("div");
  blockHeader.className = "content-block-header";

  const typeLabel = block.type === "text" ? "📝 Text" : "🖼️ Images";
  blockHeader.innerHTML = `
    <span class="block-label">${typeLabel}</span>
    <div class="block-actions">
      <button type="button" class="btn-remove" onclick="removeContentBlock(${sectionIndex}, ${blockIndex})" title="Remove block">×</button>
    </div>
  `;
  blockEl.appendChild(blockHeader);

  const blockContent = document.createElement("div");
  blockContent.className = "content-block-content";

  if (block.type === "text") {
    blockContent.innerHTML = `
      <textarea 
        class="form-control text-block-input"
        id="text-${sectionIndex}-${blockIndex}"
        rows="3"
        placeholder="Enter text content..."
      >${escapeHtml(block.value || "")}</textarea>
    `;
    const textarea = blockContent.querySelector(
      `#text-${sectionIndex}-${blockIndex}`,
    );
    textarea.addEventListener("change", (e) =>
      updateContentBlock(sectionIndex, blockIndex, "text", e.target.value),
    );
  } else if (block.type === "images") {
    blockContent.innerHTML = `
      <div class="images-block-wrapper">
        <input 
          type="file"
          multiple
          accept="image/*"
          class="form-control-file"
          id="images-${sectionIndex}-${blockIndex}"
        />
        <div id="imagePreview-${sectionIndex}-${blockIndex}" class="image-preview"></div>
      </div>
    `;
    const imageInput = blockContent.querySelector(
      `#images-${sectionIndex}-${blockIndex}`,
    );
    imageInput.addEventListener("change", (e) =>
      handleBonusImageUpload(sectionIndex, blockIndex, e.target.files),
    );

    const images = Array.isArray(block.value) ? block.value : [];
    const previewContainer = blockContent.querySelector(
      `#imagePreview-${sectionIndex}-${blockIndex}`,
    );
    if (images.length > 0) {
      renderImagePreview(previewContainer, images, null);
    }
  }

  blockEl.appendChild(blockContent);
  container.appendChild(blockEl);
}

// Debounce bonus info render
let bonusDebounceTimer = null;
function debouncedRenderBonusInfo() {
  clearTimeout(bonusDebounceTimer);
  bonusDebounceTimer = setTimeout(() => {
    renderBonusInfo();
  }, 100);
}

async function saveGameData() {
  const level = document.getElementById("levelSelect").value;
  const hint = document.getElementById("levelHint").value;
  const loupeLink = document.getElementById("levelLoupeLink").value;
  const badgeUrl = document.getElementById("levelBadgeUrl").value;

  try {
    const response = await fetch(`/api/admin/gamedata/${level}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
      },
      body: JSON.stringify({
        hint,
        loupeLink,
        bonusInfo: currentBonusInfo,
        badgeUrl,
        questionCount: currentQuestionCount,
        questions: currentQuestions,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save game data.");
    }

    showNotification(`Game data for ${level} saved successfully!`, "success");
  } catch (error) {
    console.error(error);
    showNotification(error.message, "error");
  }
}

window.loadGameData = loadGameData;
window.saveLevelConfig = saveGameData;
window.saveGameData = saveGameData;

function showNotification(message, type = "info") {
  let toast = document.getElementById("notification");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "notification";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `notification ${type} show`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFilesAsDataUrls(files) {
  return Promise.all(Array.from(files).map(readFileAsDataUrl));
}
