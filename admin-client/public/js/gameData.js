// gameData.js
let currentQuestions = {};
let currentBonusInfo = [];
let currentQuestionCount = 1;
let currentBadgeDataUrl = "";

export async function loadGameData() {
  const level = document.getElementById('levelSelect').value;
  const editor = document.getElementById('gameDataEditor');
  const loader = document.getElementById('gameDataLoading');

  editor.classList.add('hidden');
  loader.classList.remove('hidden');

  try {
    const response = await fetch(`/api/admin/gamedata/${level}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        showNotification(`No game data found for ${level}.`, 'warning');
        loader.classList.add('hidden');
        return;
      }
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.message || `Failed to fetch data for ${level}`);
    }

    const data = await response.json();

    document.getElementById('levelHint').value = data.hint || '';
    document.getElementById('levelLoupeLink').value = data.loupeLink || '';
    currentQuestionCount = Number(data.questionCount) || Object.keys(data.questions || {}).length || 1;
    document.getElementById('levelQuestionCount').value = currentQuestionCount;

    currentBadgeDataUrl = data.badgeUrl || '';
    document.getElementById('levelBadgeUrl').value = currentBadgeDataUrl;
    updateLevelBadgePreview();

    currentBonusInfo = Array.isArray(data.bonusInfo) ? data.bonusInfo : [];
    renderBonusInfo();

    currentQuestions = normalizeQuestions(data.questions || {}, currentQuestionCount);
    renderQuestions();

    loader.classList.add('hidden');
    editor.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    showNotification(error.message, 'error');
    loader.classList.add('hidden');
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
  const answers = Array.isArray(source.a) && source.a.length > 0 ? source.a.slice() : ['', '', '', ''];
  const feedbacks = Array.isArray(source.feedbacks) ? source.feedbacks.slice() : [];

  while (feedbacks.length < answers.length) {
    feedbacks.push({ text: '', imgs: [] });
  }

  return {
    q: source.q || '',
    imgs: Array.isArray(source.imgs) ? source.imgs : [],
    a: answers,
    c: Array.isArray(source.c) ? source.c : [0],
    feedbacks: feedbacks.map((item) => ({
      text: item?.text || '',
      imgs: Array.isArray(item?.imgs) ? item.imgs : [],
    })),
  };
}

function createEmptyQuestion() {
  return {
    q: '',
    imgs: [],
    a: ['', '', '', ''],
    c: [0],
    feedbacks: [{ text: '', imgs: [] }],
  };
}

function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  container.innerHTML = '';

  if (currentQuestionCount <= 0) {
    container.innerHTML = '<p class="text-muted">Set at least one question for this level.</p>';
    return;
  }

  for (let index = 1; index <= currentQuestionCount; index++) {
    const qKey = `q${index}`;
    const qData = currentQuestions[qKey] || createEmptyQuestion();

    const qCard = document.createElement('div');
    qCard.className = 'question-card';

    const qHeader = document.createElement('div');
    qHeader.className = 'question-header';
    qHeader.innerHTML = `<span>Question ${index} (${qKey})</span><span>▼</span>`;
    qHeader.onclick = () => toggleAccordion(qHeader);

    const qBody = document.createElement('div');
    qBody.className = 'question-body';

    qBody.innerHTML = `
      <div class="form-group">
        <label>Question Text</label>
        <input id="qText-${qKey}" type="text" class="form-control" value="${escapeHtml(qData.q)}" />
      </div>
      <div class="form-group">
        <label>Question Images</label>
        <input id="qImages-${qKey}" type="file" class="form-control-file" accept="image/*" multiple />
        <div id="qImagesPreview-${qKey}" class="image-preview"></div>
      </div>
      <div class="options-container">
        <h4>Answers & Feedback</h4>
      </div>
    `;

    const qTextInput = qBody.querySelector(`#qText-${qKey}`);
    qTextInput.addEventListener('change', (event) => updateQuestionText(qKey, event.target.value));

    const qImagesInput = qBody.querySelector(`#qImages-${qKey}`);
    qImagesInput.addEventListener('change', (event) => handleQuestionImagesUpload(qKey, event.target.files));
    renderImagePreview(qBody.querySelector(`#qImagesPreview-${qKey}`), qData.imgs, (imageIndex) => {
      removeQuestionImage(qKey, imageIndex);
      renderQuestions();
    });

    const optsContainer = qBody.querySelector('.options-container');
    qData.a.forEach((ans, aIndex) => {
      const isCorrect = qData.c.includes(aIndex);
      const feedback = qData.feedbacks[aIndex] || { text: '', imgs: [] };

      const optItem = document.createElement('div');
      optItem.className = 'option-item';
      optItem.innerHTML = `
        <div class="option-header">
          <label class="correct-toggle">
            <input id="correct-${qKey}-${aIndex}" type="checkbox" ${isCorrect ? 'checked' : ''} />
            <span>Correct</span>
          </label>
          <input id="option-${qKey}-${aIndex}" type="text" class="form-control" value="${escapeHtml(ans)}" placeholder="Answer option" />
        </div>
        <div class="form-group mt-10">
          <label>Feedback Text</label>
          <textarea id="feedbackText-${qKey}-${aIndex}" class="form-control" rows="2">${escapeHtml(feedback.text)}</textarea>
        </div>
        <div class="form-group">
          <label>Feedback Images</label>
          <input id="feedbackImages-${qKey}-${aIndex}" type="file" class="form-control-file" accept="image/*" multiple />
          <div id="feedbackImagesPreview-${qKey}-${aIndex}" class="image-preview"></div>
        </div>
      `;

      optsContainer.appendChild(optItem);

      const correctInput = optItem.querySelector(`#correct-${qKey}-${aIndex}`);
      correctInput.addEventListener('change', (event) => toggleCorrectAnswer(qKey, aIndex, event.target.checked));

      const answerInput = optItem.querySelector(`#option-${qKey}-${aIndex}`);
      answerInput.addEventListener('change', (event) => updateOptionText(qKey, aIndex, event.target.value));

      const feedbackText = optItem.querySelector(`#feedbackText-${qKey}-${aIndex}`);
      feedbackText.addEventListener('change', (event) => updateFeedbackText(qKey, aIndex, event.target.value));

      const feedbackImagesInput = optItem.querySelector(`#feedbackImages-${qKey}-${aIndex}`);
      feedbackImagesInput.addEventListener('change', (event) => handleFeedbackImagesUpload(qKey, aIndex, event.target.files));
      renderImagePreview(optItem.querySelector(`#feedbackImagesPreview-${qKey}-${aIndex}`), feedback.imgs, (imageIndex) => {
        removeFeedbackImage(qKey, aIndex, imageIndex);
        renderQuestions();
      });
    });

    qCard.appendChild(qHeader);
    qCard.appendChild(qBody);
    container.appendChild(qCard);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-success mt-20';
  saveBtn.innerText = 'Save All Game Data';
  saveBtn.style.width = '100%';
  saveBtn.addEventListener('click', saveGameData);
  container.appendChild(saveBtn);
}

function toggleAccordion(headerElement) {
  headerElement.classList.toggle('open');
  const body = headerElement.nextElementSibling;
  if (body) body.classList.toggle('open');
  const span = headerElement.querySelectorAll('span')[1];
  if (span) span.textContent = headerElement.classList.contains('open') ? '▲' : '▼';
}

function renderImagePreview(container, images, onRemove) {
  container.innerHTML = '';
  if (!Array.isArray(images) || images.length === 0) {
    return;
  }

  images.forEach((imgSrc, imageIndex) => {
    const previewCard = document.createElement('div');
    previewCard.className = 'image-chip';

    const previewImg = document.createElement('img');
    previewImg.src = imgSrc;
    previewImg.alt = `Image ${imageIndex + 1}`;
    previewImg.loading = 'lazy';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-image';
    removeBtn.innerText = '×';
    removeBtn.title = 'Remove image';
    removeBtn.addEventListener('click', () => onRemove(imageIndex));

    previewCard.appendChild(previewImg);
    previewCard.appendChild(removeBtn);
    container.appendChild(previewCard);
  });
}

window.updateQuestionCount = (value) => {
  const count = Math.max(1, Math.min(20, Number(value) || 1));
  currentQuestionCount = count;
  document.getElementById('levelQuestionCount').value = currentQuestionCount;
  currentQuestions = normalizeQuestions(currentQuestions, currentQuestionCount);
  renderQuestions();
};

window.handleLevelBadgeUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  currentBadgeDataUrl = await readFileAsDataUrl(file);
  document.getElementById('levelBadgeUrl').value = currentBadgeDataUrl;
  updateLevelBadgePreview();
};

function updateLevelBadgePreview() {
  const preview = document.getElementById('levelBadgePreview');
  if (!preview) return;
  preview.innerHTML = '';
  if (!currentBadgeDataUrl) return;

  const img = document.createElement('img');
  img.src = currentBadgeDataUrl;
  img.alt = 'Level Badge';
  img.className = 'preview-image';
  preview.appendChild(img);
}

window.handleQuestionImagesUpload = async (qKey, files) => {
  if (!files || files.length === 0) return;
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  currentQuestions[qKey].imgs = await readFilesAsDataUrls(files);
  renderQuestions();
};

window.handleFeedbackImagesUpload = async (qKey, answerIndex, files) => {
  if (!files || files.length === 0) return;
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  if (!currentQuestions[qKey].feedbacks) currentQuestions[qKey].feedbacks = [];
  if (!currentQuestions[qKey].feedbacks[answerIndex]) {
    currentQuestions[qKey].feedbacks[answerIndex] = { text: '', imgs: [] };
  }
  currentQuestions[qKey].feedbacks[answerIndex].imgs = await readFilesAsDataUrls(files);
  renderQuestions();
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
    currentQuestions[qKey].feedbacks[aIndex] = { text: '', imgs: [] };
  }
  currentQuestions[qKey].feedbacks[aIndex].text = val;
};

