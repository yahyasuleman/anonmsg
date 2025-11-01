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
function initializeUsername() {
    const usernameElement = document.getElementById('username');
    const username = getUsername();
    usernameElement.textContent = username;
}

// Get stored username (should always exist after first visit)
// If admin is logged in with custom username, use that instead
function getUsername() {
    const data = loadData();
    if (data.admin && data.admin.isLoggedIn && data.admin.customUsername) {
        return data.admin.customUsername;
    }
    return localStorage.getItem('myAnonymousUsername') || getOrAssignAnonymousUsername();
}

// Data Storage Functions
function loadData() {
    try {
        const data = localStorage.getItem('messengerData');
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    // Return default structure if no data exists
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

function saveData(data) {
    try {
        localStorage.setItem('messengerData', JSON.stringify(data));
        // Also update data.json file structure (for reference)
        return true;
    } catch (e) {
        console.error('Error saving data:', e);
        return false;
    }
}

// Channel Functions
function createChannel(name, type, password) {
    const data = loadData();
    const channelId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const channel = {
        id: channelId,
        name: name,
        type: type, // 'public' or 'private'
        password: password || null,
        creator: getUsername(),
        members: [getUsername()],
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    data.channels.push(channel);
    saveData(data);
    return channel;
}

function getPublicChannels() {
    const data = loadData();
    return data.channels.filter(ch => ch.type === 'public');
}

function joinChannel(channelId, password) {
    const data = loadData();
    const channel = data.channels.find(ch => ch.id === channelId);
    const username = getUsername();
    
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
        saveData(data);
    }
    
    return { success: true, channel: channel };
}

function joinPrivateChannelByName(channelName, password) {
    const data = loadData();
    const channel = data.channels.find(ch => 
        ch.name.toLowerCase() === channelName.toLowerCase() && ch.type === 'private'
    );
    
    if (!channel) {
        return { success: false, message: 'Private channel not found' };
    }
    
    return joinChannel(channel.id, password);
}

function addMessageToChannel(channelId, messageText) {
    const data = loadData();
    const channel = data.channels.find(ch => ch.id === channelId);
    
    if (!channel) {
        return false;
    }
    
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        username: getUsername(),
        text: messageText,
        timestamp: new Date().toISOString()
    };
    
    channel.messages.push(message);
    saveData(data);
    return message;
}

// DM Functions
function startDM(targetUsername) {
    const data = loadData();
    const currentUser = getUsername();
    
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
        saveData(data);
    }
    
    return conversation;
}

function getMyConversations() {
    const data = loadData();
    const currentUser = getUsername();
    return data.directMessages.filter(dm => dm.participants.includes(currentUser));
}

function addDMToConversation(conversationId, messageText) {
    const data = loadData();
    const conversation = data.directMessages.find(dm => dm.id === conversationId);
    
    if (!conversation) {
        return false;
    }
    
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        username: getUsername(),
        text: messageText,
        timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(message);
    saveData(data);
    return message;
}

// UI Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
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

function loadChatMessages(channelId, type) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    const data = loadData();
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

function renderPublicChannels() {
    const container = document.getElementById('channelsContainer');
    const publicChannels = getPublicChannels();
    
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
        
        channelDiv.addEventListener('click', () => {
            if (channel.password) {
                const password = prompt('This channel requires a password:');
                if (password === null) return;
                const result = joinChannel(channel.id, password);
                if (result.success) {
                    hideModal('joinChannelModal');
                    showChatView(channel.id, channel.name, 'channel');
                } else {
                    alert(result.message);
                }
            } else {
                joinChannel(channel.id, null);
                hideModal('joinChannelModal');
                showChatView(channel.id, channel.name, 'channel');
            }
        });
        
        container.appendChild(channelDiv);
    });
}

