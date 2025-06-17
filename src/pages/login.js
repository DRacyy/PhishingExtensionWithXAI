document.addEventListener('DOMContentLoaded', function() {
    // API Configuration - Change this to your Flask API URL
    const API_BASE_URL = 'http://localhost:5000/api';
    
    // DOM Elements - Login Card
    const loginCard = document.getElementById('loginCard');
    const email = document.getElementById('email');
    const password = document.getElementById('password');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const togglePassword = document.getElementById('togglePassword');
    const loginBtn = document.getElementById('loginBtn');
    const registerLink = document.getElementById('registerLink');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const rememberMe = document.getElementById('rememberMe');
    
    // DOM Elements - Register Card
    const registerCard = document.getElementById('registerCard');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const registerEmailError = document.getElementById('registerEmailError');
    const registerPasswordError = document.getElementById('registerPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');
    const agreeTerms = document.getElementById('agreeTerms');
    const termsError = document.getElementById('termsError');
    const registerBtn = document.getElementById('registerBtn');
    const loginLink = document.getElementById('loginLink');
    
    // DOM Elements - Forgot Password Card
    const forgotPasswordCard = document.getElementById('forgotPasswordCard');
    const resetEmail = document.getElementById('resetEmail');
    const resetEmailError = document.getElementById('resetEmailError');
    const resetBtn = document.getElementById('resetBtn');
    const backToLoginLink = document.getElementById('backToLoginLink');
    
    // Check URL parameters to determine which card to show
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'register') {
        // Show register form directly
        showCard(registerCard);
    } else if (mode === 'login') {
        // Show login form directly
        showCard(loginCard);
    } else {
        // Default: check if user is already logged in
        checkAuthStatus();
    }
    
    // Navigation between cards
    registerLink.addEventListener('click', function(e) {
        e.preventDefault();
        showCard(registerCard);
    });
    
    loginLink.addEventListener('click', function(e) {
        e.preventDefault();
        showCard(loginCard);
    });
    
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        showCard(forgotPasswordCard);
    });
    
    backToLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        showCard(loginCard);
    });
    
    // Function to show a card and hide others
    function showCard(cardToShow) {
        // Hide all cards
        loginCard.style.display = 'none';
        registerCard.style.display = 'none';
        forgotPasswordCard.style.display = 'none';
        
        // Show the requested card
        cardToShow.style.display = 'block';
        
        // Clear all forms
        clearForms();
    }
    
    // Clear all forms and error messages
    function clearForms() {
        // Clear login form
        email.value = '';
        password.value = '';
        emailError.textContent = '';
        passwordError.textContent = '';
        
        // Clear register form
        registerEmail.value = '';
        registerPassword.value = '';
        confirmPassword.value = '';
        registerEmailError.textContent = '';
        registerPasswordError.textContent = '';
        confirmPasswordError.textContent = '';
        agreeTerms.checked = false;
        termsError.textContent = '';
        
        // Clear reset password form
        resetEmail.value = '';
        resetEmailError.textContent = '';
    }
    
    // Show/hide password toggle
    togglePassword.addEventListener('click', function() {
        togglePasswordVisibility(password, togglePassword);
    });
    
    toggleRegisterPassword.addEventListener('click', function() {
        togglePasswordVisibility(registerPassword, toggleRegisterPassword);
    });
    
    function togglePasswordVisibility(inputField, toggleButton) {
        const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
        inputField.setAttribute('type', type);
        
        // Update the icon
        const icon = toggleButton.querySelector('i');
        icon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
    }
    
    // Login form submission
    loginBtn.addEventListener('click', function() {
        // Reset error messages
        emailError.textContent = '';
        passwordError.textContent = '';
        
        // Basic validation
        let isValid = true;
        
        if (!email.value.trim()) {
            emailError.textContent = 'Email is required';
            isValid = false;
        } else if (!isValidEmail(email.value.trim())) {
            emailError.textContent = 'Please enter a valid email address';
            isValid = false;
        }
        
        if (!password.value) {
            passwordError.textContent = 'Password is required';
            isValid = false;
        }
        
        if (isValid) {
            // Show loading state
            const originalBtnText = loginBtn.textContent;
            loginBtn.innerHTML = '<span class="loading-spinner"></span>Signing in...';
            loginBtn.disabled = true;
            
            // Send login request to API
            fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.value.trim(),
                    password: password.value
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store auth token in Chrome storage
                    const authData = {
                        token: data.token,
                        userId: data.userId,
                        email: email.value.trim(),
                        expiresAt: data.expiresAt
                    };
                    
                    chrome.storage.local.set({ auth: authData }, function() {
                        // Show success message
                        showToast('Login successful!', 'success');
                        
                        // Redirect to settings page 
                        setTimeout(() => {
                            window.location.href = 'settings.html';
                        }, 1000);
                    });
                } else {
                    // Show error message
                    showToast(data.message || 'Login failed. Please try again.', 'error');
                    loginBtn.innerHTML = originalBtnText;
                    loginBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                showToast('Connection error. Please try again.', 'error');
                loginBtn.innerHTML = originalBtnText;
                loginBtn.disabled = false;
            });
        }
    });
    
    // Register form submission
    registerBtn.addEventListener('click', function() {
        // Reset error messages
        registerEmailError.textContent = '';
        registerPasswordError.textContent = '';
        confirmPasswordError.textContent = '';
        termsError.textContent = '';
        
        // Basic validation
        let isValid = true;
        
        if (!registerEmail.value.trim()) {
            registerEmailError.textContent = 'Email is required';
            isValid = false;
        } else if (!isValidEmail(registerEmail.value.trim())) {
            registerEmailError.textContent = 'Please enter a valid email address';
            isValid = false;
        }
        
        if (!registerPassword.value) {
            registerPasswordError.textContent = 'Password is required';
            isValid = false;
        } else if (registerPassword.value.length < 8) {
            registerPasswordError.textContent = 'Password must be at least 8 characters long';
            isValid = false;
        }
        
        if (!confirmPassword.value) {
            confirmPasswordError.textContent = 'Please confirm your password';
            isValid = false;
        } else if (confirmPassword.value !== registerPassword.value) {
            confirmPasswordError.textContent = 'Passwords do not match';
            isValid = false;
        }
        
        if (!agreeTerms.checked) {
            termsError.textContent = 'You must agree to the terms and conditions';
            isValid = false;
        }
        
        if (isValid) {
            // Show loading state
            const originalBtnText = registerBtn.textContent;
            registerBtn.innerHTML = '<span class="loading-spinner"></span>Creating account...';
            registerBtn.disabled = true;
            
            // Send registration request to API
            fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: registerEmail.value.trim(),
                    password: registerPassword.value
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showToast('Account created successfully!', 'success');
                    
                    // Switch to login view after brief delay
                    setTimeout(() => {
                        showCard(loginCard);
                        email.value = registerEmail.value.trim();
                        showToast('Please sign in with your new account', 'info');
                    }, 1000);
                } else {
                    // Show error message
                    showToast(data.message || 'Registration failed. Please try again.', 'error');
                }
                registerBtn.innerHTML = originalBtnText;
                registerBtn.disabled = false;
            })
            .catch(error => {
                console.error('Registration error:', error);
                showToast('Connection error. Please try again.', 'error');
                registerBtn.innerHTML = originalBtnText;
                registerBtn.disabled = false;
            });
        }
    });
    
    // Reset password form submission
    resetBtn.addEventListener('click', function() {
        // Reset error messages
        resetEmailError.textContent = '';
        
        // Basic validation
        if (!resetEmail.value.trim()) {
            resetEmailError.textContent = 'Email is required';
            return;
        } else if (!isValidEmail(resetEmail.value.trim())) {
            resetEmailError.textContent = 'Please enter a valid email address';
            return;
        }
        
        // Show loading state
        const originalBtnText = resetBtn.textContent;
        resetBtn.innerHTML = '<span class="loading-spinner"></span>Sending...';
        resetBtn.disabled = true;
        
        // Send password reset request to API
        fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: resetEmail.value.trim()
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                showToast('Password reset link sent to your email', 'success');
                
                // Switch to login view after brief delay
                setTimeout(() => {
                    showCard(loginCard);
                }, 2000);
            } else {
                // Show error message
                showToast(data.message || 'Failed to send reset link. Please try again.', 'error');
            }
            resetBtn.innerHTML = originalBtnText;
            resetBtn.disabled = false;
        })
        .catch(error => {
            console.error('Password reset error:', error);
            showToast('Connection error. Please try again.', 'error');
            resetBtn.innerHTML = originalBtnText;
            resetBtn.disabled = false;
        });
    });
    
    // Check if user is already authenticated
    function checkAuthStatus() {
        chrome.storage.local.get(['auth'], function(result) {
            if (result.auth && result.auth.token) {
                // Check if token is not expired
                if (result.auth.expiresAt && result.auth.expiresAt > Date.now()) {
                    // Verify token with the server
                    fetch(`${API_BASE_URL}/auth/verify`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${result.auth.token}`
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.valid) {
                            // User is already logged in, redirect to main page
                            window.location.href = 'popup.html';
                        }
                    })
                    .catch(error => {
                        console.error('Token verification error:', error);
                        // Clear invalid token
                        chrome.storage.local.remove(['auth']);
                    });
                } else {
                    // Token is expired, clear it
                    chrome.storage.local.remove(['auth']);
                }
            }
        });
    }
    
    // Helper functions
    function isValidEmail(email) {
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function showToast(message, type = 'info') {
        // Remove any existing toast first
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            document.body.removeChild(existingToast);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }
});