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

            #ai-header-actions { display: flex; align-items: center; }
            #ai-btn-call {
                background: transparent; border: none; cursor: pointer;
                width: 36px; height: 36px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: #5c5f61; transition: background 0.15s;
            }
            #ai-btn-call:hover { background: #eceef3; }
            #ai-btn-call.ai-call-ringing { color: #10b981; animation: ai-bounce 0.9s infinite; }

            #ai-call-bar {
                display: none; align-items: center; justify-content: space-between; gap: 8px;
                padding: 8px 16px; background: #eef4ff; border-bottom: 1px solid #dbe6ff;
                font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #0050cb;
                flex-shrink: 0;
            }
            #ai-call-bar.ai-call-visible { display: flex; }
            #ai-call-bar .ai-call-left { display: flex; align-items: center; gap: 6px; overflow: hidden; }
            #ai-call-bar .ai-call-left span.material-symbols-outlined { font-size: 18px; }
            #ai-call-bar .ai-call-left span.ai-call-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            #ai-call-timer { color: #5c5f61; font-weight: 500; flex-shrink: 0; }
            #ai-call-actions { display: flex; gap: 6px; flex-shrink: 0; }
            #ai-call-actions button {
                border: none; cursor: pointer; border-radius: 9999px; padding: 5px 10px;
                font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px;
                font-family: 'Inter', sans-serif;
            }
            #ai-call-mute { background: #dae1ff; color: #001849; }
            #ai-call-end { background: #ba1a1a; color: #fff; }

            #ai-incoming-call-overlay {
                position: absolute; inset: 0; z-index: 20;
                background: rgba(11,28,48,0.85); backdrop-filter: blur(4px);
                display: none; align-items: center; justify-content: center;
                flex-direction: column; text-align: center; color: #fff;
                font-family: 'Inter', sans-serif;
            }
            #ai-incoming-call-overlay.ai-call-visible { display: flex; }
            #ai-incoming-call-overlay .ai-incoming-avatar {
                width: 88px; height: 88px; border-radius: 50%;
                background: #dae1ff; color: #001849;
                display: flex; align-items: center; justify-content: center;
                font-size: 34px; margin-bottom: 16px;
            }
            #ai-incoming-call-overlay h3 { font-size: 19px; font-weight: 700; margin-bottom: 4px; }
            #ai-incoming-call-overlay p { font-size: 14px; opacity: 0.85; margin-bottom: 28px; }
            #ai-incoming-call-actions { display: flex; gap: 32px; }
            #ai-incoming-call-actions button {
                width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
            }
            #ai-incoming-decline { background: #ba1a1a; color: #fff; }
            #ai-incoming-accept {
                background: #10b981; color: #fff;
                animation: ai-call-pulse 1.4s infinite;
            }
            @keyframes ai-call-pulse {
                0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
                70%  { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
                100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
            }

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
                <div id="ai-header-actions">
                    <button id="ai-btn-call" title="Gọi thoại cho hỗ trợ viên">
                        <span class="material-symbols-outlined" style="font-size:20px;">call</span>
                    </button>
                    <button id="ai-btn-close" title="Đóng">
                        <span class="material-symbols-outlined" style="font-size:20px;">close</span>
                    </button>
                </div>
            </div>
            <div id="ai-call-bar">
                <div class="ai-call-left">
                    <span class="material-symbols-outlined" id="ai-call-bar-icon">call</span>
                    <span class="ai-call-text" id="ai-call-bar-text">—</span>
                    <span id="ai-call-timer" style="display:none;">00:00</span>
                </div>
                <div id="ai-call-actions">
                    <button id="ai-call-mute" style="display:none;">Tắt mic</button>
                    <button id="ai-call-end">Kết thúc</button>
                </div>
            </div>
            <div id="ai-incoming-call-overlay">
                <div class="ai-incoming-avatar">
                    <span class="material-symbols-outlined" style="font-size:36px;">support_agent</span>
                </div>
                <h3>Hỗ trợ viên</h3>
                <p>Đang gọi đến...</p>
                <div id="ai-incoming-call-actions">
                    <button id="ai-incoming-decline" title="Từ chối">
                        <span class="material-symbols-outlined" style="font-size:26px;">call_end</span>
                    </button>
                    <button id="ai-incoming-accept" title="Nghe">
                        <span class="material-symbols-outlined" style="font-size:26px;">call</span>
                    </button>
                </div>
            </div>
            <audio id="ai-call-remote-audio" autoplay></audio>
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

    // ==========================================================
    // 10. TOGGLE CHAT & KÍCH HOẠT REALTIME (ĐÃ GỘP SẠCH SẼ)
    // ==========================================================
    var isChatOpen = false;
    let eventSource = null;

    

    function startRealtimeListener() {
        if (eventSource) return;

        eventSource = new EventSource("https://nhannguyen123-chat.hf.space/api/realtime");

        // 🔴 BƯỚC 1 & 2: BẮT TAY LẤY ID VÀ ĐĂNG KÝ BẢNG 🔴
        eventSource.addEventListener("PB_CONNECT", function(e) {
            try {
                const connectData = JSON.parse(e.data);
                const clientId = connectData.clientId;

                // Gửi POST lên để chốt đăng ký nghe bảng 'messages'
                fetch("https://nhannguyen123-chat.hf.space/api/realtime", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clientId: clientId,
                        subscriptions: ["messages", "calls"]
                    })
                })
                .then(res => {
                    if (res.ok) console.log("🟢 [Realtime] Đã kết nối kênh nhắn tin thành công!");
                })
                .catch(err => console.error("Lỗi đăng ký Realtime:", err));

            } catch (err) {
                console.error("Lỗi parse PB_CONNECT:", err);
            }
        });

        // 🔴 BƯỚC 3: LẮNG NGHE ĐÚNG SỰ KIỆN TÊN LÀ 'messages' 🔴
        eventSource.addEventListener("messages", function(e) {
            try {
                const data = JSON.parse(e.data);
                
                // PocketBase dùng data.action và data.record
                if (data.action === "create" && data.record) {
                    const record = data.record; 

                    // Kiểm tra chuẩn phòng chat (session) và đúng tenant
                    if (record.tenant === tenant && record.session === session) {
                        
                        // Lọc trùng lặp để không in lại tin khách vừa gửi
                        const history = loadHistory();
                        const isExisted = history.some(h => h.text === record.text);
                        
                        if (!isExisted) {
                            // In tin nhắn ra widget
                            appendBotMessage(record.text);
                            
                            // Lưu vào local
                            history.push({ role: 'bot', text: record.text });
                            saveHistory(history);
                            
                            chatBody.scrollTop = chatBody.scrollHeight;
                        }
                    }
                }
            } catch (err) {
                console.error("Lỗi parse gói tin messages:", err);
            }
        });

        // Cuộc gọi (Cloudflare Realtime) — trạng thái ringing/active/ended từ collection "calls".
        eventSource.addEventListener("calls", function(e) {
            try {
                const data = JSON.parse(e.data);
                if (data.record) handleCallRecord(data.record);
            } catch (err) {
                console.error("Lỗi parse gói tin calls:", err);
            }
        });

        eventSource.onerror = function() {
            console.log("🟡 Mất kết nối, đang thử lại...");
        };
    }

    // ==========================================================
    // GỌI THOẠI (Cloudflare Realtime — SFU, xem worker /call/rtc/* và /call/state)
    // Widget không có phiên PocketBase riêng nên mọi thay đổi trạng thái cuộc gọi đi qua
    // WORKER_URL/call/state (worker ghi hộ vào collection "calls" bằng token admin của nó).
    // App Secret Cloudflare không bao giờ chạy trong trình duyệt khách — chỉ worker giữ nó.
    // ==========================================================
    const btnCall       = document.getElementById('ai-btn-call');
    const callBar       = document.getElementById('ai-call-bar');
    const callBarIcon   = document.getElementById('ai-call-bar-icon');
    const callBarText   = document.getElementById('ai-call-bar-text');
    const callTimerEl   = document.getElementById('ai-call-timer');
    const callMuteBtn   = document.getElementById('ai-call-mute');
    const callEndBtn    = document.getElementById('ai-call-end');
    const callRemoteAudio = document.getElementById('ai-call-remote-audio');
    const incomingOverlay = document.getElementById('ai-incoming-call-overlay');
    const incomingAcceptBtn = document.getElementById('ai-incoming-accept');
    const incomingDeclineBtn = document.getElementById('ai-incoming-decline');

    let activeCallRecord = null;
    let incomingCall = null;
    let callPc = null;
    let callLocalStream = null;
    let callLocalSessionId = null;
    let callLocalTrackName = null;
    let callTimerHandle = null;
    let callStartedAt = null;
    let callMuted = false;

    let ringtoneCtx = null;
    let ringtoneHandle = null;
    function playRingtone() {
        stopRingtone();
        try {
            ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
            var beep = function() {
                if (!ringtoneCtx) return;
                var osc = ringtoneCtx.createOscillator();
                var gain = ringtoneCtx.createGain();
                osc.frequency.value = 880;
                osc.connect(gain);
                gain.connect(ringtoneCtx.destination);
                gain.gain.setValueAtTime(0.18, ringtoneCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ringtoneCtx.currentTime + 0.4);
                osc.start();
                osc.stop(ringtoneCtx.currentTime + 0.4);
            };
            beep();
            ringtoneHandle = setInterval(beep, 1000);
        } catch (err) { console.warn('Không phát được chuông:', err); }
    }
    function stopRingtone() {
        if (ringtoneHandle) clearInterval(ringtoneHandle);
        ringtoneHandle = null;
        if (ringtoneCtx) { ringtoneCtx.close().catch(function() {}); ringtoneCtx = null; }
    }

    function callRtc(path, body) {
        return fetch(WORKER_URL + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function(r) { return r.json(); });
    }

    function callState(action, extra) {
        return callRtc('/call/state', Object.assign({ tenant: tenant, session: session, action: action }, extra || {}));
    }

    async function createLocalCallLeg() {
        var created = await callRtc('/call/rtc/session-new');
        if (!created || !created.sessionId) throw new Error((created && created.error) || 'Không tạo được phiên gọi');
        callLocalSessionId = created.sessionId;

        callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        callPc = new RTCPeerConnection();
        callPc.ontrack = function(e) { callRemoteAudio.srcObject = e.streams[0]; };

        var track = callLocalStream.getAudioTracks()[0];
        var transceiver = callPc.addTransceiver(track, { direction: 'sendonly' });
        callLocalTrackName = 'mic-' + Math.random().toString(36).slice(2, 10);

        var offer = await callPc.createOffer();
        await callPc.setLocalDescription(offer);

        var pushed = await callRtc('/call/rtc/tracks-new', {
            sessionId: callLocalSessionId,
            payload: {
                sessionDescription: { type: 'offer', sdp: offer.sdp },
                tracks: [{ location: 'local', mid: transceiver.mid, trackName: callLocalTrackName }]
            }
        });
        if (pushed && pushed.sessionDescription) {
            await callPc.setRemoteDescription(new RTCSessionDescription(pushed.sessionDescription));
        }
        return { sessionId: callLocalSessionId, trackName: callLocalTrackName };
    }

    async function pullRemoteCallLeg(remoteSessionId, remoteTrackName) {
        var pulled = await callRtc('/call/rtc/tracks-new', {
            sessionId: callLocalSessionId,
            payload: { tracks: [{ location: 'remote', sessionId: remoteSessionId, trackName: remoteTrackName }] }
        });
        if (pulled && pulled.requiresImmediateRenegotiation) {
            var offer = await callPc.createOffer();
            await callPc.setLocalDescription(offer);
            var reneg = await callRtc('/call/rtc/renegotiate', {
                sessionId: callLocalSessionId,
                payload: { sessionDescription: { type: 'offer', sdp: offer.sdp } }
            });
            if (reneg && reneg.sessionDescription) {
                await callPc.setRemoteDescription(new RTCSessionDescription(reneg.sessionDescription));
            }
        }
    }

    function setCallBar(opts) {
        callBar.classList.toggle('ai-call-visible', !!opts.visible);
        if (opts.icon) callBarIcon.textContent = opts.icon;
        if (opts.text) callBarText.textContent = opts.text;
        callMuteBtn.style.display = opts.showMute ? 'flex' : 'none';
        callTimerEl.style.display = opts.timer ? 'inline' : 'none';
    }

    function showIncomingCallPopup(record) {
        incomingCall = record;
        incomingOverlay.classList.add('ai-call-visible');
        btnCall.classList.add('ai-call-ringing');
        if (!isChatOpen) toggleChat();
        playRingtone();
    }
    function hideIncomingCallPopup() {
        incomingCall = null;
        incomingOverlay.classList.remove('ai-call-visible');
        btnCall.classList.remove('ai-call-ringing');
        stopRingtone();
    }

    function startCallTimer() {
        callStartedAt = Date.now();
        callTimerEl.style.display = 'inline';
        callTimerHandle = setInterval(function() {
            var secs = Math.floor((Date.now() - callStartedAt) / 1000);
            var mm = String(Math.floor(secs / 60)).padStart(2, '0');
            var ss = String(secs % 60).padStart(2, '0');
            callTimerEl.textContent = mm + ':' + ss;
        }, 1000);
    }
    function stopCallTimer() {
        if (callTimerHandle) clearInterval(callTimerHandle);
        callTimerHandle = null;
        callTimerEl.style.display = 'none';
    }

    async function startCall() {
        if (activeCallRecord && activeCallRecord.status !== 'ended') return;
        if (!isChatOpen) toggleChat();
        startRealtimeListener();
        setCallBar({ visible: true, icon: 'call', text: 'Đang gọi hỗ trợ viên...', showMute: false, timer: false });
        try {
            var leg = await createLocalCallLeg();
            var res = await callState('start', { cf_session_id: leg.sessionId, track_name: leg.trackName });
            if (res.error) throw new Error(res.error);
            activeCallRecord = res.call;
        } catch (err) {
            console.error('Lỗi bắt đầu cuộc gọi:', err);
            setCallBar({ visible: true, icon: 'call_end', text: 'Không thể gọi — thử lại sau', showMute: false, timer: false });
            setTimeout(function() { setCallBar({ visible: false }); }, 2500);
            await teardownCallLocal();
        }
    }

    async function acceptIncomingCall() {
        var record = incomingCall;
        if (!record) return;
        hideIncomingCallPopup();
        activeCallRecord = record;
        setCallBar({ visible: true, icon: 'call', text: 'Đang kết nối...', showMute: false, timer: false });
        try {
            var leg = await createLocalCallLeg();
            await pullRemoteCallLeg(record.admin_cf_session_id, record.admin_track_name);
            var res = await callState('join', { cf_session_id: leg.sessionId, track_name: leg.trackName });
            if (res.error) throw new Error(res.error);
            activeCallRecord = res.call;
            setCallBar({ visible: true, icon: 'call', text: 'Đang gọi với hỗ trợ viên', showMute: true, timer: true });
            startCallTimer();
        } catch (err) {
            console.error('Lỗi trả lời cuộc gọi:', err);
            await endCall('error');
        }
    }

    function declineIncomingCall() {
        var record = incomingCall;
        hideIncomingCallPopup();
        if (!record) return;
        callState('end', { reason: 'declined' }).catch(function() {});
    }

    async function endCall(reason) {
        stopCallTimer();
        setCallBar({ visible: false });
        if (activeCallRecord && activeCallRecord.status !== 'ended') {
            var isDecline = activeCallRecord.status === 'ringing' && activeCallRecord.initiator === 'admin';
            callState('end', { reason: reason || (isDecline ? 'declined' : 'hangup') }).catch(function() {});
        }
        await teardownCallLocal();
    }

    async function teardownCallLocal() {
        if (callLocalStream) callLocalStream.getTracks().forEach(function(t) { t.stop(); });
        if (callPc) callPc.close();
        callPc = null;
        callLocalStream = null;
        if (callLocalSessionId) callRtc('/call/rtc/tracks-close', { sessionId: callLocalSessionId, payload: {} }).catch(function() {});
        callLocalSessionId = null;
        callLocalTrackName = null;
        activeCallRecord = null;
        callMuted = false;
        callRemoteAudio.srcObject = null;
    }

    function toggleCallMute() {
        if (!callLocalStream) return;
        callMuted = !callMuted;
        callLocalStream.getAudioTracks().forEach(function(t) { t.enabled = !callMuted; });
        callMuteBtn.textContent = callMuted ? 'Bật mic' : 'Tắt mic';
    }

    function handleCallRecord(record) {
        if (!record || record.tenant !== tenant || record.session !== session) return;

        if (record.status === 'ringing' && record.initiator === 'admin') {
            showIncomingCallPopup(record);
            return;
        }
        if (incomingCall && incomingCall.id === record.id && record.status !== 'ringing') {
            hideIncomingCallPopup();
        }
        if (record.status === 'active') {
            activeCallRecord = record;
            if (!callTimerHandle) startCallTimer();
            setCallBar({ visible: true, icon: 'call', text: 'Đang gọi với hỗ trợ viên', showMute: true, timer: true });
            return;
        }
        if (['ended', 'declined', 'missed'].includes(record.status) && activeCallRecord && activeCallRecord.id === record.id) {
            stopCallTimer();
            setCallBar({ visible: false });
            teardownCallLocal();
        }
    }

    btnCall.addEventListener('click', startCall);
    incomingAcceptBtn.addEventListener('click', acceptIncomingCall);
    incomingDeclineBtn.addEventListener('click', declineIncomingCall);
    callMuteBtn.addEventListener('click', toggleCallMute);
    callEndBtn.addEventListener('click', function() { endCall(); });

    function toggleChat() {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatWindow.classList.remove('ai-hidden');
            btnFab.classList.add('ai-hidden');
            
            // Kích hoạt lắng nghe Realtime ngay khi khách vừa bấm mở khung chat
            startRealtimeListener(); 

            // Khóa cuộn trang nền nếu đang lướt bằng Mobile tràn viền
            if (window.innerWidth <= 640) {
                document.body.style.overflow = 'hidden';
            }
            setTimeout(function() { chatBody.scrollTop = chatBody.scrollHeight; textarea.focus(); }, 100);
        } else {
            chatWindow.classList.add('ai-hidden');
            btnFab.classList.remove('ai-hidden');
            
            // Mở lại cuộn trang khi đóng chat
            if (window.innerWidth <= 640) {
                document.body.style.overflow = '';
            }
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