function renderConversations() {
    const container = document.getElementById('conversationsList');
    const conversations = getMyConversations();
    const currentUser = getUsername();
    
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
    initializeUsername();
    initializeAdminPassword();

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
    createChannelBtn.addEventListener('click', () => {
        showModal('createChannelModal');
    });

    closeCreateModal.addEventListener('click', () => {
        hideModal('createChannelModal');
    });

    cancelCreateBtn.addEventListener('click', () => {
        hideModal('createChannelModal');
    });

    document.getElementById('createChannelForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('channelName').value.trim();
        const type = document.querySelector('input[name="channelType"]:checked').value;
        const hasPassword = document.getElementById('hasPassword').checked;
        const password = hasPassword ? document.getElementById('channelPassword').value.trim() : null;
        
        if (!name) {
            alert('Please enter a channel name');
            return;
        }
        
        if (hasPassword && !password) {
            alert('Please enter a password');
            return;
        }
        
        const channel = createChannel(name, type, password);
        hideModal('createChannelModal');
        document.getElementById('createChannelForm').reset();
        document.getElementById('passwordGroup').style.display = 'none';
        alert(`Channel "${name}" created successfully!`);
    });

    // Toggle password field
    document.getElementById('hasPassword').addEventListener('change', (e) => {
        const passwordGroup = document.getElementById('passwordGroup');
        passwordGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    // Join Channel
    joinChannelBtn.addEventListener('click', () => {
        renderPublicChannels();
        showModal('joinChannelModal');
    });

    closeJoinModal.addEventListener('click', () => {
        hideModal('joinChannelModal');
    });

    document.getElementById('joinPrivateForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const channelName = document.getElementById('privateChannelName').value.trim();
        const password = document.getElementById('privateChannelPassword').value.trim();
        
        if (!channelName || !password) {
            alert('Please enter both channel name and password');
            return;
        }
        
        const result = joinPrivateChannelByName(channelName, password);
        if (result.success) {
            hideModal('joinChannelModal');
            document.getElementById('joinPrivateForm').reset();
            showChatView(result.channel.id, result.channel.name, 'channel');
        } else {
            alert(result.message);
        }
    });

    // DM
    dmBtn.addEventListener('click', () => {
        renderConversations();
        showModal('dmModal');
    });

    closeDMModal.addEventListener('click', () => {
        hideModal('dmModal');
    });

    document.getElementById('startDMBtn').addEventListener('click', () => {
        const targetUsername = document.getElementById('dmUsername').value.trim();
        if (!targetUsername) {
            alert('Please enter a username');
            return;
        }
        
        if (targetUsername === getUsername()) {
            alert('You cannot message yourself');
            return;
        }
        
        const conversation = startDM(targetUsername);
        hideModal('dmModal');
        document.getElementById('dmUsername').value = '';
        showChatView(conversation.id, targetUsername, 'dm');
    });

    // Chat View
    backToMainBtn.addEventListener('click', () => {
        hideChatView();
    });

    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const input = document.getElementById('messageInput');
        const messageText = input.value.trim();
        if (!messageText) return;
        
        const chatView = document.getElementById('channelChatView');
        const channelId = chatView.dataset.channelId;
        const chatType = chatView.dataset.chatType;
        
        let success = false;
        if (chatType === 'channel') {
            success = addMessageToChannel(channelId, messageText);
        } else if (chatType === 'dm') {
            success = addDMToConversation(channelId, messageText);
        }
        
        if (success) {
            input.value = '';
            loadChatMessages(channelId, chatType);
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

    // Initialize admin password if not set
    function initializeAdminPassword() {
        const data = loadData();
        if (!data.admin || !data.admin.password) {
            if (!data.admin) {
                data.admin = {};
            }
            data.admin.password = 'admin123';
            data.admin.customUsername = null;
            data.admin.isLoggedIn = false;
            saveData(data);
        }
    }

    // Admin login
    function loginAdmin(password) {
        const data = loadData();
        // Initialize if not set
        if (!data.admin || !data.admin.password) {
            initializeAdminPassword();
            // Reload data after initialization
            const updatedData = loadData();
            if (updatedData.admin && updatedData.admin.password === password) {
                updatedData.admin.isLoggedIn = true;
                saveData(updatedData);
                return true;
            }
            return false;
        }
        if (data.admin && data.admin.password === password) {
            data.admin.isLoggedIn = true;
            saveData(data);
            return true;
        }
        return false;
    }

    // Change admin password
    function changeAdminPassword(newPassword, confirmPassword) {
        const data = loadData();
        if (!isAdminLoggedIn()) {
            return { success: false, message: 'You must be logged in as admin' };
        }
        
        if (!newPassword || newPassword.length < 3) {
            return { success: false, message: 'Password must be at least 3 characters' };
        }
        
        if (newPassword !== confirmPassword) {
            return { success: false, message: 'Passwords do not match' };
        }
        
        data.admin.password = newPassword;
        saveData(data);
        return { success: true, message: 'Password changed successfully!' };
    }

    // Check if admin is logged in
    function isAdminLoggedIn() {
        const data = loadData();
        return data.admin && data.admin.isLoggedIn === true;
    }

    // Logout admin
    function logoutAdmin() {
        const data = loadData();
        if (data.admin) {
            data.admin.isLoggedIn = false;
            saveData(data);
        }
    }

    // Set admin custom username
    function setAdminCustomUsername(username) {
        const data = loadData();
        if (data.admin && data.admin.isLoggedIn) {
            data.admin.customUsername = username;
            saveData(data);
            // Update displayed username
            document.getElementById('username').textContent = username;
            return true;
        }
        return false;
    }

    // Get all channels (for admin)
    function getAllChannels() {
        const data = loadData();
        return data.channels || [];
    }

    // Admin join any channel (bypasses password)
    function adminJoinChannel(channelId) {
        const data = loadData();
        if (!isAdminLoggedIn()) {
            return { success: false, message: 'Not logged in as admin' };
        }
        
        const channel = data.channels.find(ch => ch.id === channelId);
        if (!channel) {
            return { success: false, message: 'Channel not found' };
        }
        
        const username = getUsername();
        if (!channel.members.includes(username)) {
            channel.members.push(username);
            saveData(data);
        }
        
        return { success: true, channel: channel };
    }

    // Create announcement
    function createAnnouncement(title, message, imageUrl, videoUrl) {
        const data = loadData();
        if (!isAdminLoggedIn()) {
            return { success: false, message: 'Not logged in as admin' };
        }
        
        const announcement = {
            id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title,
            message: message || '',
            imageUrl: imageUrl || null,
            videoUrl: videoUrl || null,
            createdAt: new Date().toISOString(),
            createdBy: getUsername()
        };
        
        if (!data.announcements) {
            data.announcements = [];
        }
        data.announcements.push(announcement);
        saveData(data);
        return { success: true, announcement: announcement };
    }

    // Get all announcements
    function getAllAnnouncements() {
        const data = loadData();
        return (data.announcements || []).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    // Render announcements
    function renderAnnouncements() {
        const container = document.getElementById('announcementsContainer');
        const announcements = getAllAnnouncements();
        
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
    function showAnnouncementsView() {
        document.querySelector('.container').classList.add('hidden');
        document.getElementById('announcementsView').classList.remove('hidden');
        renderAnnouncements();
    }

    // Hide announcements view
    function hideAnnouncementsView() {
        document.querySelector('.container').classList.remove('hidden');
        document.getElementById('announcementsView').classList.add('hidden');
    }

    // Update displayed username
    function updateDisplayedUsername() {
        const username = getUsername();
        document.getElementById('username').textContent = username;
    }

    // Render admin dashboard
    function renderAdminDashboard() {
        const data = loadData();
        
        // Show current username
        const currentUsername = getUsername();
        document.getElementById('currentAdminUsername').textContent = currentUsername;
        
        // Update main page username display
        updateDisplayedUsername();
        
        // Populate channel select
        const channelSelect = document.getElementById('adminChannelSelect');
        channelSelect.innerHTML = '<option value="">-- Select a channel --</option>';
        
        const allChannels = getAllChannels();
        allChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `${channel.name} (${channel.type}) - ${channel.members.length} members`;
            channelSelect.appendChild(option);
        });
    }

    // Admin Panel Button
    adminPanelBtn.addEventListener('click', () => {
        const data = loadData();
        if (data.admin && data.admin.isLoggedIn) {
            // Already logged in, show dashboard
            document.getElementById('adminLoginView').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            renderAdminDashboard();
        } else {
            // Show login
            document.getElementById('adminLoginView').classList.remove('hidden');
            document.getElementById('adminDashboard').classList.add('hidden');
            document.getElementById('adminPassword').value = '';
        }
        showModal('adminPanelModal');
    });

    closeAdminModal.addEventListener('click', () => {
        hideModal('adminPanelModal');
    });

    // Admin login form
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        
        if (loginAdmin(password)) {
            document.getElementById('adminLoginView').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            updateDisplayedUsername();
            renderAdminDashboard();
            alert('Admin login successful!');
        } else {
            alert('Incorrect password');
        }
    });

    // Set admin username
    document.getElementById('setAdminUsernameBtn').addEventListener('click', () => {
        const username = document.getElementById('adminCustomUsername').value.trim();
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        if (setAdminCustomUsername(username)) {
            renderAdminDashboard();
            alert('Username updated!');
            document.getElementById('adminCustomUsername').value = '';
        } else {
            alert('You must be logged in as admin');
        }
    });

    // Change admin password
    document.getElementById('changeAdminPasswordBtn').addEventListener('click', () => {
        const newPassword = document.getElementById('newAdminPassword').value.trim();
        const confirmPassword = document.getElementById('confirmAdminPassword').value.trim();
        
        const result = changeAdminPassword(newPassword, confirmPassword);
        if (result.success) {
            alert(result.message);
            document.getElementById('newAdminPassword').value = '';
            document.getElementById('confirmAdminPassword').value = '';
        } else {
            alert(result.message);
        }
    });

    // Admin join channel
    document.getElementById('adminJoinChannelBtn').addEventListener('click', () => {
        const channelId = document.getElementById('adminChannelSelect').value;
        if (!channelId) {
            alert('Please select a channel');
            return;
        }
        
        const result = adminJoinChannel(channelId);
        if (result.success) {
            hideModal('adminPanelModal');
            showChatView(result.channel.id, result.channel.name, 'channel');
        } else {
            alert(result.message);
        }
    });

    // Create announcement
    document.getElementById('createAnnouncementForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('announcementTitle').value.trim();
        const message = document.getElementById('announcementMessage').value.trim();
        const imageUrl = document.getElementById('announcementImage').value.trim();
        const videoUrl = document.getElementById('announcementVideo').value.trim();
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        const result = createAnnouncement(title, message, imageUrl, videoUrl);
        if (result.success) {
            alert('Announcement created successfully!');
            document.getElementById('createAnnouncementForm').reset();
        } else {
            alert(result.message);
        }
    });

    // Admin Announces button
    adminAnnouncesBtn.addEventListener('click', () => {
        showAnnouncementsView();
    });

    // Back from announcements
    backFromAnnouncementsBtn.addEventListener('click', () => {
        hideAnnouncementsView();
    });
});
