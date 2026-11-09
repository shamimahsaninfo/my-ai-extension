/**
 * Lovable Vibe PRO - Extension Popup Controller (v9.9.6)
 * Supports real-time credit balance display, live server sync,
 * active/inactive dashboard states, and fast server switching.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const activeView = document.getElementById('activeView');
    const inactiveView = document.getElementById('inactiveView');
    const popupCredits = document.getElementById('popupCredits');
    const popupPlan = document.getElementById('popupPlan');
    const popupMaskedKey = document.getElementById('popupMaskedKey');
    const popupExpires = document.getElementById('popupExpires');
    const copyKeyBtn = document.getElementById('copyKeyBtn');
    const copyToast = document.getElementById('copyToast');
    const refreshCreditsBtn = document.getElementById('refreshCreditsBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const keyInput = document.getElementById('keyInput');
    const activateBtn = document.getElementById('activateBtn');
    const statusMsg = document.getElementById('statusMsg');

    const serverBtnPrimary = document.getElementById('serverBtnPrimary');
    const serverBtnSecondary = document.getElementById('serverBtnSecondary');
    const popupChatModeBadge = document.getElementById('popupChatModeBadge');

    let currentLicense = null;
    const API_ENDPOINT = 'https://api.lovablevibe.tech';

    // Helper: Mask License Key for Clean Display
    function maskKey(key) {
        if (!key) return 'LV-••••-••••';
        const clean = String(key).trim();
        if (clean.length > 14) {
            return clean.slice(0, 8) + '••••-••••-' + clean.slice(-4);
        }
        return clean;
    }

    // Helper: Render Active Dashboard View
    function renderActiveState(license) {
        if (!license) return;
        currentLicense = license;
        if (activeView) activeView.style.display = 'block';
        if (inactiveView) inactiveView.style.display = 'none';

        if (popupPlan) {
            popupPlan.textContent = license.plan || 'Pro Vibe';
        }

        const creds = (license.credits !== undefined && license.credits !== null)
            ? license.credits
            : (license.credits_remaining !== undefined ? license.credits_remaining : 0);
        const numCreds = Number(creds);
        
        if (popupCredits) {
            popupCredits.textContent = numCreds.toLocaleString();
            if (numCreds < 3) {
                popupCredits.style.color = '#f87171';
            } else if (numCreds < 15) {
                popupCredits.style.color = '#fbbf24';
            } else {
                popupCredits.style.color = '#ffffff';
            }
        }

        if (numCreds < 3) {
            if (popupPlan) {
                popupPlan.textContent = 'Disabled (Low Credits)';
                popupPlan.style.color = '#f87171';
                popupPlan.style.borderColor = 'rgba(248, 113, 113, 0.5)';
            }
            if (popupExpires) {
                popupExpires.textContent = 'Disabled (< 3 Credits)';
                popupExpires.style.color = '#f87171';
            }
        } else {
            if (popupPlan) {
                popupPlan.textContent = license.plan || 'Pro Vibe';
                popupPlan.style.color = '#00f2fe';
                popupPlan.style.borderColor = 'rgba(0, 242, 254, 0.4)';
            }
            if (popupExpires) {
                popupExpires.style.color = '';
                if (license.expires_at) {
                    try {
                        const expDate = new Date(license.expires_at);
                        popupExpires.textContent = expDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                    } catch (e) {
                        popupExpires.textContent = 'Active';
                    }
                } else {
                    popupExpires.textContent = 'Active (365d)';
                }
            }
        }

        const fullKey = license.license_key || license.key || '';
        if (popupMaskedKey) {
            popupMaskedKey.textContent = maskKey(fullKey);
            popupMaskedKey.title = fullKey;
        }
    }

    // Helper: Render Inactive View (License Input Form)
    function renderInactiveState(savedKey = '') {
        currentLicense = null;
        if (activeView) activeView.style.display = 'none';
        if (inactiveView) inactiveView.style.display = 'block';
        if (keyInput && savedKey) {
            keyInput.value = savedKey;
        }
        if (statusMsg) {
            statusMsg.className = 'status-msg';
            statusMsg.style.display = 'none';
            statusMsg.textContent = '';
        }
    }

    // Direct VPS License Verification (Fallback & Live Sync)
    async function verifyWithVps(key) {
        try {
            const res = await fetch(`${API_ENDPOINT}/rest/v1/rpc/verify_user_license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': navigator.userAgent
                },
                body: JSON.stringify({
                    p_license_key: key,
                    p_device_id: 'browser_extension_popup'
                })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Direct VPS verification error:', err);
            return null;
        }
    }

    // Live Server Sync: Query Latest Credits from VPS
    async function refreshLiveCredits(silent = false) {
        const fullKey = currentLicense?.license_key || currentLicense?.key;
        if (!fullKey) return;

        if (refreshCreditsBtn) {
            refreshCreditsBtn.classList.add('spinning');
        }

        // Try background message first
        chrome.runtime.sendMessage({ action: 'verifyLicense', key: fullKey }, async (res) => {
            let data = res;
            if (!data || !data.ok) {
                // Background failed or timed out, perform direct fetch
                data = await verifyWithVps(fullKey);
            }

            if (refreshCreditsBtn) {
                refreshCreditsBtn.classList.remove('spinning');
            }

            if (data && data.ok && data.license) {
                renderActiveState(data.license);
                // Save updated license cache
                chrome.storage.local.set({
                    bruno_license: data.license,
                    user_license: data.license
                });
                if (!silent && copyToast) {
                    copyToast.textContent = '✓ Updated!';
                    copyToast.style.display = 'inline';
                    setTimeout(() => { copyToast.style.display = 'none'; }, 2000);
                }
            } else if (data && !data.ok) {
                // If license expired or disabled on server
                renderInactiveState(fullKey);
                if (statusMsg) {
                    statusMsg.className = 'status-msg status-error';
                    statusMsg.textContent = data.message || 'License has expired or was revoked.';
                    statusMsg.style.display = 'block';
                }
            }
        });
    }

    // Helper: Inspect all storage keys to find any saved license
    function findSavedLicense(all) {
        if (!all) return null;
        if (all.bruno_license && (all.bruno_license.license_key || all.bruno_license.key)) {
            return all.bruno_license;
        }
        if (all.user_license && (all.user_license.license_key || all.user_license.key)) {
            return all.user_license;
        }
        if (all.license && (all.license.license_key || all.license.key)) {
            return all.license;
        }
        // Scan object values
        for (const val of Object.values(all)) {
            if (val && typeof val === 'object') {
                if (val.license_key || val.key) {
                    return val;
                }
            } else if (typeof val === 'string') {
                const s = val.trim().toUpperCase();
                if (s.startsWith('LV-') || s.startsWith('LOVABLE-') || s.startsWith('TRIAL-')) {
                    return { license_key: s };
                }
            }
        }
        return null;
    }

    // Initialize State: Scan all storage immediately
    chrome.storage.local.get(null, (all) => {
        const cached = findSavedLicense(all);
        if (cached && (cached.license_key || cached.key)) {
            renderActiveState(cached);
            refreshLiveCredits(true);
        } else {
            // Check background worker
            chrome.runtime.sendMessage({ action: 'getLicense' }, (bgRes) => {
                if (bgRes && (bgRes.license_key || bgRes.key)) {
                    renderActiveState(bgRes);
                    refreshLiveCredits(true);
                } else {
                    renderInactiveState();
                }
            });
        }
    });

    // Refresh Button Event
    if (refreshCreditsBtn) {
        refreshCreditsBtn.addEventListener('click', () => refreshLiveCredits(false));
    }

    // Copy License Key Event
    if (copyKeyBtn) {
        copyKeyBtn.addEventListener('click', () => {
            const keyToCopy = currentLicense?.license_key || currentLicense?.key;
            if (keyToCopy) {
                navigator.clipboard.writeText(keyToCopy).then(() => {
                    if (copyToast) {
                        copyToast.textContent = '✓ Copied!';
                        copyToast.style.display = 'inline';
                        setTimeout(() => { copyToast.style.display = 'none'; }, 2000);
                    }
                }).catch(() => {
                    const input = document.createElement('input');
                    input.value = keyToCopy;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    if (copyToast) {
                        copyToast.textContent = '✓ Copied!';
                        copyToast.style.display = 'inline';
                        setTimeout(() => { copyToast.style.display = 'none'; }, 2000);
                    }
                });
            }
        });
    }

    // Logout / Change License Key Event
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Switch license key? This will clear the active license on this browser.')) {
                const prevKey = currentLicense?.license_key || currentLicense?.key || '';
                chrome.storage.local.clear(() => {
                    renderInactiveState(prevKey);
                });
            }
        });
    }

    // Activate License Button Event
    if (activateBtn && keyInput) {
        activateBtn.addEventListener('click', async () => {
            const keyVal = keyInput.value.trim().toUpperCase();
            if (!keyVal) {
                if (statusMsg) {
                    statusMsg.className = 'status-msg status-error';
                    statusMsg.textContent = 'Please enter a license key.';
                    statusMsg.style.display = 'block';
                }
                return;
            }

            activateBtn.disabled = true;
            activateBtn.textContent = 'Activating...';
            if (statusMsg) statusMsg.style.display = 'none';

            // Send to background worker
            chrome.runtime.sendMessage({ action: 'verifyLicense', key: keyVal }, async (res) => {
                let data = res;
                if (!data || !data.ok) {
                    // Try direct verification with VPS
                    data = await verifyWithVps(keyVal);
                }

                activateBtn.disabled = false;
                activateBtn.textContent = 'Activate License';

                if (data && data.ok) {
                    const lic = data.license || { license_key: keyVal, status: 'active', credits: 100 };
                    renderActiveState(lic);
                    chrome.storage.local.set({
                        bruno_license: lic,
                        user_license: lic
                    });
                    refreshLiveCredits(true);
                } else {
                    if (statusMsg) {
                        statusMsg.className = 'status-msg status-error';
                        statusMsg.textContent = '✗ ' + ((data && data.message) || 'Invalid or expired license key.');
                        statusMsg.style.display = 'block';
                    }
                }
            });
        });

        // Enter key activates immediately
        keyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                activateBtn.click();
            }
        });
    }

    // =========================================================================
    // Server Mode Switcher (Primary: server1 | Secondary: routes_root)
    // =========================================================================
    function updateServerModeUI(mode) {
        const isPrimary = mode !== 'routes_root';
        if (serverBtnPrimary && serverBtnSecondary) {
            if (isPrimary) {
                serverBtnPrimary.classList.add('active');
                serverBtnSecondary.classList.remove('active');
                if (popupChatModeBadge) {
                    popupChatModeBadge.textContent = 'Primary';
                    popupChatModeBadge.style.color = '#38bdf8';
                    popupChatModeBadge.style.background = 'rgba(56, 189, 248, 0.16)';
                    popupChatModeBadge.style.borderColor = 'rgba(56, 189, 248, 0.45)';
                }
            } else {
                serverBtnSecondary.classList.add('active');
                serverBtnPrimary.classList.remove('active');
                if (popupChatModeBadge) {
                    popupChatModeBadge.textContent = 'Secondary';
                    popupChatModeBadge.style.color = '#22c55e';
                    popupChatModeBadge.style.background = 'rgba(34, 197, 94, 0.16)';
                    popupChatModeBadge.style.borderColor = 'rgba(34, 197, 94, 0.45)';
                }
            }
        }
    }

    // Query active server mode
    chrome.runtime.sendMessage({ action: 'getChatServerMode' }, (res) => {
        const mode = res?.chatMode || 'server1';
        updateServerModeUI(mode);
    });

    if (serverBtnPrimary) {
        serverBtnPrimary.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'setChatServerMode', chatMode: 'server1' }, () => {
                updateServerModeUI('server1');
            });
        });
    }

    if (serverBtnSecondary) {
        serverBtnSecondary.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'setChatServerMode', chatMode: 'routes_root' }, () => {
                updateServerModeUI('routes_root');
            });
        });
    }
});