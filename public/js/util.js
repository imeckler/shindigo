const getStoredToken = function (eventID) {
    try {
        let editTokens = JSON.parse(localStorage.getItem("editTokens"));
        return editTokens[eventID];
    } catch (e) {
        localStorage.setItem("editTokens", JSON.stringify({}));
        return false;
    }
};

const addStoredToken = function (eventID, token) {
    try {
        let editTokens = JSON.parse(localStorage.getItem("editTokens"));
        editTokens[eventID] = token;
        localStorage.setItem("editTokens", JSON.stringify(editTokens));
    } catch (e) {
        localStorage.setItem(
            "editTokens",
            JSON.stringify({ [eventID]: token }),
        );
        return false;
    }
};

const removeStoredToken = function (eventID) {
    try {
        let editTokens = JSON.parse(localStorage.getItem("editTokens"));
        delete editTokens[eventID];
        localStorage.setItem("editTokens", JSON.stringify(editTokens));
    } catch (e) {
        localStorage.setItem("editTokens", JSON.stringify({}));
        return false;
    }
};

// Get the phone verification token from localStorage
const getPhoneVerificationToken = function() {
    return localStorage.getItem('phone_verification_token');
};

// Add the phone verification token to AJAX requests
$(document).ajaxSend(function(event, jqxhr, settings) {
    // If there's a phone verification token, add it as a header
    const token = getPhoneVerificationToken();
    if (token) {
        jqxhr.setRequestHeader('X-Phone-Verification', token);
    }
});

const unexpectedError = [
    { message: "An unexpected error has occurred. Please try again later." },
];
