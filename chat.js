document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const auth = window.firebase.auth();
    
    /**
     * CHAT SYSTEM - MOBILE-INITIATED ONLY
     * ====================================
     * Mobile app users initiate all conversations.
     * 
     * HOW IT WORKS:
     * 1. Customer opens chat in mobile app and sends first message
     * 2. Chat document is created in Firestore: chat_rooms/{chatRoomId}
     * 3. Admin dashboard automatically shows the new conversation
     * 4. Admin can respond to customer messages
     * 
     * This approach ensures:
     * - Customers reach out when they need help
     * - Better privacy (no unsolicited messages)
     * - Cleaner chat list (only active support requests)
     */
    
    const chatPageContainer = document.querySelector('.chat-page-container');
    if (!chatPageContainer) return;
    const chatListColumn = document.querySelector('.chat-page-list-column');

    // --- DOM Elements ---
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
    const typingIndicator = document.getElementById('typing-indicator');
    const chatListMenuBtn = document.getElementById('chat-list-menu-btn');
    const chatListHeaderDropdown = document.querySelector('.chat-list-header-dropdown');
    const toggleSelectionModeBtn = document.getElementById('toggle-selection-mode-btn');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-conversations-btn');

    // --- State ---
    let chats = [];
    let currentConversationId = null;
    let activeDropdown = null; // Stores the currently open conversation item dropdown
    let activeDropdownOriginalParent = null; // Stores the original parent of the activeDropdown
    let unsubscribeMessages = null; // To stop listening to old message streams
    let isSelectionModeActive = false;

    // --- Functions ---

    /**
     * Listens for real-time updates to the conversations list from Firestore.
     */
    const listenForConversations = () => {
        db.collection('chat_rooms')
            .orderBy('timestamp', 'desc')
            .onSnapshot(
                (snapshot) => {
                    chats = [];
                    snapshot.docs.forEach((doc) => {
                        const data = doc.data();
                        chats.push({
                            id: doc.id,
                            customerName: data.customerName || 'Unknown',
                            lastMessage: data.lastMessage || '',
                            timestamp: formatTimestamp(data.timestamp),
                            profilePic: data.profilePic || 'https://via.placeholder.com/40',
                            isUnread: data.isUnread || false,
                            isVerified: data.isVerified || false,
                            email: data.email || '',
                            userId: data.userId || doc.id
                        });
                    });
                    renderConversationList(searchInput.value);
                },
                (error) => {
                    console.error('Error listening to chat_rooms:', error);
                }
            );
    };

    const formatTimestamp = (firestoreTimestamp) => {
        if (!firestoreTimestamp) return '';
        const date = firestoreTimestamp.toDate();
        // This is a simple format, you can use a library like date-fns for more complex "time ago" logic
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    /**
     * Formats file size in bytes to a readable string (KB, MB, etc.).
     * @param {number} bytes - The file size in bytes.
     * @returns {string} The formatted file size.
     */
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    /**
     * Updates the unread message count badge in the sidebar.
     */
    // The global chat badge is now updated by `global-updates.js`.
    // We just need to call it when the chat state changes.
    const updateUnreadCount = () => window.updateGlobalChatBadge?.();

    /**
     * Renders the list of conversations on the left panel.
     * @param {string} [filter=''] - An optional search term to filter conversations.
     */
    const renderConversationList = (filter = '') => {
        const lowercasedFilter = filter.toLowerCase();
        const filteredChats = chats.filter(chat =>
            chat.customerName.toLowerCase().includes(lowercasedFilter)
        );

        conversationListEl.innerHTML = '';
        if (filteredChats.length === 0) {
            conversationListEl.innerHTML = '<p class="text-muted" style="padding: 1rem; text-align: center;">No conversations found.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        filteredChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = `chat-conversation-item ${chat.id === currentConversationId ? 'active' : ''} ${chat.isUnread ? 'unread' : ''}`;
            item.dataset.id = chat.id;
            item.innerHTML = `
                <div class="conversation-checkbox">
                    <input type="checkbox" data-id="${chat.id}" class="conversation-select-checkbox" />
                </div>
                <div class="profile-photo">
                    <img src="${chat.profilePic}" alt="${chat.customerName}" />
                </div>
                <div class="conversation-details">
                    <strong>${chat.customerName}</strong>
                    <small class="text-muted" style="margin-left: 0.5rem;">${chat.timestamp}</small>
                    <p>${chat.lastMessage}</p>
                </div>
                <div class="conversation-item-actions">
                    <button class="action-icon-btn conversation-menu-btn" title="More options">
                        <span class="material-symbols-outlined">more_vert</span>
                    </button>
                    <div class="conversation-item-dropdown">
                        <a href="#" class="mark-unread-btn">
                            <span class="material-symbols-outlined">mark_chat_unread</span>
                            <span>Mark as Unread</span>
                        </a>
                        <a href="#" class="archive-chat-btn">
                            <span class="material-symbols-outlined">archive</span>
                            <span>Archive Chat</span>
                        </a>
                        <a href="#" class="delete-chat-btn danger">
                            <span class="material-symbols-outlined">delete</span>
                            <span>Delete Chat</span>
                        </a>
                    </div>
                </div>
            `;
            fragment.appendChild(item);
        });
        conversationListEl.appendChild(fragment);
        updateUnreadCount(); // Update the count whenever the list is rendered
    };

    /**
     * Renders the messages for the currently selected conversation.
     * @param {string} conversationId - The ID of the conversation to display.
     */
    const renderMessages = (conversationId) => {
        // Stop listening to the previous conversation's messages
        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        const chat = chats.find(c => c.id === conversationId); // conversationId is the chat room ID
        if (!chat) return;

        currentConversationId = conversationId;

        // Mark conversation as read functionality removed
        if (chat.isUnread) {
            console.log('Mark as read functionality for chat_rooms collection has been disabled');
        }

        // Get customer verification status from chat data
        let verificationBadgeHTML = '';
        if (chat.isVerified) {
            verificationBadgeHTML = `<span class="status-badge verified small">Verified App User</span>`;
        } else {
            verificationBadgeHTML = `<span class="status-badge not-verified small">Not Verified</span>`;
        }

        // Update header
        messageHeaderEl.innerHTML = `
            <div class="profile-photo">
                <img src="${chat.profilePic}" alt="${chat.customerName}" />
            </div>
            <div class="chat-header-info">
                <h3>${chat.customerName}</h3>
                ${verificationBadgeHTML}
            </div>
            <div class="chat-header-actions">
                <button class="action-icon-btn" id="chat-menu-btn" title="More options">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
                <div class="chat-header-dropdown">
                    <a href="#" id="view-profile-btn">
                        <span class="material-symbols-outlined">person</span>
                        <span>View Profile</span>
                    </a>
                    <a href="#" id="block-user-btn" class="danger">
                        <span class="material-symbols-outlined">block</span>
                        <span>Block User</span>
                    </a>
                    <a href="#" id="suspend-user-btn" class="danger">
                        <span class="material-symbols-outlined">gavel</span>
                        <span>Suspend (30d)</span>
                    </a>
                </div>
            </div>
        `;

        // Listen to messages subcollection in real-time
        unsubscribeMessages = db.collection('chat_rooms')
            .doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(
                (snapshot) => {
                    messageListEl.innerHTML = '';
                    snapshot.docs.forEach((doc) => {
                        const msg = doc.data();
                        const isAdmin = msg.isAdmin || msg.senderRole === 'admin';
                        const messageEl = document.createElement('div');
                        messageEl.className = `chat-message ${isAdmin ? 'admin' : 'user'}`;
                        messageEl.innerHTML = `
                            <div class="message-content">
                                <p>${msg.text || ''}</p>
                                <small class="message-time">${formatTimestamp(msg.timestamp)}</small>
                            </div>
                        `;
                        messageListEl.appendChild(messageEl);
                    });
                    // Scroll to the bottom
                    messageListEl.scrollTop = messageListEl.scrollHeight;
                },
                (error) => {
                    console.error('Error listening to messages:', error);
                    messageListEl.innerHTML = '<p class="text-muted" style="text-align:center;">Error loading messages.</p>';
                }
            );

        // Scroll to the bottom
        messageListEl.scrollTop = messageListEl.scrollHeight;

        // Show message view and hide placeholder
        messageViewPlaceholder.style.display = 'none';
        messageViewContent.style.display = 'flex';

        // Update active state in conversation list
        renderConversationList(searchInput.value);
    };

    // This listener needs to be on the message view content area to handle dynamically added elements
    messageViewContent.addEventListener('click', (e) => {
        const menuBtn = e.target.closest('#chat-menu-btn');
        const viewProfileBtn = e.target.closest('#view-profile-btn');
        const blockUserBtn = e.target.closest('#block-user-btn');
        const suspendUserBtn = e.target.closest('#suspend-user-btn');
        const dropdown = messageHeaderEl.querySelector('.chat-header-dropdown');

        if (menuBtn) {
            e.stopPropagation();
            dropdown.classList.toggle('show');
            return;
        }

        if (viewProfileBtn) {
            e.preventDefault();
            const chat = chats.find(c => c.id === currentConversationId);
            if (chat) {
                // Fetch customer data from users collection using userId (matches Firestore rules)
                const customerIdToFetch = chat.userId || currentConversationId;
                db.collection('users').doc(customerIdToFetch).get()
                    .then(doc => {
                        if (doc.exists) {
                            const customerData = {
                                uid: doc.id,
                                name: doc.data().fullName || doc.data().name || chat.customerName,
                                email: doc.data().email || chat.email || '',
                                phone: doc.data().phone || chat.phone || '',
                                profilePic: doc.data().profilePic || chat.profilePic,
                                isVerified: doc.data().isVerified || chat.isVerified,
                            };
                            sessionStorage.setItem('selectedProfileData', JSON.stringify(customerData));
                            sessionStorage.setItem('previousPage', window.location.href);
                            window.location.href = 'customer-profile.html';
                        } else {
                            alert('Customer profile not found.');
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching customer profile:', error);
                        alert('Failed to load customer profile.');
                    });
            }
            return;
        }

        if (blockUserBtn) {
            e.preventDefault();
            const chat = chats.find(c => c.id === currentConversationId);
            if (chat) {
                if (confirm(`Are you sure you want to block ${chat.customerName}? This will permanently prevent them from sending messages.`)) {
                    console.log(`Blocking user: ${chat.customerName}`);
                    alert(`${chat.customerName} has been blocked.`);
                    // In a real app, you'd update the user's status in the database here.
                    dropdown.classList.remove('show');
                }
            }
            return;
        }

        if (suspendUserBtn) {
            e.preventDefault();
            const chat = chats.find(c => c.id === currentConversationId);
            if (chat) {
                if (confirm(`Are you sure you want to suspend ${chat.customerName} for 30 days for violating rules and regulations?`)) {
                    console.log(`Suspending user: ${chat.customerName} for 30 days.`);
                    alert(`${chat.customerName} has been suspended for 30 days.`);
                    // In a real app, you'd set a suspension end date in the database.
                    dropdown.classList.remove('show');
                }
            }
            return;
        }
    });

    /**
     * Fetches admin data from Firestore.
     */
    const fetchAdminData = async () => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return null;
            
            const adminDoc = await db.collection('admins').doc(currentUser.uid).get();
            if (adminDoc.exists) {
                return {
                    uid: currentUser.uid,
                    name: adminDoc.data().name || currentUser.displayName || 'Admin',
                    email: adminDoc.data().email || currentUser.email || '',
                    profilePic: adminDoc.data().profilePic || './images/redicon.png',
                    role: adminDoc.data().role || 'Admin'
                };
            }
            return null;
        } catch (error) {
            console.error("Error fetching admin data:", error);
            return null;
        }
    };

    let currentAdminData = null; // Store current admin data

    /**
     * Handles the submission of the message form.
     * @param {Event} e - The form submission event.
     */
    const handleSendMessage = (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text || !currentConversationId) return;
        
        // Get current admin's UID - MUST match request.auth.uid in Firestore rules
        const adminId = auth.currentUser ? auth.currentUser.uid : null;
        if (!adminId) {
            alert('You must be logged in to send messages.');
            return;
        }

        const newMessage = {
            senderId: adminId, // MUST match request.auth.uid for Firestore rules
            senderName: currentAdminData?.name || 'Admin',
            senderEmail: currentAdminData?.email || '',
            senderProfilePic: currentAdminData?.profilePic || './images/redicon.png',
            type: 'text',
            text: text,
            timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
            status: 'sent', // Initial status is 'sent'
            isAdmin: true // Flag to identify admin messages
        };

                // Send message to Firestore
                db.collection('chat_rooms')
                    .doc(currentConversationId)
                    .collection('messages')
                    .add(newMessage)
                    .then(() => {
                        // Update lastMessage and timestamp in chat_rooms for conversation preview
                        return db.collection('chat_rooms')
                            .doc(currentConversationId)
                            .update({
                                lastMessage: text,
                                timestamp: window.firebase.firestore.FieldValue.serverTimestamp()
                            });
                    })
                    .catch((error) => {
                        console.error('Error sending message:', error);
                        alert('Failed to send message. Please try again.');
                    });
                messageInput.value = '';
    };

    /**
     * SIMULATION: Simulates a customer on their device seeing all unread admin messages.
     * In a real app, this would be triggered by an event from the customer's device.
     */
    const simulateCustomerSeesMessage = (conversationId) => {
        // This is now handled by the mobile app, which would update the 'status' field of messages in Firestore.
        // The web admin's onSnapshot listener will automatically pick up the change and re-render the UI.
    };

    // --- Event Listeners ---
    searchInput?.addEventListener('input', () => {
        renderConversationList(searchInput.value);
    });

    // --- Chat List Header Menu Logic ---
    if (chatListMenuBtn) {
        chatListMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatListHeaderDropdown.classList.toggle('show');
        });
    }

    // Close header dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (chatListHeaderDropdown && chatListHeaderDropdown.classList.contains('show') && !e.target.closest('.chat-list-actions')) {
            chatListHeaderDropdown.classList.remove('show');
        }
    });

    // --- Selection Mode Logic ---
    const toggleSelectionMode = (forceOff = false) => {
        isSelectionModeActive = forceOff ? false : !isSelectionModeActive;

        if (isSelectionModeActive) {
            chatListColumn.classList.add('selection-mode-active');
        } else {
            chatListColumn.classList.remove('selection-mode-active');
            // Uncheck all checkboxes when exiting selection mode
            document.querySelectorAll('.conversation-select-checkbox:checked').forEach(cb => cb.checked = false);
        }
        updateDeleteButtonState();
    };

    if (toggleSelectionModeBtn) {
        toggleSelectionModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSelectionMode();
            chatListHeaderDropdown.classList.remove('show');
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chats.forEach(chat => chat.isUnread = false);
            renderConversationList(searchInput.value);
            chatListHeaderDropdown.classList.remove('show');
        });
    }

    const updateDeleteButtonState = () => {
        if (!deleteSelectedBtn) return;
        const selectedCount = document.querySelectorAll('.conversation-select-checkbox:checked').length;
        deleteSelectedBtn.disabled = selectedCount === 0;
        deleteSelectedBtn.textContent = selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
    };

    conversationListEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('conversation-select-checkbox')) {
            updateDeleteButtonState();
        }
    });

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', () => {
            const checkedBoxes = document.querySelectorAll('.conversation-select-checkbox:checked');
            if (checkedBoxes.length === 0) return;

            if (confirm(`Are you sure you want to delete ${checkedBoxes.length} conversation(s)? This cannot be undone.`)) {
                const idsToDelete = Array.from(checkedBoxes).map(cb => cb.dataset.id);
                chats = chats.filter(chat => !idsToDelete.includes(chat.id));

                if (idsToDelete.includes(currentConversationId)) {
                    currentConversationId = null;
                    messageViewContent.style.display = 'none';
                    messageViewPlaceholder.style.display = 'flex';
                }
                toggleSelectionMode(true); // Force selection mode off
                renderConversationList(searchInput.value);
            }
        });
    }

    conversationListEl.addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.chat-conversation-item');
        if (conversationItem) {
            const conversationId = conversationItem.dataset.id;
            const menuBtn = e.target.closest('.conversation-menu-btn');
            const markUnreadBtn = e.target.closest('.mark-unread-btn');
            const archiveBtn = e.target.closest('.archive-chat-btn');
            const deleteBtn = e.target.closest('.delete-chat-btn');
            const checkbox = e.target.closest('.conversation-select-checkbox');

            // If in selection mode, a click on the item should toggle the checkbox
            if (isSelectionModeActive && !menuBtn && !checkbox) {
                conversationItem.querySelector('.conversation-select-checkbox').click();
                return; // Stop further processing to prevent opening the chat
            }

            // --- Handle Menu Toggle ---
            if (menuBtn) {
                e.stopPropagation(); // Prevent the conversation from being selected
                const dropdown = conversationItem.querySelector('.conversation-item-dropdown');

                // Close all other open dropdowns first
                document.querySelectorAll('.conversation-item-dropdown.show').forEach(d => {
                    // If the dropdown being processed is not the one we're about to toggle, close it.
                    if (d !== dropdown) {
                        d.classList.remove('show');
                    }
                });

                // Now, simply toggle the 'show' class on the clicked dropdown
                dropdown.classList.toggle('show');
                return;
            }

            // --- Handle Menu Actions ---
            if (markUnreadBtn) {
                e.preventDefault();
                e.stopPropagation();

                const chat = chats.find(c => c.id === conversationId);
                if (chat) {
                    chat.isUnread = true;
                    // Re-render the list to show the unread state and update the global count
                    renderConversationList(searchInput.value);
                }

                // Manually close the dropdown since the list re-render will remove it anyway
                const dropdown = conversationItem.querySelector('.conversation-item-dropdown');
                if (dropdown) dropdown.classList.remove('show');
                return;
            }

            if (archiveBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Archiving chat: ${conversationId}`);
                alert('Archive functionality is a work in progress.');
                conversationItem.querySelector('.conversation-item-dropdown').classList.remove('show');
                return;
            }

            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
                    // 1. Find the index of the chat to delete
                    const chatIndex = chats.findIndex(c => c.id === conversationId);

                    if (chatIndex > -1) {
                        // 2. Remove the chat from the data array
                        chats.splice(chatIndex, 1);

                        // 3. If the deleted chat was the active one, reset the view
                        if (currentConversationId === conversationId) {
                            currentConversationId = null;
                            messageViewContent.style.display = 'none';
                            messageViewPlaceholder.style.display = 'flex';
                        }

                        // 4. Re-render the conversation list (which also updates the unread count)
                        renderConversationList(searchInput.value);

                        // 5. Show a success message
                        console.log(`Deleted chat: ${conversationId}`);
                    }
                }
                // No need to manually close, the list re-renders on delete.
                return;
            }

            renderMessages(conversationId);
        }
    });

    /**
     * SIMULATION: Simulates a customer replying in the currently active chat.
     */
    const simulateReplyInCurrentChat = (conversationId) => {
        const chat = chats.find(c => c.id === conversationId);
        if (!chat) return;

        const typingAvatar = typingIndicator.querySelector('img');
        typingAvatar.src = chat.profilePic;
        typingIndicator.style.display = 'flex';
        messageListEl.scrollTop = messageListEl.scrollHeight;

        // Wait a bit before "sending" the reply
        setTimeout(() => {
            typingIndicator.style.display = 'none';

            const replies = [
                "Okay, thank you!",
                "Got it, thanks for the help.",
                "Sounds good.",
                "I understand, thank you for clarifying."
            ];

            const replyMessage = {
                sender: 'customer',
                text: replies[Math.floor(Math.random() * replies.length)],
                time: new Date()
            };

            chat.messages.push(replyMessage);
            chat.lastMessage = replyMessage.text;
            chat.timestamp = 'Just now';

            renderMessages(conversationId);
        }, 2000 + Math.random() * 1500); // Simulate typing for 2-3.5 seconds
    };

    attachmentBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentConversationId) return;

        const adminId = auth.currentUser ? auth.currentUser.uid : null;
        if (!adminId) {
            alert('You must be logged in to send files.');
            e.target.value = '';
            return;
        }

        try {
            // TODO: Upload file to Firebase Storage and get the permanent URL
            // For now, using local URL (this won't work for the mobile app to see)
            const localUrl = URL.createObjectURL(file);

            let newMessage;
            let lastMessageText;

            if (file.type.startsWith('image/')) {
                newMessage = {
                    senderId: adminId,
                    senderName: currentAdminData?.name || 'Admin',
                    senderEmail: currentAdminData?.email || '',
                    type: 'image',
                    mediaUrl: localUrl, // TODO: Replace with Firebase Storage URL
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                    isAdmin: true
                };
                lastMessageText = 'You: Sent an image';
            } else if (file.type.startsWith('video/')) {
                newMessage = {
                    senderId: adminId,
                    senderName: currentAdminData?.name || 'Admin',
                    senderEmail: currentAdminData?.email || '',
                    type: 'video',
                    mediaUrl: localUrl, // TODO: Replace with Firebase Storage URL
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                    isAdmin: true
                };
                lastMessageText = 'You: Sent a video';
            } else {
                newMessage = {
                    senderId: adminId,
                    senderName: currentAdminData?.name || 'Admin',
                    senderEmail: currentAdminData?.email || '',
                    type: 'file',
                    fileName: file.name,
                    fileSize: file.size,
                    mediaUrl: localUrl, // TODO: Replace with Firebase Storage URL
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                    isAdmin: true
                };
                lastMessageText = `You: Sent ${file.name}`;
            }

            // File sending functionality removed
            console.log('File sending to chat_rooms collection has been disabled');
            
            // Reset the file input
            e.target.value = '';
        } catch (error) {
            console.error('Error sending file:', error);
            alert('Failed to send file. Please try again.');
            e.target.value = '';
        }
    });

    messageForm.addEventListener('submit', handleSendMessage);

    /**
     * Sets up real-time notifications for new messages from customers.
     * Monitors all chat rooms and sends notifications when customers send messages.
     */
    const setupMessageNotifications = () => {
        // Message notifications listener removed
        console.log('Message notifications from chat_rooms collection have been disabled');
    };

    /**
     * Sends a browser notification and plays a sound for new chat messages.
     * @param {Object} chatData - The chat room data
     * @param {string} chatId - The chat room ID
     */
    const sendChatNotification = (chatData, chatId) => {
        const customerName = chatData.customerName || 'A customer';
        const lastMessage = chatData.lastMessage || 'New message';
        const title = `New message from ${customerName}`;
        const body = lastMessage.length > 100 ? lastMessage.substring(0, 100) + '...' : lastMessage;

        // Check if browser notifications are supported
        if ('Notification' in window) {
            // Request permission if not already granted
            if (Notification.permission === 'granted') {
                createNotification(title, body, chatData.customerProfilePic, chatId);
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        createNotification(title, body, chatData.customerProfilePic, chatId);
                    }
                });
            }
        }

        // Play notification sound
        playNotificationSound();

        // Show in-app notification if notification service is available
        if (window.notificationService && window.notificationService.showNotification) {
            window.notificationService.showNotification(
                title,
                body,
                'info',
                () => {
                    // When clicked, open the chat
                    renderMessages(chatId);
                }
            );
        }
    };

    /**
     * Creates a browser notification.
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {string} icon - Notification icon URL
     * @param {string} chatId - Chat room ID to open when clicked
     */
    const createNotification = (title, body, icon, chatId) => {
        const notification = new Notification(title, {
            body: body,
            icon: icon || './images/redicon.png',
            badge: './images/redicon.png',
            tag: `chat-${chatId}`,
            requireInteraction: false,
            silent: false
        });

        notification.onclick = () => {
            window.focus();
            // Navigate to chats page if not already there
            if (!window.location.pathname.includes('chats.html')) {
                window.location.href = 'chats.html';
            }
            // Open the specific chat
            renderMessages(chatId);
            notification.close();
        };
    };

    /**
     * Plays a notification sound for new messages.
     */
    const playNotificationSound = () => {
        try {
            // Create a simple notification sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    };

    /**
     * Request notification permission on page load if not already decided.
     */
    if ('Notification' in window && Notification.permission === 'default') {
        // Show a friendly prompt to enable notifications
        setTimeout(() => {
            if (confirm('Enable desktop notifications for new chat messages?')) {
                Notification.requestPermission();
            }
        }, 2000);
    }

    // --- Initialization ---
    const init = async () => {
        try {
            // Fetch current admin data
            currentAdminData = await fetchAdminData();
            console.log('Current Admin:', currentAdminData);
            
            // Listen for conversations initiated by mobile app users
            listenForConversations();
            
            // Set up notification listener for new messages
            setupMessageNotifications();
        } catch (error) {
            console.error("Error initializing chat:", error);
        }
    };

    init();

    // --- DEMO: Simulate receiving a message from a customer ---
    const simulateCustomerReply = () => {
        if (chats.length < 2) return; // Need at least 2 chats to ensure one isn't open

        // Pick a random chat that is not the currently open one
        const availableChats = chats.filter(c => c.id !== currentConversationId);
        if (availableChats.length === 0) return;

        const randomChat = availableChats[Math.floor(Math.random() * availableChats.length)];
        const replies = [
            "Okay, thank you for the update!",
            "Got it, thanks!",
            "Can I ask another question?",
            "Perfect, see you then."
        ];
        const mediaItems = (window.appData.media || []).filter(m => m.type === 'image');

        let replyMessage;
        // 25% chance of sending an image instead of text
        if (mediaItems.length > 0 && Math.random() < 0.25) {
            const randomMedia = mediaItems[Math.floor(Math.random() * mediaItems.length)];
            replyMessage = {
                sender: 'customer',
                type: 'image',
                mediaUrl: randomMedia.url,
                time: new Date()
            };
        } else {
            replyMessage = {
                sender: 'customer',
                type: 'text',
                text: replies[Math.floor(Math.random() * replies.length)],
                time: new Date()
            };
        }
        
        randomChat.messages.push(replyMessage);
        randomChat.lastMessage = replyMessage.type === 'image' ? 'Sent an image' : replyMessage.text;
        randomChat.timestamp = 'Just now';
        randomChat.isUnread = true;
        renderConversationList(searchInput.value); // Re-render to show the unread indicator and update count
    };
    // Simulate a reply every 15-25 seconds for a more dynamic demo
    setInterval(simulateCustomerReply, 15000 + Math.random() * 10000);
});