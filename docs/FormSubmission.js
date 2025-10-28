  // Form submission handler
    document.getElementById('contact-form').addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Show success message
      document.getElementById('form-message').innerHTML = 
        '<p class="form-message">Thank you! Your message has been sent.</p>';
      
      // Clear form
      this.reset();
      
      // Remove message after 5 seconds
      setTimeout(() => {
        document.getElementById('form-message').innerHTML = '';
      }, 5000);
    });


    //https://formspree.io/register<-need to add functionality later


// Image and video carousel handler
document.querySelectorAll('.image-carousel').forEach(function(carousel) {
  const mediaContainer = carousel.querySelector('.media-container');
  const initialImg = mediaContainer.querySelector('img');
  const mediaData = initialImg.getAttribute('data-media');
  
  if (!mediaData) return;
  
  const mediaItems = JSON.parse(mediaData);
  let idx = 0;

  function isVideo(url) {
    return url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video');
  }

  function showMedia(index) {
    const url = mediaItems[index];
    
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
    } else {
      // Create image element
      const img = document.createElement('img');
      img.src = url;
      img.alt = initialImg.alt;
      img.setAttribute('data-media', mediaData);
      mediaContainer.appendChild(img);
    }
  }

  carousel.querySelector('.arrow.left').onclick = function() {
    idx = (idx - 1 + mediaItems.length) % mediaItems.length;
    showMedia(idx);
  };
  
  carousel.querySelector('.arrow.right').onclick = function() {
    idx = (idx + 1) % mediaItems.length;
    showMedia(idx);
  };
});
