// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}

// Get username from localStorage
function getUsername() {
    return localStorage.getItem('username') || 'Guest';
}

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Handle logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.reload();
}

// Create new meeting
function createNewMeeting() {
    if (!isLoggedIn()) {
        alert('Please login first to create a meeting');
        window.location.href = 'login.html';
        return;
    }

    const roomCode = generateRoomCode();
    console.log('Creating room with code:', roomCode);
    window.location.href = `room.html?code=${roomCode}`;
}

// Show join dialog
function showJoinDialog() {
    if (!isLoggedIn()) {
        alert('Please login first to join a meeting');
        window.location.href = 'login.html';
        return;
    }

    const roomCode = prompt('Enter room code:');
    if (roomCode && roomCode.trim()) {
        console.log('Joining room with code:', roomCode.trim().toUpperCase());
        window.location.href = `room.html?code=${roomCode.trim().toUpperCase()}`;
    }
}

// Update UI based on login status
function updateUI() {
    const authBtn = document.getElementById('authBtn');
    const primaryBtn = document.getElementById('newMeetingBtn');
    const secondaryBtn = document.getElementById('joinMeetingBtn');

    console.log('Updating UI, logged in:', isLoggedIn());

    if (isLoggedIn()) {
        // User is logged in
        if (authBtn) {
            authBtn.textContent = 'Logout';
            authBtn.onclick = logout;
        }

        if (primaryBtn) {
            primaryBtn.textContent = 'New Meeting';
            primaryBtn.onclick = createNewMeeting;
        }

        if (secondaryBtn) {
            secondaryBtn.textContent = 'Join with Code';
            secondaryBtn.onclick = showJoinDialog;
        }
    } else {
        // User is not logged in - buttons still work but redirect to login
        if (authBtn) {
            authBtn.textContent = 'Login';
            authBtn.onclick = () => window.location.href = 'login.html';
        }

        if (primaryBtn) {
            primaryBtn.textContent = 'New Meeting';
            primaryBtn.onclick = createNewMeeting; // Will redirect to login
        }

        if (secondaryBtn) {
            secondaryBtn.textContent = 'Join with Code';
            secondaryBtn.onclick = showJoinDialog; // Will redirect to login
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Logout functionality
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.reload();
    });

    // Join nav link - same as "Join with Code" button
    document.getElementById('joinNavLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showJoinDialog();
    });

    console.log('Home page loaded');
    updateUI();

    // Display welcome message if logged in
    const username = localStorage.getItem('username');
    if (username) {
        console.log(`Welcome back, ${username}!`);
    }
});