// damage-reports.js
// Fetches damage reports from Firestore and renders them into the damage reports table
// Provides a view action that stores the selected item in sessionStorage (for a details page).
(function () {
  console.log('damage-reports.js loaded');

  // Simple DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Update total stat
  function updateTotals(count) {
    const el = $('#total-damage-reports-stat');
    if (el) el.textContent = String(count);
  }

  // Hide loader
  function hideLoader() {
    const loader = document.querySelector('#damage-reports-table-container .table-loader');
    if (loader) loader.style.display = 'none';
  }

  // Show error message
  function showErrorMessage(message) {
    const table = $('#damage-reports-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.querySelectorAll('tr').forEach(tr => tr.remove());

    // Add error row
    const errorRow = document.createElement('tr');
    errorRow.className = 'no-results-row';
    errorRow.innerHTML = `
      <td colspan="6" class="text-center" style="padding: 2rem; color: #e74c3c;">
        <span class="material-symbols-outlined" style="font-size: 3rem; display: block; margin-bottom: 1rem;">error</span>
        <strong>${message}</strong>
      </td>
    `;
    tbody.appendChild(errorRow);
  }

  // Ensure each row has an Actions cell with an arrow button
  function ensureArrowButtons() {
    const table = $('#damage-reports-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
      // skip the no-results-row
      if (tr.classList.contains('no-results-row')) return;

      let actionsCell = tr.querySelector('.actions-cell');
      if (!actionsCell) {
        // create actions cell at the end
        actionsCell = document.createElement('td');
        actionsCell.className = 'text-center actions-cell';
        tr.appendChild(actionsCell);
      }

      // If a view button already exists, skip
      if (actionsCell.querySelector('.view-btn')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-icon-btn view-btn';
      btn.title = 'View Full Details';
      btn.innerHTML = `<span class="material-symbols-outlined">visibility</span>`;
      actionsCell.appendChild(btn);
    });
  }

  // Click handler for visibility buttons (delegated)
  function setupArrowHandler() {
    const table = $('#damage-reports-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      const row = btn.closest('tr');
      if (!row) return;
      const reportId = row.dataset.reportId || row.dataset.reviewId || null;

      // Find the full report data from the damageReports array
      const reportData = damageReports.find(rep => rep.reportId === reportId);
      
      if (reportData) {
        try {
          sessionStorage.setItem('selectedDamageReport', JSON.stringify(reportData));
        } catch (err) {
          console.warn('Could not save selected damage report to sessionStorage', err);
        }
      } else {
        console.warn('Report data not found for reportId:', reportId);
      }

      // Navigate to a details page if available
      const detailsPage = 'damage-reports-details.html';
      window.location.href = detailsPage;
    });
  }

  // Observe tbody for new rows and inject arrow buttons
  function observeTableMutations() {
    const table = $('#damage-reports-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const mo = new MutationObserver(() => {
      ensureArrowButtons();
      // update totals
      const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.classList.contains('no-results-row'));
      updateTotals(rows.length);
    });
    mo.observe(tbody, { childList: true, subtree: true });
  }

  // --- Fetch damage reports from Firestore ---
  let damageReports = [];

  async function fetchDamageReports() {
    try {
      console.log('Starting damage reports fetch...');
      
      // Wait for Firebase to be initialized
      await window.firebaseInitPromise;
      console.log('Firebase initialized successfully');
      
      const db = window.firebase.firestore();
      const auth = window.firebase.auth();
      
      // Wait for auth state to be determined
      const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      });
      
      console.log('User authentication state:', user ? 'Authenticated' : 'Not authenticated');
      
      // Check if user is authenticated
      if (!user) {
        console.warn('User not authenticated. Cannot fetch damage reports.');
        damageReports = [];
        showErrorMessage('Please log in to view damage reports.');
        return;
      }
      
      // Verify user has admin role (required by Firestore rules)
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userRole = userDoc.exists ? userDoc.data().role : null;
      
      console.log('User role:', userRole);
      
      if (userRole !== 'admin') {
        console.warn('User does not have admin privileges. Current role:', userRole);
        damageReports = [];
        showErrorMessage('Access Denied: Admin privileges required to view damage reports.');
        return;
      }
      
      console.log('Fetching damage reports from Firestore collection: damage_reports');
      // Try fetching from 'damage_reports' collection
      const snapshot = await db.collection('damage_reports').get();
      
      console.log('Firestore query completed. Documents found:', snapshot.size);
      
      if (snapshot.empty) {
        console.log('No damage reports found in Firestore.');
        damageReports = [];
        showErrorMessage('No damage reports found. The collection is empty.');
        hideLoader();
      } else {
        // First, map all reports with basic data
        const reportsWithBasicData = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Debug: Log all available fields in the first document
          if (snapshot.docs.indexOf(doc) === 0) {
            console.log('DEBUG - First document fields:', Object.keys(data));
            console.log('DEBUG - First document data:', data);
          }
          
          // Format timestamp to readable date
          let formattedDate = 'N/A';
          if (data.createdAt) {
            try {
              // Handle Firestore Timestamp
              const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
              formattedDate = date.toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit', 
                year: 'numeric' 
              });
            } catch (e) {
              console.warn('Error formatting createdAt date:', e);
              formattedDate = data.date || 'N/A';
            }
          } else if (data.date) {
            formattedDate = data.date;
          }

          return {
            reportId: doc.id,
            userId: data.userId || null,
            customer: null, // Will be fetched from users collection
            contact: data.contact || 'N/A',
            location: data.location || 'N/A',
            description: data.description || 'No description',
            date: formattedDate,
            status: data.status || 'Submitted',
            imageUrls: data.imageUrls || [],
            createdAt: data.createdAt,
            // Keep original data for details page
            ...data
          };
        });

        // Fetch user data for reports that have userId but no customer name
        damageReports = await Promise.all(reportsWithBasicData.map(async (report) => {
          if (!report.customer && report.userId) {
            try {
              console.log(`Fetching user data for userId: ${report.userId}`);
              const userDoc = await db.collection('users').doc(report.userId).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                report.customer = userData.fullName || userData.name || userData.displayName || userData.email || 'Unknown';
                console.log(`Found user data for ${report.userId}: ${report.customer}`);
              } else {
                console.warn(`User document not found for userId: ${report.userId}`);
                report.customer = 'Unknown';
              }
            } catch (err) {
              console.error(`Error fetching user data for userId ${report.userId}:`, err);
              report.customer = 'Unknown';
            }
          } else if (!report.customer) {
            report.customer = 'Unknown';
          }
          return report;
        }));

        console.log('Damage reports loaded from Firestore. Total count:', damageReports.length);
        console.log('Sample report data:', damageReports[0]);
      }
    } catch (error) {
      console.error('Error fetching damage reports from Firestore:', error);
      
      // Provide more detailed error information
      if (error.code === 'permission-denied') {
        console.error('Permission denied. Please check Firestore security rules for the damage_reports collection.');
        const errorMsg = 'Access Denied: Firestore security rules need to be updated to allow reading damage reports.';
        showErrorMessage(errorMsg);
      } else {
        showErrorMessage('Error loading damage reports. Please try again later.');
      }
      
      damageReports = [];
    }
  }

  // Get status badge HTML
  function getStatusBadge(status) {
    const statusColors = {
      'Submitted': 'background: #3498db; color: white;',
      'Under Review': 'background: #f39c12; color: white;',
      'Resolved': 'background: #2ecc71; color: white;',
      'Closed': 'background: #95a5a6; color: white;'
    };
    const style = statusColors[status] || statusColors['Submitted'];
    return `<span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; ${style}">${status || 'Submitted'}</span>`;
  }

  let filteredReports = [];
  let currentPage = 1;
  const itemsPerPage = 20;

  function renderDamageReports() {
    const table = $('#damage-reports-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Get filter value
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    
    // Apply filter
    if (statusFilter === 'all') {
      filteredReports = [...damageReports];
    } else {
      filteredReports = damageReports.filter(rep => rep.status === statusFilter);
    }

    // clear existing rows except the no-results-row template
    tbody.querySelectorAll('tr').forEach(tr => {
      if (!tr.classList.contains('no-results-row')) tr.remove();
    });

    if (filteredReports.length === 0) {
      // Show no results row if it exists
      const noResultsRow = tbody.querySelector('.no-results-row');
      if (noResultsRow) {
        noResultsRow.style.display = '';
        noResultsRow.querySelector('td').textContent = statusFilter === 'all' 
          ? 'No damage reports found.' 
          : `No reports with status "${statusFilter}".`;
      }
      updateTotals(0);
      updatePaginationUI();
      return;
    }

    // Hide no results row
    const noResultsRow = tbody.querySelector('.no-results-row');
    if (noResultsRow) {
      noResultsRow.style.display = 'none';
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredReports.length);
    const pageReports = filteredReports.slice(startIndex, endIndex);

    pageReports.forEach((rep) => {
      const row = document.createElement('tr');
      row.dataset.reportId = rep.reportId;
      
      // Truncate long text for display
      const displayText = rep.description.length > 40 
        ? rep.description.substring(0, 40) + '...' 
        : rep.description;
      
      row.innerHTML = `
        <td><input type="checkbox" class="damage-review-checkbox"></td>
        <td>${rep.customer}</td>
        <td>${rep.contact}</td>
        <td>${rep.location}</td>
        <td class="damage-comment" title="${rep.description}">${displayText}</td>
        <td>${getStatusBadge(rep.status)}</td>
        <td>${rep.date}</td>
        <td class="text-center actions-cell">
          <button type="button" class="action-icon-btn view-btn" title="View Full Details">
            <span class="material-symbols-outlined">visibility</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // update totals and pagination
    updateTotals(filteredReports.length);
    updatePaginationUI();
  }

  function updatePaginationUI() {
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const pageInfo = document.querySelector('#damage-reports-table-container .page-info');
    const prevBtn = document.querySelector('#damage-reports-table-container .pagination-btn[data-action="prev"]');
    const nextBtn = document.querySelector('#damage-reports-table-container .pagination-btn[data-action="next"]');

    if (pageInfo) {
      if (filteredReports.length === 0) {
        pageInfo.textContent = 'No reports';
      } else {
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredReports.length);
        pageInfo.textContent = `Showing ${startIndex}-${endIndex} of ${filteredReports.length}`;
      }
    }

    if (prevBtn) {
      prevBtn.disabled = currentPage === 1;
    }

    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages || filteredReports.length === 0;
    }
  }

  function setupPagination() {
    const prevBtn = document.querySelector('#damage-reports-table-container .pagination-btn[data-action="prev"]');
    const nextBtn = document.querySelector('#damage-reports-table-container .pagination-btn[data-action="next"]');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderDamageReports();
          // Scroll to top of table
          document.getElementById('damage-reports-table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
        if (currentPage < totalPages) {
          currentPage++;
          renderDamageReports();
          // Scroll to top of table
          document.getElementById('damage-reports-table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  // Setup batch actions
  function setupBatchActions() {
    const selectAllCheckbox = $('#select-all-damage-reports');
    const deleteBtn = $('#delete-selected-damage-reports-btn');
    const markReviewedBtn = $('#mark-reviewed-btn');

    // Select all functionality
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = $$('.damage-review-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBatchButtonStates();
      });
    }

    // Update button states when individual checkboxes change
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('damage-review-checkbox')) {
        updateBatchButtonStates();
      }
    });

    // Mark as reviewed
    if (markReviewedBtn) {
      markReviewedBtn.addEventListener('click', async () => {
        const selectedIds = getSelectedReportIds();
        if (selectedIds.length === 0) return;

        const confirmed = confirm(`Mark ${selectedIds.length} report(s) as "Under Review"?`);
        if (!confirmed) return;

        try {
          markReviewedBtn.disabled = true;
          markReviewedBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Updating...';

          await window.firebaseInitPromise;
          const db = window.firebase.firestore();
          const batch = db.batch();

          selectedIds.forEach(id => {
            const ref = db.collection('damage_reports').doc(id);
            batch.update(ref, {
              status: 'Under Review',
              statusUpdatedAt: new Date().toISOString(),
              statusUpdatedBy: window.firebase.auth().currentUser?.email || 'admin'
            });
          });

          await batch.commit();

          // Update local data
          damageReports.forEach(rep => {
            if (selectedIds.includes(rep.reportId)) {
              rep.status = 'Under Review';
            }
          });

          console.log(`✅ ${selectedIds.length} report(s) marked as Under Review`);
          showSuccessToast(`${selectedIds.length} report(s) marked as Under Review`);

          // Refresh display
          renderDamageReports();
          updateBatchButtonStates();
        } catch (error) {
          console.error('❌ Error updating reports:', error);
          alert('Failed to update reports: ' + error.message);
        } finally {
          markReviewedBtn.disabled = false;
          markReviewedBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Mark as Reviewed';
        }
      });
    }

    // Delete selected
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const selectedIds = getSelectedReportIds();
        if (selectedIds.length === 0) return;

        const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} report(s)? This action cannot be undone.`);
        if (!confirmed) return;

        try {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Deleting...';

          await window.firebaseInitPromise;
          const db = window.firebase.firestore();
          const batch = db.batch();

          selectedIds.forEach(id => {
            const ref = db.collection('damage_reports').doc(id);
            batch.delete(ref);
          });

          await batch.commit();

          // Remove from local data
          damageReports = damageReports.filter(rep => !selectedIds.includes(rep.reportId));

          console.log(`✅ ${selectedIds.length} report(s) deleted`);
          showSuccessToast(`${selectedIds.length} report(s) deleted successfully`);

          // Refresh display
          renderDamageReports();
          updateBatchButtonStates();
        } catch (error) {
          console.error('❌ Error deleting reports:', error);
          alert('Failed to delete reports: ' + error.message);
        } finally {
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete Selected';
        }
      });
    }
  }

  function getSelectedReportIds() {
    const checkedBoxes = $$('.damage-review-checkbox:checked');
    return checkedBoxes.map(cb => cb.closest('tr').dataset.reportId).filter(Boolean);
  }

  function updateBatchButtonStates() {
    const selectedIds = getSelectedReportIds();
    const deleteBtn = $('#delete-selected-damage-reports-btn');
    const markReviewedBtn = $('#mark-reviewed-btn');

    if (deleteBtn) deleteBtn.disabled = selectedIds.length === 0;
    if (markReviewedBtn) markReviewedBtn.disabled = selectedIds.length === 0;

    // Update select all checkbox state
    const selectAllCheckbox = $('#select-all-damage-reports');
    const allCheckboxes = $$('.damage-review-checkbox');
    if (selectAllCheckbox && allCheckboxes.length > 0) {
      selectAllCheckbox.checked = allCheckboxes.every(cb => cb.checked);
      selectAllCheckbox.indeterminate = selectedIds.length > 0 && !selectAllCheckbox.checked;
    }
  }

  function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="material-symbols-outlined">check_circle</span>
        <strong>${message}</strong>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Setup status filter
  function setupStatusFilter() {
    const statusFilter = $('#status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        currentPage = 1; // Reset to first page
        renderDamageReports();
      });
    }
  }

  // Setup search functionality
  function setupSearch() {
    const searchInput = $('#damage-report-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        currentPage = 1; // Reset to first page
        
        if (!searchTerm) {
          renderDamageReports();
          return;
        }

        // Get current status filter
        const statusFilter = document.getElementById('status-filter')?.value || 'all';
        
        // Apply search filter
        let searchResults = damageReports.filter(rep => {
          const customer = (rep.customer || '').toLowerCase();
          const contact = (rep.contact || '').toLowerCase();
          const location = (rep.location || '').toLowerCase();
          const description = (rep.description || '').toLowerCase();
          
          return customer.includes(searchTerm) || 
                 contact.includes(searchTerm) || 
                 location.includes(searchTerm) ||
                 description.includes(searchTerm);
        });

        // Also apply status filter if not 'all'
        if (statusFilter !== 'all') {
          searchResults = searchResults.filter(rep => rep.status === statusFilter);
        }

        // Render filtered results
        filteredReports = searchResults;
        const table = $('#damage-reports-table');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Clear existing rows
        tbody.querySelectorAll('tr').forEach(tr => {
          if (!tr.classList.contains('no-results-row')) tr.remove();
        });

        if (filteredReports.length === 0) {
          const noResultsRow = tbody.querySelector('.no-results-row');
          if (noResultsRow) {
            noResultsRow.style.display = '';
            noResultsRow.querySelector('td').textContent = `No reports found matching "${searchTerm}".`;
          }
          updateTotals(0);
          updatePaginationUI();
          return;
        }

        // Hide no results row
        const noResultsRow = tbody.querySelector('.no-results-row');
        if (noResultsRow) {
          noResultsRow.style.display = 'none';
        }

        // Calculate pagination for search results
        const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredReports.length);
        const pageReports = filteredReports.slice(startIndex, endIndex);

        // Render filtered results
        pageReports.forEach((rep) => {
          const row = document.createElement('tr');
          row.dataset.reportId = rep.reportId;
          
          const displayText = rep.description.length > 40 
            ? rep.description.substring(0, 40) + '...' 
            : rep.description;
          
          row.innerHTML = `
            <td><input type="checkbox" class="damage-review-checkbox"></td>
            <td>${rep.customer}</td>
            <td>${rep.contact}</td>
            <td>${rep.location}</td>
            <td class="damage-comment" title="${rep.description}">${displayText}</td>
            <td>${getStatusBadge(rep.status)}</td>
            <td>${rep.date}</td>
            <td class="text-center actions-cell">
              <button type="button" class="action-icon-btn view-btn" title="View Full Details">
                <span class="material-symbols-outlined">visibility</span>
              </button>
            </td>
          `;
          tbody.appendChild(row);
        });

        updateTotals(filteredReports.length);
        updatePaginationUI();
      });
    }
  }

  // Initialize when DOM is ready
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      // Fetch data from Firestore
      await fetchDamageReports();
      
      // Hide loader and render data
      hideLoader();
      renderDamageReports();
      ensureArrowButtons();
      setupArrowHandler();
      observeTableMutations();
      setupBatchActions();
      setupStatusFilter();
      setupSearch();
      setupPagination();
    } catch (error) {
      console.error('Error initializing damage reviews:', error);
      hideLoader();
      updateTotals(0);
    }
  });
})();