window.toggleCorrectAnswer = (qKey, aIndex, isChecked) => {
  currentQuestions[qKey] = currentQuestions[qKey] || createEmptyQuestion();
  const cArr = Array.isArray(currentQuestions[qKey].c) ? currentQuestions[qKey].c : [];
  if (isChecked) {
    if (!cArr.includes(aIndex)) cArr.push(aIndex);
  } else {
    const idx = cArr.indexOf(aIndex);
    if (idx > -1) cArr.splice(idx, 1);
  }
  currentQuestions[qKey].c = cArr;
};

window.addBonusInfoPage = () => {
  currentBonusInfo.push({ text: '', image: '' });
  renderBonusInfo();
};

window.updateBonusInfoText = (index, val) => {
  currentBonusInfo[index] = currentBonusInfo[index] || { text: '', image: '' };
  currentBonusInfo[index].text = val;
};

window.handleBonusInfoImageUpload = async (index, event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imageUrl = await readFileAsDataUrl(file);
  currentBonusInfo[index] = currentBonusInfo[index] || { text: '', image: '' };
  currentBonusInfo[index].image = imageUrl;
  renderBonusInfo();
};

window.removeBonusInfoPage = (index) => {
  currentBonusInfo.splice(index, 1);
  renderBonusInfo();
};

