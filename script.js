// Get the next sequential anonymous number (0001-9999)
function getNextAnonymousNumber() {
    // Get the last assigned number from localStorage
    let lastNumber = parseInt(localStorage.getItem('lastAnonymousNumber') || '0', 10);
    
    // Check if we've reached the limit (9999)
    if (lastNumber >= 9999) {
        // If we've reached the limit, wrap around or show error
        alert('Maximum number of users reached (9999). Please clear data to reset.');
        return null;
    }
    
    // Increment and save
    lastNumber++;
    localStorage.setItem('lastAnonymousNumber', lastNumber.toString());
    
    // Format with leading zeros (0001, 0002, etc.)
    return lastNumber.toString().padStart(4, '0');
}

// Generate or retrieve anonymous username
function getOrAssignAnonymousUsername() {
    // Check if user already has a username stored
    let username = localStorage.getItem('myAnonymousUsername');
    
    if (!username) {
        // User doesn't have a username yet, assign them the next sequential number
        const number = getNextAnonymousNumber();
        if (!number) {
            // Couldn't assign a number (reached limit)
            username = 'anonymous 0000'; // Fallback
        } else {
            username = `anonymous ${number}`;
            // Store it permanently in localStorage
            localStorage.setItem('myAnonymousUsername', username);
        }
    }
    
    return username;
}

// Set the username when page loads
async function initializeUsername() {
    const usernameElement = document.getElementById('username');
    if (!usernameElement) {
        console.warn('Username element not found');
        return;
    }
    const username = await getUsername();
    usernameElement.textContent = username;
}

// Get stored username (should always exist after first visit)
// If admin is logged in with custom username, use that instead
async function getUsername() {
    const data = await loadData();
    if (data.admin && data.admin.isLoggedIn && data.admin.customUsername) {
        return data.admin.customUsername;
    }
    return localStorage.getItem('myAnonymousUsername') || getOrAssignAnonymousUsername();
}

// Data Storage Functions
// Using JSONBin.io for GitHub Pages compatibility - free JSON storage API
// NOTE: You need to sign up at https://jsonbin.io and get a free API key
// Then replace the API_KEY below with your own key
// For now, this uses a demo key that has limited requests
const JSONBIN_API_KEY = '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa'; // Demo key - replace with your own!

// Cache for data to reduce API calls
let dataCache = null;
let jsonBinId = null;

// Initialize JSONBin ID from localStorage or create new one
function getJsonBinId() {
    if (!jsonBinId) {
        jsonBinId = localStorage.getItem('jsonBinId');
    }
    return jsonBinId;
}

function setJsonBinId(id) {
    jsonBinId = id;
    localStorage.setItem('jsonBinId', id);
}

async function loadData() {
    try {
        const binId = getJsonBinId();
        
        // If we don't have a bin ID yet, return default data
        if (!binId) {
            return getDefaultData();
        }
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'X-Bin-Meta': 'false'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const data = result.record || result; // Handle both formats
            // Ensure admin object exists
            if (!data.admin) {
                data.admin = {
                    password: 'admin123',
                    customUsername: null,
                    isLoggedIn: false
                };
            }
            dataCache = data;
            return data;
        } else if (response.status === 404) {
            // Bin doesn't exist yet, return default
            return getDefaultData();
        } else {
            throw new Error('Failed to load data from server');
        }
    } catch (e) {
        console.error('Error loading data:', e);
        // Return cached data if available, otherwise return default
        if (dataCache) {
            return dataCache;
        }
        return getDefaultData();
    }
}

function getDefaultData() {
    return {
        channels: [],
        directMessages: [],
        users: [],
        admin: {
            password: 'admin123',
            customUsername: null,
            isLoggedIn: false
        },
        announcements: []
    };
}

