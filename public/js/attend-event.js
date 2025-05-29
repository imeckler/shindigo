$(document).ready(function() {
  // Function to show verification modal
  // Handle submit verification code
  
  // Handle resend code
  // Handle the attendEvent form submission
  $('#attendEventForm').on('submit', function(e) {
    console.log('Form submit event fired', e);
    console.log('Default prevented:', e.isDefaultPrevented());
    e.preventDefault();
    console.log('Default prevented after calling preventDefault:', e.isDefaultPrevented());
    
    const form = $(this);
    console.log('Form action:', form.attr('action'));
    console.log('Form method:', form.attr('method'));
    
    const formData = new FormData(form[0]);
    
    // Convert FormData to JSON
    const formJSON = Object.fromEntries(formData.entries());
    console.log('Form data:', formJSON);

    // Set up headers with the verification token if available
    const verificationToken = localStorage.getItem('phone_verification_token');
    const headers = {};
    if (verificationToken) {
      headers['x-phone-verification'] = verificationToken;
    }
    
    // Get the current eventID from the DOM
    const eventID = $('#eventName').attr('data-event-id');
    const ajaxUrl = form.attr('action') || '/attendevent/' + eventID;
    console.log('AJAX URL:', ajaxUrl);
    
    // Submit the form via AJAX
    $.ajax({
      type: 'POST',
      url: ajaxUrl,
      headers,
      data: formJSON,
      success: function(response) {
        console.log('Form submission response:', response);
        
        // Check if verification is required
        if (response.verification) {
          console.log('Verification required:', response.verification);
          const verification = response.verification;
          
          // Show the verification modal
          showPhoneVerificationModal(
            verification.phoneNumber,
            verification.eventID,
            verification.type,
            verification.attendeeID
          );
          
          // Close the attendance modal
          $('#attendModal').modal('hide');
          
          // Add an event listener to prevent closing the verification modal with the escape key or by clicking outside
          $('#verifyPhoneModal').modal({
            backdrop: 'static',
            keyboard: false
          });
        } else {
          // No verification needed, just reload the page
          window.location.reload();
        }
      },
      error: function(xhr) {
        console.error('Error response:', xhr.responseJSON);
        
        // Special handling for creator phone error
        if (xhr.responseJSON?.isCreatorPhone) {
          // This is the event creator trying to attend with the same phone number
          $('#attendModal').modal('hide');
          alert(xhr.responseJSON.error);
          
          // Suggest they use a different phone number
          setTimeout(() => {
            if (confirm('Would you like to try again with a different phone number?')) {
              $('#attendEvent').click();
            }
          }, 500);
        } else {
          // Generic error
          alert('An error occurred: ' + (xhr.responseJSON?.error || 'Please try again'));
        }
      }
    });
    
    // Extra protection to prevent form submission
    return false;
  });
  
  // Handle the clear verification (sign out) button
  $(document).on('click', '#clearVerification', function() {
    console.log('Sign out button clicked');
    
    // Clear the verification token from localStorage
    localStorage.removeItem('phone_verification_token');
    localStorage.removeItem('verified_user_name');
    localStorage.removeItem('verified_user_phone');
    localStorage.removeItem('verified_user_email');
    
    // Clear the verification token cookie by setting its expiry to the past
    document.cookie = "phone_verification=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname + ";";
    document.cookie = "phone_verification=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    
    // Create a temporary form and submit a POST request to server to clear cookies
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/clear-verification';
    document.body.appendChild(form);
    form.submit();
  });
  
  // Handle the unattend event button click (using phone verification token)
  $('#unattendEventBtn').on('click', function() {
    const eventID = $('#eventName').attr('data-event-id');
    
    // Get the verification token from localStorage or cookies
    const verificationToken = localStorage.getItem('phone_verification_token');
    
    console.log('Unattend request with token:', verificationToken);
    
    // Set up headers with the verification token if available
    const headers = {};
    if (verificationToken) {
      headers['X-Phone-Verification'] = verificationToken;
    }
    
    // Send the unattend request
    $.ajax({
      url: `/api/unattend/${eventID}`,
      method: 'DELETE',
      headers: headers,
      success: function(response) {
        console.log('Unattend successful:', response);
        // Reload the page to show the updated attendance
        window.location.reload();
      },
      error: function(xhr, status, error) {
        console.error('Unattend failed:', xhr.responseJSON, status, error);
        
        // Special handling for verification required error
        if (xhr.responseJSON?.requiresVerification) {
          // Need to verify phone number
          $('#unattendModal').modal('hide');
          
          // Get the phone number from an attendee entry form or some other source
          const phoneInput = prompt('Please enter your phone number (including country code) to verify:');
          
          if (phoneInput) {
            alert('We will send a verification code to your phone number. Please enter it when prompted.');
            
            // Find the attendee ID using the phone number (this part would need modification if there's a way to look up the attendee)
            // For this implementation, we'll assume we need to verify a phone without knowing the attendee ID yet
            showPhoneVerificationModal(
              phoneInput,
              eventID,
              'attendee' // Generic attendee type
            );
          }
        } else {
          // Show error in the modal
          const message = xhr.responseJSON?.error || 'Failed to remove you from the event. Please try again.';
          
          // Using Alpine.js to update the message
          const messageData = { error: message };
          const modalEl = document.getElementById('unattendModal');
          
          // Update Alpine data
          if (modalEl && modalEl.__x) {
            modalEl.__x.$data.message = messageData;
          } else {
            // Fallback if Alpine is not working
            alert(message);
          }
        }
      }
    });
  });
});
