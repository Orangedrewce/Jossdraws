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
