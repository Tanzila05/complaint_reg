const API_URL = 'http://127.0.0.1:5000/api';

// Check auth status on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
});

// Get current user from localStorage
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check auth status and update UI
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

// Logout function
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
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    alert('Logged out successfully');
    window.location.href = 'login.html';
}

document.getElementById('complaintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        category: document.getElementById('category').value,
        subject: document.getElementById('subject').value,
        description: document.getElementById('description').value
    };

    try {
        const response = await fetch(`${API_URL}/complaints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('complaintForm').classList.add('hidden');
            document.getElementById('successMessage').classList.remove('hidden');
            document.getElementById('complaintId').textContent = data.id;
        } else {
            alert('Error submitting complaint: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error submitting complaint: ' + error.message);
    }
});

function resetForm() {
    document.getElementById('complaintForm').reset();
    document.getElementById('complaintForm').classList.remove('hidden');
    document.getElementById('successMessage').classList.add('hidden');
}
