let currentPage = 1;
const rowsPerPage = 10;
let leaderboardData = [];
let sortKey = 'points';
let sortAsc = false;

const urgencyMap = {
    "Physical Hazard": 5, "Biological Hazard": 4, "Chemical Hazard": 4,
    "Ergonomic Hazard": 3, "Electrical Hazard": 4, "Safety Hazard": 4,
    "Earthquake": 3, "Flood": 3, "Extreme Weather": 3, "Sinkhole": 2, "Others": 2
};

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('lat').value = position.coords.latitude.toFixed(6);
            document.getElementById('lng').value = position.coords.longitude.toFixed(6);
        }, (error) => {
            alert('Error getting location: ' + error.message);
        });
    } else {
        alert('Geolocation not supported.');
    }
}

function validateDarpanId(id) {
    return /^[a-zA-Z0-9]{6,}$/.test(id);
}

function getDarpanUser(isNgo) {
    const darpanId = document.getElementById('darpanId').value.trim();
    return isNgo ? 'NGO_' + darpanId : darpanId;
}

function initUser(userId) {
    let users = JSON.parse(localStorage.getItem('users')) || {};
    if (!users[userId]) {
        users[userId] = { points: 0, level: 1 };
        localStorage.setItem('users', JSON.stringify(users));
    }
    return users;
}

function updateUserPoints(userId, addPoints) {
    let users = JSON.parse(localStorage.getItem('users')) || {};
    if (users[userId]) {
        users[userId].points += addPoints;
        users[userId].level = Math.floor(users[userId].points / 10) + 1;
        localStorage.setItem('users', JSON.stringify(users));
    }
}

function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

function saveCurrentUser(userId) {
    localStorage.setItem('currentUser', userId);
}

function loadDarpanForForm() {
    const currentUser = getCurrentUser();
    if (currentUser) {
        const section = document.getElementById('darpanSection');
        const input = document.getElementById('darpanId');
        if (section && input) {
            section.style.display = 'block';
            input.value = currentUser;
        }
    }
}

function toggleLoginHelp(event) {
    const checkbox = event.target;
    const help = document.getElementById('loginHelp');
    if (checkbox.checked) {
        help.textContent = 'NGO mode enabled. Verify your Darpan ID at ngodarpan.gov.in.';
    } else {
        help.textContent = 'Alphanumeric, min 6 chars. NGOs: Check box for prefix.';
    }
}

function login(event) {
    event.preventDefault();
    const darpanId = document.getElementById('darpanId').value.trim();
    const isNgo = document.getElementById('isNgo').checked;

    if (!validateDarpanId(darpanId)) {
        showStatus('Invalid Darpan ID: Must be alphanumeric and at least 6 characters.', 'error');
        return;
    }

    const userId = getDarpanUser(isNgo);
    initUser(userId);
    saveCurrentUser(userId);
    showStatus('Login successful! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
}

function loginWithGmail() {
    const gmailId = document.getElementById('gmailId').value.trim();
    if (!gmailId || !gmailId.includes('@gmail.com')) {
        showStatus('Please enter a valid Gmail address.', 'error');
        return;
    }

    const userId = 'GMAIL_' + gmailId.replace('@gmail.com', '');
    initUser(userId);
    saveCurrentUser(userId);
    showStatus('Login with Gmail successful! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
}

function logout() {
    localStorage.removeItem('currentUser');
    showStatus('Logged out successfully!', 'success');
    document.getElementById('loginForm').reset();
    document.getElementById('isNgo').checked = false;
    document.getElementById('userInfo').style.display = 'none';
}

function showStatus(message, type) {
    const statusDiv = document.createElement('div');
    statusDiv.className = `login-status ${type}`;
    statusDiv.textContent = message;
    
    document.querySelector('.login-box:first-child').appendChild(statusDiv);
    
    setTimeout(() => {
        statusDiv.remove();
    }, 5000);
}

function checkLoggedIn() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        document.getElementById('currentUserDisplay').textContent = currentUser;
        document.getElementById('userInfo').style.display = 'block';
    } else {
        document.getElementById('userInfo').style.display = 'none';
    }
}

function submitReport(event) {
    event.preventDefault();
    const userId = getCurrentUser();
    if (!userId) {
        showStatus('Please log in to submit a report.', 'error');
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    const description = document.getElementById('description').value;
    const type = document.getElementById('type').value;
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    const imageFile = document.getElementById('image').files[0];

    if (!description || !type || !lat || !lng) {
        showStatus('Please fill all required fields.', 'error');
        return;
    }

    if (description.length < 10) {
        showStatus('Description must be at least 10 characters long.', 'error');
        return;
    }

    const hazard = {
        id: Date.now(),
        reporter: userId,
        description,
        type,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        image: null,
        status: 'pending',
        validation_status: 'pending',
        votes: { true: 0, false: 0 },
        resolvedBy: null,
        solutions: [],
        validatedBy: {}
    };

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            hazard.image = e.target.result;
            saveHazard(hazard);
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveHazard(hazard);
    }
}

function saveHazard(hazard) {
    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards.push(hazard);
    localStorage.setItem('hazards', JSON.stringify(hazards));
    
    showStatus('Report submitted successfully! It will appear in Validate Hazards for review.', 'success');
    document.getElementById('reportForm').reset();
}

