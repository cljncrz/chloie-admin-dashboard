document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be initialized
    await window.firebaseInitPromise;
    
    const db = window.firebase.firestore();
    const auth = window.firebase.auth();
    
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
    const newMessageBtn = document.getElementById('new-message-btn');
    const newMessageModal = document.getElementById('new-message-modal');
    const closeNewMessageModal = document.getElementById('close-new-message-modal');
    const userSearchInput = document.getElementById('user-search-input');
    const userListContainer = document.getElementById('user-list-container');

    // --- State ---
    let chats = [];
    let currentConversationId = null;
    let activeDropdown = null; // Stores the currently open conversation item dropdown
    let activeDropdownOriginalParent = null; // Stores the original parent of the activeDropdown
    let unsubscribeMessages = null; // To stop listening to old message streams
    let isSelectionModeActive = false;
    let usersData = {}; // Store user data fetched from Firebase for quick lookup

    // --- Functions ---

    /**
     * Fetches all users who signed up in the mobile app from Firestore.
     * This ensures we have access to customer data for chat initialization.
     * Excludes users with admin role.
     */
    const fetchMobileAppUsers = async () => {
        try {
            const usersSnapshot = await db.collection('users').get();
            usersData = {}; // Reset user data storage
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                
                // Exclude users with admin role
                const userRole = (userData.role || '').toLowerCase();
                const isAdmin = userRole === 'admin' || 
                                userRole === 'administrator' || 
                                userData.isAdmin === true ||
                                userData.admin === true;
                
                if (!isAdmin) {
                    usersData[doc.id] = {
                        uid: doc.id,
                        name: userData.fullName || userData.name || userData.customerName || 'Unknown User',
                        email: userData.email || '',
                        phone: userData.phone || '',
                        profilePic: userData.profilePic || userData.customerProfilePic || './images/redicon.png',
                        isVerified: userData.isVerified || false,
                        createdAt: userData.createdAt || userData.registrationDate || null,
                    };
                }
            });
            
            console.log(`Fetched ${Object.keys(usersData).length} non-admin users from Firebase`, usersData);
            return usersData;
        } catch (error) {
            console.error("Error fetching mobile app users:", error);
            return {};
        }
    };

    /**
     * Listens for real-time updates to the conversations list from Firestore.
     */
    const listenForConversations = () => {
        // Order by the timestamp of the last message to show recent chats first
        // Filter out archived chats
        const chatsRef = db.collection('chats');
        const q = chatsRef.where('archived', '!=', true).orderBy('archived').orderBy('timestamp', 'desc');
        
        q.onSnapshot(snapshot => {
            const newChats = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Get user info from the usersData cache, fallback to chat document data
                const userInfo = usersData[doc.id] || {};
                
                newChats.push({
                    id: doc.id, // The document ID is the chatId (e.g., customer's UID)
                    customerName: userInfo.name || data.customerName || 'Unknown Customer',
                    profilePic: userInfo.profilePic || data.customerProfilePic || './images/redicon.png', // Fallback avatar
                    lastMessage: data.lastMessage || '...',
                    // Convert Firestore timestamp to a readable string
                    timestamp: data.timestamp ? formatTimestamp(data.timestamp) : '',
                    isUnread: data.isUnreadForAdmin || false,
                    isVerified: userInfo.isVerified || data.isVerified || false,
                    phone: userInfo.phone || data.phone || '',
                    // Messages will be fetched separately
                });
            });
            chats = newChats;
            renderConversationList(searchInput.value);
        }, error => {
            console.error("Error listening for conversations:", error);
            conversationListEl.innerHTML = '<p class="text-muted" style="padding: 1rem; text-align: center;">Error loading chats.</p>';
        });
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

        const chat = chats.find(c => c.id === conversationId); // conversationId is the customer's UID
        if (!chat) return;

        currentConversationId = conversationId;

        // Mark conversation as read when opened
        if (chat.isUnread) {
            db.collection('chats').doc(conversationId).update({ isUnreadForAdmin: false })
              .catch(err => console.error("Error marking chat as read:", err));
            // The UI will update automatically due to the `listenForConversations` snapshot listener.
        }

        // Get full customer data from the usersData cache
        const customerData = usersData[conversationId];
        let verificationBadgeHTML = '';
        if (customerData && customerData.isVerified) {
            verificationBadgeHTML = `<span class="status-badge verified small">Verified App User</span>`;
        } else if (customerData) {
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

        // Update message list
        messageListEl.innerHTML = '';

        // Listen for new messages in this conversation's subcollection
        const messagesRef = db.collection('chats').doc(conversationId).collection('messages');
        const messagesQuery = messagesRef.orderBy('timestamp', 'asc');
        
        unsubscribeMessages = messagesQuery.onSnapshot(snapshot => {
            messageListEl.innerHTML = ''; // Clear and re-render on every update
            const fragment = document.createDocumentFragment();
            snapshot.forEach(doc => {
                const msg = doc.data();
                const msgEl = document.createElement('div');
                let messageContentHTML = `<p>${msg.text || ''}</p>`; // Default to text

                // Determine sender class ('admin' or 'customer')
                const senderClass = msg.senderId === 'admin' ? 'admin' : 'customer';

                if (msg.type === 'image') {
                    messageContentHTML = `<a href="${msg.mediaUrl}" target="_blank" title="View full image"><img src="${msg.mediaUrl}" alt="Customer image" class="chat-media-image"></a>`;
                } else if (msg.type === 'video') {
                    messageContentHTML = `<video src="${msg.mediaUrl}" controls class="chat-media-video"></video>`;
                }

                let statusIndicator = '';
                if (senderClass === 'admin' && msg.status) {
                    statusIndicator = `<small class="message-status">${msg.status}</small>`;
                }

                // Add admin name and email if message is from admin
                let senderInfoHTML = '';
                if (senderClass === 'admin' && msg.senderName) {
                    senderInfoHTML = `
                        <div class="admin-sender-info">
                            <strong>${msg.senderName}</strong>
                            ${msg.senderEmail ? `<small class="admin-email">${msg.senderEmail}</small>` : ''}
                        </div>`;
                }

                msgEl.className = `chat-message ${senderClass}`;
                msgEl.innerHTML = `
                    ${senderInfoHTML}
                    ${messageContentHTML}
                    <div class="message-meta">
                        <small class="message-timestamp">${formatTimestamp(msg.timestamp)}</small>${statusIndicator}
                    </div>`;
                fragment.appendChild(msgEl);
            });
            messageListEl.appendChild(fragment);
            // Scroll to the bottom on new message
            messageListEl.scrollTop = messageListEl.scrollHeight;
        }, error => {
            console.error("Error fetching messages:", error);
            messageListEl.innerHTML = '<p class="text-muted" style="text-align:center;">Could not load messages.</p>';
        });

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
                // Get customer data from usersData cache (already loaded from Firebase)
                const customerData = usersData[currentConversationId];
                if (customerData) {
                    sessionStorage.setItem('selectedProfileData', JSON.stringify(customerData));
                    sessionStorage.setItem('previousPage', window.location.href);
                    window.location.href = 'customer-profile.html';
                }
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
        const adminId = window.firebase.auth().currentUser ? window.firebase.auth().currentUser.uid : 'admin';

        const newMessage = {
            senderId: adminId, // Identify sender as admin
            senderName: currentAdminData?.name || 'Admin',
            senderEmail: currentAdminData?.email || '',
            senderProfilePic: currentAdminData?.profilePic || './images/redicon.png',
            type: 'text',
            text: text,
            timestamp: window.firebase.firestore().FieldValue.serverTimestamp(),
            status: 'sent' // Initial status is 'sent'
        };

        const chatRef = db.collection('chats').doc(currentConversationId);
        const messagesRef = chatRef.collection('messages');

        // Add the new message to the subcollection
        messagesRef.add(newMessage)
            .then(() => {
                // After sending, update the parent chat document for the list view
                return chatRef.update({
                    lastMessage: text.startsWith('You:') ? text : `You: ${text}`,
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    isUnreadForCustomer: true, // Mark as unread for the customer
                    isUnreadForAdmin: false // Admin just sent it, so it's read for them
                });
            })
            .then(() => {
                messageInput.value = '';
                // The UI will update automatically thanks to the onSnapshot listeners.
                // No need to call render functions manually.
            })
            .catch(error => {
                console.error("Error sending message: ", error);
                alert("Could not send message. Please try again.");
            });
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
            
            // Use batch to mark all chats as read
            const batch = db.batch();
            chats.filter(chat => chat.isUnread).forEach(chat => {
                const chatRef = db.collection('chats').doc(chat.id);
                batch.update(chatRef, { isUnreadForAdmin: false });
            });
            
            batch.commit()
                .then(() => {
                    console.log('Marked all chats as read');
                    // The snapshot listener will automatically update the UI
                })
                .catch(error => {
                    console.error('Error marking all as read:', error);
                    alert('Failed to mark all as read. Please try again.');
                });
                
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
                
                // Use Firebase batch to delete multiple conversations
                const batch = db.batch();
                idsToDelete.forEach(id => {
                    const chatRef = db.collection('chats').doc(id);
                    batch.delete(chatRef);
                });
                
                batch.commit()
                    .then(() => {
                        console.log(`Deleted ${idsToDelete.length} conversations`);
                        
                        if (idsToDelete.includes(currentConversationId)) {
                            currentConversationId = null;
                            messageViewContent.style.display = 'none';
                            messageViewPlaceholder.style.display = 'flex';
                        }
                        toggleSelectionMode(true); // Force selection mode off
                        // The snapshot listener will automatically update the UI
                    })
                    .catch(error => {
                        console.error('Error deleting conversations:', error);
                        alert('Failed to delete some conversations. Please try again.');
                    });
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

                // Update Firebase to mark as unread
                db.collection('chats').doc(conversationId).update({ isUnreadForAdmin: true })
                    .then(() => {
                        console.log(`Marked chat as unread: ${conversationId}`);
                        // The snapshot listener will automatically update the UI
                    })
                    .catch(error => {
                        console.error('Error marking chat as unread:', error);
                    });

                // Manually close the dropdown since the list re-render will remove it anyway
                const dropdown = conversationItem.querySelector('.conversation-item-dropdown');
                if (dropdown) dropdown.classList.remove('show');
                return;
            }

            if (archiveBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                // Archive the chat by adding an 'archived' field
                db.collection('chats').doc(conversationId).update({ archived: true })
                    .then(() => {
                        console.log(`Archived chat: ${conversationId}`);
                        // The snapshot listener will automatically update the UI
                    })
                    .catch(error => {
                        console.error('Error archiving chat:', error);
                        alert('Failed to archive conversation. Please try again.');
                    });
                    
                conversationItem.querySelector('.conversation-item-dropdown').classList.remove('show');
                return;
            }

            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
                    // Delete the chat document from Firestore
                    db.collection('chats').doc(conversationId).delete()
                        .then(() => {
                            console.log(`Deleted chat: ${conversationId}`);
                            
                            // If the deleted chat was the active one, reset the view
                            if (currentConversationId === conversationId) {
                                currentConversationId = null;
                                messageViewContent.style.display = 'none';
                                messageViewPlaceholder.style.display = 'flex';
                            }
                            
                            // The snapshot listener will automatically update the UI
                        })
                        .catch(error => {
                            console.error('Error deleting chat:', error);
                            alert('Failed to delete conversation. Please try again.');
                        });
                }
                // No need to manually close, the list re-renders on delete.
                return;
            }

            renderMessages(conversationId);
        }
    });



    attachmentBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentConversationId) return;

        const adminId = auth.currentUser ? auth.currentUser.uid : 'admin';
        const chatRef = db.collection('chats').doc(currentConversationId);
        const messagesRef = chatRef.collection('messages');

        try {
            // Show uploading indicator
            const uploadingMsg = document.createElement('div');
            uploadingMsg.className = 'chat-message admin uploading';
            uploadingMsg.innerHTML = '<p>Uploading file...</p>';
            messageListEl.appendChild(uploadingMsg);
            messageListEl.scrollTop = messageListEl.scrollHeight;

            // Upload file to Firebase Storage
            const storage = window.firebase.storage();
            const timestamp = Date.now();
            const storageRef = storage.ref(`chat-media/${currentConversationId}/${timestamp}_${file.name}`);
            const uploadTask = await storageRef.put(file);
            const downloadUrl = await uploadTask.ref.getDownloadURL();

            // Remove uploading indicator
            uploadingMsg.remove();

            let newMessage;
            let lastMessageText;

            if (file.type.startsWith('image/')) {
                newMessage = {
                    senderId: adminId,
                    senderName: currentAdminData?.name || 'Admin',
                    senderEmail: currentAdminData?.email || '',
                    senderProfilePic: currentAdminData?.profilePic || './images/redicon.png',
                    type: 'image',
                    mediaUrl: downloadUrl,
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent'
                };
                lastMessageText = 'You sent an image.';
            } else if (file.type.startsWith('video/')) {
                newMessage = {
                    senderId: adminId,
                    senderName: currentAdminData?.name || 'Admin',
                    senderEmail: currentAdminData?.email || '',
                    senderProfilePic: currentAdminData?.profilePic || './images/redicon.png',
                    type: 'video',
                    mediaUrl: downloadUrl,
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent'
                };
                lastMessageText = 'You sent a video.';
            } else {
                newMessage = {
                    senderId: adminId,
                    senderName: currentAdminData?.name || 'Admin',
                    senderEmail: currentAdminData?.email || '',
                    senderProfilePic: currentAdminData?.profilePic || './images/redicon.png',
                    type: 'file',
                    fileName: file.name,
                    fileSize: file.size,
                    fileUrl: downloadUrl,
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent'
                };
                lastMessageText = `You sent a file: ${file.name}`;
            }

            // Add message to Firestore
            await messagesRef.add(newMessage);
            
            // Update chat document
            await chatRef.update({
                lastMessage: lastMessageText,
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                isUnreadForCustomer: true,
                isUnreadForAdmin: false
            });

        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            // Reset the file input to allow selecting the same file again
            e.target.value = '';
        }
    });

    messageForm.addEventListener('submit', handleSendMessage);

    // --- New Message Functionality ---

    /**
     * Fetches users from Firebase users collection for the new message modal
     * Excludes users with admin role
     */
    const fetchUsersForNewMessage = async () => {
        try {
            userListContainer.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading users...</p>
                </div>
            `;

            const usersSnapshot = await db.collection('users').get();
            const allUsers = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                
                // Exclude users with admin role
                const userRole = (userData.role || '').toLowerCase();
                const isAdmin = userRole === 'admin' || 
                                userRole === 'administrator' || 
                                userData.isAdmin === true ||
                                userData.admin === true;
                
                if (!isAdmin) {
                    allUsers.push({
                        uid: doc.id,
                        name: userData.name || userData.customerName || 'Unknown User',
                        email: userData.email || '',
                        phone: userData.phone || '',
                        profilePic: userData.profilePic || userData.customerProfilePic || './images/redicon.png',
                        isVerified: userData.isVerified || false,
                        createdAt: userData.createdAt || userData.registrationDate || null,
                    });
                }
            });

            // Store in usersData if not already there
            allUsers.forEach(user => {
                if (!usersData[user.uid]) {
                    usersData[user.uid] = user;
                }
            });

            console.log(`Loaded ${allUsers.length} non-admin users for messaging`);
            return allUsers;
        } catch (error) {
            console.error("Error fetching users for new message:", error);
            userListContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">error</span>
                    <p>Error loading users. Please try again.</p>
                </div>
            `;
            return [];
        }
    };

    /**
     * Renders the list of users in the new message modal
     */
    const renderUserList = (allUsers, filter = '') => {
        const lowercasedFilter = filter.toLowerCase();
        
        // Filter users based on search term
        const filteredUsers = allUsers.filter(user => {
            const searchText = `${user.name} ${user.email} ${user.phone}`.toLowerCase();
            return searchText.includes(lowercasedFilter);
        });

        // Sort users by name
        filteredUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Update user count badge
        const userCountBadge = document.getElementById('user-count-badge');
        if (userCountBadge) {
            const count = filteredUsers.length;
            userCountBadge.textContent = `${count} ${count === 1 ? 'user' : 'users'}`;
        }

        userListContainer.innerHTML = '';

        if (filteredUsers.length === 0) {
            userListContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">person_off</span>
                    <p>No users found</p>
                    <small class="text-muted">Try adjusting your search</small>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        filteredUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            userItem.dataset.userId = user.uid;
            
            // Check if there's an existing conversation
            const hasExistingChat = chats.some(chat => chat.id === user.uid);
            
            const verificationBadge = user.isVerified 
                ? '<span class="status-badge verified small">✓ Verified</span>' 
                : '<span class="status-badge not-verified small">Unverified</span>';

            const chatIndicator = hasExistingChat 
                ? '<span class="chat-exists-badge" title="Existing conversation"><span class="material-symbols-outlined">chat_bubble</span></span>' 
                : '';

            userItem.innerHTML = `
                <div class="user-item-left">
                    <div class="profile-photo">
                        <img src="${user.profilePic}" alt="${user.name}" onerror="this.src='./images/redicon.png'" />
                    </div>
                    <div class="user-item-details">
                        <div class="user-item-header">
                            <strong>${user.name}</strong>
                            ${verificationBadge}
                            ${chatIndicator}
                        </div>
                        <small class="text-muted user-email">${user.email}</small>
                        ${user.phone ? `<small class="text-muted user-phone"><span class="material-symbols-outlined">phone</span>${user.phone}</small>` : ''}
                    </div>
                </div>
                <button class="message-user-btn" data-user-id="${user.uid}" title="Send message to ${user.name}">
                    <span class="material-symbols-outlined">send</span>
                    <span>Message</span>
                </button>
            `;
            fragment.appendChild(userItem);
        });
        userListContainer.appendChild(fragment);
    };

    /**
     * Opens a chat with a specific user, creating a new conversation if needed
     */
    const openChatWithUser = async (userId) => {
        try {
            const user = usersData[userId];
            if (!user) {
                alert('User not found.');
                return;
            }

            // Check if a conversation already exists
            const existingChat = chats.find(chat => chat.id === userId);
            
            if (existingChat) {
                // Conversation exists, just open it
                renderMessages(userId);
                newMessageModal.style.display = 'none';
                return;
            }

            // Create a new conversation document
            const chatRef = db.collection('chats').doc(userId);
            await chatRef.set({
                customerName: user.name,
                customerProfilePic: user.profilePic,
                phone: user.phone || '',
                email: user.email || '',
                isVerified: user.isVerified || false,
                lastMessage: 'Start a conversation...',
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                isUnreadForAdmin: false,
                isUnreadForCustomer: false,
                archived: false,
                createdBy: 'admin',
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            });

            // The snapshot listener will automatically pick up the new chat and render it
            // Then open the conversation
            currentConversationId = userId;
            renderMessages(userId);
            
            // Close the modal
            newMessageModal.style.display = 'none';
            
        } catch (error) {
            console.error('Error opening chat with user:', error);
            alert('Failed to start conversation. Please try again.');
        }
    };

    // Event listeners for new message modal
    let cachedUsers = []; // Cache users to avoid refetching on search

    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', async () => {
            newMessageModal.style.display = 'flex';
            userSearchInput.value = '';
            
            // Fetch and render users
            cachedUsers = await fetchUsersForNewMessage();
            renderUserList(cachedUsers);
            
            // Focus search input after a brief delay to ensure modal is visible
            setTimeout(() => userSearchInput.focus(), 100);
        });
    }

    if (closeNewMessageModal) {
        closeNewMessageModal.addEventListener('click', () => {
            newMessageModal.style.display = 'none';
            userSearchInput.value = '';
        });
    }

    // Close modal when clicking outside
    if (newMessageModal) {
        newMessageModal.addEventListener('click', (e) => {
            if (e.target === newMessageModal) {
                newMessageModal.style.display = 'none';
                userSearchInput.value = '';
            }
        });
    }

    // Search users with debounce for better performance
    let searchTimeout;
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderUserList(cachedUsers, userSearchInput.value);
            }, 300); // 300ms debounce
        });
    }

    // Handle user selection from list
    if (userListContainer) {
        userListContainer.addEventListener('click', (e) => {
            const messageBtn = e.target.closest('.message-user-btn');
            if (messageBtn) {
                const userId = messageBtn.dataset.userId;
                messageBtn.disabled = true;
                messageBtn.innerHTML = '<div class="spinner small"></div><span>Opening...</span>';
                openChatWithUser(userId);
            }
        });
    }

    // --- Initialization ---
    const init = async () => {
        try {
            // Fetch current admin data
            currentAdminData = await fetchAdminData();
            console.log('Current Admin:', currentAdminData);
            
            // Fetch all mobile app users
            await fetchMobileAppUsers();
            
            // Then listen for conversations with user data populated
            listenForConversations();
        } catch (error) {
            console.error("Error initializing chat:", error);
        }
    };

    init();
});