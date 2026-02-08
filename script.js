// 动态获取设备信息并显示在状态栏
function updateDeviceStatus() {
    const statusElement = document.getElementById('deviceStatus');
    if (!statusElement) return;

    // 1. 获取当前时间
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // 2. 获取网络状态
    let networkStr = '未知网络';
    if (navigator.connection) {
        const networkTypes = {
            'wifi': 'Wi-Fi',
            'cellular': '5G/4G',
            'ethernet': '以太网',
            'none': '无网络'
        };
        networkStr = networkTypes[navigator.connection.effectiveType] || navigator.connection.effectiveType;
    }

    // 3. 获取电池电量（仅部分浏览器支持）
    let batteryStr = '电量未知';
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            const level = Math.round(battery.level * 100);
            batteryStr = `${level}%`;
            // 电池状态变化时更新
            battery.addEventListener('levelchange', () => {
                const newLevel = Math.round(battery.level * 100);
                statusElement.textContent = `${timeStr} | ${networkStr} | ${newLevel}%`;
            });
            // 首次更新电池信息
            statusElement.textContent = `${timeStr} | ${networkStr} | ${batteryStr}`;
        });
    }

    // 先显示时间和网络（电池信息可能延迟）
    statusElement.textContent = `${timeStr} | ${networkStr} | ${batteryStr}`;

    // 每分钟更新一次时间
    setInterval(() => {
        const newNow = new Date();
        const newTimeStr = newNow.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        statusElement.textContent = `${newTimeStr} | ${networkStr} | ${batteryStr}`;
    }, 60000);
}

// 页面加载完成后更新设备状态
window.addEventListener('load', updateDeviceStatus);


// 1. 读取配置/显示配置弹窗
let config = JSON.parse(localStorage.getItem('aiPhoneConfig')) || null;
const configModal = document.getElementById('configModal');
const phone = document.getElementById('phone');
const avatarDisplay = document.getElementById('avatarDisplay');
const nameDisplay = document.getElementById('nameDisplay');
const saveConfigBtn = document.getElementById('saveConfigBtn');

// 头像图片上传+预览
const avatarFile = document.getElementById('avatarFile');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const avatarPreview = document.getElementById('avatarPreview').querySelector('img');

// 点击按钮触发文件选择
avatarUploadBtn.addEventListener('click', () => {
    avatarFile.click();
});

// 选择图片后预览
avatarFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            avatarPreview.src = readerEvent.target.result;
            avatarPreview.style.display = 'block'; // 显示预览图
        };
        reader.readAsDataURL(file); // 转成base64格式保存
    }
});

// 2. 配置弹窗：保存配置并进入聊天
saveConfigBtn.addEventListener('click', () => {
    // 获取头像（优先用上传的图片，没有则用默认）
    const avatar = avatarPreview.src || 'https://via.placeholder.com/40/eee/333?text=AI';
    const name = document.getElementById('nameInput').value.trim() || '我的AI';
    const setting = document.getElementById('settingInput').value.trim() || '你是我的朋友，说话自然，回复简短';
    const apiUrl = document.getElementById('apiUrlInput').value.trim(); // 自定义API网址
    const apiKey = document.getElementById('apiKeyInput').value.trim(); // 自定义API密钥

    // 校验必填项
    if (!apiUrl || !apiKey) {
        alert('请填写API网址和密钥！');
        return;
    }

    // 保存配置到浏览器
    config = { avatar, name, setting, apiUrl, apiKey };
    localStorage.setItem('aiPhoneConfig', JSON.stringify(config));
    
    // 显示手机界面，隐藏配置弹窗
    configModal.style.display = 'none';
    phone.style.display = 'block';
    // 显示头像（如果是图片链接，用img标签；否则用文字）
    if (avatar.startsWith('data:') || avatar.startsWith('http')) {
        avatarDisplay.innerHTML = `<img src="${avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        avatarDisplay.textContent = avatar;
    }
    nameDisplay.textContent = name;
    initChat(); // 初始化聊天功能
});

// 3. 如果已有配置，直接进入聊天
if (config) {
    configModal.style.display = 'none';
    phone.style.display = 'block';
    // 显示头像
    if (config.avatar.startsWith('data:') || config.avatar.startsWith('http')) {
        avatarDisplay.innerHTML = `<img src="${config.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        avatarDisplay.textContent = config.avatar;
    }
    nameDisplay.textContent = config.name;
    initChat();
}

// 4. 聊天功能核心逻辑
function initChat() {
    const chatContent = document.getElementById('chatContent');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');

    // 新增：根据人设生成AI的第一条欢迎语
    async function generateWelcomeMsg() {
        try {
            const requestData = {
                model: "doubao-3-pro", // 若其他API模型名不同，可让朋友手动改这里，或后续新增配置项
                messages: [
                    { role: "system", content: config.setting },
                    { role: "user", content: "请用符合你人设的语气，说一句简短的欢迎语，和我打招呼" }
                ],
                temperature: 0.8,
                max_tokens: 50
            };
            const response = await fetch(config.apiUrl, { // 使用自定义API网址
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}` // 使用自定义API密钥
                },
                body: JSON.stringify(requestData)
            });
            const data = await response.json();
            const welcomeMsg = data.choices[0].message.content.trim();
            addMsgToChat(welcomeMsg, 'ai'); // 显示AI的欢迎语
        } catch (error) {
            addMsgToChat('你好呀～我是你的专属AI！', 'ai'); // 失败时显示默认欢迎语
            console.log(error);
        }
    }

    // 初始化时生成欢迎语
    generateWelcomeMsg();

    // 发送消息
    function sendMsg() {
        const msgText = msgInput.value.trim();
        if (!msgText) return;
        addMsgToChat(msgText, 'user');
        msgInput.value = '';
        getAiReply(msgText);
    }

    // 添加消息到聊天区
    function addMsgToChat(text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${type}-msg`;
        msgDiv.innerHTML = `<div class="msg-box">${text}</div>`;
        chatContent.appendChild(msgDiv);
        chatContent.scrollTop = chatContent.scrollHeight;
    }

    // 调用自定义API接口
    async function getAiReply(userMsg) {
        try {
            const requestData = {
                model: "doubao-3-pro", // 可根据实际API修改模型名，或新增配置项让朋友自定义
                messages: [
                    { role: "system", content: config.setting },
                    { role: "user", content: userMsg }
                ],
                temperature: 0.8,
                max_tokens: 200
            };
            const response = await fetch(config.apiUrl, { // 使用自定义API网址
                method: "POST",
                headers: {
