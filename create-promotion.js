document.addEventListener("DOMContentLoaded", async () => {
  // Wait for Firebase to be initialized
  await window.firebaseInitPromise;
  
  const db = window.firebase.firestore();
  const createPromotionForm = document.getElementById("create-promotion-form");
  if (!createPromotionForm) return;

  // --- Get Form Elements ---
  const titleInput = document.getElementById("promo-title");
  const descriptionInput = document.getElementById("promo-description");
  const serviceChecklist = document.getElementById("service-checklist");
  const imageInput = document.getElementById("promo-image");
  const imagePreview = document.getElementById("image-preview");
  const imagePreviewImage = imagePreview ? imagePreview.querySelector(".image-preview-image") : null;
  const uploadOverlay = imagePreview ? imagePreview.querySelector(".upload-overlay") : null;
  const publishInput = document.getElementById("promo-publish-date");
  const expiryInput = document.getElementById("promo-expiry");
  const saveDraftBtn = document.getElementById("save-draft-btn");

  // Pricing elements
  const vehicleTypeSelect = document.getElementById("pricing-vehicle-type");
  const originalPriceSmallLabel = document.getElementById(
    "original-price-small-label"
  );
  const originalPriceMediumLabel = document.getElementById(
    "original-price-medium-label"
  );
  const originalPriceSmallInput =
    document.getElementById("original-price-small");
  const originalPriceMediumInput = document.getElementById("original-price-medium");
  const promoPriceSmallLabel = document.getElementById(
    "promo-price-small-label"
  );
  const promoPriceMediumLabel = document.getElementById(
    "promo-price-medium-label"
  );
  const promoPriceSmallInput = document.getElementById("promo-price-small");
  const promoPriceMediumInput = document.getElementById("promo-price-medium");

  // --- Populate Service Checklist ---
  const populateServiceChecklist = async () => {
    try {
      // Fetch services from Firebase
      const servicesSnapshot = await db.collection('services').get();
      
      let allServices = [];
      if (!servicesSnapshot.empty) {
        allServices = servicesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            serviceId: doc.id,
            service: data.service || data.serviceName || 'Unknown Service',
            ...data
          };
        });
        console.log('Services fetched from Firebase:', allServices);
      } else {
        // Fallback to appData if Firebase is empty
        allServices = window.appData.services || [];
      }
      
      // Populate Service Checklist
      if (serviceChecklist) {
        serviceChecklist.innerHTML = '';
        allServices.forEach((service) => {
          const itemHtml = `
            <div class="checklist-item">
              <input type="checkbox" id="service-${service.serviceId}" name="services" value="${service.service}">
              <label for="service-${service.serviceId}">${service.service}</label>
            </div>
          `;
          serviceChecklist.insertAdjacentHTML("beforeend", itemHtml);
        });
      }
    } catch (error) {
      console.error('Error fetching services from Firebase:', error);
      // Fallback to appData if there's an error
      const allServices = window.appData.services || [];
      if (serviceChecklist) {
        serviceChecklist.innerHTML = '';
        allServices.forEach((service) => {
          const itemHtml = `
            <div class="checklist-item">
              <input type="checkbox" id="service-${service.serviceId}" name="services" value="${service.service}">
              <label for="service-${service.serviceId}">${service.service}</label>
            </div>
          `;
          serviceChecklist.insertAdjacentHTML("beforeend", itemHtml);
        });
      }
    }
  };

  // Call the function to populate services
  await populateServiceChecklist();

  // --- Image Preview Logic ---
  if (imageInput) {
    imageInput.addEventListener("change", function () {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        if (uploadOverlay) uploadOverlay.style.display = "none";
        imagePreviewImage.style.display = "block";
        reader.addEventListener("load", function () {
          imagePreviewImage.setAttribute("src", this.result);
        });
        reader.readAsDataURL(file);
      }
    });
  }

  // --- Media Manager Integration ---
  const chooseFromMediaBtn = document.getElementById('choose-from-media-btn');
  const mediaModalOverlay = document.getElementById('media-modal-overlay');
  const mediaModalClose = document.getElementById('media-modal-close');
  const mediaGrid = document.getElementById('media-grid');
  const mediaSearch = document.getElementById('media-search');
  const mediaLoader = document.getElementById('media-loader');
  let allMediaItems = [];

  const createMediaCard = (media, index) => {
    const mediaItem = document.createElement('div');
    mediaItem.className = 'media-item';
    mediaItem.dataset.name = (media.name || '').toLowerCase();
    mediaItem.style.cssText = `
      cursor: pointer; 
      border: 3px solid var(--color-border); 
      border-radius: 12px; 
      overflow: hidden; 
      transition: all 0.3s ease;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      position: relative;
    `;
    
    const formatDate = (timestamp) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    mediaItem.innerHTML = `
      <div style="position: relative; overflow: hidden; background: var(--color-light);">
        <img src="${media.url}" alt="${media.name || 'Media'}" style="width: 100%; height: 180px; object-fit: cover; transition: transform 0.3s;" />
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7)); opacity: 0; transition: opacity 0.3s;" class="media-overlay"></div>
        <div style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: var(--color-primary); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; opacity: 0; transition: opacity 0.3s;" class="select-badge">
          <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle;">check_circle</span>
          Select
        </div>
      </div>
      <div style="padding: 0.75rem;">
        <div style="font-weight: 500; font-size: 0.9rem; color: var(--color-dark); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${media.name || 'Untitled'}">${media.name || 'Untitled'}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--color-dark-variant);">
          <span>${formatDate(media.uploadedAt)}</span>
          ${media.category ? `<span style="background: var(--color-info-light); padding: 0.125rem 0.5rem; border-radius: 12px;">${media.category}</span>` : ''}
        </div>
      </div>
    `;

    // Hover effects
    mediaItem.addEventListener('mouseenter', () => {
      mediaItem.style.borderColor = 'var(--color-primary)';
      mediaItem.style.transform = 'translateY(-4px)';
      mediaItem.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
      const img = mediaItem.querySelector('img');
      if (img) img.style.transform = 'scale(1.1)';
      const overlay = mediaItem.querySelector('.media-overlay');
      if (overlay) overlay.style.opacity = '1';
      const badge = mediaItem.querySelector('.select-badge');
      if (badge) badge.style.opacity = '1';
    });

    mediaItem.addEventListener('mouseleave', () => {
      mediaItem.style.borderColor = 'var(--color-border)';
      mediaItem.style.transform = 'translateY(0)';
      mediaItem.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      const img = mediaItem.querySelector('img');
      if (img) img.style.transform = 'scale(1)';
      const overlay = mediaItem.querySelector('.media-overlay');
      if (overlay) overlay.style.opacity = '0';
      const badge = mediaItem.querySelector('.select-badge');
      if (badge) badge.style.opacity = '0';
    });

    // Click to select
    mediaItem.addEventListener('click', () => {
      imagePreviewImage.src = media.url;
      imagePreviewImage.style.display = 'block';
      if (uploadOverlay) uploadOverlay.style.display = 'none';
      mediaModalOverlay.style.display = 'none';
      
      if (typeof showSuccessToast === 'function') {
        showSuccessToast('Banner image selected!');
      }
    });

    return mediaItem;
  };

  const loadMediaFromFirebase = async () => {
    try {
      mediaLoader.style.display = 'block';
      mediaGrid.innerHTML = '';
      
      const mediaSnapshot = await db.collection('media').orderBy('uploadedAt', 'desc').get();
      
      mediaLoader.style.display = 'none';

      if (mediaSnapshot.empty) {
        mediaGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <span class="material-symbols-outlined" style="font-size: 4rem; color: var(--color-dark-variant); opacity: 0.5;">image_not_supported</span>
            <p style="color: var(--color-dark-variant); margin-top: 1rem; font-size: 1.1rem;">No media found</p>
            <p style="color: var(--color-dark-variant); font-size: 0.9rem;">Upload images in the Media Manager first</p>
          </div>
        `;
        return;
      }

      allMediaItems = mediaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      allMediaItems.forEach((media, index) => {
        const mediaCard = createMediaCard(media, index);
        mediaGrid.appendChild(mediaCard);
      });

      console.log(`Loaded ${allMediaItems.length} media items`);
    } catch (error) {
      console.error('Error loading media:', error);
      mediaLoader.style.display = 'none';
      mediaGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
          <span class="material-symbols-outlined" style="font-size: 4rem; color: var(--color-danger); opacity: 0.5;">error</span>
          <p style="color: var(--color-danger); margin-top: 1rem; font-size: 1.1rem;">Error loading media</p>
          <p style="color: var(--color-dark-variant); font-size: 0.9rem;">Please try again later</p>
        </div>
      `;
    }
  };

  // Search functionality
  if (mediaSearch) {
    mediaSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const mediaItems = mediaGrid.querySelectorAll('.media-item');
      
      let visibleCount = 0;
      mediaItems.forEach(item => {
        const name = item.dataset.name || '';
        if (name.includes(searchTerm)) {
          item.style.display = 'block';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });

      // Show no results message
      const existingNoResults = mediaGrid.querySelector('.no-results-message');
      if (existingNoResults) existingNoResults.remove();

      if (visibleCount === 0 && searchTerm) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results-message';
        noResults.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 2rem;';
        noResults.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--color-dark-variant); opacity: 0.5;">search_off</span>
          <p style="color: var(--color-dark-variant); margin-top: 1rem;">No results found for "${searchTerm}"</p>
        `;
        mediaGrid.appendChild(noResults);
      }
    });
  }

  if (chooseFromMediaBtn) {
    chooseFromMediaBtn.addEventListener('click', async () => {
      mediaModalOverlay.style.display = 'flex';
      if (mediaSearch) mediaSearch.value = '';
      await loadMediaFromFirebase();
    });
  }

  if (mediaModalClose) {
    mediaModalClose.addEventListener('click', () => {
      mediaModalOverlay.style.display = 'none';
    });
    
    // Hover effect for close button
    mediaModalClose.addEventListener('mouseenter', () => {
      mediaModalClose.style.background = 'rgba(255,255,255,0.3)';
      mediaModalClose.style.transform = 'scale(1.1)';
    });
    mediaModalClose.addEventListener('mouseleave', () => {
      mediaModalClose.style.background = 'rgba(255,255,255,0.2)';
      mediaModalClose.style.transform = 'scale(1)';
    });
  }

  if (mediaModalOverlay) {
    mediaModalOverlay.addEventListener('click', (e) => {
      if (e.target === mediaModalOverlay) {
        mediaModalOverlay.style.display = 'none';
      }
    });
  }

  // --- Dynamic Pricing Label Logic ---
  if (vehicleTypeSelect) {
    vehicleTypeSelect.addEventListener("change", () => {
      const selectedType = vehicleTypeSelect.value;

      if (selectedType === "motorcycle") {
        originalPriceSmallLabel.textContent = "399cc below";
        originalPriceMediumLabel.textContent = "400cc above";
        promoPriceSmallLabel.textContent = "399cc below";
        promoPriceMediumLabel.textContent = "400cc above";
      } else {
        // Default to car labels
        originalPriceSmallLabel.textContent = "5-Seater";
        originalPriceMediumLabel.textContent = "7-Seater";
        promoPriceSmallLabel.textContent = "5-Seater";
        promoPriceMediumLabel.textContent = "7-Seater";
      }
      // Clear inputs when type changes to avoid confusion
      originalPriceSmallInput.value = "";
      originalPriceMediumInput.value = "";
      promoPriceSmallInput.value = "";
      promoPriceMediumInput.value = "";
      calculatePromoPrices();
    });
  }

  // --- Discount Percentage Calculator ---
  const discountInput = document.getElementById('discount-percentage');
  const discountSmallInfo = document.getElementById('discount-small');
  const discountMediumInfo = document.getElementById('discount-medium');

  const calculatePromoPrices = () => {
    const discount = parseFloat(discountInput.value) || 0;
    const originalSmall = parseFloat(originalPriceSmallInput.value) || 0;
    const originalMedium = parseFloat(originalPriceMediumInput.value) || 0;

    if (discount > 0 && discount <= 100) {
      // Calculate promotional prices
      const promoSmall = originalSmall - (originalSmall * discount / 100);
      const promoMedium = originalMedium - (originalMedium * discount / 100);

      promoPriceSmallInput.value = promoSmall.toFixed(2);
      promoPriceMediumInput.value = promoMedium.toFixed(2);

      // Show discount info
      if (originalSmall > 0) {
        discountSmallInfo.textContent = `Save ₱${(originalSmall - promoSmall).toFixed(2)} (${discount}% off)`;
        discountSmallInfo.style.display = 'block';
      }
      if (originalMedium > 0) {
        discountMediumInfo.textContent = `Save ₱${(originalMedium - promoMedium).toFixed(2)} (${discount}% off)`;
        discountMediumInfo.style.display = 'block';
      }
    } else {
      promoPriceSmallInput.value = '';
      promoPriceMediumInput.value = '';
      discountSmallInfo.style.display = 'none';
      discountMediumInfo.style.display = 'none';
    }
  };

  // Add event listeners for automatic calculation
  if (discountInput) {
    discountInput.addEventListener('input', calculatePromoPrices);
  }
  if (originalPriceSmallInput) {
    originalPriceSmallInput.addEventListener('input', calculatePromoPrices);
  }
  if (originalPriceMediumInput) {
    originalPriceMediumInput.addEventListener('input', calculatePromoPrices);
  }

  // --- Preview Promotion ---
  const previewBtn = document.getElementById('preview-promotion-btn');
  const previewModalOverlay = document.getElementById('preview-modal-overlay');
  const previewModalClose = document.getElementById('preview-modal-close');
  const previewCloseBtn = document.getElementById('preview-close-btn');
  const previewPublishBtn = document.getElementById('preview-publish-btn');
  const promotionPreview = document.getElementById('promotion-preview');

  const generatePreview = () => {
    const formData = getFormData();
    
    const publishDate = new Date(formData.publishDate);
    const expiryDate = new Date(formData.expiryDate);
    const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const servicesHTML = formData.services.length > 0 
      ? `<ul style="margin: 0; padding-left: 1.5rem;">${formData.services.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '<p class="text-muted">No services selected</p>';

    const vehicleTypeLabel = formData.vehicleType === 'motorcycle' ? 'Motorcycle' : 'Car';
    const smallLabel = formData.vehicleType === 'motorcycle' ? '399cc below' : '5-Seater';
    const mediumLabel = formData.vehicleType === 'motorcycle' ? '400cc above' : '7-Seater';

    promotionPreview.innerHTML = `
      <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        ${formData.imageUrl ? `<img src="${formData.imageUrl}" alt="${formData.title}" style="width: 100%; height: 200px; object-fit: cover;" />` : '<div style="width: 100%; height: 200px; background: var(--color-light); display: flex; align-items: center; justify-content: center; color: var(--color-dark-variant);">No banner image</div>'}
        <div style="padding: 1.5rem; background: var(--color-white);">
          <h2 style="margin: 0 0 0.5rem 0; color: var(--color-dark);">${formData.title || 'Untitled Promotion'}</h2>
          <p style="color: var(--color-dark-variant); margin-bottom: 1rem;">${formData.description || 'No description provided'}</p>
          
          <div style="background: var(--color-light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: var(--color-dark);">Included Services</h4>
            ${servicesHTML}
          </div>

          <div style="background: var(--color-success-light); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 1rem 0; color: var(--color-dark);">Pricing (${vehicleTypeLabel})</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <strong>${smallLabel}</strong><br>
                <span style="text-decoration: line-through; color: var(--color-dark-variant); font-size: 0.9rem;">₱${formData.originalPrices.small || 0}</span>
                <span style="color: var(--color-success); font-weight: 600; font-size: 1.2rem; margin-left: 0.5rem;">₱${formData.promoPrices.small || 0}</span>
              </div>
              <div>
                <strong>${mediumLabel}</strong><br>
                <span style="text-decoration: line-through; color: var(--color-dark-variant); font-size: 0.9rem;">₱${formData.originalPrices.medium || 0}</span>
                <span style="color: var(--color-success); font-weight: 600; font-size: 1.2rem; margin-left: 0.5rem;">₱${formData.promoPrices.medium || 0}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--color-dark-variant);">
            <div><strong>Valid From:</strong> ${formatDate(publishDate)}</div>
            <div><strong>Valid Until:</strong> ${formatDate(expiryDate)}</div>
          </div>
        </div>
      </div>
    `;
  };

  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      generatePreview();
      previewModalOverlay.style.display = 'flex';
    });
  }

  if (previewModalClose || previewCloseBtn) {
    [previewModalClose, previewCloseBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          previewModalOverlay.style.display = 'none';
        });
      }
    });
  }

  if (previewPublishBtn) {
    previewPublishBtn.addEventListener('click', () => {
      previewModalOverlay.style.display = 'none';
      createPromotionForm.dispatchEvent(new Event('submit'));
    });
  }

  if (previewModalOverlay) {
    previewModalOverlay.addEventListener('click', (e) => {
      if (e.target === previewModalOverlay) {
        previewModalOverlay.style.display = 'none';
      }
    });
  }

  // --- Form Submission Logic ---
  createPromotionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log('📝 Form submission started');
    
    const formData = getFormData();
    console.log('📊 Form data collected:', formData);
    
    formData.status = "Active"; // Or determine based on publish date

    // Determine status based on publish date
    const now = new Date();
    const publishDate = new Date(formData.publishDate);
    const expiryDate = new Date(formData.expiryDate);
    now.setHours(0, 0, 0, 0);

    if (publishDate > now) formData.status = 'Scheduled';
    else if (expiryDate < now) formData.status = 'Expired';
    else formData.status = 'Active';

    console.log("✅ Publishing Promotion:", formData);

    // Validate required fields
    if (!formData.title || !formData.promoId) {
      console.error('❌ Missing required fields:', { title: formData.title, promoId: formData.promoId });
      alert('Please fill in all required fields (Title, etc.)');
      return;
    }

    // Save to Firebase
    try {
      console.log(`🔄 Saving promotion ${formData.promoId} to Firebase...`);
      
      const docData = {
        title: formData.title,
        description: formData.description,
        services: formData.services,
        vehicleType: formData.vehicleType,
        discountPercentage: formData.discountPercentage,
        originalPrices: formData.originalPrices,
        promoPrices: formData.promoPrices,
        publishDate: formData.publishDate,
        expiryDate: formData.expiryDate,
        imageUrl: formData.imageUrl,
        status: formData.status,
        createdAt: new Date().toISOString()
      };
      
      console.log('📄 Document data to save:', docData);
      
      await db.collection('promotions').doc(formData.promoId).set(docData);
      console.log('✅ Promotion created in Firebase:', formData.promoId);
      console.log('✅ Redirecting to promotions.html...');
      
      if (typeof showSuccessToast === 'function') {
        showSuccessToast('Promotion published successfully!');
      }
      
      setTimeout(() => {
        window.location.href = "promotions.html";
      }, 500);
    } catch (error) {
      console.error('❌ Error creating promotion in Firebase:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      alert(`Failed to create promotion: ${error.message}`);
    }
  });

  // --- Save as Draft Logic ---
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", async () => {
      const formData = getFormData();
      formData.status = "Draft";

      console.log("Saving Draft:", formData);

      // Save to Firebase
      try {
        await db.collection('promotions').doc(formData.promoId).set({
          title: formData.title,
          description: formData.description,
          services: formData.services,
          vehicleType: formData.vehicleType,
          discountPercentage: formData.discountPercentage,
          originalPrices: formData.originalPrices,
          promoPrices: formData.promoPrices,
          publishDate: formData.publishDate,
          expiryDate: formData.expiryDate,
          imageUrl: formData.imageUrl,
          status: 'Draft',
          createdAt: new Date().toISOString()
        });
        console.log('Promotion saved as draft in Firebase:', formData.promoId);
        
        if (typeof showSuccessToast === 'function') {
          showSuccessToast('Promotion saved as draft!');
        }
        
        setTimeout(() => {
          window.location.href = "promotions.html";
        }, 500);
      } catch (error) {
        console.error('Error saving draft promotion in Firebase:', error);
        alert('Failed to save draft. Please try again.');
      }
    });
  }

  // --- Helper to get form data ---
  function getFormData() {
    const selectedServices = Array.from(
      serviceChecklist.querySelectorAll('input[type="checkbox"]:checked')
    ).map((input) => input.value);

    const promoId = `PROMO-${Date.now().toString().slice(-6)}`;
    console.log('🆔 Generated Promo ID:', promoId);
    console.log('📌 Selected Services:', selectedServices);
    console.log('📅 Publish Date:', publishInput.value);
    console.log('📅 Expiry Date:', expiryInput.value);

    return {
      promoId: promoId,
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      services: selectedServices,
      vehicleType: vehicleTypeSelect.value,
      discountPercentage: parseFloat(discountInput.value) || null,
      originalPrices: {
        small: parseFloat(originalPriceSmallInput.value) || null,
        medium: parseFloat(originalPriceMediumInput.value) || null,
      },
      promoPrices: {
        small: parseFloat(promoPriceSmallInput.value) || null,
        medium: parseFloat(promoPriceMediumInput.value) || null,
      },
      publishDate: publishInput.value
        ? new Date(publishInput.value).toISOString()
        : null,
      expiryDate: expiryInput.value
        ? new Date(expiryInput.value).toISOString()
        : null,
      imageUrl: imagePreviewImage.src && (imagePreviewImage.src.includes("data:image") || imagePreviewImage.src.includes("http"))
        ? imagePreviewImage.src
        : null,
    };
  }
});