async function saveData(data) {
    try {
        // Ensure admin object exists before saving
        if (!data.admin) {
            data.admin = {
                password: 'admin123',
                customUsername: null,
                isLoggedIn: false
            };
        }
        
        let binId = getJsonBinId();
        let response;
        
        if (!binId) {
            // Create new bin
            response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY,
                    'X-Bin-Name': 'Messenger App Data',
                    'X-Bin-Private': 'false'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                binId = result.metadata?.id || result.id;
                setJsonBinId(binId);
                dataCache = data;
                return true;
            } else {
                const errorText = await response.text();
                console.error('Failed to create bin:', errorText);
                throw new Error('Failed to create data bin');
            }
        } else {
            // Update existing bin
            response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                dataCache = data;
                return true;
            } else {
                const errorText = await response.text();
                console.error('Failed to update bin:', errorText);
                // If bin was deleted, try to create a new one
                if (response.status === 404) {
                    setJsonBinId(null);
                    return await saveData(data);
                }
                throw new Error('Failed to save data to server');
            }
        }
    } catch (e) {
        console.error('Error saving data:', e);
        // Update cache anyway so UI can continue working
        dataCache = data;
        return false;
    }
}

// Channel Functions
async function createChannel(name, type, password) {
    const data = await loadData();
    const channelId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const username = await getUsername();
    
    const channel = {
        id: channelId,
        name: name,
        type: type, // 'public' or 'private'
        password: password || null,
        creator: username,
        members: [username],
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    data.channels.push(channel);
    await saveData(data);
    return channel;
}

async function getPublicChannels() {
    const data = await loadData();
    return data.channels.filter(ch => ch.type === 'public');
}

async function joinChannel(channelId, password) {
    const data = await loadData();
    const channel = data.channels.find(ch => ch.id === channelId);
    const username = await getUsername();
    
    if (!channel) {
        return { success: false, message: 'Channel not found' };
    }
    
    // Check if channel requires password
    if (channel.password && channel.password !== password) {
        return { success: false, message: 'Incorrect password' };
    }
    
    // Check if user is already a member
    if (!channel.members.includes(username)) {
        channel.members.push(username);
        await saveData(data);
    }
    
    return { success: true, channel: channel };
}

async function joinPrivateChannelByName(channelName, password) {
    const data = await loadData();
    const channel = data.channels.find(ch => 
        ch.name.toLowerCase() === channelName.toLowerCase() && ch.type === 'private'
    );
    
    if (!channel) {
        return { success: false, message: 'Private channel not found' };
    }
    
    return await joinChannel(channel.id, password);
}

async function addMessageToChannel(channelId, messageText) {
    const data = await loadData();
    const channel = data.channels.find(ch => ch.id === channelId);
    
    if (!channel) {
        return false;
    }
    
    const username = await getUsername();
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        username: username,
        text: messageText,
        timestamp: new Date().toISOString()
    };
    
    channel.messages.push(message);
    await saveData(data);
    return message;
}

// DM Functions
async function startDM(targetUsername) {
    const data = await loadData();
    const currentUser = await getUsername();
    
    // Create a conversation ID (sorted usernames to ensure uniqueness)
    const usernames = [currentUser, targetUsername].sort();
    const conversationId = 'dm_' + usernames.join('_').replace(/\s+/g, '_');
    
    // Check if conversation already exists
    let conversation = data.directMessages.find(dm => dm.id === conversationId);
    
    if (!conversation) {
        conversation = {
            id: conversationId,
            participants: usernames,
            messages: [],
            createdAt: new Date().toISOString()
        };
        data.directMessages.push(conversation);
        await saveData(data);
    }
    
    return conversation;
}

async function getMyConversations() {
    const data = await loadData();
    const currentUser = await getUsername();
    return data.directMessages.filter(dm => dm.participants.includes(currentUser));
}

async function addDMToConversation(conversationId, messageText) {
    const data = await loadData();
    const conversation = data.directMessages.find(dm => dm.id === conversationId);
    
    if (!conversation) {
        return false;
    }
    
    const username = await getUsername();
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        username: username,
        text: messageText,
        timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(message);
    await saveData(data);
    return message;
}

// UI Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    } else {
        console.error('Modal not found:', modalId);
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    } else {
        console.error('Modal not found:', modalId);
    }
}

function showChatView(channelId, channelName, type) {
    document.querySelector('.container').classList.add('hidden');
    const chatView = document.getElementById('channelChatView');
    chatView.classList.remove('hidden');
    chatView.dataset.channelId = channelId;
    chatView.dataset.chatType = type;
    document.getElementById('currentChannelName').textContent = channelName;
    loadChatMessages(channelId, type);
}

