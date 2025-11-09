import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc,
  deleteDoc, doc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0iRq9z-KJxjnX_4CpjEZrwvX0hjvPb1w",
  authDomain: "ubify-598fe.firebaseapp.com",
  projectId: "ubify-598fe",
  storageBucket: "ubify-598fe.appspot.com",
  messagingSenderId: "291570754705",
  appId: "1:291570754705:web:c458124db5954b58d34b30"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const propiedadesRef = collection(db, "propiedades");

// Elementos del DOM
const form = document.getElementById('propForm');
const lista = document.getElementById('listaPropiedades');
const loadingSpinner = document.getElementById('loading-spinner');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const filterOperation = document.getElementById('filter-operation');
const filterType = document.getElementById('filter-type');
const filterFeatured = document.getElementById('filter-featured');
const clearFilters = document.getElementById('clear-filters');
const refreshBtn = document.getElementById('refresh-btn');
const totalProperties = document.getElementById('total-properties');
const featuredCount = document.getElementById('featured-count');
const descriptionField = document.getElementById('description');
const currencySelect = document.getElementById('currency');
const priceField = document.getElementById('price');
const modalTitle = document.getElementById('modal-title');
const submitBtnText = document.getElementById('submit-btn-text');
const submitLoading = document.getElementById('submit-loading');

let editandoId = null;
let currentProperties = [];
let featuredPropertiesCount = 0;

// Función de diagnóstico de Firebase
async function testFirebaseConnection() {
  try {
    console.log("Testing Firebase connection...");
    const testQuery = query(propiedadesRef, orderBy('title'));
    const testSnapshot = await getDocs(testQuery);
    console.log("Firebase connection successful. Properties count:", testSnapshot.size);
    return true;
  } catch (error) {
    console.error("Firebase connection failed:", error);
    showError("Error de conexión con Firebase: " + error.message);
    return false;
  }
}

// Inicializar la aplicación
async function init() {
  console.log("Initializing application...");
  if (!form || !lista || !loadingSpinner) {
    console.error("Required DOM elements are missing:", { form, lista, loadingSpinner });
    showError("Error: Elementos del DOM no encontrados.");
    return;
  }
  
  // Probar conexión con Firebase
  const firebaseConnected = await testFirebaseConnection();
  if (!firebaseConnected) {
    return;
  }
  
  setupEventListeners();
  cargarPropiedades();
}

// Configurar event listeners
function setupEventListeners() {
  console.log("Setting up event listeners...");
  document.getElementById('add-property-btn')?.addEventListener('click', openModal);
  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('confirm-ok-btn')?.addEventListener('click', closeModal);
  
  form?.addEventListener('submit', handleFormSubmit);
  
  // Event listener adicional para el botón de submit fuera del formulario
  document.querySelector('button[type="submit"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleFormSubmit(e);
  });
  
  searchBtn?.addEventListener('click', applyFilters);
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilters();
  });
  
  filterOperation?.addEventListener('change', applyFilters);
  filterType?.addEventListener('change', applyFilters);
  filterFeatured?.addEventListener('click', toggleFeaturedFilter);
  clearFilters?.addEventListener('click', resetFilters);
  refreshBtn?.addEventListener('click', cargarPropiedades);
  
  descriptionField?.addEventListener('input', updateCharacterCount);
  currencySelect?.addEventListener('change', updateCurrencySymbol);
  
  // Event listeners para generar ubicación automáticamente
  document.getElementById('street')?.addEventListener('input', updateLocation);
  document.getElementById('streetNumber')?.addEventListener('input', updateLocation);
  document.getElementById('city')?.addEventListener('input', updateLocation);
  document.getElementById('province')?.addEventListener('change', updateLocation);
  
  // Event listeners para carga de imágenes
  setupImageUploadListeners();
}

// Actualizar símbolo de moneda
function updateCurrencySymbol() {
  const symbol = currencySelect.value === 'USD' ? 'US$' : 
                 currencySelect.value === 'EUR' ? '€' : '$';
  const currencySymbol = document.getElementById('currency-symbol');
  if (currencySymbol) {
    currencySymbol.textContent = symbol;
  }
}

