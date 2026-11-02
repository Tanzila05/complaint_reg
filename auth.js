const API_URL = 'http://127.0.0.1:5000/api';

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    // Only run checkAuthStatus if we're not on the login page
    if (!window.location.href.includes('login.html')) {
        checkAuthStatus();
    }
});

async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const response = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            
            if (data.authenticated) {
                updateUIForLoggedInUser(data.user);
            } else {
                clearAuth();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            clearAuth();
        }
    }
}

function updateUIForLoggedInUser(user) {
    // Update navigation or other UI elements to show logged-in state
    const nav = document.querySelector('nav');
    if (nav) {
        // Add user info and logout button
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <span>Welcome, ${user.username}</span>
            <button onclick="logout()" class="btn-secondary btn-small">Logout</button>
        `;
        nav.appendChild(userInfo);
    }
}

function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Login form handling
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                alert('Login successful!');
                window.location.href = 'track.html';
            } else {
                alert('Login failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });
}

// Register form handling
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Registration successful! Please login.');
                showLoginForm();
            } else {
                alert('Registration failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    });
}

function showLoginForm() {
    document.getElementById('loginForm').parentElement.classList.remove('hidden');
    document.getElementById('registerContainer').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('loginForm').parentElement.classList.add('hidden');
    document.getElementById('registerContainer').classList.remove('hidden');
}

async function logout() {
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    clearAuth();
    alert('Logged out successfully');
    window.location.href = 'login.html';
}

// Helper function to get auth headers for API calls
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check auth status and update UI (called from other pages)
function checkAuthStatus() {
    const user = getCurrentUser();
    const loginLink = document.getElementById('loginLink');
    
    if (user) {
        if (loginLink) {
            loginLink.textContent = 'Logout';
            loginLink.onclick = logout;
        }
        
        // Add user info to nav
        const nav = document.querySelector('nav');
        if (nav && !document.querySelector('.user-info')) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <span>Welcome, ${user.username}</span>
            `;
            nav.appendChild(userInfo);
        }
    } else {
        if (loginLink) {
            loginLink.textContent = 'Login';
            loginLink.onclick = null;
        }
    }
}