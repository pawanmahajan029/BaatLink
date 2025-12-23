// Check if user is logged in
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token) {
    window.location.href = 'login.html';
}

// Display username
document.getElementById('userName').textContent = `Hello, ${username}`;

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
});

// Create/Join room
document.getElementById('createRoomBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('roomCode').value.trim();
    if (roomCode) {
        window.location.href = `room.html?room=${roomCode}`;
    } else {
        showError('Please enter a room code');
    }
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const roomCode = document.getElementById('joinRoomCode').value.trim();
    if (roomCode) {
        window.location.href = `room.html?room=${roomCode}`;
    } else {
        showError('Please enter a room code');
    }
});

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 3000);
}