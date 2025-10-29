    // =============================================================================
// PAGE LOAD EVENT LOGGING
// =============================================================================
console.log('=== PAGE LOADED ===');
console.log('Timestamp:', new Date().toLocaleString());
console.log('User Agent:', navigator.userAgent);
console.log('Window Size:', window.innerWidth + 'x' + window.innerHeight);

// =============================================================================
// TAB CHANGE EVENT LOGGING
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('=== DOM READY ===');
  
  // Get initial active tab
  const initialTab = document.querySelector('input[type="radio"][name="tabs"]:checked');
  if (initialTab) {
    console.log('Initial Tab:', initialTab.id);
  }
  
  // Log tab changes
  document.querySelectorAll('input[type="radio"][name="tabs"]').forEach(tab => {
    tab.addEventListener('change', function() {
      if (this.checked) {
        console.log('=== TAB CHANGED ===');
        console.log('Tab ID:', this.id);
        console.log('Tab Name:', this.id.replace('tab-', '').toUpperCase());
        console.log('Timestamp:', new Date().toLocaleTimeString());
      }
    });
  });
});

// =============================================================================
// FORM INPUT EVENT LOGGING
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
  const formInputs = document.querySelectorAll('#contact-form input, #contact-form textarea');
  
  formInputs.forEach(input => {
    input.addEventListener('focus', function() {
      console.log('=== USER INPUT ===');
      console.log('Field Focused:', this.id || this.name);
    });
    
    input.addEventListener('blur', function() {
      console.log('Field Completed:', this.id || this.name);
      console.log('Value Length:', this.value.length, 'characters');
    });
  });
});

// =============================================================================
// FORM SUBMISSION HANDLER WITH LOGGING
// =============================================================================
document.getElementById('contact-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const form = this;
  const formData = new FormData(form);
  const messageDiv = document.getElementById('form-message');
  
  // Log form submission details
  console.log('=== FORM SUBMISSION STARTED ===');
  console.log('Name:', formData.get('name'));
  console.log('Email:', formData.get('email'));
  console.log('Message Length:', formData.get('message').length, 'characters');
  console.log('Timestamp:', new Date().toLocaleString());
  
  // Show loading message
  messageDiv.innerHTML = '<p class="form-message" style="border-color: #666; color: #666;">Sending your message...</p>';
  console.log('Status: Sending to Formspree...');
  
  // Submit to Formspree using fetch
  fetch('https://formspree.io/f/xeopkjyk', {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json'
    }
  })
  .then(response => {
    console.log('=== FORM RESPONSE RECEIVED ===');
    console.log('Status Code:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.ok) {
      // Success - show success message
      messageDiv.innerHTML = 
        '<p class="form-message" style="border-color: #28a745; color: #28a745;">Thank you! Your message has been sent successfully.</p>';
      
      console.log('✅ FORM SUBMISSION SUCCESSFUL');
      console.log('Response Time:', new Date().toLocaleTimeString());
      
      // Clear form
      form.reset();
      console.log('Form cleared');
    } else {
      // Error from Formspree
      return response.json().then(data => {
        console.log('❌ FORM SUBMISSION FAILED');
        console.log('Error Data:', data);
        throw new Error(data.error || 'Form submission failed');
      });
    }
  })
  .catch(error => {
    // Show error message
    messageDiv.innerHTML = 
      '<p class="form-message" style="border-color: #dc3545; color: #dc3545;">Oops! There was a problem sending your message. Please try again.</p>';
    console.error('=== FORM SUBMISSION ERROR ===');
    console.error('Error:', error.message);
    console.error('Full Error:', error);
  })
  .finally(() => {
    // Remove message after 5 seconds
    setTimeout(() => {
      messageDiv.innerHTML = '';
      console.log('Form message cleared');
    }, 5000);
  });
});



// =============================================================================
// IMAGE AND VIDEO CAROUSEL HANDLER WITH LOGGING
// =============================================================================
console.log('=== INITIALIZING CAROUSELS ===');

document.querySelectorAll('.image-carousel').forEach(function(carousel, carouselIndex) {
  const mediaContainer = carousel.querySelector('.media-container');
  const initialImg = mediaContainer.querySelector('img');
  const mediaData = initialImg.getAttribute('data-media');
  
  if (!mediaData) {
    console.log('Carousel', carouselIndex + 1, '- No media data found');
    return;
  }
  
  const mediaItems = JSON.parse(mediaData);
  let idx = 0;
  
  console.log('Carousel', carouselIndex + 1, '- Initialized with', mediaItems.length, 'media items');

  function isVideo(url) {
    return url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video');
  }

  function showMedia(index) {
    const url = mediaItems[index];
    const mediaType = isVideo(url) ? 'VIDEO' : 'IMAGE';
    
    console.log('=== CAROUSEL NAVIGATION ===');
    console.log('Carousel:', carouselIndex + 1);
    console.log('Media Index:', index + 1, 'of', mediaItems.length);
    console.log('Media Type:', mediaType);
    console.log('URL:', url);
    
    // Clear the container
    mediaContainer.innerHTML = '';
    
    if (isVideo(url)) {
      // Create video element
      const video = document.createElement('video');
      video.src = url;
      video.alt = initialImg.alt;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.style.width = '100%';
      video.style.height = 'auto';
      video.style.display = 'block';
      mediaContainer.appendChild(video);
      console.log('Video element created and playing');
    } else {
      // Create image element
      const img = document.createElement('img');
      img.src = url;
      img.alt = initialImg.alt;
      img.setAttribute('data-media', mediaData);
      mediaContainer.appendChild(img);
      console.log('Image element created');
    }
  }

  carousel.querySelector('.arrow.left').onclick = function() {
    console.log('⬅️ Previous button clicked - Carousel', carouselIndex + 1);
    idx = (idx - 1 + mediaItems.length) % mediaItems.length;
    showMedia(idx);
  };
  
  carousel.querySelector('.arrow.right').onclick = function() {
    console.log('➡️ Next button clicked - Carousel', carouselIndex + 1);
    idx = (idx + 1) % mediaItems.length;
    showMedia(idx);
  };
});

console.log('=== ALL CAROUSELS INITIALIZED ===');