function renderBonusInfo() {
  const container = document.getElementById('bonusInfoContainer');
  if (!container) return;
  container.innerHTML = '';

  if (currentBonusInfo.length === 0) {
    container.innerHTML = '<p class="text-muted">No bonus pages added yet.</p>';
    return;
  }

  currentBonusInfo.forEach((page, index) => {
    const card = document.createElement('div');
    card.className = 'card mt-10 p-10 bonus-card';
    card.innerHTML = `
      <div class="flex-between">
        <strong>Page ${index + 1}</strong>
        <button type="button" class="btn-danger btn-sm" onclick="removeBonusInfoPage(${index})">Remove</button>
      </div>
      <div class="form-group mt-10">
        <label>Text</label>
        <textarea id="bonusText-${index}" class="form-control" rows="2">${escapeHtml(page.text)}</textarea>
      </div>
      <div class="form-group">
        <label>Image</label>
        <input id="bonusImage-${index}" type="file" accept="image/*" class="form-control-file" />
        <div id="bonusImagePreview-${index}" class="image-preview"></div>
      </div>
    `;

    container.appendChild(card);
    document.getElementById(`bonusText-${index}`).addEventListener('change', (event) => updateBonusInfoText(index, event.target.value));
    document.getElementById(`bonusImage-${index}`).addEventListener('change', (event) => handleBonusInfoImageUpload(index, event));
    renderImagePreview(document.getElementById(`bonusImagePreview-${index}`), page.image ? [page.image] : [], () => {
      currentBonusInfo[index].image = '';
      renderBonusInfo();
    });
  });
}

async function saveGameData() {
  const level = document.getElementById('levelSelect').value;
  const hint = document.getElementById('levelHint').value;
  const loupeLink = document.getElementById('levelLoupeLink').value;
  const badgeUrl = document.getElementById('levelBadgeUrl').value;

  try {
    const response = await fetch(`/api/admin/gamedata/${level}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
      throw new Error('Failed to save game data.');
    }

    showNotification(`Game data for ${level} saved successfully!`, 'success');
  } catch (error) {
    console.error(error);
    showNotification(error.message, 'error');
  }
}

window.loadGameData = loadGameData;
window.saveLevelConfig = saveGameData;
window.saveGameData = saveGameData;

function showNotification(message, type = 'info') {
  const toast = document.getElementById('notification');
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.className = `notification ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
