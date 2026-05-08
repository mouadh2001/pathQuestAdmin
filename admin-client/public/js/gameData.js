// gameData.js
let currentQuestions = {};

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
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${level}`);
    }

    const data = await response.json();
    
    // Set Level Info
    document.getElementById('levelHint').value = data.hint || '';
    document.getElementById('levelBonusInfo').value = data.bonusInfo || '';
    
    // Set Questions
    currentQuestions = data.questions || {};
    renderQuestions();

    loader.classList.add('hidden');
    editor.classList.remove('hidden');

  } catch (error) {
    console.error(error);
    showNotification(error.message, 'error');
    loader.classList.add('hidden');
  }
}

function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  container.innerHTML = '';

  const qKeys = Object.keys(currentQuestions);
  
  if (qKeys.length === 0) {
    container.innerHTML = '<p>No questions found for this level.</p>';
    return;
  }

  qKeys.forEach((qKey, index) => {
    const qData = currentQuestions[qKey];
    const qIndex = index + 1;
    
    const qCard = document.createElement('div');
    qCard.className = 'question-card';
    
    const qHeader = document.createElement('div');
    qHeader.className = 'question-header';
    qHeader.innerHTML = `<span>Question ${qIndex} (${qKey})</span><span>▼</span>`;
    qHeader.onclick = () => toggleAccordion(qHeader);

    const qBody = document.createElement('div');
    qBody.className = 'question-body';

    // Question Text Input
    const qTextGroup = document.createElement('div');
    qTextGroup.className = 'form-group';
    qTextGroup.innerHTML = `
      <label>Question Text</label>
      <input type="text" class="form-control" value="${escapeHtml(qData.q)}" onchange="updateQuestionText('${qKey}', this.value)" />
    `;
    qBody.appendChild(qTextGroup);

    // Options Container
    const optsContainer = document.createElement('div');
    optsContainer.className = 'options-container';
    optsContainer.innerHTML = '<h4>Answers & Feedback</h4>';

    qData.a.forEach((ans, aIndex) => {
      const isCorrect = qData.c.includes(aIndex);
      const feedback = qData.feedbacks && qData.feedbacks[aIndex] ? qData.feedbacks[aIndex] : { text: '', imgs: [] };
      const imagesStr = feedback.imgs ? feedback.imgs.join(', ') : '';

      const optItem = document.createElement('div');
      optItem.className = 'option-item';
      optItem.innerHTML = `
        <div class="option-header">
          <input type="checkbox" class="correct-checkbox" ${isCorrect ? 'checked' : ''} onchange="toggleCorrectAnswer('${qKey}', ${aIndex}, this.checked)" title="Mark as correct" />
          <input type="text" class="form-control" value="${escapeHtml(ans)}" onchange="updateOptionText('${qKey}', ${aIndex}, this.value)" placeholder="Answer option" />
        </div>
        <div class="form-group mt-10">
          <label>Feedback Text</label>
          <textarea class="form-control" rows="2" onchange="updateFeedbackText('${qKey}', ${aIndex}, this.value)">${escapeHtml(feedback.text)}</textarea>
        </div>
        <div class="form-group">
          <label>Feedback Images (Comma separated URLs/paths)</label>
          <input type="text" class="form-control" value="${escapeHtml(imagesStr)}" onchange="updateFeedbackImages('${qKey}', ${aIndex}, this.value)" />
        </div>
      `;
      optsContainer.appendChild(optItem);
    });

    qBody.appendChild(optsContainer);

    qCard.appendChild(qHeader);
    qCard.appendChild(qBody);
    container.appendChild(qCard);
  });
  
  // Add a final "Save All Game Data" button at the bottom of the container
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-success mt-20';
  saveBtn.innerHTML = 'Save All Game Data';
  saveBtn.style.marginTop = '20px';
  saveBtn.style.width = '100%';
  saveBtn.onclick = saveGameData;
  container.appendChild(saveBtn);
}

function toggleAccordion(headerElement) {
  headerElement.classList.toggle('open');
  const body = headerElement.nextElementSibling;
  body.classList.toggle('open');
  const span = headerElement.querySelectorAll('span')[1];
  span.textContent = headerElement.classList.contains('open') ? '▲' : '▼';
}

// State Updaters
window.updateQuestionText = (qKey, val) => { currentQuestions[qKey].q = val; };
window.updateOptionText = (qKey, aIndex, val) => { currentQuestions[qKey].a[aIndex] = val; };
window.updateFeedbackText = (qKey, aIndex, val) => {
  if(!currentQuestions[qKey].feedbacks) currentQuestions[qKey].feedbacks = [];
  if(!currentQuestions[qKey].feedbacks[aIndex]) currentQuestions[qKey].feedbacks[aIndex] = {text:'', imgs:[]};
  currentQuestions[qKey].feedbacks[aIndex].text = val;
};
window.updateFeedbackImages = (qKey, aIndex, val) => {
  if(!currentQuestions[qKey].feedbacks) currentQuestions[qKey].feedbacks = [];
  if(!currentQuestions[qKey].feedbacks[aIndex]) currentQuestions[qKey].feedbacks[aIndex] = {text:'', imgs:[]};
  currentQuestions[qKey].feedbacks[aIndex].imgs = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
};
window.toggleCorrectAnswer = (qKey, aIndex, isChecked) => {
  const cArr = currentQuestions[qKey].c;
  if (isChecked) {
    if (!cArr.includes(aIndex)) cArr.push(aIndex);
  } else {
    const idx = cArr.indexOf(aIndex);
    if (idx > -1) cArr.splice(idx, 1);
  }
};

export async function saveGameData() {
  const level = document.getElementById('levelSelect').value;
  const hint = document.getElementById('levelHint').value;
  const bonusInfo = document.getElementById('levelBonusInfo').value;

  try {
    const response = await fetch(`/api/admin/gamedata/${level}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ hint, bonusInfo, questions: currentQuestions })
    });

    if (!response.ok) {
      throw new Error("Failed to save game data.");
    }

    showNotification(`Game data for ${level} saved successfully!`, 'success');
  } catch (error) {
    console.error(error);
    showNotification(error.message, 'error');
  }
}

// Make functions available globally so HTML onclick handlers can find them
window.loadGameData = loadGameData;
window.saveLevelConfig = saveGameData;
window.saveGameData = saveGameData;

function showNotification(message, type = 'info') {
  const toast = document.getElementById('notification');
  if(!toast) return alert(message);
  
  toast.textContent = message;
  toast.className = `notification ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Helper to escape HTML characters in inputs
function escapeHtml(unsafe) {
  if(!unsafe) return '';
  return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}
