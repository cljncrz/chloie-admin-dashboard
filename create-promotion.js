document.addEventListener("DOMContentLoaded", () => {
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
  const allServices = window.appData.services || [];
  if (serviceChecklist) {
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
  createPromotionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    // This is where you would handle the form submission,
    // gathering all the data and saving it.
    const formData = getFormData();
    formData.status = "Active"; // Or determine based on publish date

    // For demonstration: log data and redirect
    console.log("Publishing Promotion:", formData);
    sessionStorage.setItem("newlyCreatedPromotion", JSON.stringify(formData));
    window.location.href = "promotions.html";
  });

  // --- Save as Draft Logic ---
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", () => {
      const formData = getFormData();
      formData.status = "Draft";

      // For demonstration: log data and redirect
      console.log("Saving Draft:", formData);
      sessionStorage.setItem("newlyCreatedPromotion", JSON.stringify(formData));
      window.location.href = "promotions.html";
    });
  }

  // --- Helper to get form data ---
  function getFormData() {
    const selectedServices = Array.from(
      serviceChecklist.querySelectorAll('input[type="checkbox"]:checked')
    ).map((input) => input.value);

    return {
      promoId: `PROMO-${Date.now().toString().slice(-6)}`,
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