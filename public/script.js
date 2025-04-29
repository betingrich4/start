const video = document.getElementById('bg-video');
video.addEventListener('error', () => {
  document.querySelector('.video-fallback').style.zIndex = '-1';
});

document.addEventListener('click', () => {
  if (video.paused) {
    video.play().catch(e => console.log('Video play failed:', e));
  }
}, { once: true });

const submitBtn = document.getElementById('submit');
const numberInput = document.getElementById('number');
const pairDiv = document.getElementById('pair');
const waitingMessage = document.getElementById('waiting-message');
const sessionControls = document.getElementById('session-controls');
const connectSessionBtn = document.getElementById('connect-session');
const sessionIdInput = document.getElementById('session-id');
const statusList = document.getElementById('status-list');
const bioInput = document.getElementById('bio');
const updateBioBtn = document.getElementById('update-bio');
const toggleAutoBioBtn = document.getElementById('toggle-autobio');
const autoBioStatus = document.getElementById('autobio-status');

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showFeedback('Copied!');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

function showFeedback(message) {
  const feedback = document.createElement('div');
  feedback.className = 'copy-feedback show';
  feedback.textContent = message;
  pairDiv.appendChild(feedback);
  setTimeout(() => {
    feedback.classList.remove('show');
    setTimeout(() => feedback.remove(), 300);
  }, 1000);
}

submitBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!numberInput.value) {
    pairDiv.innerHTML = '<a style="color:white;font-weight:bold">Enter your WhatsApp number with Country Code</a>';
    return;
  }
  if (numberInput.value.replace(/[^0-9]/g, '').length < 11) {
    pairDiv.innerHTML = '<a style="color:#ff00ff;font-weight:bold">Invalid Number</a>';
    return;
  }

  const Wasi_Tech = numberInput.value.replace(/[^0-9]/g, '');
  let bb = '';
  let bbc = '';
  const cc = Wasi_Tech.split('');
  cc.forEach(a => {
    bbc += a;
    if (bbc.length === 3 || bbc.length === 8) {
      bb += ' ' + a;
    } else {
      bb += a;
    }
  });
  numberInput.type = 'text';
  numberInput.value = '+' + bb;
  numberInput.style = 'color:white;font-size:20px';
  waitingMessage.style.display = 'block';
  pairDiv.innerHTML = '';

  try {
    const { data } = await axios.get(`/code?number=${Wasi_Tech}`);
    waitingMessage.style.display = 'none';
    const { code, sessionId } = data;
    if (code === 'Service Unavailable') {
      pairDiv.innerHTML = '<a style="color:#ff00ff;font-weight:bold">Service Unavailable</a>';
      return;
    }

    const codeHTML = `
      <div class="code-container" onclick="copyToClipboard('${code}')">
        <div class="code-label">Click to copy your code</div>
        <div id="copy">${code}</div>
      </div>
      <div class="code-label">Save this Session ID: ${sessionId}</div>
    `;
    pairDiv.innerHTML = codeHTML;
    sessionControls.style.display = 'block';
    sessionIdInput.value = sessionId;
    autoBioStatus.textContent = 'Auto-Bio: Enabled';
    copyToClipboard(code);
  } catch (err) {
    waitingMessage.style.display = 'none';
    pairDiv.innerHTML = '<a style="color:#ff00ff;font-weight:bold">Error generating code</a>';
  }
});

connectSessionBtn.addEventListener('click', async () => {
  const sessionId = sessionIdInput.value;
  if (!sessionId) {
    alert('Please enter a Session ID');
    return;
  }

  try {
    const { data } = await axios.post('/bot/connect', { sessionId });
    if (data.error) {
      alert(data.error);
      return;
    }
    alert('Connected! Fetching statuses...');
    autoBioStatus.textContent = `Auto-Bio: ${data.autoBioActive ? 'Enabled' : 'Disabled'}`;
    fetchStatuses(sessionId);
  } catch (err) {
    alert('Error connecting session');
  }
});

async function fetchStatuses(sessionId) {
  try {
    const { data } = await axios.get(`/bot/statuses/${sessionId}`);
    statusList.innerHTML = '';
    data.forEach(status => {
      const statusDiv = document.createElement('div');
      statusDiv.innerHTML = `
        ${status.from} (${new Date(status.timestamp * 1000).toLocaleString()}): ${status.content}
        <button onclick="likeStatus('${sessionId}', '${status.id}', '${status.from}')">Like</button>
      `;
      statusList.appendChild(statusDiv);
    });
  } catch (err) {
    statusList.innerHTML = '<div>Error fetching statuses</div>';
  }
}

async function likeStatus(sessionId, statusId, remoteJid) {
  try {
    const { data } = await axios.post('/bot/like-status', { sessionId, statusId, remoteJid });
    alert('Status liked!');
  } catch (err) {
    alert('Error liking status');
  }
}

updateBioBtn.addEventListener('click', async () => {
  const sessionId = sessionIdInput.value;
  const bio = bioInput.value;
  if (!sessionId || !bio) {
    alert('Please enter Session ID and Bio');
    return;
  }

  try {
    const { data } = await axios.post('/bot/update-bio', { sessionId, bio });
    alert('Bio updated!');
    bioInput.value = '';
  } catch (err) {
    alert('Error updating bio');
  }
});

toggleAutoBioBtn.addEventListener('click', async () => {
  const sessionId = sessionIdInput.value;
  if (!sessionId) {
    alert('Please enter a Session ID');
    return;
  }

  try {
    const currentStatus = autoBioStatus.textContent.includes('Enabled');
    const { data } = await axios.post('/bot/toggle-autobio', { sessionId, enable: !currentStatus });
    autoBioStatus.textContent = `Auto-Bio: ${data.status.includes('enabled') ? 'Enabled' : 'Disabled'}`;
    alert(data.status);
  } catch (err) {
    alert('Error toggling auto-bio');
  }
});
