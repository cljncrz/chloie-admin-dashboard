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
    });
  }

  // --- Form Submission Logic ---
  createPromotionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log('📝 Form submission started');
    // Disable submit button to prevent duplicate submissions
    const submitBtn = createPromotionForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

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
      if (submitBtn) submitBtn.disabled = false;
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
      console.log('💾 Saving to sessionStorage for display...');
      sessionStorage.setItem("newlyCreatedPromotion", JSON.stringify(formData));
      console.log('✅ sessionStorage updated. Redirecting to promotions.html...');
      window.location.href = "promotions.html";
    } catch (error) {
      console.error('❌ Error creating promotion in Firebase:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      alert(`Failed to create promotion: ${error.message}`);
      if (submitBtn) submitBtn.disabled = false;
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
          originalPrices: formData.originalPrices,
          promoPrices: formData.promoPrices,
          publishDate: formData.publishDate,
          expiryDate: formData.expiryDate,
          imageUrl: formData.imageUrl,
          status: 'Draft',
          createdAt: new Date().toISOString()
        });
        console.log('Promotion saved as draft in Firebase:', formData.promoId);
        
        sessionStorage.setItem("newlyCreatedPromotion", JSON.stringify(formData));
        window.location.href = "promotions.html";
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
      imageUrl: imagePreviewImage.src.includes("data:image")
        ? imagePreviewImage.src
        : null,
    };
  }
});