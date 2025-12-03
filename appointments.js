    // Defensive: Prevent approve if no technician, even if button is enabled by DOM manipulation
    document.addEventListener('click', function(e) {
        const approveBtn = e.target.closest('.approve-btn');
        if (approveBtn && !approveBtn.disabled) {
            // Find the row and check technician
            const row = approveBtn.closest('tr');
            if (row) {
                const serviceId = row.dataset.serviceId;
                const appointments = window.appData && window.appData.appointments ? window.appData.appointments : [];
                const appointment = appointments.find(a => a.serviceId === serviceId);
                if (!appointment || !appointment.technician || appointment.technician === '') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof showSuccessToast === 'function') showSuccessToast('Choose technician first before approving.', 'error');
                    else alert('Choose technician first before approving.');
                    return false;
                }
            }
        }
    }, true);
document.addEventListener('DOMContentLoaded', async () => {
    // Show Archived Services Button Toggle
    const showArchivedBtn = document.getElementById('show-archived-btn');
    const archivedContainer = document.getElementById('archived-appointments-table-container');
    if (showArchivedBtn && archivedContainer) {
        showArchivedBtn.addEventListener('click', () => {
            const isVisible = archivedContainer.style.display !== 'none';
            if (isVisible) {
                archivedContainer.style.display = 'none';
                showArchivedBtn.innerHTML = '<span class="material-symbols-outlined">history</span> Show Archived Services';
            } else {
                archivedContainer.style.display = '';
                showArchivedBtn.innerHTML = '<span class="material-symbols-outlined">history</span> Hide Archived Services';
            }
        });
    }
    // ========== ARCHIVED APPOINTMENTS TABLE POPULATION ==========
    async function populateArchivedAppointmentsTable() {
        const container = document.getElementById('archived-appointments-table-container');
        if (!container) return;
        // Ensure Firebase is initialized (auth currentUser may be null before init)
        if (window.firebaseInitPromise) await window.firebaseInitPromise;
        const table = container.querySelector('table');
        const thead = table ? table.querySelector('thead tr') : null;
        const tbody = table ? table.querySelector('tbody') : null;
        if (!tbody || !thead) return;
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading archived services...</td></tr>';
        try {
            // Prefer server-side fetch to avoid Firestore client rules blocking reads
            let archived = null;
            try {
                const resp = await fetch('/api/archived-appointments?limit=1000');
                if (resp.ok) {
                    const payload = await resp.json();
                    if (payload && Array.isArray(payload.archived)) archived = payload.archived;
                } else {
                    console.debug('Server archived endpoint returned', resp.status);
                }
            } catch (err) {
                console.debug('Could not reach server archived endpoint:', err);
            }

            // If server did not provide archived items, attempt to read from Firestore
            if (!archived || archived.length === 0) {
                try {
                    const db = window.firebase.firestore();
                    const snap = await db.collection('archive_bookings').orderBy('archivedAt', 'desc').get();
                    if (!snap.empty) {
                        archived = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    } else {
                        // Also try a fallback collection name that some deployments use
                        const snap2 = await db.collection('archived_appointments').orderBy('archivedAt', 'desc').get();
                        if (!snap2.empty) archived = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
                    }
                } catch (fsErr) {
                    console.debug('Firestore fetch for archive_bookings failed:', fsErr);
                }
            }

                if (!archived || archived.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-warning">No archived services found or unable to load archived services. Ensure the server is running or check permissions.</td></tr>`;
                return;
            }
            // Normalize for table rendering
            const normalized = archived.map(a => ({
                serviceId: a.serviceId || a.id || '',
                customer: a.customer || a.carName || a.plate || 'N/A',
                service: a.service || a.serviceNames || '',
                datetime: a.datetime || '',
                price: a.price || '',
                archivedAt: a.archivedAt || '',
                _source: a._source || ''
            }));
            // Update archived notification (count + last archived time) in the header
            try {
                const header = container.querySelector('.table-header');
                if (header) {
                    let notif = header.querySelector('#archived-notification');
                    const count = normalized.length;
                    // Find latest archivedAt
                    const times = normalized.map(x => x.archivedAt).filter(Boolean).map(t => new Date(t));
                    const latest = times.length ? new Date(Math.max(...times.map(d => d.getTime()))) : null;
                    const latestStr = latest ? latest.toLocaleString() : 'N/A';
                    const text = `${count} archived service${count !== 1 ? 's' : ''}` + (latest ? ` • Last archived: ${latestStr}` : '');
                    if (!notif) {
                        notif = document.createElement('p');
                        notif.id = 'archived-notification';
                        notif.style.margin = '6px 0 0 0';
                        notif.style.fontSize = '0.95rem';
                        notif.style.color = 'var(--color-muted)';
                        header.appendChild(notif);
                    }
                    notif.textContent = text;
                }
            } catch (notifErr) {
                console.debug('Could not update archived notification:', notifErr);
            }

            tbody.innerHTML = '';
            if (normalized.length === 0) {
                const tr = document.createElement('tr');
                tr.classList.add('no-results-row');
                tr.innerHTML = `<td colspan="7" class="text-center text-muted">No archived services found.</td>`;
                tbody.appendChild(tr);
                return;
            }
            normalized.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
            for (const item of normalized) {
                const tr = document.createElement('tr');
                const archivedAt = item.archivedAt ? (new Date(item.archivedAt)).toLocaleString() : 'N/A';
                tr.innerHTML = `
                    <td>${item.serviceId}</td>
                    <td>${item.customer || 'N/A'}</td>
                    <td>${item.service || 'N/A'}</td>
                    <td>${item.datetime || 'N/A'}</td>
                    <td>${item.price || 'N/A'}</td>
                    <td>${item._source || 'N/A'}</td>
                    <td>${archivedAt}</td>
                `;
                tbody.appendChild(tr);
            }
        } catch (err) {
            // Permission errors are common when this collection is restricted by Firestore rules.
            const isPermissionError = (err && (err.code === 'permission-denied' || String(err).toLowerCase().includes('insufficient')));
            if (isPermissionError) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-warning">You do not have permission to view archived services. Please check Firestore rules or sign in as an admin.</td></tr>`;
            } else {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load archived services.</td></tr>`;
            }
            console.error('Error loading archived services:', err);
        }
    }
    // ARCHIVE ALL COMPLETED & PAID BUTTON (robust, batched, admin-checked)
    document.addEventListener('click', async (e) => {
        const archiveBtn = e.target.closest('#archive-completed-paid-btn');
        if (!archiveBtn) return;

        archiveBtn.disabled = true;
        const originalHTML = archiveBtn.innerHTML;
        archiveBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">hourglass_empty</span> Checking...';

        try {
            const db = window.firebase.firestore();
            const auth = window.firebase.auth && window.firebase.auth();

            // Verify admin role before performing archival
            if (!auth || !auth.currentUser) {
                if (typeof showSuccessToast === 'function') showSuccessToast('Please sign in as an admin to archive services.', 'error');
                else alert('Please sign in as an admin to archive services.');
                archiveBtn.disabled = false;
                archiveBtn.innerHTML = originalHTML;
                return;
            }
            const uid = auth.currentUser.uid;
            let isAdmin = false;
            try {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const role = (userDoc.data() && userDoc.data().role) ? String(userDoc.data().role).toLowerCase() : '';
                    if (role === 'admin' || role === 'superadmin') isAdmin = true;
                }
            } catch (roleErr) {
                console.debug('Could not verify user role for archive operation:', roleErr);
            }
            if (!isAdmin) {
                console.warn('Archive aborted: current user is not an admin', { uid });
                if (typeof showSuccessToast === 'function') showSuccessToast('You do not have permission to archive services.', 'error');
                else alert('You do not have permission to archive services.');
                archiveBtn.disabled = false;
                archiveBtn.innerHTML = originalHTML;
                return;
            }

            // Gather completed & paid bookings / walkins
            const appointments = (window.appData.appointments || []).filter(a => 
                String(a.status).toLowerCase() === 'completed' && 
                String(a.paymentStatus).toLowerCase() === 'paid'
            );
            const walkins = (window.appData.walkins || []).filter(w => 
                String(w.status).toLowerCase() === 'completed' && 
                String(w.paymentStatus).toLowerCase() === 'paid'
            );

            const totalItems = appointments.length + walkins.length;
            console.log(`📦 Archive check: found ${appointments.length} bookings and ${walkins.length} walk-ins (total: ${totalItems}) to archive`);
            
            if (totalItems === 0) {
                if (typeof showSuccessToast === 'function') showSuccessToast('No completed & paid services found to archive.', 'info');
                else alert('No completed & paid services found to archive.');
                archiveBtn.disabled = false;
                archiveBtn.innerHTML = originalHTML;
                return;
            }

            // Show detailed confirmation dialog
            const confirmMsg = `Found ${totalItems} completed & paid service${totalItems > 1 ? 's' : ''}:\n\n` +
                `• ${appointments.length} booking${appointments.length !== 1 ? 's' : ''}\n` +
                `• ${walkins.length} walk-in${walkins.length !== 1 ? 's' : ''}\n\n` +
                `Archive these items? This action will:\n` +
                `✓ Move them to archive collection\n` +
                `✓ Remove them from active appointments\n` +
                `✓ Keep all data for records\n\n` +
                `Continue?`;
            
            if (!confirm(confirmMsg)) {
                archiveBtn.disabled = false;
                archiveBtn.innerHTML = originalHTML;
                return;
            }

            archiveBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Archiving...';

            // Attempt server-side archival first (preferred for better performance)
            let serverArchived = false;
            try {
                const resp = await fetch('/api/archive-completed-paid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ limit: Math.max(1000, totalItems) })
                });
                
                if (resp.ok) {
                    const result = await resp.json();
                    if (result.success && result.archived > 0) {
                        console.log(`✅ Server archived ${result.archived} services successfully`);
                        if (typeof showSuccessToast === 'function') {
                            showSuccessToast(`Successfully archived ${result.archived} service${result.archived !== 1 ? 's' : ''}!`, 'success');
                        } else {
                            alert(`Successfully archived ${result.archived} service${result.archived !== 1 ? 's' : ''}!`);
                        }
                        
                        // Refresh data
                        if (typeof fetchAndPopulateAppointments === 'function') await fetchAndPopulateAppointments();
                        if (typeof populateArchivedAppointmentsTable === 'function') populateArchivedAppointmentsTable();
                        
                        archiveBtn.disabled = false;
                        archiveBtn.innerHTML = originalHTML;
                        return;
                    }
                }
                console.debug('Server archival returned non-success, falling back to client-side');
            } catch (serverErr) {
                console.debug('Server archival endpoint unavailable, using client-side method:', serverErr.message);
            }

            // Client-side archival with Firestore batching
            // Firestore limit: 500 writes per batch. Each item requires 2 writes (set + delete).
            const maxItemsPerBatch = 200; // safe floor (200 items => 400 writes)
            const items = [];
            const now = new Date();
            const archivedBy = auth.currentUser.email || auth.currentUser.uid;

            // Prepare items for archival
            for (const appt of appointments) {
                const docRef = db.collection('bookings').doc(appt.serviceId);
                const archiveRef = db.collection('archive_bookings').doc(appt.serviceId);
                items.push({ 
                    docRef, 
                    archiveRef, 
                    data: { 
                        ...appt, 
                        archivedAt: now.toISOString(), 
                        archivedBy: archivedBy,
                        _source: 'Booking',
                        _originalCollection: 'bookings'
                    } 
                });
            }
            for (const walkin of walkins) {
                const docRef = db.collection('walkins').doc(walkin.id);
                const archiveRef = db.collection('archive_bookings').doc(walkin.id);
                items.push({ 
                    docRef, 
                    archiveRef, 
                    data: { 
                        ...walkin, 
                        archivedAt: now.toISOString(),
                        archivedBy: archivedBy,
                        _source: 'Walk-in',
                        _originalCollection: 'walkins'
                    } 
                });
            }

            let successCount = 0;
            let failCount = 0;
            const failedItems = [];

            // Process in batches with progress updates
            const totalBatches = Math.ceil(items.length / maxItemsPerBatch);
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const i = batchIndex * maxItemsPerBatch;
                const chunk = items.slice(i, i + maxItemsPerBatch);
                const batch = db.batch();
                
                // Update progress
                archiveBtn.innerHTML = `<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Archiving ${i + 1}-${i + chunk.length} of ${items.length}...`;
                
                for (const it of chunk) {
                    // Use set (will overwrite if doc exists) to ensure archived copy exists
                    batch.set(it.archiveRef, it.data);
                    batch.delete(it.docRef);
                }

                try {
                    console.log(`📦 Committing batch ${batchIndex + 1}/${totalBatches}: items ${i + 1} to ${i + chunk.length}`);
                    await batch.commit();
                    successCount += chunk.length;
                    
                    // Remove from local in-memory data
                    for (const it of chunk) {
                        if (String(it.data._source).toLowerCase() === 'booking') {
                            window.appData.appointments = (window.appData.appointments || []).filter(a => a.serviceId !== it.docRef.id);
                        } else {
                            window.appData.walkins = (window.appData.walkins || []).filter(w => w.id !== it.docRef.id);
                        }
                    }
                    
                    console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} completed successfully`);
                } catch (batchErr) {
                    console.error(`❌ Batch ${batchIndex + 1}/${totalBatches} failed:`, batchErr);
                    failCount += chunk.length;
                    
                    // Track failed items for detailed reporting
                    chunk.forEach(it => {
                        failedItems.push({
                            id: it.docRef.id,
                            type: it.data._source,
                            error: batchErr.message || 'Unknown error'
                        });
                    });
                    
                    // If permission denied, abort further processing
                    const isPermissionError = (batchErr && (batchErr.code === 'permission-denied' || String(batchErr).toLowerCase().includes('insufficient')));
                    if (isPermissionError) {
                        console.error('❌ Permission denied error - aborting further archival operations');
                        if (typeof showSuccessToast === 'function') {
                            showSuccessToast('Permission denied while archiving. Check Firestore security rules.', 'error');
                        } else {
                            alert('Permission denied while archiving. Check Firestore security rules.');
                        }
                        break;
                    }
                    // otherwise continue with next batch
                }
            }

            // Re-render tables and archived list
            console.log('🔄 Refreshing all tables...');
            if (typeof populateAppointmentsTable === 'function') populateAppointmentsTable();
            if (typeof populateWalkinAppointmentsTable === 'function') populateWalkinAppointmentsTable();
            if (typeof populateArchivedAppointmentsTable === 'function') populateArchivedAppointmentsTable();

            // Show comprehensive results
            if (successCount > 0) {
                const msg = `Successfully archived ${successCount} service${successCount !== 1 ? 's' : ''}!`;
                console.log(`✅ ${msg}`);
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(msg, 'success');
                } else {
                    alert(msg);
                }
            }
            
            if (failCount > 0) {
                const msg = `${failCount} service${failCount !== 1 ? 's' : ''} failed to archive.`;
                console.error(`❌ ${msg}`);
                console.error('Failed items:', failedItems);
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(`${msg} Check console for details.`, 'error');
                } else {
                    alert(`${msg} Check console for details.`);
                }
            }

        } catch (err) {
            console.error('❌ Unexpected error during archival:', err);
            if (typeof showSuccessToast === 'function') {
                showSuccessToast('Failed to archive services: ' + (err.message || 'Unexpected error'), 'error');
            } else {
                alert('Failed to archive services: ' + (err.message || 'Unexpected error'));
            }
        } finally {
            archiveBtn.disabled = false;
            archiveBtn.innerHTML = originalHTML;
        }
    });
    // Populate archived table on load and after data changes
    if (typeof populateArchivedAppointmentsTable === 'function') populateArchivedAppointmentsTable();
    // --- Pending Queue Functionality ---
    // Helper to get selected date from the calendar widget (if available)
    function getSelectedDate() {
        const dateStr = document.getElementById('time-slots-date')?.textContent;
        if (!dateStr) return null;
        // Expecting format like 'November 24, 2025' or '11/24/2025'
        const parsed = new Date(dateStr);
        if (!isNaN(parsed)) return parsed;
        // fallback: try MM/DD/YYYY
        const fallback = Date.parse(dateStr);
        return isNaN(fallback) ? null : new Date(fallback);
    }

    // Render the pending queue for the selected date
    function renderPendingQueue() {
        const queueList = document.getElementById('queue-list');
        if (!queueList) return;
        const selectedDate = getSelectedDate();
        if (!selectedDate) {
            queueList.innerHTML = '<div class="text-muted">No date selected.</div>';
            return;
        }
        // Get all pending bookings and walk-ins for the selected date
        const bookings = window.appData?.appointments || [];
        const walkins = window.appData?.walkins || [];
        const technicians = window.appData?.technicians || [];
        const items = [];
        bookings.forEach(appt => {
            if (String(appt.status).toLowerCase() !== 'pending') return;
            const t = appt.datetimeRaw ? new Date(appt.datetimeRaw) : null;
            if (!t) return;
            if (t.toDateString() !== selectedDate.toDateString()) return;
            items.push({ type:'booking', id: appt.serviceId, time: t, data: appt });
        });
        walkins.forEach(w => {
            if (String(w.status).toLowerCase() !== 'pending') return;
            const t = w.datetimeRaw ? new Date(w.datetimeRaw) : null;
            if (!t) return;
            if (t.toDateString() !== selectedDate.toDateString()) return;
            items.push({ type:'walkin', id: w.id, time: t, data: w });
        });
        if (items.length === 0) {
            queueList.innerHTML = '<div class="text-muted">No pending appointments for this date.</div>';
            return;
        }
        queueList.innerHTML = '';
        items.sort((a,b) => a.time - b.time).forEach(({type, id, time, data}) => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.dataset.type = type;
            div.dataset.serviceId = id;
            const serviceName = data.serviceNames || data.service || '';
            const plateOrName = data.plate || data.carName || data.customer || 'N/A';
            
            // Build technician dropdown
            const currentTechnician = data.technician || '';
            let technicianOptions = '<option value="">Select Technician</option>';
            technicians.forEach(tech => {
                const selected = tech.name === currentTechnician ? 'selected' : '';
                technicianOptions += `<option value="${tech.name}" ${selected}>${tech.name}</option>`;
            });
            
            div.innerHTML = `
                <div class="queue-item-header">
                    <div>
                        <strong>${plateOrName}</strong>
                        <span class="badge type ${type}" style="margin-left:6px;">${type === 'walkin' ? 'Walk-in' : 'Booking'}</span>
                    </div>
                    <small class="text-muted">${time.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })}</small>
                </div>
                <div class="queue-item-body">
                    <div class="queue-item-info">
                        <div><strong>Service:</strong> ${serviceName}</div>
                        <div><strong>Date:</strong> ${time.toLocaleDateString('en-US')}</div>
                    </div>
                    <div class="queue-item-actions">
                        <select class="technician-select-queue" style="width:100%;margin-bottom:8px;padding:6px;border:1px solid var(--color-border);border-radius:4px;">
                            ${technicianOptions}
                        </select>
                        <div style="display:flex;gap:6px;">
                            <button class="btn-primary approve-queue-btn" data-type="${type}" data-service-id="${id}" style="flex:1;padding:6px 12px;font-size:0.85rem;" ${!currentTechnician ? 'disabled' : ''}>
                                <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">check_circle</span> Approve
                            </button>
                            <button class="btn-link show-appt-btn" data-type="${type}" data-service-id="${id}" style="padding:6px 12px;font-size:0.85rem;">
                                <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">visibility</span> Show
                            </button>
                        </div>
                    </div>
                </div>
            `;
            queueList.appendChild(div);
        });
    }

    // Hook into calendar date selection and appointment data updates
    function setupPendingQueueListeners() {
        // Listen for changes to the date (calendar)
        const timeSlotsDate = document.getElementById('time-slots-date');
        if (timeSlotsDate) {
            const observer = new MutationObserver(() => {
                renderPendingQueue();
                // Keep the explicit date filter input in sync with the calendar only when using calendar mode
                try {
                    if (window.tableDateFilterMode === 'calendar') {
                        const dateInputEl = document.getElementById('appointments-date-filter');
                        if (dateInputEl && typeof getSelectedDate === 'function') {
                            const d = getSelectedDate();
                            if (d && !isNaN(d)) {
                                const yyyy = d.getFullYear();
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const dd = String(d.getDate()).padStart(2, '0');
                                const formatted = `${yyyy}-${mm}-${dd}`;
                                if (dateInputEl.value !== formatted) dateInputEl.value = formatted;
                            }
                        }
                    }
                } catch (e) { /* ignore */ }
                // Also re-render the main table to apply the date filter
                if (typeof populateAppointmentsTable === 'function') populateAppointmentsTable();
            });
            observer.observe(timeSlotsDate, { childList: true, subtree: true, characterData: true });
        }
        // Listen for appointment data changes (after fetch)
        const origFetchAndPopulate = fetchAndPopulateAppointments;
        fetchAndPopulateAppointments = async function(...args) {
            await origFetchAndPopulate.apply(this, args);
            renderPendingQueue();
            if (typeof populateAppointmentsTable === 'function') populateAppointmentsTable();
            if (typeof window.rerenderCalendar === 'function') window.rerenderCalendar();
        };
    }
    // Wait for Firebase to initialize
    await window.firebaseInitPromise;

    // This script is now for the main appointments page
    const mainAppointmentsContainer = document.getElementById('main-appointments-table');

    // --- Pagination & Filter State for Appointment Page Tables ---
    let apptCurrentPage = 1;
    const apptRowsPerPage = 25;
    let walkinCurrentPage = 1;
    const walkinRowsPerPage = 25;
    let currentSort = { column: 'datetime', direction: 'desc' }; // Default sort
    // Controls how the main table applies date filtering: 'calendar' | 'input' | 'none'
    window.tableDateFilterMode = window.tableDateFilterMode || 'calendar';


     // --- Animate Insight Numbers ---
    // This function is reused for the new quick stats
    const animateInsightNumbers = (element) => {
        const targetValue = parseInt(element.dataset.value);
        // No currency prefix for appointment counts, so removed the prefix logic
        
        let currentValue = 0;
        const increment = targetValue / 50; // Control animation speed

        const updateCount = () => {
            if (currentValue < targetValue) {
                currentValue += increment;
                element.textContent = Math.ceil(currentValue).toLocaleString();
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = targetValue.toLocaleString();
            }
        };
        updateCount();
    };

    // --- Get current logged-in user's full name (if available) ---
    let currentUserFullName = null;
    let currentUserRole = null;
    let currentUserUid = null;
    const fetchCurrentUserFullName = async () => {
        try {
            const auth = window.firebase.auth();
            if (!auth || !auth.currentUser) return null;
            const uid = auth.currentUser.uid;
            currentUserUid = uid;
            const db = window.firebase.firestore();
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const data = userDoc.data() || {};
                currentUserFullName = data.fullName || null;
                currentUserRole = data.role || null;
                // expose globally in case other scripts want to use it
                window.currentUserFullName = currentUserFullName;
                window.currentUserRole = currentUserRole;
                window.currentUserUid = currentUserUid;
                return currentUserFullName;
            }
        } catch (e) {
            console.warn('Could not fetch current user full name', e);
        }
        return null;
    };
    // --- New function to update the quick stats on the appointment page ---
    const updateAppointmentPageStats = () => {
        if (!document.getElementById('total-appointments-stat')) return; // Only run on appointments page
        const totalEl = document.getElementById('total-appointments-stat');
        const pendingEl = document.getElementById('pending-appointments-stat');
        const inProgressEl = document.getElementById('inprogress-appointments-stat');
        const completedEl = document.getElementById('completed-appointments-stat');
        const cancelledEl = document.getElementById('cancelled-appointments-stat');

        // Ensure all elements exist before proceeding
        if (!totalEl || !pendingEl || !inProgressEl || !completedEl || !cancelledEl) {
            console.warn("One or more appointment stat elements not found. Skipping stat update.");
            return;
        }

        // Combine appointments and walk-ins from global appData
        const allAppointments = [
            ...(window.appData.appointments || []),
            ...(window.appData.walkins || [])
        ];

            const counts = allAppointments.reduce((acc, appt) => {
                     acc.total++;
                     const status = appt.status.toLowerCase();
                     if (status === 'pending') acc.pending++;
                     else if (status === 'in progress') acc.inProgress++;
                     else if (status === 'completed') acc.completed++;
                     else if (status === 'cancelled') acc.cancelled++;
                     else if (status === 'approve' || status === 'approved') acc.approve = (acc.approve || 0) + 1;
                     return acc;
                 }, { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, approve: 0 });

        // Set data-value for animation and update text content
        totalEl.dataset.value = counts.total;
        pendingEl.dataset.value = counts.pending;
        inProgressEl.dataset.value = counts.inProgress;
        completedEl.dataset.value = counts.completed;
        cancelledEl.dataset.value = counts.cancelled;

        // Animate numbers for each stat card
        animateInsightNumbers(totalEl);
        animateInsightNumbers(pendingEl);
        animateInsightNumbers(inProgressEl);
        animateInsightNumbers(completedEl);
        animateInsightNumbers(cancelledEl);
    };

    // This function will now be defined here to ensure it uses live data from Firestore
    window.appData.createTechnicianDropdown = (selectedTechnician, disabled = false) => {
        const technicians = window.appData.technicians || [];
        // Filter for active technicians, and always include the currently selected one even if they are inactive
        const activeTechnicians = technicians.filter(tech => tech.status === 'Active' || tech.name === selectedTechnician);

        let options = '<option value="">-- Select Technician --</option>';
        activeTechnicians.forEach(tech => {
            if (!tech.name || tech.name === 'Unassigned') return;
            const isSelected = tech.name === selectedTechnician ? 'selected' : '';
            options += `<option value="${tech.name}" ${isSelected}>${tech.name}</option>`;
        });

        const disabledAttr = disabled ? 'disabled' : '';
        return `<select class="technician-select" ${disabledAttr}>${options}</select>`;
    };


    if (mainAppointmentsContainer) { // This condition now only checks if we are on the main appointments page
        // The previous updateAppointmentWidgets function is no longer needed
        // as the HTML structure and IDs have changed.

        // --- Fetch and Populate Table from Firestore ---
        window.fetchAndPopulateAppointments = async () => {
            const tableBody = mainAppointmentsContainer.querySelector('tbody');
            const loader = mainAppointmentsContainer.querySelector('.table-loader');
            if (loader) loader.classList.add('loading');

            try {
                const db = window.firebase.firestore();
                // Fetch bookings, walkins, and technicians simultaneously for better performance
                const [bookingsSnapshot, walkinsSnapshot, techniciansSnapshot] = await Promise.all([
                    db.collection('bookings').get(),
                    db.collection('walkins').get(),
                    db.collection('technicians').get()
                ]);

                // Process and store technicians data globally
                window.appData.technicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Process bookings data
                if (bookingsSnapshot.empty) {
                    const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
                    if (noResultsRow) noResultsRow.style.display = 'table-row';
                    console.log('No booking documents found in Firestore.');
                    // Continue — we still want to process walkins and technicians if available
                }

                // Replace sample data with Firestore data
                window.appData.appointments = bookingsSnapshot.docs.map(doc => {
                    const data = doc.data() || {};

                    // helper: parse various firestore-like date shapes into Date or null
                    const parseFirestoreDate = (val) => {
                        if (!val && val !== 0) return null;
                        try {
                            // Firestore Timestamp with toDate()
                            if (val && typeof val.toDate === 'function') return val.toDate();

                            // Firestore-like object: { seconds, nanoseconds } or { seconds, nanos }
                            if (val && (typeof val.seconds === 'number')) {
                                const nanos = val.nanoseconds ?? val.nanosecond ?? val.nanos ?? val.nanoseconds ?? 0;
                                return new Date(val.seconds * 1000 + Math.floor(nanos / 1e6));
                            }

                            // JS Date instance
                            if (val instanceof Date) return val;

                            // number: could be seconds or milliseconds
                            if (typeof val === 'number') {
                                // Heuristic: if <= 1e12 treat as seconds, else milliseconds
                                if (val < 1e12) return new Date(val * 1000);
                                return new Date(val);
                            }

                            // string
                            if (typeof val === 'string') {
                                const parsed = new Date(val);
                                if (!isNaN(parsed)) return parsed;
                            }
                        } catch (e) {
                            // fall through to null
                            console.debug('parseFirestoreDate error', e);
                        }
                        return null;
                    };

                    const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate', 'createdAt'];
                    let dateSource = null;
                    let selectedField = null;

                    for (const f of possibleDateFields) {
                        if (data[f] !== undefined && data[f] !== null) {
                            dateSource = data[f];
                            selectedField = f;
                            break;
                        }
                    }

                    // If not found on known keys, scan top-level values for anything that looks like a date/timestamp
                    if (!dateSource) {
                        for (const [k, v] of Object.entries(data)) {
                            const maybe = parseFirestoreDate(v);
                            if (maybe) {
                                dateSource = v;
                                selectedField = k;
                                break;
                            }
                        }
                    }

                    const scheduleDateObj = parseFirestoreDate(dateSource);

                    // Parse bookingTime if available
                    if (scheduleDateObj && data.bookingTime) {
                        const timeRange = data.bookingTime.split(' - ')[0]; // e.g., "1:20 PM"
                        const timeMatch = timeRange.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (timeMatch) {
                            let hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            const ampm = timeMatch[3].toUpperCase();
                            if (ampm === 'PM' && hours !== 12) hours += 12;
                            if (ampm === 'AM' && hours === 12) hours = 0;
                            scheduleDateObj.setHours(hours, minutes, 0, 0);
                        }
                    }

                    let formattedDateTime = 'No Date';
                    if (scheduleDateObj) {
                        const datePart = scheduleDateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                        const timePart = data.bookingTime || scheduleDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                        formattedDateTime = `${datePart} - ${timePart}`;
                    }


                    // Debug logging for documents that still don't resolve to a date
                    if (!scheduleDateObj) {
                        console.warn(`Booking doc ${doc.id} has no recognizable date. Available keys: ${Object.keys(data).join(', ')}`);
                        // For deeper debugging, optionally log the values (commented out to reduce noise):
                        // console.debug('doc data:', data);
                    } else {
                        console.debug(`Booking doc ${doc.id} -> date field: ${selectedField} -> ${scheduleDateObj.toISOString()}`);
                    }

                    return {
                        ...data,
                        serviceId: doc.id,
                        plate: data.plateNumber || data.plate || '',
                        service: data.serviceNames || data.service || '',
                        datetime: formattedDateTime,
                        datetimeRaw: scheduleDateObj ? scheduleDateObj.getTime() : null,
                    };
                });

                // Now that we have live bookings, render cancelled table as well
                renderCancelledTable();

                // --- Process walk-ins data ---
                if (!walkinsSnapshot.empty) {
                    window.appData.walkins = walkinsSnapshot.docs.map(doc => {
                        const data = doc.data() || {};

                        // Reuse the same parseFirestoreDate helper defined above
                        const parseFirestoreDate = (val) => {
                            if (!val && val !== 0) return null;
                            try {
                                if (val && typeof val.toDate === 'function') return val.toDate();
                                if (val && (typeof val.seconds === 'number')) {
                                    const nanos = val.nanoseconds ?? val.nanosecond ?? val.nanos ?? 0;
                                    return new Date(val.seconds * 1000 + Math.floor(nanos / 1e6));
                                }
                                if (val instanceof Date) return val;
                                if (typeof val === 'number') {
                                    if (val < 1e12) return new Date(val * 1000);
                                    return new Date(val);
                                }
                                if (typeof val === 'string') {
                                    const parsed = new Date(val);
                                    if (!isNaN(parsed)) return parsed;
                                }
                            } catch (e) {
                                console.debug('parseFirestoreDate error', e);
                            }
                            return null;
                        };

                        const possibleDateFields = ['time', 'scheduleDate', 'dateTime', 'datetime', 'date', 'scheduledAt', 'appointmentDate', 'timestamp', 'bookingDate', 'createdAt'];
                        let dateSource = null;
                        let selectedField = null;
                        for (const f of possibleDateFields) {
                            if (data[f] !== undefined && data[f] !== null) {
                                dateSource = data[f];
                                selectedField = f;
                                break;
                            }
                        }
                        if (!dateSource) {
                            for (const [k, v] of Object.entries(data)) {
                                const maybe = parseFirestoreDate(v);
                                if (maybe instanceof Date) { // Ensure it's a valid Date object
                                    dateSource = v;
                                    break;
                                }
                            }
                        }

                        const scheduleDateObj = parseFirestoreDate(dateSource);
                        let formattedDateTime = 'No Date';
                        if (scheduleDateObj ) {
                            const datePart = scheduleDateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                            const timePart = scheduleDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            formattedDateTime = `${datePart} - ${timePart}`;
                        }

                        return {
                            id: doc.id,
                            ...data,
                            plate: data.plateNumber || data.plate || '',
                            service: data.serviceNames || data.service || data.serviceName || '',
                            datetime: formattedDateTime,
                            datetimeRaw: scheduleDateObj ? scheduleDateObj.getTime() : null,
                        };
                    });
                } else {
                    // Ensure walkins is at least an empty array when there are no documents
                    window.appData.walkins = [];
                }

                // Initial population of tables
                populateAppointmentsTable();
                populateWalkinsTable(); // Assuming walk-ins might also come from bookings or a separate fetch
                updateAppointmentPageStats(); // Update stats after fetching data

            } catch (error) {
                console.error("Error fetching bookings from Firestore:", error);
                const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
                if (noResultsRow) {
                    noResultsRow.style.display = 'table-row';
                    noResultsRow.querySelector('td').textContent = 'Error loading appointments.';
                }
            } finally {
                if (loader) loader.classList.remove('loading');
            }
        };

        // --- Populate Table ---
        const populateAppointmentsTable = () => {
            const tableBody = mainAppointmentsContainer.querySelector('tbody');
            const searchInput = document.getElementById('appointment-search'); // Main appointments search
            const statusFilter = document.querySelector('#main-appointments-table-container .status-filter'); // Main appointments filter
            if (!tableBody || !searchInput) return;

            const appointments = [...(window.appData.appointments || [])]; // Always get the latest data
            const fragment = document.createDocumentFragment();
            
            // 1. Filter Data
            const searchTerm = searchInput.value.toLowerCase();
            const selectedStatus = statusFilter ? statusFilter.value.toLowerCase() : 'all';
            // Resolve selected date based on filter mode
            let selectedDate = null;
            if (window.tableDateFilterMode === 'input') {
                const dateInputEl = document.getElementById('appointments-date-filter');
                if (dateInputEl && dateInputEl.value) {
                    const parts = dateInputEl.value.split('-');
                    if (parts.length === 3) {
                        const [yyyy, mm, dd] = parts;
                        selectedDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                    }
                }
            } else if (window.tableDateFilterMode === 'calendar') {
                if (typeof getSelectedDate === 'function') selectedDate = getSelectedDate();
            } else {
                // 'none' => do not filter by date
                selectedDate = null;
            }

            // Only allow these statuses
            const allowedStatuses = ['pending', 'approved', 'in progress', 'completed'];
            // Also allow 'approve' (legacy/capitalized) for compatibility
            const allowedStatusesWithApprove = [...allowedStatuses, 'approve'];
            let filteredAppointments = appointments.filter(appt => {
                const status = (appt.status || '').toLowerCase();
                if (!allowedStatusesWithApprove.includes(status)) return false;
                const matchesSearch = searchTerm === '' ||
                    Object.values(appt).some(val => String(val).toLowerCase().includes(searchTerm));
                const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
                const matchesDate = !selectedDate || (
                    (appt.datetimeRaw && (new Date(appt.datetimeRaw)).toDateString() === selectedDate.toDateString()) ||
                    (!appt.datetimeRaw && appt.datetime && !isNaN(new Date(appt.datetime.replace(' - ', ' '))) && (new Date(appt.datetime.replace(' - ', ' '))).toDateString() === selectedDate.toDateString())
                );
                return matchesSearch && matchesStatus && matchesDate;
            });

            // 2. Sort Data (using currentSort state)
            if (selectedDate && currentSort.column === 'datetime' && currentSort.direction !== 'asc') {
                currentSort.direction = 'asc';
                try {
                    const header = document.querySelector('#main-appointments-table th[data-sort-by="datetime"]');
                    if (header) {
                        document.querySelectorAll('#appointments-page th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
                        header.classList.add('sorted-asc');
                    }
                } catch(_) {}
            }
            filteredAppointments.sort((a, b) => {
                // If sorting by datetime, prefer the raw timestamp (datetimeRaw) when available.
                if (currentSort.column === 'datetime') {
                    const aRaw = a.datetimeRaw != null ? a.datetimeRaw : (typeof a.datetime === 'string' ? new Date(a.datetime.replace(' - ', ' ')).getTime() : null);
                    const bRaw = b.datetimeRaw != null ? b.datetimeRaw : (typeof b.datetime === 'string' ? new Date(b.datetime.replace(' - ', ' ')).getTime() : null);

                    // Handle nulls so that items with no date come last when sorting ascending
                    if (aRaw === bRaw) return 0;
                    if (aRaw === null) return 1;
                    if (bRaw === null) return -1;

                    const diff = aRaw - bRaw;
                    return currentSort.direction === 'asc' ? diff : -diff;
                }

                let valA = a[currentSort.column] || '';
                let valB = b[currentSort.column] || '';
                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return currentSort.direction === 'asc' ? comparison : -comparison;
            });

            // 3. Paginate Data
            const totalPages = Math.ceil(filteredAppointments.length / apptRowsPerPage);
            apptCurrentPage = Math.max(1, Math.min(apptCurrentPage, totalPages));
            const startIndex = (apptCurrentPage - 1) * apptRowsPerPage;
            const endIndex = startIndex + apptRowsPerPage;
            const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);

            // 4. Render Rows
            paginatedAppointments.forEach(appt => {
                const row = document.createElement('tr');
                const statusClass = appt.status.toLowerCase().replace(' ', '-');
                // Add data attributes for modal functionality if needed later
                row.dataset.serviceId = appt.serviceId;
                row.dataset.plate = appt.plate;
                row.dataset.carName = appt.carName;
                row.dataset.carType = appt.carType;
                row.dataset.service = appt.serviceNames;
                row.dataset.datetime = appt.datetime;
                row.dataset.price = appt.price;
                row.dataset.technicians = appt.technicians;
                row.dataset.status = appt.status;
                row.dataset.paymentStatus = appt.paymentStatus;

                // Conditionally add action buttons based on status
                let actionButtons = '';
                if (appt.status === 'Pending') {
                    // Only show Approve if a real technician is assigned
                    if (appt.technician && appt.technician !== '') {
                        actionButtons = `
                            <button class="action-icon-btn approve-btn" title="Approve Appointment">
                                <span class="material-symbols-outlined">check_circle</span>
                            </button>`;
                    } else {
                        actionButtons = `
                            <button class="action-icon-btn approve-btn" title="Approve Appointment" disabled style="opacity:0.5;pointer-events:none;user-select:none;" tabindex="-1" aria-disabled="true"> 
                                <span class="material-symbols-outlined">check_circle</span>
                            </button>`;
                    }
                } else if (['Approve', 'Approved'].includes(appt.status)) {
                    actionButtons = `
                        <button class="action-icon-btn start-service-btn" title="Start Service">
                            <span class="material-symbols-outlined">play_arrow</span>
                        </button>`;
                } else if (appt.status === 'In Progress') {
                    actionButtons = `
                        <button class="action-icon-btn complete-service-btn" title="Complete Service">
                            <span class="material-symbols-outlined">check</span>
                        </button>`;
                }

                const technicianDropdown = window.appData.createTechnicianDropdown(appt.technician, appt.status !== 'Pending');

                const paymentStatus = appt.paymentStatus || 'Unpaid'; // Default to 'Unpaid' if undefined
                const paymentStatusClass = paymentStatus.toLowerCase();
                const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${paymentStatus}</span>`;

                let paymentActionButton = '';
                if (paymentStatus === 'Unpaid') {
                    paymentActionButton = `
                        <button class="action-icon-btn mark-paid-btn" title="Approve Payment">
                            <span class="material-symbols-outlined">payments</span>
                        </button>`;
                }
                // Add note if status is Approve
                let approveNote = '';
                if (['Approve', 'Approved'].includes(appt.status)) {
                    approveNote = '';
                }
                let statusDisplay = '';
                if (['Approve', 'Approved'].includes(appt.status)) {
                    statusDisplay = '<span class="status-badge approved" title="This appointment has been approved and is awaiting service.">Approved</span>';
                } else if (appt.status === 'Completed') {
                    statusDisplay = '<span class="completed">Completed</span>';
                } else {
                    statusDisplay = `<span class="${statusClass}">${appt.status}</span>`;
                }
                // Disable cancel button if completed and paid, approved, or in progress
                let disableCancel = (appt.status === 'Completed' && appt.paymentStatus === 'Paid') || 
                                   appt.status === 'In Progress' || 
                                   appt.status === 'Approved' || 
                                   appt.status === 'Approve';
                let cancelTooltip = 'Cancel Appointment';
                
                if (appt.status === 'In Progress') {
                    cancelTooltip = 'Cannot cancel: service has started';
                } else if (appt.status === 'Approved' || appt.status === 'Approve') {
                    cancelTooltip = 'Cannot cancel: appointment has been approved';
                } else if (appt.status === 'Completed' && appt.paymentStatus === 'Paid') {
                    cancelTooltip = 'Cannot cancel: service is completed and paid';
                }
                
                row.innerHTML = `
                    <td>${appt.serviceId}</td>
                    <td>${appt.plate}</td>
                    <td>${appt.carName}</td>
                    <td>${appt.carType}</td>
                    <td>${appt.serviceNames}</td>
                    <td>${appt.datetime}</td>
                    <td>${appt.price}</td>
                    <td>${technicianDropdown}</td>
                    <td class="text-center">${statusDisplay}</td>
                    <td class="text-center">${paymentBadge}</td>
                    <td class="text-center">
                        ${actionButtons}
                        ${paymentActionButton}
                        <button class="action-icon-btn cancel-btn" title="${cancelTooltip}"${disableCancel ? ' disabled style="opacity:0.5;pointer-events:none;"' : ''}>
                            <span class="material-symbols-outlined">cancel</span>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });

            tableBody.innerHTML = ''; // Clear existing rows
            tableBody.appendChild(fragment);

            // 5. Update UI (No results row, pagination)
            const noResultsRow = mainAppointmentsContainer.querySelector('.no-results-row');
            if (noResultsRow) {
                noResultsRow.style.display = paginatedAppointments.length === 0 ? 'table-row' : 'none';
            }

            const paginationContainer = mainAppointmentsContainer.querySelector('.table-pagination');
            if (paginationContainer) {
                const pageInfo = paginationContainer.querySelector('.page-info');
                const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
                const nextBtn = paginationContainer.querySelector('[data-action="next"]');
                pageInfo.textContent = `Page ${apptCurrentPage} of ${totalPages || 1}`;
                prevBtn.disabled = apptCurrentPage === 1;
                nextBtn.disabled = apptCurrentPage === totalPages || totalPages === 0;
            }
        };

        // --- Add a single appointment to the top of the table ---
        const addAppointmentToTable = (appt) => {
            const tableBody = mainAppointmentsContainer.querySelector('tbody');
            if (!tableBody) return;
            
            // This function is now simpler: just re-render the table to ensure
            // sorting, filtering, and pagination are all correct.
            populateAppointmentsTable();
        }

        // --- Populate Walk-ins Table ---
        const populateWalkinsTable = () => {
            const tableContainer = document.getElementById('walk-in-appointments-table-container');
            const tableBody = tableContainer.querySelector('tbody');
            const searchInput = document.getElementById('walkin-appointment-search');
            const statusFilter = tableContainer.querySelector('.status-filter');
            if (!tableBody || !searchInput) return;

            const walkins = [...(window.appData.walkins || [])]; // Always get the latest data
            const fragment = document.createDocumentFragment();

            // 1. Filter Data
            const searchTerm = searchInput.value.toLowerCase();
            const selectedStatus = statusFilter ? statusFilter.value.toLowerCase() : 'all';
            // Only allow these statuses
            const allowedStatuses = ['pending', 'approved', 'in progress', 'completed'];
            let filteredWalkins = walkins.filter(walkin => {
                const status = (walkin.status || '').toLowerCase();
                if (!allowedStatuses.includes(status)) return false;
                const matchesSearch = searchTerm === '' ||
                    Object.values(walkin).some(val => String(val).toLowerCase().includes(searchTerm));
                const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
                return matchesSearch && matchesStatus;
            });

            // 2. Sort Data (using the same global sort state for simplicity)
            filteredWalkins.sort((a, b) => {
                if (currentSort.column === 'datetime') {
                    const aRaw = a.datetimeRaw != null ? a.datetimeRaw : (typeof a.datetime === 'string' ? new Date(a.datetime.replace(' - ', ' ')).getTime() : null);
                    const bRaw = b.datetimeRaw != null ? b.datetimeRaw : (typeof b.datetime === 'string' ? new Date(b.datetime.replace(' - ', ' ')).getTime() : null);

                    if (aRaw === bRaw) return 0;
                    if (aRaw === null) return 1;
                    if (bRaw === null) return -1;

                    const diff = aRaw - bRaw;
                    return currentSort.direction === 'asc' ? diff : -diff;
                }

                const valA = a[currentSort.column] || '';
                const valB = b[currentSort.column] || '';
                const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                return currentSort.direction === 'asc' ? comparison : -comparison;
            });

            // 3. Paginate Data
            const totalPages = Math.ceil(filteredWalkins.length / walkinRowsPerPage);
            walkinCurrentPage = Math.max(1, Math.min(walkinCurrentPage, totalPages));
            const startIndex = (walkinCurrentPage - 1) * walkinRowsPerPage;
            const endIndex = startIndex + walkinRowsPerPage;
            const paginatedWalkins = filteredWalkins.slice(startIndex, endIndex);

            // 4. Render Rows
            paginatedWalkins.forEach(walkin => {
                const row = document.createElement('tr');
                const statusClass = walkin.status.toLowerCase().replace(' ', '-');
                // Add data attributes for modal functionality
                row.dataset.plate = walkin.plate;
                row.dataset.serviceId = walkin.id; // Use the unique walkin ID
                row.dataset.carName = walkin.carName;
                row.dataset.carType = walkin.carType;
                row.dataset.service = walkin.service;
                row.dataset.datetime = walkin.datetime;
                row.dataset.price = walkin.price;
                row.dataset.technician = walkin.technician;
                row.dataset.status = walkin.status;
                row.dataset.paymentStatus = walkin.paymentStatus;

                let actionButtons = '';
                if (walkin.status === 'Pending') {
                    actionButtons = `
                        <button class="action-icon-btn start-service-btn" title="Start Service">
                            <span class="material-symbols-outlined">play_arrow</span>
                        </button>`;
                } else if (walkin.status === 'In Progress') {
                    actionButtons = `
                        <button class="action-icon-btn complete-service-btn" title="Complete Service">
                            <span class="material-symbols-outlined">check</span>
                        </button>`;
                }

                const technicianDropdown = window.appData.createTechnicianDropdown(walkin.technician, walkin.status !== 'Pending');

                const paymentStatusClass = walkin.paymentStatus.toLowerCase();
                const paymentBadge = `<span class="payment-status-badge ${paymentStatusClass}">${walkin.paymentStatus}</span>`;

                let paymentActionButton = '';
                if (walkin.paymentStatus === 'Unpaid') {
                    paymentActionButton = `
                        <button class="action-icon-btn mark-paid-btn" title="Mark as Paid">
                            <span class="material-symbols-outlined">payments</span>
                        </button>`;
                }
                
                // Disable cancel button if completed and paid, approved, or in progress
                let disableCancel = (walkin.status === 'Completed' && walkin.paymentStatus === 'Paid') || 
                                   walkin.status === 'In Progress' || 
                                   walkin.status === 'Approved' || 
                                   walkin.status === 'Approve';
                let cancelTooltip = 'Cancel Appointment';
                
                if (walkin.status === 'In Progress') {
                    cancelTooltip = 'Cannot cancel: service has started';
                } else if (walkin.status === 'Approved' || walkin.status === 'Approve') {
                    cancelTooltip = 'Cannot cancel: walk-in has been approved';
                } else if (walkin.status === 'Completed' && walkin.paymentStatus === 'Paid') {
                    cancelTooltip = 'Cannot cancel: service is completed and paid';
                }
                
                row.innerHTML = `
                    <td>${walkin.plate}</td>
                    <td>${walkin.carName}</td>
                    <td>${walkin.carType}</td>
                    <td>${walkin.service}</td>
                    <td>${walkin.datetime}</td>
                    <td>${walkin.price}</td>
                    <td>${technicianDropdown}</td>
                    <td class="text-center"><span class="${statusClass}">${walkin.status}</span></td>
                    <td class="text-center">${paymentBadge}</td>
                    <td class="text-center">
                        ${actionButtons}
                        ${paymentActionButton}
                        <button class="action-icon-btn cancel-btn" title="${cancelTooltip}"${disableCancel ? ' disabled style="opacity:0.5;pointer-events:none;"' : ''}>
                            <span class="material-symbols-outlined">cancel</span>
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });

            tableBody.innerHTML = ''; // Clear existing rows
            tableBody.appendChild(fragment);

            // 5. Update UI
            const noResultsRow = tableContainer.querySelector('.no-results-row');
            if (noResultsRow) {
                noResultsRow.style.display = paginatedWalkins.length === 0 ? 'table-row' : 'none';
            }

            const paginationContainer = tableContainer.querySelector('.table-pagination');
            if (paginationContainer) {
                const pageInfo = paginationContainer.querySelector('.page-info');
                const prevBtn = paginationContainer.querySelector('[data-action="prev"]');
                const nextBtn = paginationContainer.querySelector('[data-action="next"]');
                pageInfo.textContent = `Page ${walkinCurrentPage} of ${totalPages || 1}`;
                prevBtn.disabled = walkinCurrentPage === 1;
                nextBtn.disabled = walkinCurrentPage === totalPages || totalPages === 0;
            }
        };

        // --- Add a single walk-in to the top of the table ---
        const addWalkinToTable = (walkin) => {
            const tableBody = document.querySelector('#walk-in-appointments-table tbody');
            if (!tableBody) return;
            
            // Just re-render the table to ensure all logic is applied
            populateWalkinsTable();
        };

        // --- Populate Status Filters ---
        const populateStatusFilters = () => {
            const statuses = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Approved'];
            document.querySelectorAll('.status-filter').forEach(filterSelect => {
                filterSelect.innerHTML = statuses.map(status =>
                    `<option value="${status.toLowerCase()}">${status}</option>`
                ).join('');
            });
        };

        // --- Helper function to increase a technician's task count ---
        const increaseTechnicianTaskCount = (technicianName) => {
            if (!technicianName || technicianName === 'Unassigned') {
                return; // Do not increase for system or unassigned tasks
            }

            const technicians = window.appData.technicians || [];
            const technician = technicians.find(t => t.name === technicianName);

            if (technician) {
                technician.tasks++;
                console.log(`Task started by ${technician.name}. New task count: ${technician.tasks}`);
            } else {
                console.warn(`Could not find technician "${technicianName}" to increase task count.`);
            }
        };

        // --- Helper function to decrease a technician's task count ---
        const decreaseTechnicianTaskCount = (technicianName) => {
            if (!technicianName || technicianName === 'Unassigned') {
                return; // Do not decrease for system or unassigned tasks
            }

            const technicians = window.appData.technicians || [];
            const technician = technicians.find(t => t.name === technicianName);

            if (technician) {
                if (technician.tasks > 0) {
                    technician.tasks--;
                    console.log(`Task completed by ${technician.name}. New task count: ${technician.tasks}`);
                } else {
                    console.warn(`Attempted to decrease task count for ${technician.name}, but it was already 0.`);
                }
            }
        };

        // --- Open Appointment Details Modal on Row Click ---
        const appointmentTableBody = mainAppointmentsContainer.querySelector('tbody');
        if (appointmentTableBody) {
            appointmentTableBody.addEventListener('click', async (e) => {
                const cancelButton = e.target.closest('.cancel-btn');
                const approveButton = e.target.closest('.approve-btn');
                const startServiceButton = e.target.closest('.start-service-btn');
                const completeServiceButton = e.target.closest('.complete-service-btn');
                const markPaidButton = e.target.closest('.mark-paid-btn');
                const technicianSelect = e.target.closest('.technician-select');
                const isActionButtonClick = approveButton || startServiceButton || completeServiceButton || cancelButton || markPaidButton || technicianSelect;
                const row = e.target.closest('tr');

                if (!row || row.classList.contains('no-results-row')) return;

                if (approveButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);
                    // Prevent approving if no technician is chosen
                    if (!appointment || !appointment.technician || appointment.technician === '') {
                        if (typeof showSuccessToast === 'function') showSuccessToast('Choose technician first before approving.', 'error');
                        else alert('Choose technician first before approving.');
                        return;
                    }
                    // Prevent approving if appointment is already completed and paid
                    if (String(appointment.status).toLowerCase() === 'completed' && String(appointment.paymentStatus).toLowerCase() === 'paid') {
                        if (typeof showSuccessToast === 'function') showSuccessToast('Cannot approve a service that is already completed and paid.', 'error');
                        else alert('Cannot approve a service that is already completed and paid.');
                        return;
                    }
                    if (appointment.status === 'Pending') {
                        const db = window.firebase.firestore();
                        try {
                            await db.collection('bookings').doc(appointment.serviceId).update({
                                    status: 'Approved'
                                });
                        } catch (err) {
                            console.error('Error updating booking to Approve:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to approve appointment (database error).', 'error');
                            else alert('Failed to approve appointment (database error).');
                            return;
                        }
                        appointment.status = 'Approved';
                        row.dataset.status = 'Approved';
                        const statusCell = row.querySelector('td:nth-last-child(3)');
                        statusCell.innerHTML = `<span class="status-badge approved" title="Approved">Approved</span><div class=\"status-note\" style=\"color: #1976d2; font-size: 0.95em; margin-top: 4px;\">Ask customer to get their vehicle to kingsley site</div>`;
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Appointment for ${appointment.customer} has been approved.`);
                        updateAppointmentPageStats();
                        // --- Send notification to mobile app user ---
                        if (typeof NotificationService !== 'undefined' && typeof NotificationService.notifyAppointmentApproved === 'function') {
                            NotificationService.notifyAppointmentApproved(appointment.customerId || appointment.customer, appointment);
                        }
                        // Replace the approve button with a start button
                        const actionsCell = approveButton.parentElement;
                        approveButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn start-service-btn" title="Start Service">
                                <span class="material-symbols-outlined">play_arrow</span>
                            </button>
                        `);
                    }
                    return;
                }

                if (startServiceButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && (appointment.status === 'Approve' || appointment.status === 'Approved')) {
                        // Ensure we know who is logged in (name + role)
                        await fetchCurrentUserFullName();

                        // Admins may start regardless; others must be assigned technician
                        if (!appointment.technician || appointment.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot start service: no technician assigned.', 'error');
                            else alert('Cannot start service: no technician assigned.');
                            return;
                        }

                        // Validate appointment date is today
                        const appointmentDate = appointment.datetimeRaw 
                            ? new Date(appointment.datetimeRaw) 
                            : window.appData.parseCustomDate(appointment.datetime);
                        const today = new Date();
                        const isToday = appointmentDate && 
                            appointmentDate.getDate() === today.getDate() &&
                            appointmentDate.getMonth() === today.getMonth() &&
                            appointmentDate.getFullYear() === today.getFullYear();
                        
                        if (!isToday) {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot start service: appointment is not scheduled for today.', 'error');
                            else alert('Cannot start service: appointment is not scheduled for today.');
                            return;
                        }

                        if (currentUserFullName !== appointment.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can start this service.', 'error');
                            else alert('Only the assigned technician can start this service.');
                            return;
                        }

                        const originalStatus = appointment.status; // Capture original status
                        const db = window.firebase.firestore();
                        try {
                            // Persist change to Firestore first so mobile app updates
                            await db.collection('bookings').doc(appointment.serviceId).update({
                                status: 'In Progress',
                                startTime: window.firebase.firestore().FieldValue.serverTimestamp(),
                                technician: appointment.technician
                            });
                        } catch (err) {
                            console.error('Error updating booking to In Progress:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to start service (database error).', 'error');
                            else alert('Failed to start service (database error).');
                            return;
                        }

                        // Local/UI updates after successful DB update
                        const startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // prettier-ignore
                        appointment.status = 'In Progress';
                        appointment.startTime = startTime;
                        row.dataset.status = 'In Progress';
                        row.dataset.startTime = startTime;
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="in-progress">In Progress</span>`;

                        if (originalStatus === 'Pending') increaseTechnicianTaskCount(appointment.technician);

                        updateAppointmentPageStats(); // Refresh stats
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${appointment.customer} has started.`);

                        // --- Send notification to mobile app user ---
                        sendServiceStartedNotification(appointment);

                        // Replace the start button with a complete button
                        const actionsCell = startServiceButton.parentElement;
                        startServiceButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn complete-service-btn" title="Complete Service">
                                <span class="material-symbols-outlined">check</span>
                            </button>
                        `);

                        // Disable technician select and cancel button for this row to make status immutable
                        const techSelect = row.querySelector('.technician-select');
                        if (techSelect) techSelect.disabled = true;
                        const cancelBtn = row.querySelector('.cancel-btn');
                        if (cancelBtn) cancelBtn.disabled = true;
                    }
                    return;
                }

                if (completeServiceButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    if (appointment && appointment.status === 'In Progress') {
                        await fetchCurrentUserFullName();
                        // Admins may complete; otherwise only assigned technician
                        if (currentUserFullName !== appointment.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can complete this service.', 'error');
                            else alert('Only the assigned technician can complete this service.');
                            return;
                        }

                        const db = window.firebase.firestore();
                        try {
                            await db.collection('bookings').doc(appointment.serviceId).update({
                                status: 'Completed',
                                completedAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating booking to Completed:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to complete service (database error).', 'error');
                            else alert('Failed to complete service (database error).');
                            return;
                        }

                        appointment.status = 'Completed';
                        row.dataset.status = 'Completed';
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="completed">Completed</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for ${appointment.customer} is complete.`);
                        updateAppointmentPageStats(); // Refresh stats
                        completeServiceButton.remove();

                        // Decrease the technician's task count
                        decreaseTechnicianTaskCount(appointment.technician);

                        // --- Send notification to mobile app user ---
                        sendServiceCompletedNotification(appointment);
                    }
                    return;
                }

                if (cancelButton) {
                    // Find the appointment in the data array and update its status
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);
                    if (appointment) {
                        const originalStatus = appointment.status;
                        
                        // Prevent cancelling once service is In Progress
                        if (originalStatus === 'In Progress') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot cancel service after it has started.', 'error');
                            else alert('Cannot cancel service after it has started.');
                            return;
                        }
                        
                        // Prevent cancelling if already approved
                        if (originalStatus === 'Approved' || originalStatus === 'Approve') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot cancel: appointment has already been approved.', 'error');
                            else alert('Cannot cancel: appointment has already been approved.');
                            return;
                        }
                        
                        // Store appointment and status in sessionStorage and redirect
                        try {
                            sessionStorage.setItem('appointmentToCancel', JSON.stringify({ appointment, originalStatus }));
                        } catch (e) {
                            console.error('Could not store appointmentToCancel:', e);
                        }
                        window.location.href = 'cancel-appointment.html';
                    }
                    return;
                }

                if (markPaidButton) {
                    const appointments = window.appData.appointments || [];
                    const appointment = appointments.find(a => a.serviceId === row.dataset.serviceId);

                    // Normalize current payment status (treat undefined/null as 'Unpaid')
                    const currentPaymentStatus = (appointment && appointment.paymentStatus) ? String(appointment.paymentStatus) : 'Unpaid';

                    if (appointment && currentPaymentStatus.toLowerCase() === 'unpaid') {
                        // Require technician assignment before payment approval
                        if (!appointment.technician || appointment.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') {
                                showSuccessToast('Please assign a technician before approving payment.', 'error');
                            } else {
                                alert('Please assign a technician before approving payment.');
                            }
                            return;
                        }
                        // Approve payment directly, no modal
                        let paymentMethod = '';
                        let customerId = appointment.customerId || appointment.userId || appointment.customerUid;
                        (async () => {
                            try {
                                const db = window.firebase.firestore();
                                if (!customerId) {
                                    // Try to find by fullName if no ID
                                    const usersSnapshot = await db.collection('users').where('fullName', '==', appointment.customer).limit(1).get();
                                    if (!usersSnapshot.empty) {
                                        customerId = usersSnapshot.docs[0].id;
                                    }
                                }
                                if (customerId) {
                                    const userDoc = await db.collection('users').doc(customerId).get();
                                    if (userDoc.exists) {
                                        const userData = userDoc.data();
                                        paymentMethod = userData.paymentMethod || 'Not set';
                                    }
                                }
                            } catch (err) {
                                paymentMethod = 'Not set';
                                console.error('Error fetching user payment method:', err);
                            }

                            // Update payment status in Firestore
                            try {
                                const db = window.firebase.firestore();
                                if (!appointment.serviceId) {
                                    console.error('No serviceId found for appointment:', appointment);
                                }
                                await db.collection('bookings').doc(appointment.serviceId).update({
                                    paymentStatus: 'Paid',
                                    paymentMethod: paymentMethod,
                                    paidAt: window.firebase.firestore().FieldValue.serverTimestamp()
                                });
                                appointment.paymentStatus = 'Paid';
                                appointment.paymentMethod = paymentMethod;
                                row.dataset.paymentStatus = 'Paid';
                                const paymentCell = row.querySelector('td:nth-last-child(2)');
                                if (paymentCell) paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;
                                if (typeof showSuccessToast === 'function') {
                                    showSuccessToast(`Appointment ${appointment.serviceId} marked as paid with ${paymentMethod}.`);
                                }
                                // Remove the mark paid button
                                const markPaidBtn = row.querySelector('.mark-paid-btn');
                                if (markPaidBtn) markPaidBtn.remove();
                                // Send notification to mobile app user
                                if (typeof sendPaymentReceivedNotification === 'function') {
                                    sendPaymentReceivedNotification(appointment);
                                }
                            } catch (err) {
                                console.error('Error updating payment status:', err, {
                                    serviceId: appointment.serviceId,
                                    paymentMethod,
                                    appointment
                                });
                                if (typeof showSuccessToast === 'function') {
                                    showSuccessToast('Failed to process payment (database error). ' + (err && err.message ? err.message : ''), 'error');
                                } else {
                                    alert('Failed to process payment (database error). ' + (err && err.message ? err.message : ''));
                                }
                            }
                        })();
                    }
                    return;
                }

                // If the click was on the row itself (but not on a button), show details overlay
                if (row && !isActionButtonClick) {
                    const appointment = (window.appData.appointments || []).find(a => a.serviceId === row.dataset.serviceId);
 
                    if (appointment) {
                        // Store the appointment data for the details page
                        sessionStorage.removeItem('selectedAppointmentData');
                        // Store the full, current page URL to enable correct "back" navigation
                        sessionStorage.setItem('previousPage', window.location.href);
                        sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appointment));
                        window.location.href = `appointment-details.html`;
                    }
                }

            });
        }

        // --- Helper function to find and assign the least busy technician ---
        const findAndAssignLeastBusyTechnician = () => {
            const technicians = window.appData.technicians || [];
            
            // Filter for active technicians, excluding the "Unassigned" system user
            const activeTechnicians = technicians.filter(tech => tech.status === 'Active' && tech.name !== 'Unassigned');
        
            if (activeTechnicians.length === 0) {
                console.warn("No active technicians available. Assigning to 'Unassigned'.");
                return "Unassigned";
            }
        
            // Sort by task count, ascending. The one with the fewest tasks will be first.
            activeTechnicians.sort((a, b) => a.tasks - b.tasks);
            
            const leastBusyTechnicianData = activeTechnicians[0];
            
            // Increment the task count for the assigned technician in the central data
            // This is crucial for the logic to work on subsequent assignments.
            const techInDataSource = technicians.find(t => t.id === leastBusyTechnicianData.id);
            if (techInDataSource) {
                techInDataSource.tasks++;
                console.log(`Assigned task to ${techInDataSource.name}. New task count: ${techInDataSource.tasks}`);
            } else {
                console.warn(`Could not find technician with ID ${leastBusyTechnicianData.id} in the main data source to update task count.`);
            }
            
            return leastBusyTechnicianData.name;
        };


        // --- Open Walk-in Details Modal & Handle Actions ---
        const walkinTableBody = document.querySelector('#walk-in-appointments-table tbody');
        if (walkinTableBody) {
            walkinTableBody.addEventListener('click', async (e) => {
                const cancelButton = e.target.closest('.cancel-btn');
                const startServiceButton = e.target.closest('.start-service-btn');
                const completeServiceButton = e.target.closest('.complete-service-btn');
                const markPaidButton = e.target.closest('.mark-paid-btn');
                const technicianSelect = e.target.closest('.technician-select');
                const isActionButtonClick = startServiceButton || completeServiceButton || cancelButton || markPaidButton || technicianSelect;
                const row = e.target.closest('tr');

                if (!row || row.classList.contains('no-results-row')) return;

                if (startServiceButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin && walkin.status === 'Pending') {
                        await fetchCurrentUserFullName();

                        // Admins may start regardless; others must be assigned technician
                        if (!walkin.technician || walkin.technician === 'Unassigned') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot start service: no technician assigned.', 'error');
                            else alert('Cannot start service: no technician assigned.');
                            return;
                        }

                        // Validate walk-in date is today
                        const walkinDate = walkin.datetimeRaw 
                            ? new Date(walkin.datetimeRaw) 
                            : window.appData.parseCustomDate(walkin.datetime);
                        const today = new Date();
                        const isToday = walkinDate && 
                            walkinDate.getDate() === today.getDate() &&
                            walkinDate.getMonth() === today.getMonth() &&
                            walkinDate.getFullYear() === today.getFullYear();
                        
                        if (!isToday) {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot start service: walk-in is not scheduled for today.', 'error');
                            else alert('Cannot start service: walk-in is not scheduled for today.');
                            return;
                        }

                        if (currentUserFullName !== walkin.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can start this service.', 'error');
                            else alert('Only the assigned technician can start this service.');
                            return;
                        }

                        const originalStatus = walkin.status; // Capture original status
                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'In Progress',
                                startTime: window.firebase.firestore().FieldValue.serverTimestamp(),
                                technician: walkin.technician
                            });
                        } catch (err) {
                            console.error('Error updating walkin to In Progress:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to start walk-in (database error).', 'error');
                            else alert('Failed to start walk-in (database error).');
                            return;
                        }

                        const startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); // prettier-ignore
                        walkin.status = 'In Progress';
                        walkin.startTime = startTime;
                        row.dataset.status = 'In Progress';
                        row.dataset.startTime = startTime; // prettier-ignore
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="in-progress">In Progress</span>`;

                        if (originalStatus === 'Pending') increaseTechnicianTaskCount(walkin.technician);

                        updateAppointmentPageStats(); // Refresh stats
                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for walk-in ${walkin.plate} has started.`);

                        // Replace the start button with a complete button
                        const actionsCell = startServiceButton.parentElement;
                        startServiceButton.remove();
                        actionsCell.insertAdjacentHTML('afterbegin', `
                            <button class="action-icon-btn complete-service-btn" title="Complete Service">
                                <span class="material-symbols-outlined">check</span>
                            </button>
                        `);

                        // Disable technician select and cancel button for this row to make status immutable
                        const techSelect = row.querySelector('.technician-select');
                        if (techSelect) techSelect.disabled = true;
                        const cancelBtn = row.querySelector('.cancel-btn');
                        if (cancelBtn) cancelBtn.disabled = true;
                    }
                    return;
                }

                if (completeServiceButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin && walkin.status === 'In Progress') {
                        await fetchCurrentUserFullName();
                        if (currentUserFullName !== walkin.technician && window.currentUserRole !== 'admin') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Only the assigned technician can complete this service.', 'error');
                            else alert('Only the assigned technician can complete this service.');
                            return;
                        }

                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'Completed',
                                completedAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walkin to Completed:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to complete walk-in (database error).', 'error');
                            else alert('Failed to complete walk-in (database error).');
                            return;
                        }

                        walkin.status = 'Completed';
                        row.dataset.status = 'Completed';
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="completed">Completed</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Service for walk-in ${walkin.plate} is complete.`);
                        updateAppointmentPageStats(); // Refresh stats
                        completeServiceButton.remove();

                        // Decrease the technician's task count
                        decreaseTechnicianTaskCount(walkin.technician);
                    }
                    return;
                }

                if (cancelButton) {
                    // Find walkin by plate and service to be more specific
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin) {
                        const originalStatus = walkin.status;

                        // Prevent cancelling once service is In Progress
                        if (originalStatus === 'In Progress') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot cancel service after it has started.', 'error');
                            else alert('Cannot cancel service after it has started.');
                            return;
                        }

                        // Prevent cancelling if already approved
                        if (originalStatus === 'Approved' || originalStatus === 'Approve') {
                            if (typeof showSuccessToast === 'function') showSuccessToast('Cannot cancel: walk-in has already been approved.', 'error');
                            else alert('Cannot cancel: walk-in has already been approved.');
                            return;
                        }

                        const db = window.firebase.firestore();
                        try {
                            await db.collection('walkins').doc(walkin.id).update({
                                status: 'Cancelled',
                                cancelledAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walkin to Cancelled:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to cancel walk-in (database error).', 'error');
                            else alert('Failed to cancel walk-in (database error).');
                            return;
                        }

                        // Update status in data model
                        walkin.status = 'Cancelled';
                        row.dataset.status = 'Cancelled';

                        // Update status in UI
                        const statusCell = row.querySelector('td:nth-last-child(3)'); // The 3rd cell from the end is Status
                        statusCell.innerHTML = `<span class="cancelled">Cancelled</span>`;

                        // If it was a pending or in-progress task, free up the technician
                        if (originalStatus === 'Pending' || originalStatus === 'In Progress') {
                            decreaseTechnicianTaskCount(walkin.technician);
                        }
                        
                        cancelButton.disabled = true;
                        updateAppointmentPageStats(); // Refresh stats
                        // Re-render the table with current filters
                        populateWalkinsTable();
                    }
                    return;
                }

                if (markPaidButton) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    // Normalize current payment status (treat undefined/null as 'Unpaid')
                    const currentPaymentStatus = (walkin && walkin.paymentStatus) ? String(walkin.paymentStatus) : 'Unpaid';

                    if (walkin && currentPaymentStatus.toLowerCase() === 'unpaid') {
                        const db = window.firebase.firestore();
                        try {
                            // Update payment status in Firestore
                            await db.collection('walkins').doc(walkin.id).update({
                                paymentStatus: 'Paid',
                                paidAt: window.firebase.firestore().FieldValue.serverTimestamp()
                            });
                        } catch (err) {
                            console.error('Error updating walk-in payment status:', err);
                            if (typeof showSuccessToast === 'function') showSuccessToast('Failed to mark as paid (database error).', 'error');
                            else alert('Failed to mark as paid (database error).');
                            return;
                        }

                        // Local/UI updates after successful DB update
                        walkin.paymentStatus = 'Paid';
                        row.dataset.paymentStatus = 'Paid';

                        const paymentCell = row.querySelector('td:nth-last-child(2)');
                        if (paymentCell) paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;

                        if (typeof showSuccessToast === 'function') showSuccessToast(`Walk-in for ${walkin.plate} marked as paid.`);
                        
                        // Remove the button after it's clicked
                        markPaidButton.remove();
                    }
                    return;
                }

                // If the click was on the row itself (but not on a button), show details overlay
                if (row && !isActionButtonClick) {
                    const walkins = window.appData.walkins || [];
                    const walkin = walkins.find(w => w.plate === row.dataset.plate && w.service === row.dataset.service);

                    if (walkin) {
                        sessionStorage.removeItem('selectedWalkinData');
                        // Store the full, current page URL to enable correct "back" navigation
                        sessionStorage.setItem('previousPage', window.location.href);
                        sessionStorage.setItem('selectedWalkinData', JSON.stringify(walkin));
                        window.location.href = `walk-in-details.html`;
                    }
                }
            });
        }
        
        // --- Event Listeners for Filters, Sorting, and Pagination ---
        const setupTableInteractions = () => {
            // Appointments Table
            const apptContainer = document.getElementById('main-appointments-table-container');
            apptContainer.querySelector('#appointment-search').addEventListener('input', () => { apptCurrentPage = 1; populateAppointmentsTable(); });
            apptContainer.querySelector('.status-filter')?.addEventListener('change', () => { apptCurrentPage = 1; populateAppointmentsTable(); });
            const apptDateInput = document.getElementById('appointments-date-filter');
            const apptDateClear = document.getElementById('appointments-date-clear');
            if (apptDateInput) {
                apptDateInput.addEventListener('change', () => {
                    window.tableDateFilterMode = apptDateInput.value ? 'input' : 'none';
                    if (window.setCalendarDate && apptDateInput.value) {
                        const [yyyy, mm, dd] = apptDateInput.value.split('-');
                        const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                        window.setCalendarDate(d);
                    }
                    apptCurrentPage = 1;
                    populateAppointmentsTable();
                });
            }
            if (apptDateClear) {
                apptDateClear.addEventListener('click', () => {
                    const el = document.getElementById('appointments-date-filter');
                    if (el) el.value = '';
                    window.tableDateFilterMode = 'none';
                    apptCurrentPage = 1;
                    populateAppointmentsTable();
                });
            }
            apptContainer.querySelector('.table-pagination [data-action="prev"]').addEventListener('click', () => { if (apptCurrentPage > 1) { apptCurrentPage--; populateAppointmentsTable(); } });
            apptContainer.querySelector('.table-pagination [data-action="next"]').addEventListener('click', () => { apptCurrentPage++; populateAppointmentsTable(); });

            // Handle Technician Re-assignment for Appointments
            apptContainer.querySelector('tbody').addEventListener('change', async (e) => { // Make the event listener async
                const technicianSelect = e.target.closest('.technician-select');
                if (!technicianSelect) return;

                const row = e.target.closest('tr');
                if (!row || !row.dataset.serviceId) return;

                const serviceId = row.dataset.serviceId;
                const newTechnicianName = technicianSelect.value;

                const appointment = window.appData.appointments.find(a => a.serviceId === serviceId);
                if (!appointment) return;

                const oldTechnicianName = appointment.technician;
                // Prevent changing technician once service is in progress or completed
                if (appointment.status === 'In Progress' || appointment.status === 'Completed') {
                    technicianSelect.value = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast('Cannot change technician after service started or completed.', 'error');
                    return;
                }

                appointment.technician = newTechnicianName;
                row.dataset.technician = newTechnicianName;

                try { // Add try...catch for the database operation
                    // --- Firestore Update ---
                    const db = window.firebase.firestore();
                    await db.collection('bookings').doc(serviceId).update({
                        technician: newTechnicianName
                    });

                    // Update task counts only after a successful database update
                    if (appointment.status === 'Pending' || appointment.status === 'In Progress') {
                        decreaseTechnicianTaskCount(oldTechnicianName);
                        increaseTechnicianTaskCount(newTechnicianName);
                    }

                    if (typeof showSuccessToast === 'function') showSuccessToast(`Technician for ${appointment.customer} changed to ${newTechnicianName}.`);
                        // Update approve button state in the row (if present)
                        try {
                            const approveBtn = row.querySelector('.approve-btn');
                            if (approveBtn) {
                                if (appointment.status === 'Pending' && newTechnicianName && newTechnicianName !== '') {
                                    approveBtn.removeAttribute('disabled');
                                    approveBtn.removeAttribute('tabindex');
                                    approveBtn.removeAttribute('aria-disabled');
                                    approveBtn.style.opacity = '';
                                    approveBtn.style.pointerEvents = '';
                                    approveBtn.style.userSelect = '';
                                } else {
                                    approveBtn.setAttribute('disabled', '');
                                    approveBtn.setAttribute('tabindex', '-1');
                                    approveBtn.setAttribute('aria-disabled', 'true');
                                    approveBtn.style.opacity = '0.5';
                                    approveBtn.style.pointerEvents = 'none';
                                    approveBtn.style.userSelect = 'none';
                                }
                            }
                        } catch (e) {
                            console.debug('Could not update approve button state in row:', e);
                        }
                } catch (error) {
                    console.error("Error updating technician in Firestore:", error);
                    // Revert local changes if DB update fails
                    appointment.technician = oldTechnicianName;
                    row.dataset.technician = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast(`Error: Could not assign technician.`, 'error');
                }
            });

            // Walk-ins Table
            const walkinContainer = document.getElementById('walk-in-appointments-table-container');
            walkinContainer.querySelector('#walkin-appointment-search').addEventListener('input', () => { walkinCurrentPage = 1; populateWalkinsTable(); });
            walkinContainer.querySelector('.status-filter')?.addEventListener('change', () => { walkinCurrentPage = 1; populateWalkinsTable(); });
            walkinContainer.querySelector('.table-pagination [data-action="prev"]').addEventListener('click', () => { if (walkinCurrentPage > 1) { walkinCurrentPage--; populateWalkinsTable(); } });
            walkinContainer.querySelector('.table-pagination [data-action="next"]').addEventListener('click', () => { walkinCurrentPage++; populateWalkinsTable(); });

            // Handle Technician Re-assignment for Walk-ins
            walkinContainer.querySelector('tbody').addEventListener('change', async (e) => { // Make the event listener async
                const technicianSelect = e.target.closest('.technician-select');
                if (!technicianSelect) return;

                const row = e.target.closest('tr');
                if (!row || !row.dataset.serviceId) return; // Use serviceId which holds the unique ID

                // Walk-ins are identified by their unique ID stored in the row's dataset
                const walkinId = row.dataset.serviceId; // Assuming walk-in rows also have data-service-id
                const walkin = window.appData.walkins.find(w => w.id === walkinId);
                if (!walkin) return;

                const oldTechnicianName = walkin.technician;
                const newTechnicianName = technicianSelect.value;
                // Prevent changing technician once service is in progress or completed
                if (walkin.status === 'In Progress' || walkin.status === 'Completed') {
                    technicianSelect.value = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast('Cannot change technician after service started or completed.', 'error');
                    return;
                }

                walkin.technician = newTechnicianName;
                row.dataset.technician = newTechnicianName;

                try { // Add try...catch for the database operation
                    // --- Firestore Update ---
                    const db = window.firebase.firestore();
                    await db.collection('walkins').doc(walkinId).update({
                        technician: newTechnicianName
                    });

                    // Update task counts only after a successful database update
                    if (walkin.status === 'Pending' || walkin.status === 'In Progress') {
                        decreaseTechnicianTaskCount(oldTechnicianName);
                        increaseTechnicianTaskCount(newTechnicianName);
                    }
                    if (typeof showSuccessToast === 'function') showSuccessToast(`Technician for walk-in ${walkin.plate} changed to ${newTechnicianName}.`);
                        // Update approve button state in the row (if present) for walk-ins
                        try {
                            const approveBtn = row.querySelector('.approve-btn');
                            if (approveBtn) {
                                if (walkin.status === 'Pending' && newTechnicianName && newTechnicianName !== '') {
                                    approveBtn.removeAttribute('disabled');
                                    approveBtn.removeAttribute('tabindex');
                                    approveBtn.removeAttribute('aria-disabled');
                                    approveBtn.style.opacity = '';
                                    approveBtn.style.pointerEvents = '';
                                    approveBtn.style.userSelect = '';
                                } else {
                                    approveBtn.setAttribute('disabled', '');
                                    approveBtn.setAttribute('tabindex', '-1');
                                    approveBtn.setAttribute('aria-disabled', 'true');
                                    approveBtn.style.opacity = '0.5';
                                    approveBtn.style.pointerEvents = 'none';
                                    approveBtn.style.userSelect = 'none';
                                }
                            }
                        } catch (e) {
                            console.debug('Could not update approve button state in walk-in row:', e);
                        }
                } catch (error) {
                    console.error("Error updating walk-in technician in Firestore:", error);
                    // Revert local changes if DB update fails
                    walkin.technician = oldTechnicianName;
                    row.dataset.technician = oldTechnicianName;
                    if (typeof showSuccessToast === 'function') showSuccessToast(`Error: Could not assign technician.`, 'error');
                }
            });

            // Sorting (applies to both tables)
            document.querySelectorAll('#appointments-page .sortable-header th[data-sortable="true"]').forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.sortBy || header.textContent.toLowerCase().trim().replace(' ', '');
                    
                    if (currentSort.column === column) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.column = column;
                        currentSort.direction = 'desc';
                    }

                    // Update header classes for visual feedback
                    document.querySelectorAll('#appointments-page th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
                    header.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');

                    // Re-render both tables with the new sort order
                    populateAppointmentsTable();
                    populateWalkinsTable();
                });
            });
        };

        // Initial Setup
        if (mainAppointmentsContainer) { // Only run these on the main appointments page
            populateStatusFilters();
            setupTableInteractions();
            setupPendingQueueListeners();
            fetchAndPopulateAppointments(); // Fetch data from Firestore on initial load
            updateAppointmentPageStats(); // Call the new function to update stats
            if (typeof window.initializeTableFunctionality === 'function') {
                window.initializeTableFunctionality('#main-appointments-table');
                window.initializeTableFunctionality('#walk-in-appointments-table');
            }
            // Queue "Show" action to focus a specific appointment
            const queueList = document.getElementById('queue-list');
            if (queueList) {
                // Handle Show button clicks
                queueList.addEventListener('click', (e) => {
                    const btn = e.target.closest('.show-appt-btn');
                    if (!btn) return;
                    const apptId = btn.dataset.serviceId;
                    const type = btn.dataset.type || 'booking';

                    if (type === 'booking') {
                        const table = document.querySelector('#main-appointments-table-container');
                        if (!table) return;
                        const searchInput = table.querySelector('#appointment-search');
                        if (searchInput) {
                            searchInput.value = apptId;
                            const evt = new Event('input', { bubbles: true });
                            searchInput.dispatchEvent(evt);
                        }
                        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setTimeout(() => {
                            const row = table.querySelector(`tbody tr[data-service-id="${apptId}"]`);
                            if (row) {
                                row.classList.add('card-flash');
                                setTimeout(() => row.classList.remove('card-flash'), 1000);
                            }
                        }, 400);
                    } else {
                        const table = document.querySelector('#walk-in-appointments-table-container');
                        if (!table) return;
                        const searchInput = table.querySelector('#walkin-appointment-search');
                        if (searchInput) {
                            searchInput.value = apptId;
                            const evt = new Event('input', { bubbles: true });
                            searchInput.dispatchEvent(evt);
                        }
                        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setTimeout(() => {
                            const row = table.querySelector(`tbody tr[data-service-id="${apptId}"]`);
                            if (row) {
                                row.classList.add('card-flash');
                                setTimeout(() => row.classList.remove('card-flash'), 1000);
                            }
                        }, 400);
                    }
                });

                // Handle technician dropdown changes
                queueList.addEventListener('change', async (e) => {
                    if (!e.target.classList.contains('technician-select-queue')) return;
                    
                    const queueItem = e.target.closest('.queue-item');
                    if (!queueItem) return;
                    
                    const type = queueItem.dataset.type;
                    const serviceId = queueItem.dataset.serviceId;
                    const technicianName = e.target.value;
                    const approveBtn = queueItem.querySelector('.approve-queue-btn');
                    
                    // Enable/disable approve button based on technician selection
                    if (approveBtn) {
                        approveBtn.disabled = !technicianName;
                    }
                    
                    // Save technician assignment
                    if (technicianName) {
                        try {
                            const db = window.firebase.firestore();
                            const collection = type === 'booking' ? 'bookings' : 'walkins';
                            await db.collection(collection).doc(serviceId).update({
                                technician: technicianName,
                                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            // Update local data
                            if (type === 'booking') {
                                const appt = window.appData.appointments.find(a => a.serviceId === serviceId);
                                if (appt) appt.technician = technicianName;
                            } else {
                                const walkin = window.appData.walkins.find(w => w.id === serviceId);
                                if (walkin) walkin.technician = technicianName;
                            }
                            
                            if (typeof showSuccessToast === 'function') {
                                showSuccessToast(`Technician ${technicianName} assigned successfully`, 'success');
                            }
                        } catch (err) {
                            console.error('Error assigning technician:', err);
                            if (typeof showSuccessToast === 'function') {
                                showSuccessToast('Failed to assign technician', 'error');
                            }
                        }
                    }
                });

                // Handle Approve button clicks
                queueList.addEventListener('click', async (e) => {
                    const btn = e.target.closest('.approve-queue-btn');
                    if (!btn || btn.disabled) return;
                    
                    const type = btn.dataset.type;
                    const serviceId = btn.dataset.serviceId;
                    const queueItem = btn.closest('.queue-item');
                    const techSelect = queueItem?.querySelector('.technician-select-queue');
                    const technicianName = techSelect?.value;
                    
                    if (!technicianName) {
                        if (typeof showSuccessToast === 'function') {
                            showSuccessToast('Please select a technician first', 'error');
                        }
                        return;
                    }
                    
                    // Disable button during processing
                    btn.disabled = true;
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">hourglass_empty</span> Approving...';
                    
                    try {
                        const db = window.firebase.firestore();
                        const collection = type === 'booking' ? 'bookings' : 'walkins';
                        
                        await db.collection(collection).doc(serviceId).update({
                            status: 'Approved',
                            technician: technicianName,
                            approvedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        // Update local data
                        if (type === 'booking') {
                            const appt = window.appData.appointments.find(a => a.serviceId === serviceId);
                            if (appt) {
                                appt.status = 'Approved';
                                appt.technician = technicianName;
                            }
                        } else {
                            const walkin = window.appData.walkins.find(w => w.id === serviceId);
                            if (walkin) {
                                walkin.status = 'Approved';
                                walkin.technician = technicianName;
                            }
                        }
                        
                        if (typeof showSuccessToast === 'function') {
                            showSuccessToast('Appointment approved successfully!', 'success');
                        }
                        
                        // Refresh the queue and tables
                        setTimeout(() => {
                            renderPendingQueue();
                            if (typeof populateAppointmentsTable === 'function') populateAppointmentsTable();
                            if (typeof populateWalkinAppointmentsTable === 'function') populateWalkinAppointmentsTable();
                        }, 500);
                        
                    } catch (err) {
                        console.error('Error approving appointment:', err);
                        btn.disabled = false;
                        btn.innerHTML = originalHTML;
                        if (typeof showSuccessToast === 'function') {
                            showSuccessToast('Failed to approve appointment', 'error');
                        }
                    }
                });
            }
        }

        // --- Add event listener to refresh data when page is shown ---
        // This handles cases where the user navigates back to this page.
        window.addEventListener('pageshow', (event) => {
            // The 'persisted' property is true if the page is from the back/forward cache.
            if (event.persisted) {
                if (mainAppointmentsContainer) fetchAndPopulateAppointments();
            }
        });
    }

    // ===== HELPER: GET CUSTOMER ID FROM NAME =====
    /**
     * Look up customer's Firestore ID using their name
     * Queries the 'users' collection for a customer with matching fullName
     */
    const getCustomerIdFromName = async (customerName) => {
        try {
            if (!customerName || typeof customerName !== 'string') {
                return null;
            }

            const db = window.firebase.firestore();
            const usersSnapshot = await db.collection('users')
                .where('fullName', '==', customerName.trim())
                .where('role', '!=', 'admin')
                .limit(1)
                .get();

            if (usersSnapshot.empty) {
                console.warn(`⚠️ No customer found with name: ${customerName}`);
                return null;
            }

            const customerId = usersSnapshot.docs[0].id;
            console.log(`✅ Found customer ID: ${customerId} for name: ${customerName}`);
            return customerId;
        } catch (error) {
            console.error(`❌ Error looking up customer ID: ${error.message}`);
            return null;
        }
    };

    // ===== NOTIFICATION FUNCTIONS TO SEND TO MOBILE USERS =====

    /**
     * Send "Service Started" notification to customer
     */
    const sendServiceStartedNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data (could be any of these names)
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID using the customer name
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyServiceStarted(customerId, {
                id: appointment.serviceId,
                serviceName: appointment.serviceNames || appointment.service,
                technician: appointment.technician
            });

            console.log(`✅ Service started notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending service started notification:', error.message);
        }
    };

    /**
     * Send "Service Completed" notification to customer
     */
    const sendServiceCompletedNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyServiceCompleted(customerId, {
                id: appointment.serviceId,
                serviceName: appointment.serviceNames || appointment.service
            });

            console.log(`✅ Service completed notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending service completed notification:', error.message);
        }
    };

    /**
     * Send "Payment Received" notification to customer
     */
    const sendPaymentReceivedNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyPaymentReceived(customerId, {
                id: appointment.serviceId,
                amount: appointment.price,
                serviceName: appointment.serviceNames || appointment.service
            });

            console.log(`✅ Payment received notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending payment received notification:', error.message);
        }
    };

    /**
     * Send "Appointment Cancelled" notification to customer
     */
    const sendAppointmentCancelledNotification = async (appointment) => {
        try {
            if (typeof NotificationService === 'undefined') {
                console.warn('NotificationService not available');
                return;
            }

            // Get customer ID from appointment data
            const customerName = appointment.customer || appointment.customerName || appointment.fullName;
            
            if (!customerName) {
                console.warn('⚠️ No customer name found in appointment data');
                return;
            }

            // Look up the actual Firestore user ID
            const customerId = await getCustomerIdFromName(customerName);
            
            if (!customerId) {
                console.warn(`⚠️ Could not find Firestore ID for customer: ${customerName}`);
                return;
            }

            await NotificationService.notifyAppointmentCancelled(customerId, {
                id: appointment.serviceId,
                serviceName: appointment.serviceNames || appointment.service,
                reason: appointment.cancellationReason || 'Your appointment was cancelled by the admin'
            });

            console.log(`✅ Appointment cancelled notification sent to ${customerId}`);
        } catch (error) {
            console.error('❌ Error sending appointment cancelled notification:', error.message);
        }
    };

    // TODO: Pending reschedule requests table removed - UI and handlers deleted

    // --- Payment Form Handler ---
    const paymentForm = document.getElementById('payment-form');
    const paymentCancelBtn = document.getElementById('payment-cancel-btn');
    const modalOverlay = document.getElementById('modal-overlay');

    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const paymentAmountInput = document.getElementById('payment-amount');
            const paymentMethodInput = document.getElementById('payment-method');
            const amount = parseFloat(paymentAmountInput?.value || 0);

            const appointment = window.pendingPaymentAppointment;
            const row = window.pendingPaymentRow;

            if (!appointment || !row) {
                alert('Error: Could not find appointment data.');
                return;
            }

            // Fetch the user's payment method from Firestore
            let paymentMethod = '';
            try {
                const db = window.firebase.firestore();
                let customerId = appointment.customerId || appointment.customer || appointment.customerUid;
                if (!customerId) {
                    // Try to look up by name if needed
                    const usersSnapshot = await db.collection('users').where('fullName', '==', appointment.customer).limit(1).get();
                    if (!usersSnapshot.empty) {
                        customerId = usersSnapshot.docs[0].id;
                    }
                }
                if (customerId) {
                    const userDoc = await db.collection('users').doc(customerId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        paymentMethod = userData.paymentMethod || '';
                    }
                }
            } catch (err) {
                console.error('Error fetching user payment method:', err);
            }

            if (!paymentMethod) {
                alert('No payment method found for this user.');
                return;
            }

            // Set the payment method in the modal (for display)
            if (paymentMethodInput) paymentMethodInput.value = paymentMethod;

            const db = window.firebase.firestore();
            try {
                // Update payment status in Firestore with paymentMethod and price
                await db.collection('bookings').doc(appointment.serviceId).update({
                    paymentStatus: 'Paid',
                    paymentMethod: paymentMethod,
                    price: amount,
                    paidAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });

                // Local/UI updates after successful DB update
                appointment.paymentStatus = 'Paid';
                appointment.paymentMethod = paymentMethod;
                appointment.price = amount;
                row.dataset.paymentStatus = 'Paid';

                const paymentCell = row.querySelector('td:nth-last-child(2)');
                if (paymentCell) paymentCell.innerHTML = `<span class="payment-status-badge paid">Paid</span>`;

                if (typeof showSuccessToast === 'function') {
                    showSuccessToast(`Appointment ${appointment.serviceId} marked as paid with ${paymentMethod}.`);
                }

                // Remove the mark paid button
                const markPaidBtn = row.querySelector('.mark-paid-btn');
                if (markPaidBtn) markPaidBtn.remove();

                // Send notification to mobile app user
                if (typeof sendPaymentReceivedNotification === 'function') {
                    sendPaymentReceivedNotification(appointment);
                }

                // Close the modal
                if (modalOverlay) {
                    modalOverlay.style.display = 'none';
                }

                // Reset form
                paymentForm.reset();
                window.pendingPaymentAppointment = null;
                window.pendingPaymentRow = null;

            } catch (err) {
                console.error('Error updating payment status:', err);
                if (typeof showSuccessToast === 'function') {
                    showSuccessToast('Failed to process payment (database error).', 'error');
                } else {
                    alert('Failed to process payment (database error).');
                }
            }
        });
    }

    if (paymentCancelBtn) {
        paymentCancelBtn.addEventListener('click', () => {
            if (modalOverlay) {
                modalOverlay.style.display = 'none';
            }
            const paymentForm = document.getElementById('payment-form');
            if (paymentForm) {
                paymentForm.reset();
            }
            window.pendingPaymentAppointment = null;
            window.pendingPaymentRow = null;
        });
    }

    // Cancel modal logic removed for redirect-based cancel flow

    // Close modal when clicking outside of it
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
                const paymentForm = document.getElementById('payment-form');
                if (paymentForm) {
                    paymentForm.reset();
                }
                window.pendingPaymentAppointment = null;
                window.pendingPaymentRow = null;
            }
        });
    }

    // --- Cancelled Appointments Table ---
    const cancelledContainer = document.getElementById('cancelled-appointments-table');
    const cancelledTableBody = cancelledContainer?.querySelector('tbody');
    let cancelledSearchTerm = '';

    function renderCancelledTable() {
        if (!cancelledTableBody) return;

        // Combine cancelled appointments and cancelled walk-ins
        const cancelledAppointments = (window.appData.appointments || []).filter(a => String(a.status || '').toLowerCase() === 'cancelled' || String(a.status || '') === 'Cancelled');
        const cancelledWalkins = (window.appData.walkins || []).filter(w => String(w.status || '').toLowerCase() === 'cancelled' || String(w.status || '') === 'Cancelled');
        // Normalize walk-in fields to match appointment fields for table rendering
        const normalizedWalkins = cancelledWalkins.map(w => ({
            serviceId: w.id || w.serviceId || '',
            customer: w.customer || w.carName || w.plate || 'Walk-in',
            service: w.service || '',
            datetime: w.datetime || '',
            cancellationReason: w.cancellationReason || '',
            cancellationNotes: w.cancellationNotes || '',
            cancelledAt: w.cancelledAt || '',
            // Add any other fields needed for rendering or actions
        }));
        const cancelled = [...cancelledAppointments, ...normalizedWalkins];

        // Apply search filter
        const filtered = cancelled.filter(a => {
            const term = cancelledSearchTerm.toLowerCase();
            if (!term) return true;
            return (a.serviceId || '').toLowerCase().includes(term) ||
                   (a.customer || '').toLowerCase().includes(term) ||
                   (a.service || '').toLowerCase().includes(term) ||
                   (a.cancellationReason || '').toLowerCase().includes(term) ||
                   (a.cancellationNotes || '').toLowerCase().includes(term);
        });

        cancelledTableBody.innerHTML = '';

        if (filtered.length === 0) {
            const tr = document.createElement('tr');
            tr.classList.add('no-results-row');
            tr.innerHTML = `<td colspan="8" class="text-center text-muted">No cancelled appointments found.</td>`;
            cancelledTableBody.appendChild(tr);
            return;
        }

        filtered.forEach(a => {
            const row = document.createElement('tr');
            const cancelledAt = a.cancelledAt ? (new Date(a.cancelledAt)).toLocaleString() : 'N/A';
            row.innerHTML = `
                <td>${a.serviceId}</td>
                <td>${a.customer || 'N/A'}</td>
                <td>${a.service || 'N/A'}</td>
                <td>${a.datetime || 'N/A'}</td>
                <td>${a.cancellationReason || 'N/A'}</td>
                <td class="text-center">
                    <button class="action-icon-btn view-cancel-btn" data-id="${a.serviceId}" title="View"><span class="material-symbols-outlined">visibility</span></button>
                    <button class="action-icon-btn reinstate-btn" data-id="${a.serviceId}" title="Reinstate"><span class="material-symbols-outlined">restore</span></button>
                </td>
            `;
            cancelledTableBody.appendChild(row);
        });
    }

    const cancelledSearchInput = document.getElementById('cancelled-appointment-search');
    if (cancelledSearchInput) {
        cancelledSearchInput.addEventListener('input', (e) => {
            cancelledSearchTerm = e.target.value || '';
            renderCancelledTable();
        });
    }

    const cancelledTableEl = document.querySelector('#cancelled-appointments-table tbody');
    if (cancelledTableEl) {
        cancelledTableEl.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-cancel-btn');
            const reinstateBtn = e.target.closest('.reinstate-btn');
            if (viewBtn) {
                const id = viewBtn.dataset.id;
                const appointment = (window.appData.appointments || []).find(a => a.serviceId === id);
                if (appointment) {
                    sessionStorage.setItem('previousPage', window.location.href);
                    sessionStorage.setItem('selectedAppointmentData', JSON.stringify(appointment));
                    window.location.href = 'appointment-details.html';
                }
            }

            if (reinstateBtn) {
                const id = reinstateBtn.dataset.id;
                if (!confirm('Reinstate this appointment? This will set the appointment status back to Pending.')) return;
                try {
                    const db = window.firebase.firestore();
                    await db.collection('bookings').doc(id).update({
                        status: 'Pending',
                        cancelledAt: window.firebase.firestore.FieldValue.delete(),
                        cancellationReason: window.firebase.firestore.FieldValue.delete(),
                        cancellationNotes: window.firebase.firestore.FieldValue.delete()
                    });
                    // Update local model
                    window.appData.appointments = (window.appData.appointments || []).map(a => a.serviceId === id ? ({ ...a, status: 'Pending', cancelledAt: null, cancellationReason: null, cancellationNotes: null }) : a);
                    renderCancelledTable();
                    populateAppointmentsTable();
                    updateAppointmentPageStats();
                    if (typeof showSuccessToast === 'function') showSuccessToast('Appointment reinstated.');
                } catch (err) {
                    console.error('Error reinstating appointment:', err);
                    if (typeof showSuccessToast === 'function') showSuccessToast('Failed to reinstate appointment.', 'error');
                }
            }
        });
    }
});