// Actualizar ubicación automáticamente
function updateLocation() {
  const street = document.getElementById('street')?.value || '';
  const streetNumber = document.getElementById('streetNumber')?.value || '';
  const city = document.getElementById('city')?.value || '';
  const province = document.getElementById('province')?.value || '';
  
  // Construir ubicación con los campos disponibles
  let fullLocation = '';
  if (street) {
    fullLocation += street;
    if (streetNumber) {
      fullLocation += ` ${streetNumber}`;
    }
  }
  if (city) {
    if (fullLocation) fullLocation += ', ';
    fullLocation += city;
  }
  if (province) {
    if (fullLocation) fullLocation += ', ';
    fullLocation += province;
  }
  
  // Actualizar el campo de ubicación
  const locationField = document.getElementById('location');
  if (locationField && fullLocation) {
    locationField.value = fullLocation;
  }
}

// Actualizar contador de caracteres
function updateCharacterCount() {
  const count = descriptionField.value.length;
  const descCounter = document.getElementById('desc-counter');
  if (descCounter) {
    descCounter.textContent = count;
    
    if (count > 180) {
      descCounter.style.color = '#f59e0b';
    } else {
      descCounter.style.color = '#6b7280';
    }
    
    if (count >= 200) {
      descCounter.style.color = '#dc2626';
    }
  }
}

// Abrir modal
function openModal() {
  console.log("Opening modal...");
  const modal = document.getElementById('add-property-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

// Cerrar modal
function closeModal() {
  console.log("Closing modal...");
  document.getElementById('add-property-modal').style.display = 'none';
  document.getElementById('confirmation-modal').style.display = 'none';
  document.getElementById('delete-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
  limpiarFormulario();
}

// Limpiar formulario
function limpiarFormulario() {
  console.log("Clearing form...");
  if (form) form.reset();
  editandoId = null;
  if (modalTitle) modalTitle.textContent = 'Agregar propiedad';
  if (submitBtnText) submitBtnText.textContent = 'Guardar Propiedad';
  updateCharacterCount();
  updateCurrencySymbol();
}

// Mostrar loading
function showLoading() {
  console.log("Showing loading spinner...");
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (lista) lista.style.display = 'none';
}

// Ocultar loading
function hideLoading() {
  console.log("Hiding loading spinner...");
  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (lista) lista.style.display = 'grid';
}

// Mostrar confirmación
function showConfirmation(message) {
  console.log("Showing confirmation:", message);
  document.getElementById('confirmation-message').textContent = message;
  document.getElementById('confirmation-modal').style.display = 'flex';
  document.getElementById('confirm-ok-btn').focus();
}

// Mostrar error
function showError(message) {
  console.error("Error:", message);
  const errorModal = document.createElement('div');
  errorModal.className = 'modal';
  errorModal.innerHTML = `
    <div class="modal-content small-modal">
      <div class="modal-body">
        <i class="fas fa-exclamation-circle error-icon"></i>
        <h3>Error</h3>
        <p>${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="close-error-btn">Aceptar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(errorModal);
  errorModal.style.display = 'flex';
  
  document.getElementById('close-error-btn').addEventListener('click', () => {
    errorModal.remove();
  });
}

// Cargar propiedades
async function cargarPropiedades() {
  console.log("Loading properties...");
  try {
    showLoading();
    const q = query(propiedadesRef, orderBy('title'));
    const querySnapshot = await getDocs(q);
    console.log("Query snapshot received, size:", querySnapshot.size);
    
    currentProperties = [];
    featuredPropertiesCount = 0;
    
    if (querySnapshot.empty) {
      console.log("No properties found.");
      renderProperties([]);
      hideLoading();
      return;
    }
    
    querySnapshot.forEach(doc => {
      const p = doc.data();
      p.id = doc.id;
      currentProperties.push(p);
      if (p.featured) featuredPropertiesCount++;
    });
    
    console.log("Properties loaded:", currentProperties.length);
    renderProperties(currentProperties);
    updateStats();
    hideLoading();
  } catch (error) {
    console.error("Error loading properties:", error);
    showError("Error al cargar las propiedades: " + error.message);
    hideLoading();
  }
}

// Renderizar propiedades
function renderProperties(properties) {
  console.log("Rendering properties:", properties.length);
  lista.innerHTML = '';
  
  if (properties.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-home empty-icon"></i>
        <h3>No se encontraron propiedades</h3>
        <p>${currentProperties.length === 0 ? 'No hay propiedades disponibles.' : 'No hay propiedades que coincidan con los filtros.'}</p>
      </div>
    `;
    return;
  }
  
  properties.forEach(p => {
    const propertyCard = document.createElement('div');
    propertyCard.className = 'property-card';
    
    const statusClass = p.operation === 'Venta' ? 'sold' : 'rented';
    const statusText = p.operation === 'Venta' ? 'VENTA' : 
                      p.operation === 'Alquiler temporal' ? 'ALQUILER TEMPORAL' : 'ALQUILER';
    
    const mainImage = p.images && p.images.length > 0 ? p.images[0] : 'https://via.placeholder.com/400x300?text=Sin+imagen';
    
    const priceFormatted = `${p.currency || 'ARS'} ${p.price.toLocaleString()}`;
    
    propertyCard.innerHTML = `
      <div class="property-image-container">
        <img src="${mainImage}" alt="${p.title}" class="property-main-image">
        <span class="property-status ${statusClass}">${statusText}</span>
        ${p.featured ? '<span class="property-featured"><i class="fas fa-star"></i> Destacado</span>' : ''}
      </div>
      <div class="property-content">
        <h3 class="property-title">${p.title}</h3>
        <div class="property-price">${priceFormatted}</div>
        <div class="property-location">
          <i class="fas fa-map-marker-alt"></i> ${p.location}
        </div>
        <div class="property-details">
          <span class="property-detail-item">
            <i class="fas fa-ruler-combined"></i> ${p.squareMeters} m²
          </span>
          <span class="property-detail-item">
            <i class="fas fa-bed"></i> ${p.bedrooms} dorm.
          </span>
          <span class="property-detail-item">
            <i class="fas fa-bath"></i> ${p.bathrooms} baños
          </span>
          <span class="property-detail-item">
            <i class="fas fa-building"></i> ${p.type}
          </span>
        </div>
        <div class="property-actions">
          <button class="btn btn-primary btn-sm" data-id="${p.id}" data-property='${JSON.stringify(p)}'>
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-danger btn-sm" data-id="${p.id}">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      </div>
    `;
    
    lista.appendChild(propertyCard);
  });
  
  document.querySelectorAll('.btn-primary[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const property = JSON.parse(btn.getAttribute('data-property'));
      console.log("Editing property:", id);
      editarPropiedad(id, property);
    });
  });
  
  document.querySelectorAll('.btn-danger[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      console.log("Showing delete confirmation for property:", id);
      mostrarConfirmacionEliminacion(id);
    });
  });
}

