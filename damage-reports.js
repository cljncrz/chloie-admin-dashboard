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
            console.log('DEBUG - Contact field check:', {
              contact: data.contact,
              contactNo: data.contactNo,
              contactNumber: data.contactNumber,
              phone: data.phone,
              phoneNumber: data.phoneNumber
            });
            console.log('DEBUG - userId field:', data.userId);
          }
          
          // Format timestamp to readable date if it exists
          let formattedDate = 'N/A';
          if (data.timestamp) {
            try {
              // Handle Firestore Timestamp
              const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
              formattedDate = date.toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit', 
                year: 'numeric' 
              });
            } catch (e) {
              console.warn('Error formatting date:', e);
              formattedDate = data.date || 'N/A';
            }
          } else if (data.date) {
            formattedDate = data.date;
          }

          return {
            reportId: doc.id,
            userId: data.userId || null,
            customer: data.customerName || data.customer || data.name || data.fullName || null,
            contactNo: data.contact || data.contactNo || data.contactNumber || data.phone || data.phoneNumber || 'N/A',
            location: data.location || data.address || 'N/A',
            reportText: data.damageReport || data.reportText || data.description || data.report || 'No description',
            date: formattedDate,
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

  function renderDamageReports() {
    const table = $('#damage-reports-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // clear existing rows except the no-results-row template
    tbody.querySelectorAll('tr').forEach(tr => {
      if (!tr.classList.contains('no-results-row')) tr.remove();
    });

    if (damageReports.length === 0) {
      // Show no results row if it exists
      const noResultsRow = tbody.querySelector('.no-results-row');
      if (noResultsRow) {
        noResultsRow.style.display = '';
      }
      updateTotals(0);
      return;
    }

    // Hide no results row
    const noResultsRow = tbody.querySelector('.no-results-row');
    if (noResultsRow) {
      noResultsRow.style.display = 'none';
    }

    damageReports.forEach((rep) => {
      const row = document.createElement('tr');
      row.dataset.reportId = rep.reportId;
      
      // Truncate long text for display
      const displayText = rep.reportText.length > 50 
        ? rep.reportText.substring(0, 50) + '...' 
        : rep.reportText;
      
      row.innerHTML = `
        <td><input type="checkbox" class="damage-review-checkbox"></td>
        <td>${rep.customer}</td>
        <td>${rep.contactNo}</td>
        <td>${rep.location}</td>
        <td class="damage-comment" title="${rep.reportText}">${displayText}</td>
        <td>${rep.date}</td>
        <td class="text-center actions-cell">
          <button type="button" class="action-icon-btn view-btn" title="View Full Details">
            <span class="material-symbols-outlined">visibility</span>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // update totals
    updateTotals(damageReports.length);
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
    } catch (error) {
      console.error('Error initializing damage reviews:', error);
      hideLoader();
      updateTotals(0);
    }
  });
})();
