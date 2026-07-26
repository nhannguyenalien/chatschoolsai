(function() {
    // 1. BẢO MẬT
    const scriptTag = document.currentScript;
    const tenant = scriptTag.getAttribute('data-tenant') || 'default_tenant';
    const botName = scriptTag.getAttribute('data-botname') || 'Support Assistant';
    const allowedDomain = scriptTag.getAttribute('data-domain');
    const currentDomain = window.location.hostname;

    if (allowedDomain && currentDomain !== "localhost" && currentDomain !== "127.0.0.1" && !currentDomain.includes(allowedDomain)) {
        console.warn("Bảo mật: Chat Widget không được phép chạy trên tên miền lạ.");
        return;
    }

    // 2. FONTS & CSS
    document.head.insertAdjacentHTML('beforeend', `
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
        <style>
            #ai-chat-root * { box-sizing: border-box; }
            #ai-chat-root h2, #ai-chat-root p { margin: 0; padding: 0; }
            .ai-hide-scroll::-webkit-scrollbar { display: none; }
            .ai-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

            .ai-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; display: inline-block; animation: ai-bounce 1.2s infinite ease-in-out; }
            .ai-dot:nth-child(2) { animation-delay: 0.15s; }
            .ai-dot:nth-child(3) { animation-delay: 0.30s; }
            @keyframes ai-bounce {
                0%, 100% { transform: translateY(0); opacity: 0.35; }
                50%       { transform: translateY(-5px); opacity: 1; }
            }

            #ai-chat-window {
                position: fixed;
                bottom: 1.5rem; right: 1.5rem;
                width: 380px; height: 600px;
                background: #f8f9ff;
                border-radius: 12px;
                overflow: hidden;
                display: flex; flex-direction: column;
                box-shadow: 0 12px 48px rgba(0,0,0,0.14);
                z-index: 999999;
                font-family: 'Inter', sans-serif;
                transition: transform 0.3s cubic-bezier(0.2,0,0,1), opacity 0.3s cubic-bezier(0.2,0,0,1);
                transform-origin: bottom right;
            }
            #ai-chat-window.ai-hidden {
                transform: scale(0) translateY(40px);
                opacity: 0;
                pointer-events: none;
            }
            @media (max-width: 640px) {
                #ai-chat-window { width: 100%; height: 100dvh; bottom: 0; right: 0; border-radius: 0; }
            }

            #ai-chat-header {
                background: #f8f9ff;
                padding: 10px 16px;
                display: flex; align-items: center; justify-content: space-between;
                border-bottom: 1px solid #eceef3;
                flex-shrink: 0;
            }
            #ai-chat-header .ai-header-left { display: flex; align-items: center; gap: 10px; }
            #ai-chat-header .ai-avatar {
                position: relative;
                width: 40px; height: 40px; border-radius: 50%;
                background: #dae1ff;
                display: flex; align-items: center; justify-content: center;
                color: #001849; flex-shrink: 0;
            }
            #ai-chat-header .ai-online-dot {
                position: absolute; bottom: 1px; right: 1px;
                width: 11px; height: 11px; border-radius: 50%;
                background: #10b981; border: 2px solid #f8f9ff;
            }
            #ai-chat-header h2 { font-size: 17px; font-weight: 600; line-height: 22px; color: #191c20; letter-spacing: -0.01em; }
            #ai-chat-header p  { font-size: 13px; font-weight: 500; color: #5c5f61; margin-top: 1px; }
            #ai-btn-close {
                background: transparent; border: none; cursor: pointer;
                width: 36px; height: 36px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: #5c5f61; transition: background 0.15s;
            }
            #ai-btn-close:hover { background: #eceef3; }

            #ai-chat-body {
                flex: 1; overflow-y: auto;
                padding: 16px;
                background: #ffffff;
                display: flex; flex-direction: column;
            }

            .ai-timestamp { text-align: center; margin: 8px 0 12px; }
            .ai-timestamp span {
                font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
                color: #727687; background: #eceef3;
                padding: 3px 10px; border-radius: 9999px;
            }

            .ai-msg-bot { display: flex; align-items: flex-end; gap: 8px; margin-top: 12px; max-width: 85%; }
            .ai-msg-bot .ai-bot-icon {
                width: 32px; height: 32px; border-radius: 50%;
                background: #e6e8ed; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center; color: #424656;
            }
            .ai-msg-bot .ai-bubble {
                background: #eceef3; color: #191c20;
                font-size: 15px; line-height: 22px;
                padding: 10px 14px;
                border-radius: 18px 18px 18px 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            }

            .ai-msg-user { display: flex; justify-content: flex-end; margin-top: 12px; max-width: 85%; align-self: flex-end; }
            .ai-msg-user .ai-bubble {
                background: #0050cb; color: #ffffff;
                font-size: 15px; line-height: 22px;
                padding: 10px 14px;
                border-radius: 18px 18px 4px 18px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            }

            #ai-typing {
                display: none; align-items: flex-end; gap: 8px;
                padding: 0 16px 10px; flex-shrink: 0;
            }
            #ai-typing .ai-bot-icon {
                width: 32px; height: 32px; border-radius: 50%;
                background: #e6e8ed; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center; color: #424656;
            }
            #ai-typing .ai-dots {
                background: #eceef3; padding: 0 14px; height: 40px;
                border-radius: 18px 18px 18px 4px;
                display: flex; align-items: center; gap: 5px;
            }

            #ai-chat-footer {
                padding: 8px; background: #f8f9ff;
                border-top: 1px solid rgba(0,0,0,0.04);
                box-shadow: 0 -4px 20px rgba(0,0,0,0.03); flex-shrink: 0;
            }
            #ai-input-row {
                display: flex; align-items: flex-end;
                background: #f2f3f9; border-radius: 24px;
                padding: 4px; border: 1.5px solid transparent;
                transition: border-color 0.15s, background 0.15s;
            }
            #ai-input-row:focus-within { border-color: #c2c6d8; background: #f8f9ff; }
            #ai-input-row .ai-icon-btn {
                background: transparent; border: none; cursor: pointer;
                width: 36px; height: 36px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: #5c5f61; flex-shrink: 0; margin-bottom: 2px; transition: color 0.15s;
            }
            #ai-input-row .ai-icon-btn:hover { color: #0050cb; }
            #ai-chat-input {
                flex: 1; background: transparent; border: none; outline: none;
                resize: none; font-family: 'Inter', sans-serif;
                font-size: 15px; line-height: 22px; color: #191c20;
                padding: 10px 8px; min-height: 44px; max-height: 100px;
            }
            #ai-chat-input::placeholder { color: #c2c6d8; }
            #ai-send-btn {
                width: 36px; height: 36px; border-radius: 50%;
                background: #0050cb; color: #fff;
                border: none; cursor: pointer; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 2px 6px rgba(0,80,203,0.3);
                transition: background 0.15s; margin-bottom: 2px;
            }
            #ai-send-btn:hover { background: #003fa4; }
            #ai-footer-note { text-align: center; margin-top: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: #727687; }

            #ai-btn-fab {
                position: fixed; bottom: 1.5rem; right: 1.5rem;
                width: 60px; height: 60px; border-radius: 50%;
                background: #0050cb; color: #fff;
                border: none; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 8px 24px rgba(0,80,203,0.35);
                z-index: 999998;
                transition: transform 0.2s, opacity 0.2s;
            }
            #ai-btn-fab:hover { transform: scale(1.1); }
            #ai-btn-fab.ai-hidden { transform: scale(0); opacity: 0; pointer-events: none; }
        </style>
    `);

    // 3. SESSION
    let session = localStorage.getItem('ai_session_' + tenant);
    if (!session) {
        session = 'sess_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('ai_session_' + tenant, session);
    }

    // 4. HTML
    const root = document.createElement('div');
    root.id = 'ai-chat-root';
    root.innerHTML = `
        <div id="ai-chat-window" class="ai-hidden">
            <div id="ai-chat-header">
                <div class="ai-header-left">
                    <div class="ai-avatar">
                        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;font-size:24px;">account_circle</span>
                        <span class="ai-online-dot"></span>
                    </div>
                    <div>
                        <h2>${botName}</h2>
                        <p>Hỗ trợ viên</p>
                    </div>
                </div>
                <button id="ai-btn-close" title="Đóng">
                    <span class="material-symbols-outlined" style="font-size:20px;">close</span>
                </button>
            </div>
            <div id="ai-chat-body" class="ai-hide-scroll">
                <div class="ai-timestamp"><span id="ai-timestamp-label"></span></div>
            </div>
            <div id="ai-typing">
                <div class="ai-bot-icon">
                    <span class="material-symbols-outlined" style="font-size:16px;">smart_toy</span>
                </div>
                <div class="ai-dots">
                    <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
                </div>
            </div>
            <div id="ai-chat-footer">
                <div id="ai-input-row">
                    <button class="ai-icon-btn" tabindex="-1">
                        <span class="material-symbols-outlined" style="font-size:22px;">add_circle</span>
                    </button>
                    <textarea id="ai-chat-input" placeholder="Nhập tin nhắn..." rows="1"></textarea>
                    <button id="ai-send-btn" title="Gửi">
                        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;font-size:20px;">send</span>
                    </button>
                </div>
                <div id="ai-footer-note">Được bảo vệ bởi Fluid Conversations</div>
            </div>
        </div>
        <button id="ai-btn-fab" title="Mở chat">
            <span class="material-symbols-outlined" style="font-size:28px;">chat</span>
        </button>
    `;
    document.body.appendChild(root);

    // 5. CONSTANTS & DOM REFS
    const WORKER_URL      = "https://knowledge-worker.toidayhoc.workers.dev";
    const HISTORY_KEY     = 'ai_history_' + tenant + '_' + session;
    const MAX_HISTORY     = 60;

    const chatWindow      = document.getElementById('ai-chat-window');
    const btnClose        = document.getElementById('ai-btn-close');
    const btnFab          = document.getElementById('ai-btn-fab');
    const textarea        = document.getElementById('ai-chat-input');
    const sendBtn         = document.getElementById('ai-send-btn');
    const chatBody        = document.getElementById('ai-chat-body');
    const typingIndicator = document.getElementById('ai-typing');
    const tsEl            = document.getElementById('ai-timestamp-label');

    // Timestamp
    if (tsEl) {
        const now = new Date();
        tsEl.textContent = 'Hôm nay, ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    // 6. LỊCH SỬ CHAT — localStorage
    function loadHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
        catch(e) { return []; }
    }
    function saveHistory(history) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY))); }
        catch(e) {}
    }

    // 7. RENDER MARKDOWN
    function renderMarkdown(text) {
        // Ảnh: ![alt](url)
        text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, function(_, alt, url) {
            return '<img src="' + url + '" alt="' + alt + '" style="max-width:100%;border-radius:10px;margin-top:8px;display:block;cursor:pointer;" onclick="window.open(\'' + url + '\',\'_blank\')"/>';
        });
        // Video trực tiếp
        text = text.replace(/(https?:\/\/\S+\.(mp4|webm|ogg))(\s|$)/gi, function(_, url, ext, tail) {
            return '<video src="' + url + '" controls style="max-width:100%;border-radius:10px;margin-top:8px;display:block;"></video>' + tail;
        });
        // YouTube
        text = text.replace(/(https?:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)[^\s]*)/g, function(_, url, id) {
            return '<div style="position:relative;padding-bottom:56.25%;height:0;margin-top:8px;border-radius:10px;overflow:hidden;"><iframe src="https://www.youtube.com/embed/' + id + '" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>';
        });
        // Markdown link
        text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" style="color:#0050cb;text-decoration:underline;">$1</a>');
        // URL trần
        text = text.replace(/(?<![("'=])(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" style="color:#0050cb;text-decoration:underline;">$1</a>');
        // Xuống dòng
        text = text.replace(/\n/g, '<br>');
        return text;
    }

    // 8. APPEND (chỉ render DOM, không lưu)
    function appendUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'ai-msg-user';
        div.innerHTML = '<div class="ai-bubble">' + text + '</div>';
        chatBody.appendChild(div);
    }
    function appendBotMessage(text) {
        const div = document.createElement('div');
        div.className = 'ai-msg-bot';
        div.innerHTML = '<div class="ai-bot-icon"><span class="material-symbols-outlined" style="font-size:16px;">smart_toy</span></div><div class="ai-bubble">' + renderMarkdown(text) + '</div>';
        chatBody.appendChild(div);
    }

    // 9. RESTORE LỊCH SỬ khi load trang
    (function restoreHistory() {
        var history = loadHistory();
        history.forEach(function(item) {
            if (item.role === 'user') appendUserMessage(item.text);
            else appendBotMessage(item.text);
        });
        if (history.length > 0) setTimeout(function() { chatBody.scrollTop = chatBody.scrollHeight; }, 50);
    })();

    // 10. TOGGLE CHAT
    var isChatOpen = false;
    function toggleChat() {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatWindow.classList.remove('ai-hidden');
            btnFab.classList.add('ai-hidden');
            setTimeout(function() { chatBody.scrollTop = chatBody.scrollHeight; textarea.focus(); }, 100);
        } else {
            chatWindow.classList.add('ai-hidden');
            btnFab.classList.remove('ai-hidden');
        }
    }
    btnClose.addEventListener('click', toggleChat);
    btnFab.addEventListener('click', toggleChat);

    // Auto-resize textarea
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    // 11. GỬI TIN NHẮN
    async function sendMessage() {
        var text = textarea.value.trim();
        if (!text) return;

        // Render lên màn hình
        appendUserMessage(text);

        // Lưu tin khách vào localStorage
        var history = loadHistory();
        history.push({ role: 'user', text: text });
        saveHistory(history);

        textarea.value = '';
        textarea.style.height = 'auto';
        chatBody.scrollTop = chatBody.scrollHeight;
        typingIndicator.style.display = 'flex';
        textarea.disabled = true;

        try {
            var res = await fetch(WORKER_URL + "/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenant: tenant, session: session, question: text })
            });
            var data = await res.json();

            typingIndicator.style.display = 'none';
            textarea.disabled = false;
            textarea.focus();

            var reply = (data && data.reply) ? data.reply : "<span style='color:#ba1a1a'>Lỗi kết nối tới AI.</span>";

            // Render tin bot
            appendBotMessage(reply);

            // Lưu tin bot vào localStorage
            var h2 = loadHistory();
            h2.push({ role: 'bot', text: reply });
            saveHistory(h2);

        } catch (err) {
            typingIndicator.style.display = 'none';
            textarea.disabled = false;
            appendBotMessage("<span style='color:#ba1a1a'>Đường truyền có vấn đề. Vui lòng thử lại.</span>");
        }
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    sendBtn.addEventListener('click', sendMessage);
    textarea.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
})();