// Actualizar estadísticas
function updateStats() {
  console.log("Updating stats:", currentProperties.length, featuredPropertiesCount);
  if (totalProperties) {
    totalProperties.textContent = `${currentProperties.length} ${currentProperties.length === 1 ? 'propiedad' : 'propiedades'}`;
  }
  if (featuredCount) {
    featuredCount.textContent = `${featuredPropertiesCount} destacada${featuredPropertiesCount !== 1 ? 's' : ''}`;
  }
}

// Aplicar filtros
function applyFilters() {
  console.log("Applying filters...");
  let filtered = [...currentProperties];
  const searchTerm = searchInput.value.toLowerCase();
  
  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(searchTerm) || 
      p.location.toLowerCase().includes(searchTerm) ||
      (p.description && p.description.toLowerCase().includes(searchTerm)) ||
      (p.owner && p.owner.toLowerCase().includes(searchTerm))
    );
  }
  
  if (filterOperation.value) {
    filtered = filtered.filter(p => p.operation === filterOperation.value);
  }
  
  if (filterType.value) {
    filtered = filtered.filter(p => p.type === filterType.value);
  }
  
  if (filterFeatured.classList.contains('active')) {
    filtered = filtered.filter(p => p.featured);
  }
  
  renderProperties(filtered);
}

// Alternar filtro de destacados
function toggleFeaturedFilter() {
  console.log("Toggling featured filter...");
  filterFeatured.classList.toggle('active');
  
  // Actualizar el texto del botón
  if (filterFeatured.classList.contains('active')) {
    filterFeatured.innerHTML = '<i class="fas fa-star"></i> Mostrar todas';
  } else {
    filterFeatured.innerHTML = '<i class="fas fa-star"></i> Solo destacados';
  }
  
  applyFilters();
}

