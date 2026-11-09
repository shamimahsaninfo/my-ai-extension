const chatContainer = document.getElementById('chat-container');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');

const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');

const providerSelect = document.getElementById('provider-select');
const googleKeyInput = document.getElementById('google-key-input');
const claudeKeyInput = document.getElementById('claude-key-input');

let config = {
  provider: 'gemini',
  googleKey: '',
  claudeKey: ''
};

// Load saved config
chrome.storage.sync.get(['provider', 'googleKey', 'claudeKey'], (res) => {
  if (res.provider) config.provider = res.provider;
  if (res.googleKey) config.googleKey = res.googleKey;
  if (res.claudeKey) config.claudeKey = res.claudeKey;

  providerSelect.value = config.provider;
  googleKeyInput.value = config.googleKey;
  claudeKeyInput.value = config.claudeKey;
});

openSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });

saveSettingsBtn.addEventListener('click', () => {
  config.provider = providerSelect.value;
  config.googleKey = googleKeyInput.value.trim();
  config.claudeKey = claudeKeyInput.value.trim();

  chrome.storage.sync.set(config, () => {
    alert('Settings Saved!');
    settingsModal.style.display = 'none';
  });
});

function appendMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerText = text;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return div;
}

sendBtn.addEventListener('click', sendMessage);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const text = promptInput.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  promptInput.value = '';
  sendBtn.disabled = true;

  const botMsg = appendMessage('টাইপিং...', 'bot');

  try {
    let reply = '';
    if (config.provider === 'claude') {
      if (!config.claudeKey) throw new Error('Claude API Key পাওয়া যায়নি! সেটিংসে গিয়ে কি বসান।');
      reply = await callClaude(text, config.claudeKey);
    } else {
      if (!config.googleKey) throw new Error('Google API Key পাওয়া যায়নি! সেটিংসে গিয়ে কি বসান।');
      reply = await callGemini(text, config.googleKey);
    }
    botMsg.innerText = reply;
  } catch (err) {
    botMsg.innerText = 'ত্রুটি: ' + err.message;
  } finally {
    sendBtn.disabled = false;
  }
}

// Google Gemini API Call
async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text;
}

// Anthropic Claude API Call
async function callClaude(prompt, apiKey) {
  const url = 'https://api.anthropic.com/v1/messages';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}
