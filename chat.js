/**
 * Chat Module - Main Chat Page Logic
 * 
 * Handles:
 * - UI rendering (conversations list, messages, forms)
 * - User interactions (clicking, searching, sending messages)
 * - Real-time updates via ChatService
 * - Notifications
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for Firebase to initialize
  await window.firebaseInitPromise;
  
  // Initialize chat service
  const chatService = window.chatService;
  await chatService.initialize(window.firebase);
  
  // ===== DOM ELEMENTS =====
  const chatPageContainer = document.querySelector('.chat-page-container');
  if (!chatPageContainer) return;
  
  const conversationListEl = document.getElementById('chat-conversation-list');
  const messageViewPlaceholder = document.getElementById('chat-message-view-placeholder');
  const messageViewContent = document.getElementById('chat-message-view-content');
  const messageHeaderEl = document.getElementById('chat-message-header');
  const messageListEl = document.getElementById('chat-message-list');
  const messageForm = document.getElementById('chat-message-form');
  const messageInput = document.getElementById('chat-message-input');
  const searchInput = document.getElementById('chat-search');
  const attachmentBtn = document.getElementById('chat-attachment-btn');
  const fileInput = document.getElementById('chat-file-input');

  // ===== STATE =====
  let allConversations = [];
  let currentConversationId = null;
  let currentAdminData = null;

  // ===== RENDER FUNCTIONS =====

  /**
   * Render the conversations list
   */
  const renderConversationsList = (filter = '') => {
    const filtered = chatService.searchConversations(allConversations, filter);
    conversationListEl.innerHTML = '';

    if (filtered.length === 0) {
      conversationListEl.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--color-info);">
          <p>No conversations yet</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(conv => {
      const item = document.createElement('div');
      item.className = `chat-conversation-item ${conv.id === currentConversationId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`;
      item.dataset.id = conv.id;

      const unreadBadge = conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : '';
      const lastSender = conv.lastMessageSenderRole === 'admin' ? 'You: ' : '';
      
      item.innerHTML = `
        <div class="profile-photo">
          <img src="${conv.profilePic}" alt="${conv.userName}" />
          ${conv.isVerified ? '<span class="verified-badge" title="Verified User">✓</span>' : ''}
        </div>
        <div class="conversation-details">
          <div class="conv-header">
            <strong>${conv.userName}</strong>
            <small class="conv-time">${conv.lastMessageTime}</small>
          </div>
          <p class="conv-message">${lastSender}${conv.lastMessage}</p>
        </div>
        ${unreadBadge}
        <div class="conversation-menu">
          <button class="menu-btn" title="Options">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
          <div class="dropdown-menu">
            <button class="delete-btn" data-action="delete">
              <span class="material-symbols-outlined">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.menu-btn') || e.target.closest('.dropdown-menu')) return;
        selectConversation(conv.id);
      });

      item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete conversation with ${conv.userName}?`)) {
          deleteConversation(conv.id);
        }
      });

      fragment.appendChild(item);
    });

    conversationListEl.appendChild(fragment);
  };

  /**
   * Render messages for current conversation
   */
  const renderMessages = (messages) => {
    console.log('Rendering messages:', messages.length, 'messages');
    if (!messageListEl) {
      console.error('Message list element not found');
      return;
    }
    
    messageListEl.innerHTML = '';

    if (messages.length === 0) {
      messageListEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-info);">
          <p>No messages yet. Start the conversation!</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    messages.forEach(msg => {
      console.log('Message:', msg.text, 'isAdmin:', msg.isAdmin, 'senderRole:', msg.senderRole);
      const msgEl = document.createElement('div');
      const isAdmin = msg.isAdmin || msg.senderRole === 'admin';
      msgEl.className = `chat-message ${isAdmin ? 'admin' : 'customer'}`;

      let contentHTML = '';
      if (msg.type === 'text') {
        contentHTML = `<p>${escapeHtml(msg.text)}</p>`;
      } else if (msg.type === 'image') {
        contentHTML = `<img src="${msg.mediaUrl}" alt="Image" style="max-width: 300px; border-radius: 8px;" />`;
      } else if (msg.type === 'file') {
        contentHTML = `
          <a href="${msg.mediaUrl}" download="${msg.fileName}" class="file-link">
            <span class="material-symbols-outlined">download</span>
            ${msg.fileName} (${chatService.formatFileSize(msg.fileSize)})
          </a>
        `;
      }

      msgEl.innerHTML = `
        <div class="message-content">
          ${contentHTML}
          <small class="message-time">${msg.timestamp}</small>
        </div>
      `;

      fragment.appendChild(msgEl);
    });

    messageListEl.appendChild(fragment);
    // Auto-scroll to bottom
    setTimeout(() => {
      messageListEl.scrollTop = messageListEl.scrollHeight;
    }, 100);
  };

  /**
   * Update the message header with conversation info
   */
  const updateMessageHeader = (conv) => {
    if (!conv) return;

    const verifiedBadge = conv.isVerified ? '<span class="status-badge verified">Verified</span>' : '';
    
    messageHeaderEl.innerHTML = `
      <div class="profile-photo">
        <img src="${conv.profilePic}" alt="${conv.userName}" />
      </div>
      <div class="chat-header-info">
        <h3>${conv.userName}</h3>
        <small>${conv.userEmail}</small>
        ${verifiedBadge}
      </div>
      <div class="chat-header-actions">
        <a href="customer-profile.html" class="action-icon-btn" title="View Profile">
          <span class="material-symbols-outlined">person</span>
        </a>
      </div>
    `;
  };

  // ===== EVENT HANDLERS =====

  /**
   * Select a conversation to view
   */
  const selectConversation = async (convId) => {
    console.log('Selecting conversation:', convId);
    currentConversationId = convId;
    
    // Update UI
    document.querySelectorAll('.chat-conversation-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === convId);
    });

    messageViewPlaceholder.style.display = 'none';
    messageViewContent.style.display = 'flex';

    const conv = allConversations.find(c => c.id === convId);
    updateMessageHeader(conv);

    // Mark as read
    if (conv.unreadCount > 0) {
      await chatService.markAsRead(convId);
    }

    // Listen to messages
    console.log('Setting up message listener for conversation:', convId);
    chatService.listenToMessages(convId, renderMessages);
  };

  /**
   * Delete a conversation
   */
  const deleteConversation = async (convId) => {
    try {
      await chatService.deleteConversation(convId);
      
      if (currentConversationId === convId) {
        currentConversationId = null;
        messageViewPlaceholder.style.display = 'flex';
        messageViewContent.style.display = 'none';
      }
      
      allConversations = allConversations.filter(c => c.id !== convId);
      renderConversationsList(searchInput.value);
      updateGlobalChatBadge();
    } catch (error) {
      alert('Failed to delete conversation');
      console.error(error);
    }
  };

  /**
   * Send a message
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    console.log('handleSendMessage called');
    
    const text = messageInput.value.trim();
    console.log('Message text:', text, 'currentConversationId:', currentConversationId);
    
    if (!text || !currentConversationId) {
      console.warn('Cannot send: text is empty or no conversation selected');
      return;
    }

    try {
      messageInput.disabled = true;
      console.log('Sending message...');
      await chatService.sendMessage(currentConversationId, text, currentAdminData);
      console.log('Message sent successfully');
      messageInput.value = '';
    } catch (error) {
      alert('Failed to send message');
      console.error('Error sending message:', error);
    } finally {
      messageInput.disabled = false;
      messageInput.focus();
    }
  };

  /**
   * Escape HTML to prevent XSS
   */
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Update global chat badge count
   */
  const updateGlobalChatBadge = () => {
    if (window.updateGlobalChatBadge) {
      window.updateGlobalChatBadge();
    }
  };

  // ===== EVENT LISTENERS =====

  searchInput?.addEventListener('input', (e) => {
    renderConversationsList(e.target.value);
  });

  if (messageForm) {
    messageForm.addEventListener('submit', handleSendMessage);
    console.log('Message form event listener attached');
  } else {
    console.error('Message form not found!');
  }

  attachmentBtn?.addEventListener('click', () => {
    fileInput.click();
  });

  // File input change handler (basic implementation)
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentConversationId) return;
    
    // TODO: Implement file upload to Firebase Storage
    console.log('File upload not yet implemented:', file.name);
    e.target.value = '';
  });

  // ===== INITIALIZATION =====

  const init = async () => {
    try {
      // Fetch current admin data
      currentAdminData = await chatService.getCurrentAdmin();
      console.log('Admin logged in:', currentAdminData?.name);

      // Listen to conversations
      chatService.listenToConversations((conversations) => {
        // Ensure new conversations have proper timestamps
        conversations.forEach(conv => {
          if (!conv.rawLastMessageTime) {
            chatService.ensureChatRoomTimestamps(conv.id).catch(err => 
              console.warn('Could not fix timestamps for conversation:', err)
            );
          }
        });
        
        allConversations = conversations;
        renderConversationsList(searchInput.value);
        updateGlobalChatBadge();
      });

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
          Notification.requestPermission();
        }, 2000);
      }
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  // Start initialization
  init();

  // ===== CLEANUP =====
  window.addEventListener('beforeunload', () => {
    chatService.stopAllListeners();
  });
});