// Resetear filtros
function resetFilters() {
  console.log("Resetting filters...");
  searchInput.value = '';
  filterOperation.value = '';
  filterType.value = '';
  filterFeatured.classList.remove('active');
  filterFeatured.innerHTML = '<i class="fas fa-star"></i> Solo destacados';
  applyFilters();
}

// Manejar envío del formulario
async function handleFormSubmit(e) {
  e.preventDefault();
  console.log("Submitting form...");
  
  // Validar campos requeridos
  const requiredFields = ['title', 'street', 'city', 'province', 'type', 'operation', 'price', 'currency', 'description', 'detailedDescription', 'squareMeters', 'bedrooms', 'bathrooms', 'owner', 'phone'];
  const missingFields = [];
  
  requiredFields.forEach(fieldName => {
    const field = form[fieldName];
    if (!field || !field.value.trim()) {
      missingFields.push(fieldName);
    }
  });
  
  if (missingFields.length > 0) {
    showError(`Por favor complete los siguientes campos: ${missingFields.join(', ')}`);
    return;
  }
  
  const submitBtn = document.querySelector('button[type="submit"]');
  submitBtnText.style.display = 'none';
  submitLoading.style.display = 'inline-block';
  submitBtn.disabled = true;
  
  // Generar ubicación completa (sin número si no está presente)
  let fullLocation = form.street.value;
  if (form.streetNumber.value.trim()) {
    fullLocation += ` ${form.streetNumber.value}`;
  }
  fullLocation += `, ${form.city.value}, ${form.province.value}`;
  
  // Actualizar el campo de ubicación automáticamente
  form.location.value = fullLocation;
  
  const data = {
    title: form.title.value,
    street: form.street.value,
    streetNumber: form.streetNumber.value,
    city: form.city.value,
    province: form.province.value,
    location: fullLocation,
    mapUrl: form.mapUrl.value || null,
    type: form.type.value,
    operation: form.operation.value,
    price: Number(form.price.value),
    currency: form.currency.value,
    description: form.description.value,
    detailedDescription: form.detailedDescription.value,
    squareMeters: form.squareMeters.value.trim(),
    bedrooms: Number(form.bedrooms.value),
    bathrooms: Number(form.bathrooms.value),
    owner: form.owner.value,
    phone: form.phone.value,
    featured: form.featured.checked,
    slug: form.title.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    images: form.images.value 
      ? form.images.value.split(/[\n,]+/).map(url => url.trim()).filter(url => url)
      : [],
    amenities: form.amenities.value 
      ? form.amenities.value.split(',').map(item => item.trim()).filter(item => item)
      : [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    console.log("Form data:", data);
    
    // Agregar timeout para evitar carga infinita
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: La operación tardó demasiado')), 30000);
    });
    
    const savePromise = (async () => {
      if (editandoId) {
        console.log("Updating property:", editandoId);
        await updateDoc(doc(db, "propiedades", editandoId), data);
        console.log("Property updated successfully");
        showConfirmation("Propiedad actualizada con éxito.");
      } else {
        console.log("Adding new property...");
        const docRef = await addDoc(propiedadesRef, data);
        console.log("Property added successfully with ID:", docRef.id);
        showConfirmation("Propiedad agregada con éxito.");
      }
      
      console.log("Reloading properties...");
      await cargarPropiedades();
      console.log("Properties reloaded");
      
      // Cerrar el modal después de un breve delay
      setTimeout(() => {
        closeModal();
      }, 1000);
    })();
    
    await Promise.race([savePromise, timeoutPromise]);
  } catch (error) {
    console.error("Error saving property:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    showError("Error al guardar la propiedad: " + error.message);
  } finally {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtnText.style.display = 'inline-block';
    submitLoading.style.display = 'none';
    submitBtn.disabled = false;
  }
}

