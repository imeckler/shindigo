// User verification functionality
$(document).ready(function() {
  // Show sign in modal when button is clicked
  $('.showVerificationModal').on('click', function() {
    $('#signInModal').modal('show');
  });

  // Handle the first step of sign-in (sending verification code)
  $('#sendVerificationBtn').on('click', function(e) {
    e.preventDefault();
    $('#signInForm').submit();
  });

  $("#signInPhone").on("keypress", function(e) {
      if (e.which == 13) {
          e.preventDefault();
          $('#signInForm').submit();
      }
  });

  $('#signInForm').on('submit', function(e) {
    e.preventDefault();
    const phone = window.signInTel.getNumber();
    
    // Validate inputs
    if (!phone) {
      $('#signInError').text('Phone number is required.').show();
      return;
    }

    // Hide error if previously shown
    $('#signInError').hide();
    $('#sendVerificationBtn').hide();
    $('#loaderButton').show();
    // Send request to initiate verification
    $.ajax({
      url: '/send-verification',
      method: 'POST',
      data: {
        phone: phone
      },
      success: function(response) {
        $('#loaderButton').hide();
        console.log('nice', phone);
        // Show the verification code step
        $('#signInStep1').hide();
        $('#sendVerificationBtn').hide();
        
        $('#verificationPhoneNumber').text(phone);
        window.verificationPhoneNumber = $('#verificationPhoneNumber');
        
        $('#signInStep2').show();
        $('#resendVerificationCode').show();
        $('#submitVerificationCode').show();
      },
      error: function(xhr) {
        $('#loaderButton').hide();
        $('#sendVerificationBtn').show();
        // Show error message
        const errorMessage = xhr.responseJSON?.message || 'Failed to send verification code. Please try again.';
        $('#signInError').text(errorMessage).show();
      }
    });
  });

  $('#submitVerificationCode').on('click', function() {
    $('#verifyCodeForm').submit();
  });

  // Handle submitting the verification code
  $('#verifyCodeForm').on('submit', function(e) {
    e.preventDefault();

    const code = $('#verificationCode').val();
    const phone = window.signInTel.getNumber();

    if (!code) {
      $('#verificationError').text('Please enter the verification code.').show();
      return;
    }

    // Hide error if previously shown
    $('#verificationError').hide();
    $('#submitVerificationCode').hide();
    $('#loaderButton').show();

    // Send verification request
    $.ajax({
      url: '/verify-code',
      method: 'POST',
      data: {
        verificationCode: code,
        phone: phone,
      },
      success: function(response) {
        $('#loaderButton').hide();
        // If new, prompt the user for name
        console.log('verify resp', response);
        console.log('verify respj', response.newUser);
        localStorage.setItem('verified_user_phone', phone);
        localStorage.setItem('phone_verification_token', response.verificationToken);

        if (response.newUser) {
          $('#signInStep2').hide();
          $('#resendVerificationCode').hide();
          $('#submitVerificationCode').hide();

          $('#signInStep3').show();
          $('#setUserInfo').show();
          // step 3 with name and email
        } else {
        // Close the modal
          $('#signInModal').modal('hide');
          // Store verification info in localStorage for client-side use
          if (response.name) localStorage.setItem('verified_user_name', name);
          if (response.email) localStorage.setItem('verified_user_email', email);

          // Reload the page to update the UI with the verified user
          window.location.reload();
        }
      },
      error: function(xhr) {
        $('#loaderButton').hide();
        $('#submitVerificationCode').show();
        // Show error message
        const errorMessage = xhr.responseJSON?.message || 'Verification failed. Please try again.';
        $('#verificationError').text(errorMessage).show();
      }
    });
  });

  // Handle resending the verification code
  $('#resendVerificationCode').on('click', function() {
    const phone = window.signInTel.getNumber();
    
    $.ajax({
      url: '/resend-verification',
      method: 'POST',
      data: {
        phone: phone
      },
      success: function() {
        alert('Verification code sent again!');
      },
      error: function() {
        alert('Failed to resend code. Please try again.');
      }
    });
  });

  $('#setUserInfo').on('click', function() {
    $('#userInfoForm').submit();
  });

  $('#userInfoForm').on('submit', function(e) {
    e.preventDefault();
    const name = $('#userInfoName').val();
    $.ajax({
      url: 'user-info',
      method: 'POST',
      headers: {
        'x-phone-verification': localStorage.getItem('phone_verification_token'),
      },
      data: {
        name,
      },
      success: function(response) {
        localStorage.setItem('verified_user_name', name);
        $('#signInModal').modal('hide');
        window.location.reload();
      },
      error: function(xhr) {
        const errorMessage = xhr.responseJSON?.message || 'Verification failed. Please try again.';
        $('#userInfoError').text(errorMessage).show();
      }
    })
  });

  // Reset modal when closed
  $('#signInModal').on('hidden.bs.modal', function() {
    $('#signInStep1').show();
    $('#sendVerificationBtn').show();
    
    $('#signInStep2').hide();
    $('#resendVerificationCode').hide();
    $('#submitVerificationCode').hide();
    
    $('#signInStep3').hide();
    $('#setUserInfo').hide();

    $('#signInForm')[0].reset();
    $('#verifyCodeForm')[0].reset();
    $('#signInError').hide();
    $('#verificationError').hide();
  });
});
