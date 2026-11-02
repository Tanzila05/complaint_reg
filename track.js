const API_URL = 'http://127.0.0.1:5000/api';
let currentComplaintId = null;

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

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

// Load stats and complaints on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    loadStats();
    loadComplaints();
});

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/complaints/stats`);
        const stats = await response.json();

        document.getElementById('totalComplaints').textContent = stats.total;
        document.getElementById('pendingComplaints').textContent = stats.pending;
        document.getElementById('inProgressComplaints').textContent = stats.in_progress;
        document.getElementById('resolvedComplaints').textContent = stats.resolved;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadComplaints() {
    try {
        const response = await fetch(`${API_URL}/complaints`);
        const complaints = await response.json();
        displayComplaints(complaints);
    } catch (error) {
        console.error('Error loading complaints:', error);
    }
}

function displayComplaints(complaints) {
    const container = document.getElementById('complaintsList');
    
    if (complaints.length === 0) {
        container.innerHTML = '<p class="no-data">No complaints found</p>';
        return;
    }

    container.innerHTML = complaints.map(complaint => `
        <div class="complaint-card ${complaint.status.toLowerCase().replace(' ', '-')}" onclick="openModal('${complaint.id}')">
            <h3>${escapeHtml(complaint.subject)}</h3>
            <p><strong>Name:</strong> ${escapeHtml(complaint.name)}</p>
            <p><strong>Category:</strong> ${escapeHtml(complaint.category)}</p>
            <div class="meta">
                <span>ID: ${complaint.id.substring(0, 8)}...</span>
                <span><span class="status-badge ${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span></span>
                <span>${complaint.created_at}</span>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function searchComplaints() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    try {
        const response = await fetch(`${API_URL}/complaints`);
        const complaints = await response.json();
        
        const filtered = complaints.filter(c => 
            c.id.toLowerCase().includes(searchTerm) ||
            c.name.toLowerCase().includes(searchTerm) ||
            c.subject.toLowerCase().includes(searchTerm) ||
            c.email.toLowerCase().includes(searchTerm)
        );
        
        displayComplaints(filtered);
    } catch (error) {
        console.error('Error searching complaints:', error);
    }
}

async function openModal(complaintId) {
    console.log('openModal called with complaintId:', complaintId);
    currentComplaintId = complaintId;
    console.log('currentComplaintId set to:', currentComplaintId);
    
    try {
        const response = await fetch(`${API_URL}/complaints/${complaintId}`);
        const complaint = await response.json();
        console.log('Complaint data loaded:', complaint);

        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <p><strong>ID:</strong> ${complaint.id}</p>
            <p><strong>Name:</strong> ${escapeHtml(complaint.name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(complaint.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(complaint.phone || 'N/A')}</p>
            <p><strong>Category:</strong> ${escapeHtml(complaint.category)}</p>
            <p><strong>Subject:</strong> ${escapeHtml(complaint.subject)}</p>
            <p><strong>Description:</strong> ${escapeHtml(complaint.description)}</p>
            <p><strong>Status:</strong> <span class="status-badge ${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span></p>
            <p><strong>Submitted:</strong> ${complaint.created_at}</p>
            <p><strong>Last Updated:</strong> ${complaint.updated_at}</p>
        `;

        document.getElementById('statusUpdate').value = complaint.status;
        document.getElementById('complaintModal').classList.remove('hidden');
        console.log('Modal opened successfully');
    } catch (error) {
        console.error('Error loading complaint details:', error);
        alert('Error loading complaint details');
    }
}

function closeModal() {
    console.log('Closing modal');
    document.getElementById('complaintModal').classList.add('hidden');
    currentComplaintId = null;
    console.log('Modal closed, currentComplaintId reset');
}

// Close modal when clicking outside the modal content
document.addEventListener('click', (e) => {
    const modal = document.getElementById('complaintModal');
    if (e.target === modal) {
        closeModal();
    }
});

async function updateComplaintStatus() {
    console.log('updateComplaintStatus called');
    console.log('currentComplaintId:', currentComplaintId);
    
    if (!currentComplaintId) {
        console.error('No complaint ID set');
        alert('No complaint selected');
        return;
    }

    const newStatus = document.getElementById('statusUpdate').value;
    console.log('New status:', newStatus);

    // Check if user is authenticated
    if (!isAuthenticated()) {
        alert('Please login to update complaint status');
        window.location.href = 'login.html';
        return;
    }

    try {
        console.log('Sending PUT request to:', `${API_URL}/complaints/${currentComplaintId}`);
        const response = await fetch(`${API_URL}/complaints/${currentComplaintId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
            closeModal();
            loadStats();
            loadComplaints();
            alert('Complaint status updated successfully!');
        } else {
            console.error('Error response:', data);
            alert('Error updating complaint status: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating complaint:', error);
        alert('Error updating complaint status: ' + error.message);
    }
}

async function exportToExcel() {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        alert('Please login to export complaints');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/complaints/export`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'complaints_export.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const data = await response.json();
            alert('Error exporting: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Error exporting to Excel');
    }
}

// Search on Enter key
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchComplaints();
    }
});