// Editar propiedad
function editarPropiedad(id, p) {
  console.log("Preparing to edit property:", id);
  try {
    editandoId = id;
    if (modalTitle) modalTitle.textContent = 'Editar propiedad';
    if (submitBtnText) submitBtnText.textContent = 'Actualizar Propiedad';
    
    const fieldMap = {
      title: form.title,
      street: form.street,
      streetNumber: form.streetNumber,
      city: form.city,
      province: form.province,
      location: form.location,
      mapUrl: form.mapUrl,
      type: form.type,
      operation: form.operation,
      price: form.price,
      currency: form.currency,
      description: form.description,
      detailedDescription: form.detailedDescription,
      squareMeters: form.squareMeters,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      owner: form.owner,
      phone: form.phone,
      featured: form.featured,
      images: form.images,
      amenities: form.amenities
    };

    for (const [key, field] of Object.entries(fieldMap)) {
      if (p.hasOwnProperty(key) && field) {
        if (key === 'images' && Array.isArray(p[key])) {
          field.value = p[key].join('\n');
        } else if (field.type === 'checkbox') {
          field.checked = p[key];
        } else {
          field.value = p[key] || '';
        }
      }
    }
    
    updateCharacterCount();
    updateCurrencySymbol();
    updateLocation(); // Actualizar la ubicación automáticamente
    openModal();
  } catch (error) {
    console.error("Error preparing edit:", error);
    showError("Error al preparar la edición: " + error.message);
  }
}

// Mostrar confirmación de eliminación
function mostrarConfirmacionEliminacion(id) {
  console.log("Showing delete confirmation for:", id);
  document.getElementById('delete-modal').style.display = 'flex';
  
  const cancelBtn = document.getElementById('delete-cancel-btn');
  const confirmBtn = document.getElementById('delete-confirm-btn');
  
  const closeDeleteModal = () => {
    document.getElementById('delete-modal').style.display = 'none';
  };
  
  cancelBtn.onclick = closeDeleteModal;
  
  confirmBtn.onclick = async () => {
    console.log("Deleting property:", id);
    try {
      await deleteDoc(doc(db, "propiedades", id));
      closeDeleteModal();
      showConfirmation("Propiedad eliminada con éxito.");
      cargarPropiedades();
    } catch (error) {
      console.error("Error deleting property:", error);
      showError("Error al eliminar la propiedad: " + error.message);
      closeDeleteModal();
    }
  };
}

// Configurar event listeners para carga de imágenes
function setupImageUploadListeners() {
  const uploadBtn = document.getElementById('uploadImageBtn');
  const uploadModal = document.getElementById('upload-image-modal');
  const closeUploadBtn = document.getElementById('close-upload-btn');
  const closeUploadModalBtn = document.getElementById('close-upload-modal-btn');
  const uploadArea = document.getElementById('uploadArea');
  const imageInput = document.getElementById('imageInput');
  const addImageBtn = document.getElementById('add-image-btn');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  
  // Abrir modal de carga
  uploadBtn?.addEventListener('click', () => {
    uploadModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    resetUploadModal();
  });
  
  // Cerrar modal de carga
  closeUploadBtn?.addEventListener('click', closeUploadModal);
  closeUploadModalBtn?.addEventListener('click', closeUploadModal);
  
  // Clic en área de carga
  uploadArea?.addEventListener('click', () => {
    imageInput.click();
  });
  
  // Drag and drop
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      imageInput.files = files;
      handleImageUpload();
    }
  });
  
  // Cambio en input de archivo
  imageInput?.addEventListener('change', handleImageUpload);
  
  // Agregar imagen al formulario
  addImageBtn?.addEventListener('click', addImageToForm);
  
  // Copiar URL
  copyUrlBtn?.addEventListener('click', copyImageUrl);
}

// Cerrar modal de carga
function closeUploadModal() {
  document.getElementById('upload-image-modal').style.display = 'none';
  document.body.style.overflow = 'auto';
  resetUploadModal();
}

// Resetear modal de carga
function resetUploadModal() {
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('uploadLoading').classList.add('hidden');
  document.getElementById('uploadResult').classList.add('hidden');
  document.getElementById('add-image-btn').disabled = true;
  document.getElementById('imageInput').value = '';
}

// Manejar carga de imagen
function handleImageUpload() {
  const file = document.getElementById('imageInput').files[0];
  if (!file) return;
  
  // Mostrar preview
  const preview = document.getElementById('uploadPreview');
  const previewImage = document.getElementById('previewImage');
  const reader = new FileReader();
  
  reader.onload = function(e) {
    previewImage.src = e.target.result;
    preview.classList.remove('hidden');
  };
  
  reader.readAsDataURL(file);
  
  // Subir imagen
  uploadImageToImgBB(file);
}

