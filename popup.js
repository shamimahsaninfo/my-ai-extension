document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const popupPlan = document.getElementById('popupPlan');
    const popupCredits = document.getElementById('popupCredits');
    const popupExpires = document.getElementById('popupExpires');
    const popupMaskedKey = document.getElementById('popupMaskedKey');
    const copyKeyBtn = document.getElementById('copyKeyBtn');
    const keyInput = document.getElementById('keyInput');
    const activateBtn = document.getElementById('activateBtn');
    const statusMsg = document.getElementById('statusMsg');
    const logoutBtn = document.getElementById('logoutBtn');
    const activeStateCard = document.getElementById('activeStateCard');
    const inactiveStateCard = document.getElementById('inactiveStateCard');
    const serverBtnPrimary = document.getElementById('serverBtnPrimary');
    const serverBtnSecondary = document.getElementById('serverBtnSecondary');
    const popupChatModeBadge = document.getElementById('popupChatModeBadge');

    // কাস্টম লাইসেন্স ডাটা (১ কোটি ক্রেডিট)
    const customUnlimitedLicense = {
        license_key: 'LV-UNLIMITED-PRO-2026',
        status: 'active',
        plan: 'Pro VIP Lifetime',
        credits: 10000000, // ১ কোটি ক্রেডিট
        expires_at: '2099-12-31T23:59:59Z'
    };

    function renderActiveState(license) {
        if (!license) return;
        if (activeStateCard) activeStateCard.style.display = 'block';
        if (inactiveStateCard) inactiveStateCard.style.display = 'none';

        if (popupPlan) popupPlan.textContent = license.plan;
        if (popupCredits) popupCredits.textContent = Number(license.credits).toLocaleString();
        if (popupExpires) popupExpires.textContent = 'Never (Lifetime)';
        if (popupMaskedKey) {
            popupMaskedKey.textContent = 'LV-••••-••••';
            popupMaskedKey.title = license.license_key;
        }
    }

    // ব্রাউজারে স্বয়ংক্রিয়ভাবে সক্রিয় রাখা
    chrome.storage.local.set({
        bruno_license: customUnlimitedLicense,
        user_license: customUnlimitedLicense
    }, () => {
        renderActiveState(customUnlimitedLicense);
    });

    // কপি বাটন
    if (copyKeyBtn) {
        copyKeyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(customUnlimitedLicense.license_key).then(() => {
                copyKeyBtn.textContent = 'Copied!';
                setTimeout(() => { copyKeyBtn.textContent = 'Copy Full Key'; }, 1500);
            });
        });
    }

    // সার্ভার মোড হ্যান্ডলার
    function updateServerModeUI(mode) {
        if (!serverBtnPrimary || !serverBtnSecondary) return;
        if (mode === 'server1') {
            serverBtnPrimary.classList.add('active');
            serverBtnSecondary.classList.remove('active');
            if (popupChatModeBadge) {
                popupChatModeBadge.textContent = 'Primary';
                popupChatModeBadge.style.color = '#38bdf8';
                popupChatModeBadge.style.background = 'rgba(56, 189, 248, 0.16)';
            }
        } else {
            serverBtnSecondary.classList.add('active');
            serverBtnPrimary.classList.remove('active');
            if (popupChatModeBadge) {
                popupChatModeBadge.textContent = 'Secondary';
                popupChatModeBadge.style.color = '#22c55e';
                popupChatModeBadge.style.background = 'rgba(34, 197, 94, 0.16)';
            }
        }
    }

    chrome.runtime.sendMessage({ action: 'getChatServerMode' }, (res) => {
        updateServerModeUI(res?.chatMode || 'server1');
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