function loadValidatedHazards() {
    const hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    const filtered = hazards.filter(h => h.validation_status === 'valid')
        .sort((a, b) => urgencyMap[b.type] - urgencyMap[a.type] || b.id - a.id);
    const list = document.getElementById('hazardList');
    if (!list) return;
    
    list.innerHTML = '';

    if (typeof L !== 'undefined') {
        const map = L.map('map').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        filtered.forEach(hazard => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>Type: ${hazard.type} (Urgency: ${urgencyMap[hazard.type]})</strong><br>
                Description: ${hazard.description}<br>
                Reporter: ${hazard.reporter}<br>
                Location: (${hazard.lat}, ${hazard.lng})<br>
                Status: ${hazard.status} ${hazard.resolvedBy ? `(Resolved by: ${hazard.resolvedBy})` : ''}<br>
                ${hazard.image ? `<img src="${hazard.image}" alt="Hazard Image" style="max-width: 200px;">` : ''}<br>
                ${hazard.solutions.length ? `Solutions: <ul>${hazard.solutions.map(s => `<li>${s.validator}: ${s.solution}</li>`).join('')}</ul>` : 'No solutions yet.'}
                <button onclick="updateStatus(${hazard.id}, 'resolved')">Mark Resolved</button>
            `;
            list.appendChild(li);

            L.marker([hazard.lat, hazard.lng]).addTo(map)
                .bindPopup(`${hazard.type}: ${hazard.description}`);
        });
    }
}

function loadPendingHazards() {
    const hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    const filtered = hazards.filter(h => h.validation_status === 'pending');
    const list = document.getElementById('pendingList');
    if (!list) return;
    
    list.innerHTML = '';

    filtered.forEach(hazard => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>Type: ${hazard.type} (Urgency: ${urgencyMap[hazard.type]})</strong><br>
            Description: ${hazard.description}<br>
            Reporter: ${hazard.reporter}<br>
            Location: (${hazard.lat}, ${hazard.lng})<br>
            Votes: Valid (${hazard.votes.true}) / Invalid (${hazard.votes.false})<br>
            ${hazard.image ? `<img src="${hazard.image}" alt="Hazard Image" style="max-width: 200px;">` : ''}<br>
            <label for="solution_${hazard.id}">Suggest a Solution (optional):</label>
            <textarea id="solution_${hazard.id}" placeholder="Enter solution here"></textarea><br>
            <button onclick="vote(${hazard.id}, true)">Valid (True)</button>
            <button onclick="vote(${hazard.id}, false)">Invalid (False)</button>
        `;
        list.appendChild(li);
    });
}

function vote(id, isValid) {
    const userId = getCurrentUser();
    if (!userId) {
        alert('Please login with your Darpan ID or Gmail first.');
        window.location.href = 'login.html';
        return;
    }

    initUser(userId);

    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards = hazards.map(h => {
        if (h.id === id) {
            if (h.validatedBy[userId]) {
                alert('You have already voted on this hazard.');
                return h;
            }
            h.votes[isValid ? 'true' : 'false']++;
            h.validatedBy[userId] = true;
            const solution = document.getElementById(`solution_${id}`).value.trim();
            if (isValid && solution) {
                h.solutions.push({ validator: userId, solution });
            }
            if (h.votes.true >= 3) {
                h.validation_status = 'valid';
                updateUserPoints(h.reporter, 10);
            } else if (h.votes.false >= 3) {
                h.validation_status = 'invalid';
            }
            return h;
        }
        return h;
    });
    localStorage.setItem('hazards', JSON.stringify(hazards));

    updateUserPoints(userId, 1);
    loadPendingHazards();
}

function updateStatus(id, newStatus) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login with your Darpan ID or Gmail first.');
        window.location.href = 'login.html';
        return;
    }

    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards = hazards.map(h => {
        if (h.id === id) {
            h.status = newStatus;
            h.resolvedBy = currentUser;
            if (newStatus === 'resolved' && currentUser.startsWith('NGO_')) {
                updateUserPoints(currentUser, 5);
            }
            return h;
        }
        return h;
    });
    localStorage.setItem('hazards', JSON.stringify(hazards));
    loadValidatedHazards();
}

function loadLeaderboard() {
    const users = JSON.parse(localStorage.getItem('users')) || {};
    leaderboardData = Object.entries(users).map(([userId, { points, level }]) => ({ user: userId, points, level }));
    sortLeaderboard();
    displayPage(currentPage);
}

function sortLeaderboard() {
    leaderboardData.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (sortKey === 'points' || sortKey === 'level') {
            valA = Number(valA);
            valB = Number(valB);
        }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });
}

function displayPage(page) {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = leaderboardData.slice(start, end);
    const body = document.getElementById('leaderboardBody');
    if (!body) return;
    
    body.innerHTML = '';
    pageData.forEach((entry, index) => {
        const rank = start + index + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rank}</td>
            <td>${entry.user}</td>
            <td>${entry.points}</td>
            <td><span class="badge ${getBadgeClass(entry.level)}">Level ${entry.level}</span></td>
        `;
        body.appendChild(tr);
    });
    document.getElementById('pageInfo').textContent = `Page ${page} of ${Math.ceil(leaderboardData.length / rowsPerPage)}`;
}

function getBadgeClass(level) {
    if (level >= 10) return 'badge-platinum';
    if (level >= 5) return 'badge-gold';
    if (level >= 3) return 'badge-silver';
    return 'badge-bronze';
}

function sortTable(key) {
    if (sortKey === key) {
        sortAsc = !sortAsc;
    } else {
        sortKey = key;
        sortAsc = false;
    }
    sortLeaderboard();
    displayPage(currentPage);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayPage(currentPage);
    }
}

function nextPage() {
    if (currentPage * rowsPerPage < leaderboardData.length) {
        currentPage++;
        displayPage(currentPage);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mainNav = document.getElementById('main-nav');
    
    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', function() {
            mainNav.classList.toggle('active');
        });
    }
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
    
    checkLoggedIn();
    loadDarpanForForm();
});