// Subir imagen a ImgBB
async function uploadImageToImgBB(file) {
  const loading = document.getElementById('uploadLoading');
  const result = document.getElementById('uploadResult');
  const addBtn = document.getElementById('add-image-btn');
  
  loading.classList.remove('hidden');
  
  try {
    // Convertir a WebP para optimizar
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(async function(blob) {
        const formData = new FormData();
        formData.append('image', blob, 'imagen.webp');
        
        const response = await fetch('https://api.imgbb.com/1/upload?key=b2fea72412df6a82adf27032257cf86b', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        loading.classList.add('hidden');
        
        if (data.success) {
          const imageUrl = data.data.url;
          document.getElementById('imageUrl').value = imageUrl;
          result.classList.remove('hidden');
          addBtn.disabled = false;
          addBtn.dataset.imageUrl = imageUrl;
        } else {
          showError('Error al subir la imagen: ' + (data.error?.message || 'Error desconocido'));
        }
      }, 'image/webp', 0.8);
    };
    
    img.src = URL.createObjectURL(file);
    
  } catch (error) {
    loading.classList.add('hidden');
    showError('Error al subir la imagen: ' + error.message);
  }
}

// Agregar imagen al formulario
function addImageToForm() {
  const imageUrl = document.getElementById('add-image-btn').dataset.imageUrl;
  const imagesTextarea = document.getElementById('images');
  const imagePreview = document.getElementById('imagePreview');
  
  if (imageUrl) {
    // Agregar URL al textarea
    const currentUrls = imagesTextarea.value.trim();
    const newUrls = currentUrls ? currentUrls + '\n' + imageUrl : imageUrl;
    imagesTextarea.value = newUrls;
    
    // Agregar preview
    addImagePreview(imageUrl);
    
    // Cerrar modal
    closeUploadModal();
    
    // Mostrar mensaje de éxito
    showConfirmation('Imagen agregada al formulario');
  }
}

// Agregar preview de imagen
function addImagePreview(imageUrl) {
  const imagePreview = document.getElementById('imagePreview');
  const previewItem = document.createElement('div');
  previewItem.className = 'preview-item';
  previewItem.innerHTML = `
    <img src="${imageUrl}" alt="Imagen cargada">
    <button class="remove-btn" onclick="removeImagePreview(this, '${imageUrl}')">
      <i class="fas fa-times"></i>
    </button>
  `;
  imagePreview.appendChild(previewItem);
}

// Remover preview de imagen
function removeImagePreview(button, imageUrl) {
  const imagesTextarea = document.getElementById('images');
  const currentUrls = imagesTextarea.value.split('\n').filter(url => url.trim() !== imageUrl);
  imagesTextarea.value = currentUrls.join('\n');
  
  button.parentElement.remove();
}

// Copiar URL de imagen
function copyImageUrl() {
  const imageUrl = document.getElementById('imageUrl').value;
  if (imageUrl) {
    navigator.clipboard.writeText(imageUrl).then(() => {
      showConfirmation('URL copiada al portapapeles');
    }).catch(() => {
      showError('Error al copiar la URL');
    });
  }
}

// Actualizar preview de imágenes cuando cambia el textarea
function updateImagePreview() {
  const imagesTextarea = document.getElementById('images');
  const imagePreview = document.getElementById('imagePreview');
  
  imagesTextarea?.addEventListener('input', function() {
    const urls = this.value.split('\n').filter(url => url.trim());
    imagePreview.innerHTML = '';
    
    urls.forEach(url => {
      if (url.trim()) {
        addImagePreview(url.trim());
      }
    });
  });
}

// Inicializar preview de imágenes
function initImagePreview() {
  updateImagePreview();
  
  // Cargar preview inicial si hay URLs
  const imagesTextarea = document.getElementById('images');
  if (imagesTextarea && imagesTextarea.value.trim()) {
    const urls = imagesTextarea.value.split('\n').filter(url => url.trim());
    urls.forEach(url => {
      if (url.trim()) {
        addImagePreview(url.trim());
      }
    });
  }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded, initializing...");
  init();
  initImagePreview();
});