function hideChatView() {
    document.querySelector('.container').classList.remove('hidden');
    document.getElementById('channelChatView').classList.add('hidden');
}

async function loadChatMessages(channelId, type) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    const data = await loadData();
    let messages = [];
    
    if (type === 'channel') {
        const channel = data.channels.find(ch => ch.id === channelId);
        if (channel) {
            messages = channel.messages || [];
        }
    } else if (type === 'dm') {
        const conversation = data.directMessages.find(dm => dm.id === channelId);
        if (conversation) {
            messages = conversation.messages || [];
        }
    }
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
        return;
    }
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username">${msg.username}</span>
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-content">${escapeHtml(msg.text)}</div>
        `;
        messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function renderPublicChannels() {
    const container = document.getElementById('channelsContainer');
    const publicChannels = await getPublicChannels();
    
    container.innerHTML = '';
    
    if (publicChannels.length === 0) {
        container.innerHTML = '<div class="empty-state">No public channels available. Create one to get started!</div>';
        return;
    }
    
    publicChannels.forEach(channel => {
        const channelDiv = document.createElement('div');
        channelDiv.className = 'channel-item';
        channelDiv.innerHTML = `
            <div class="channel-info">
                <div class="channel-name">${escapeHtml(channel.name)}</div>
                <div class="channel-meta">
                    ${channel.members.length} member${channel.members.length !== 1 ? 's' : ''}
                    ${channel.password ? '<span class="channel-lock">🔒</span>' : ''}
                </div>
            </div>
        `;
        
        channelDiv.addEventListener('click', async () => {
            if (channel.password) {
                const password = prompt('This channel requires a password:');
                if (password === null) return;
                const result = await joinChannel(channel.id, password);
                if (result.success) {
                    hideModal('joinChannelModal');
                    showChatView(channel.id, channel.name, 'channel');
                } else {
                    alert(result.message);
                }
            } else {
                await joinChannel(channel.id, null);
                hideModal('joinChannelModal');
                showChatView(channel.id, channel.name, 'channel');
            }
        });
        
        container.appendChild(channelDiv);
    });
}

async function renderConversations() {
    const container = document.getElementById('conversationsList');
    const conversations = await getMyConversations();
    const currentUser = await getUsername();
    
    container.innerHTML = '';
    
    if (conversations.length === 0) {
        container.innerHTML = '<div class="empty-state">No active conversations</div>';
        return;
    }
    
    conversations.forEach(conv => {
        const otherUser = conv.participants.find(u => u !== currentUser);
        const convDiv = document.createElement('div');
        convDiv.className = 'conversation-item';
        convDiv.innerHTML = `<strong>${escapeHtml(otherUser)}</strong>`;
        
        convDiv.addEventListener('click', () => {
            hideModal('dmModal');
            showChatView(conv.id, otherUser, 'dm');
        });
        
        container.appendChild(convDiv);
    });
}

    // Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeUsername();
    } catch (e) {
        console.error('Error initializing username:', e);
    }
    
    try {
        initializeAdminPassword();
    } catch (e) {
        console.error('Error initializing admin password:', e);
    }

    // Button event listeners
    const createChannelBtn = document.getElementById('createChannelBtn');
    const joinChannelBtn = document.getElementById('joinChannelBtn');
    const dmBtn = document.getElementById('dmBtn');
    
    // Modal close buttons
    const closeCreateModal = document.getElementById('closeCreateModal');
    const closeJoinModal = document.getElementById('closeJoinModal');
    const closeDMModal = document.getElementById('closeDMModal');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const backToMainBtn = document.getElementById('backToMainBtn');

    // Create Channel
    if (createChannelBtn) {
        createChannelBtn.addEventListener('click', () => {
            showModal('createChannelModal');
        });
    } else {
        console.error('createChannelBtn not found');
    }

    if (closeCreateModal) {
        closeCreateModal.addEventListener('click', () => {
            hideModal('createChannelModal');
        });
    }

    if (cancelCreateBtn) {
        cancelCreateBtn.addEventListener('click', () => {
            hideModal('createChannelModal');
        });
    }

    const createChannelForm = document.getElementById('createChannelForm');
    if (createChannelForm) {
        createChannelForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('channelName')?.value.trim();
            const type = document.querySelector('input[name="channelType"]:checked')?.value;
            const hasPassword = document.getElementById('hasPassword')?.checked;
            const password = hasPassword ? document.getElementById('channelPassword')?.value.trim() : null;
            
            if (!name) {
                alert('Please enter a channel name');
                return;
            }
            
            if (hasPassword && !password) {
                alert('Please enter a password');
                return;
            }
            
            const channel = await createChannel(name, type, password);
            hideModal('createChannelModal');
            const form = document.getElementById('createChannelForm');
            if (form) form.reset();
            const passwordGroup = document.getElementById('passwordGroup');
            if (passwordGroup) passwordGroup.style.display = 'none';
            alert(`Channel "${name}" created successfully!`);
        });
    }

    // Toggle password field
    const hasPasswordCheckbox = document.getElementById('hasPassword');
    if (hasPasswordCheckbox) {
        hasPasswordCheckbox.addEventListener('change', (e) => {
            const passwordGroup = document.getElementById('passwordGroup');
            if (passwordGroup) {
                passwordGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });
    }

    // Join Channel
    if (joinChannelBtn) {
        joinChannelBtn.addEventListener('click', async () => {
            await renderPublicChannels();
            showModal('joinChannelModal');
        });
    } else {
        console.error('joinChannelBtn not found');
    }

    if (closeJoinModal) {
        closeJoinModal.addEventListener('click', () => {
            hideModal('joinChannelModal');
        });
    }

    const joinPrivateForm = document.getElementById('joinPrivateForm');
    if (joinPrivateForm) {
        joinPrivateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const channelName = document.getElementById('privateChannelName')?.value.trim();
            const password = document.getElementById('privateChannelPassword')?.value.trim();
            
            if (!channelName || !password) {
                alert('Please enter both channel name and password');
                return;
            }
            
            const result = await joinPrivateChannelByName(channelName, password);
            if (result.success) {
                hideModal('joinChannelModal');
                const form = document.getElementById('joinPrivateForm');
                if (form) form.reset();
                showChatView(result.channel.id, result.channel.name, 'channel');
            } else {
                alert(result.message);
            }
        });
    }

    // DM
    if (dmBtn) {
        dmBtn.addEventListener('click', async () => {
            await renderConversations();
            showModal('dmModal');
        });
    } else {
        console.error('dmBtn not found');
    }

    if (closeDMModal) {
        closeDMModal.addEventListener('click', () => {
            hideModal('dmModal');
        });
    }

    const startDMBtn = document.getElementById('startDMBtn');
    if (startDMBtn) {
        startDMBtn.addEventListener('click', async () => {
            const targetUsername = document.getElementById('dmUsername')?.value.trim();
            if (!targetUsername) {
                alert('Please enter a username');
                return;
            }
            
            const currentUsername = await getUsername();
            if (targetUsername === currentUsername) {
                alert('You cannot message yourself');
                return;
            }
            
            const conversation = await startDM(targetUsername);
            hideModal('dmModal');
            const dmUsernameInput = document.getElementById('dmUsername');
            if (dmUsernameInput) dmUsernameInput.value = '';
            showChatView(conversation.id, targetUsername, 'dm');
        });
    }

    // Chat View
    if (backToMainBtn) {
        backToMainBtn.addEventListener('click', () => {
            hideChatView();
        });
    }

    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    async function sendMessage() {
        const input = document.getElementById('messageInput');
        const messageText = input.value.trim();
        if (!messageText) return;
        
        const chatView = document.getElementById('channelChatView');
        const channelId = chatView.dataset.channelId;
        const chatType = chatView.dataset.chatType;
        
        let success = false;
        if (chatType === 'channel') {
            success = await addMessageToChannel(channelId, messageText);
        } else if (chatType === 'dm') {
            success = await addDMToConversation(channelId, messageText);
        }
        
        if (success) {
            input.value = '';
            await loadChatMessages(channelId, chatType);
        }
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });

    // Admin Panel Functions
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    const closeAdminModal = document.getElementById('closeAdminModal');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminAnnouncesBtn = document.getElementById('adminAnnouncesBtn');
    const backFromAnnouncementsBtn = document.getElementById('backFromAnnouncementsBtn');
    
    if (!adminPanelBtn) {
        console.error('adminPanelBtn not found');
    }
    if (!adminAnnouncesBtn) {
        console.error('adminAnnouncesBtn not found');
    }

    // Initialize admin password if not set - more robust for GitHub Pages
    async function initializeAdminPassword() {
        const data = await loadData();
        // Always ensure admin object exists with all required properties
        if (!data.admin) {
            data.admin = {
                password: 'admin123',
                customUsername: null,
                isLoggedIn: false
            };
            await saveData(data);
            return;
        }
        
        // If admin exists but password is missing or invalid, reset it
        if (!data.admin.password || typeof data.admin.password !== 'string') {
            data.admin.password = 'admin123';
            // Don't reset customUsername or isLoggedIn if they exist
            if (data.admin.customUsername === undefined) {
                data.admin.customUsername = null;
            }
            if (data.admin.isLoggedIn === undefined) {
                data.admin.isLoggedIn = false;
            }
            await saveData(data);
            return;
        }
    }

    // Admin login - more robust checking
    async function loginAdmin(password) {
        // Always ensure admin is initialized first
        await initializeAdminPassword();
        
        const data = await loadData();
        
        // Ensure we have valid admin data
        if (!data.admin || !data.admin.password) {
            console.error('Admin data not properly initialized');
            // Force re-initialization
            data.admin = {
                password: 'admin123',
                customUsername: data.admin?.customUsername || null,
                isLoggedIn: false
            };
            await saveData(data);
        }
        
        // Check password
        if (data.admin && data.admin.password && data.admin.password === password) {
            data.admin.isLoggedIn = true;
            await saveData(data);
            return true;
        }
        
        return false;
    }

    // Change admin password
    async function changeAdminPassword(newPassword, confirmPassword) {
        await initializeAdminPassword(); // Ensure admin exists
        const data = await loadData();
        const loggedIn = await isAdminLoggedIn();
        if (!loggedIn) {
            return { success: false, message: 'You must be logged in as admin' };
        }
        
        if (!newPassword || newPassword.length < 3) {
            return { success: false, message: 'Password must be at least 3 characters' };
        }
        
        if (newPassword !== confirmPassword) {
            return { success: false, message: 'Passwords do not match' };
        }
        
        data.admin.password = newPassword;
        await saveData(data);
        return { success: true, message: 'Password changed successfully!' };
    }

    // Check if admin is logged in
    async function isAdminLoggedIn() {
        await initializeAdminPassword(); // Ensure admin exists
        const data = await loadData();
        return data.admin && data.admin.isLoggedIn === true;
    }

    // Logout admin
    async function logoutAdmin() {
        const data = await loadData();
        if (data.admin) {
            data.admin.isLoggedIn = false;
            await saveData(data);
        }
    }

    // Set admin custom username
    async function setAdminCustomUsername(username) {
        await initializeAdminPassword(); // Ensure admin exists
        const data = await loadData();
        const loggedIn = await isAdminLoggedIn();
        if (data.admin && loggedIn) {
            data.admin.customUsername = username;
            await saveData(data);
            // Update displayed username
            const usernameEl = document.getElementById('username');
            if (usernameEl) {
                usernameEl.textContent = username;
            }
            return true;
        }
        return false;
    }

    // Get all channels (for admin)
    async function getAllChannels() {
        const data = await loadData();
        return data.channels || [];
    }

    // Admin join any channel (bypasses password)
    async function adminJoinChannel(channelId) {
        await initializeAdminPassword(); // Ensure admin exists
        const data = await loadData();
        const loggedIn = await isAdminLoggedIn();
        if (!loggedIn) {
            return { success: false, message: 'Not logged in as admin' };
        }
        
        const channel = data.channels.find(ch => ch.id === channelId);
        if (!channel) {
            return { success: false, message: 'Channel not found' };
        }
        
        const username = await getUsername();
        if (!channel.members.includes(username)) {
            channel.members.push(username);
            await saveData(data);
        }
        
        return { success: true, channel: channel };
    }

    // Create announcement
    async function createAnnouncement(title, message, imageUrl, videoUrl) {
        await initializeAdminPassword(); // Ensure admin exists
        const data = await loadData();
        const loggedIn = await isAdminLoggedIn();
        if (!loggedIn) {
            return { success: false, message: 'Not logged in as admin' };
        }
        
        const username = await getUsername();
        const announcement = {
            id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title,
            message: message || '',
            imageUrl: imageUrl || null,
            videoUrl: videoUrl || null,
            createdAt: new Date().toISOString(),
            createdBy: username
        };
        
        if (!data.announcements) {
            data.announcements = [];
        }
        data.announcements.push(announcement);
        await saveData(data);
        return { success: true, announcement: announcement };
    }

    // Get all announcements
    async function getAllAnnouncements() {
        const data = await loadData();
        return (data.announcements || []).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    // Render announcements
    async function renderAnnouncements() {
        const container = document.getElementById('announcementsContainer');
        const announcements = await getAllAnnouncements();
        
        container.innerHTML = '';
        
        if (announcements.length === 0) {
            container.innerHTML = '<div class="empty-state">No announcements yet.</div>';
            return;
        }
        
        announcements.forEach(announcement => {
            const card = document.createElement('div');
            card.className = 'announcement-card';
            
            const date = new Date(announcement.createdAt);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let content = `
                <div class="announcement-header">
                    <h3 class="announcement-title">${escapeHtml(announcement.title)}</h3>
                    <div class="announcement-date">${dateStr}</div>
                </div>
            `;
            
            if (announcement.message) {
                content += `<div class="announcement-message">${escapeHtml(announcement.message)}</div>`;
            }
            
            if (announcement.imageUrl) {
                content += `<img src="${escapeHtml(announcement.imageUrl)}" alt="Announcement image" class="announcement-image" onerror="this.style.display='none'">`;
            }
            
            if (announcement.videoUrl) {
                // Check if it's a YouTube URL or direct video URL
                let videoEmbed = announcement.videoUrl;
                if (videoEmbed.includes('youtube.com/watch?v=')) {
                    const videoId = videoEmbed.split('v=')[1].split('&')[0];
                    videoEmbed = `https://www.youtube.com/embed/${videoId}`;
                } else if (videoEmbed.includes('youtu.be/')) {
                    const videoId = videoEmbed.split('youtu.be/')[1].split('?')[0];
                    videoEmbed = `https://www.youtube.com/embed/${videoId}`;
                }
                content += `<iframe src="${escapeHtml(videoEmbed)}" class="announcement-video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            }
            
            card.innerHTML = content;
            container.appendChild(card);
        });
    }

    // Show announcements view
    async function showAnnouncementsView() {
        document.querySelector('.container').classList.add('hidden');
        document.getElementById('announcementsView').classList.remove('hidden');
        await renderAnnouncements();
    }

    // Hide announcements view
    function hideAnnouncementsView() {
        document.querySelector('.container').classList.remove('hidden');
        document.getElementById('announcementsView').classList.add('hidden');
    }

    // Update displayed username
    async function updateDisplayedUsername() {
        const username = await getUsername();
        const usernameEl = document.getElementById('username');
        if (usernameEl) {
            usernameEl.textContent = username;
        }
    }

    // Render admin dashboard
    async function renderAdminDashboard() {
        await initializeAdminPassword(); // Ensure admin exists
        const data = await loadData();
        
        // Show current username
        const currentUsername = await getUsername();
        const adminUsernameEl = document.getElementById('currentAdminUsername');
        if (adminUsernameEl) {
            adminUsernameEl.textContent = currentUsername;
        }
        
        // Update main page username display
        await updateDisplayedUsername();
        
        // Populate channel select
        const channelSelect = document.getElementById('adminChannelSelect');
        if (channelSelect) {
            channelSelect.innerHTML = '<option value="">-- Select a channel --</option>';
            
            const allChannels = await getAllChannels();
            allChannels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `${channel.name} (${channel.type}) - ${channel.members.length} members`;
                channelSelect.appendChild(option);
            });
        }
    }

    // Admin Panel Button
    if (adminPanelBtn) {
        adminPanelBtn.addEventListener('click', async () => {
        // Always initialize admin first
        await initializeAdminPassword();
        const data = await loadData();
        
        const adminLoginView = document.getElementById('adminLoginView');
        const adminDashboard = document.getElementById('adminDashboard');
        const adminPasswordInput = document.getElementById('adminPassword');
        
        if (data.admin && data.admin.isLoggedIn === true) {
            // Already logged in, show dashboard
            if (adminLoginView) adminLoginView.classList.add('hidden');
            if (adminDashboard) adminDashboard.classList.remove('hidden');
            await renderAdminDashboard();
        } else {
            // Show login
            if (adminLoginView) adminLoginView.classList.remove('hidden');
            if (adminDashboard) adminDashboard.classList.add('hidden');
            if (adminPasswordInput) adminPasswordInput.value = '';
        }
        showModal('adminPanelModal');
        });
    }

    if (closeAdminModal) {
        closeAdminModal.addEventListener('click', () => {
            hideModal('adminPanelModal');
        });
    }

    // Admin login form
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        
        if (await loginAdmin(password)) {
            document.getElementById('adminLoginView').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            await updateDisplayedUsername();
            await renderAdminDashboard();
            alert('Admin login successful!');
        } else {
            alert('Incorrect password');
        }
        });
    }

    // Set admin username
    const setAdminUsernameBtn = document.getElementById('setAdminUsernameBtn');
    if (setAdminUsernameBtn) {
        setAdminUsernameBtn.addEventListener('click', async () => {
        const username = document.getElementById('adminCustomUsername').value.trim();
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        if (await setAdminCustomUsername(username)) {
            await renderAdminDashboard();
            alert('Username updated!');
            document.getElementById('adminCustomUsername').value = '';
        } else {
            alert('You must be logged in as admin');
        }
        });
    }

    // Change admin password
    const changeAdminPasswordBtn = document.getElementById('changeAdminPasswordBtn');
    if (changeAdminPasswordBtn) {
        changeAdminPasswordBtn.addEventListener('click', async () => {
        const newPassword = document.getElementById('newAdminPassword').value.trim();
        const confirmPassword = document.getElementById('confirmAdminPassword').value.trim();
        
        const result = await changeAdminPassword(newPassword, confirmPassword);
        if (result.success) {
            alert(result.message);
            document.getElementById('newAdminPassword').value = '';
            document.getElementById('confirmAdminPassword').value = '';
        } else {
            alert(result.message);
        }
        });
    }

    // Admin join channel
    const adminJoinChannelBtn = document.getElementById('adminJoinChannelBtn');
    if (adminJoinChannelBtn) {
        adminJoinChannelBtn.addEventListener('click', async () => {
        const channelId = document.getElementById('adminChannelSelect').value;
        if (!channelId) {
            alert('Please select a channel');
            return;
        }
        
        const result = await adminJoinChannel(channelId);
        if (result.success) {
            hideModal('adminPanelModal');
            showChatView(result.channel.id, result.channel.name, 'channel');
        } else {
            alert(result.message);
        }
        });
    }

    // Create announcement
    const createAnnouncementForm = document.getElementById('createAnnouncementForm');
    if (createAnnouncementForm) {
        createAnnouncementForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('announcementTitle').value.trim();
        const message = document.getElementById('announcementMessage').value.trim();
        const imageUrl = document.getElementById('announcementImage').value.trim();
        const videoUrl = document.getElementById('announcementVideo').value.trim();
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        const result = await createAnnouncement(title, message, imageUrl, videoUrl);
        if (result.success) {
            alert('Announcement created successfully!');
            document.getElementById('createAnnouncementForm').reset();
        } else {
            alert(result.message);
        }
        });
    }

    // Admin Announces button
    if (adminAnnouncesBtn) {
        adminAnnouncesBtn.addEventListener('click', async () => {
            await showAnnouncementsView();
        });
    }

    // Back from announcements
    if (backFromAnnouncementsBtn) {
        backFromAnnouncementsBtn.addEventListener('click', () => {
            hideAnnouncementsView();
        });
    }
});
