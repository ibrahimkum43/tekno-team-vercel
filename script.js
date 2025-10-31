// Arka plan fotoğraflarını değiştir
const backgroundImages = [
  'attached_assets/bg1.jpg',
  'attached_assets/bg2.jpg',
  'attached_assets/bg3.jpg'
];
let currentImageIndex = 0;
let backgroundInterval = null;

function changeBackground() {
  currentImageIndex = (currentImageIndex + 1) % backgroundImages.length;
  document.body.style.backgroundImage = `url('${backgroundImages[currentImageIndex]}')`;
}

backgroundInterval = setInterval(changeBackground, 2500);

// Sayfa yüklendiğinde session kontrolü
async function checkSession() {
  const result = await apiCall('/api/session');
  
  if (result.authenticated) {
    currentUser = result.username;
    isAdmin = result.isAdmin;
    isGuest = false;
    
    clearInterval(backgroundInterval);
    document.body.classList.add('logged-in');
    
    hideAllScreens();
    document.getElementById("panelScreen").classList.remove("hidden");
    
    if (currentUser === '0000') {
      document.getElementById("welcomeText").textContent = `Hoş geldiniz, Admin!`;
    } else {
      document.getElementById("welcomeText").textContent = `Hoş geldiniz, ${currentUser}!`;
    }
    
    const guestButtons = document.getElementById("guestMediaButtons");
    guestButtons.classList.add("hidden");
    
    const userNotesButton = document.getElementById("userNotesButton");
    userNotesButton.classList.remove("hidden");
    
    if (isAdmin) {
      document.getElementById("adminPanel").classList.remove("hidden");
      document.getElementById("adminVideoPanel").classList.remove("hidden");
      document.getElementById("adminPhotoPanel").classList.remove("hidden");
      document.getElementById("adminAnnouncementPanel").classList.remove("hidden");
      document.getElementById("adminMessagePanel").classList.remove("hidden");
      loadUserList();
    } else {
      document.getElementById("adminPanel").classList.add("hidden");
      document.getElementById("adminVideoPanel").classList.add("hidden");
      document.getElementById("adminPhotoPanel").classList.add("hidden");
      document.getElementById("adminAnnouncementPanel").classList.add("hidden");
      document.getElementById("adminMessagePanel").classList.add("hidden");
    }
    
    document.querySelectorAll('.settings-btn').forEach(btn => btn.classList.remove('hidden'));
    document.querySelector('.home-btn').classList.add('hidden');
    
    checkAdminMessages();
  }
}

// Sayfa yüklendiğinde session kontrolü yap
window.addEventListener('DOMContentLoaded', checkSession);

// Kullanıcı Sistemi
let currentUser = null;
let isAdmin = false;
let isGuest = false;

let timerInterval = null;
let centiseconds = 0;
let selectedRobotType = "";

// API çağrıları
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin'
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(endpoint, options);
    return await response.json();
  } catch (error) {
    console.error('API çağrısı hatası:', error);
    return { success: false, message: 'Bağlantı hatası' };
  }
}

// Dosya yükleme için multipart API çağrısı
async function uploadFile(endpoint, formData) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    });
    return await response.json();
  } catch (error) {
    console.error('Dosya yükleme hatası:', error);
    return { success: false, message: 'Bağlantı hatası' };
  }
}

// Tüm ekranları gizle
function hideAllScreens() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("panelScreen").classList.add("hidden");
  document.getElementById("timerScreen").classList.add("hidden");
  document.getElementById("saveScreen").classList.add("hidden");
  document.getElementById("videosScreen").classList.add("hidden");
  document.getElementById("photosScreen").classList.add("hidden");
  document.getElementById("announcementsScreen").classList.add("hidden");
  document.getElementById("notesScreen").classList.add("hidden");
}

// Misafir girişi
async function misafirGirisi() {
  currentUser = 'Misafir';
  isGuest = true;
  isAdmin = false;
  
  clearInterval(backgroundInterval);
  document.body.classList.add('logged-in');
  
  hideAllScreens();
  document.getElementById("panelScreen").classList.remove("hidden");
  document.getElementById("welcomeText").textContent = "Misafir Görünümü";
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("adminVideoPanel").classList.add("hidden");
  document.getElementById("adminPhotoPanel").classList.add("hidden");
  document.getElementById("adminAnnouncementPanel").classList.add("hidden");
  document.getElementById("adminMessagePanel").classList.add("hidden");
  
  const guestButtons = document.getElementById("guestMediaButtons");
  guestButtons.classList.remove("hidden");
  
  const userNotesButton = document.getElementById("userNotesButton");
  userNotesButton.classList.add("hidden");
  
  // Misafir için şifre değiştir butonunu gizle, ana sayfaya dön butonunu göster
  document.querySelectorAll('.settings-btn').forEach(btn => btn.classList.add('hidden'));
  document.querySelector('.home-btn').classList.remove('hidden');
  
  checkAdminMessages();
}

// Ana sayfaya dön (misafir için)
function anaSayfayaDon() {
  currentUser = null;
  isAdmin = false;
  isGuest = false;
  
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
  }
  lastCheckedMessageCount = 0;
  
  document.body.classList.remove('logged-in');
  backgroundInterval = setInterval(changeBackground, 2500);
  
  hideAllScreens();
  document.getElementById("loginScreen").classList.remove("hidden");
  
  document.querySelector('.home-btn').classList.add('hidden');
}

// Giriş yap
async function girisYap() {
  const kullanici = document.getElementById("kullanici").value.trim();
  const sifre = document.getElementById("sifre").value;
  const sonuc = document.getElementById("sonuc");
  
  const result = await apiCall('/api/login', 'POST', { username: kullanici, password: sifre });
  
  if (result.success) {
    currentUser = result.username;
    isAdmin = result.isAdmin;
    isGuest = false;
    
    clearInterval(backgroundInterval);
    document.body.classList.add('logged-in');
    
    hideAllScreens();
    document.getElementById("panelScreen").classList.remove("hidden");
    
    // 0000 kullanıcısı Admin olarak gösterilmeli
    if (currentUser === '0000') {
      document.getElementById("welcomeText").textContent = `Hoş geldiniz, Admin!`;
    } else {
      document.getElementById("welcomeText").textContent = `Hoş geldiniz, ${currentUser}!`;
    }
    
    const guestButtons = document.getElementById("guestMediaButtons");
    guestButtons.classList.add("hidden");
    
    const userNotesButton = document.getElementById("userNotesButton");
    userNotesButton.classList.remove("hidden");
    
    if (isAdmin) {
      document.getElementById("adminPanel").classList.remove("hidden");
      document.getElementById("adminVideoPanel").classList.remove("hidden");
      document.getElementById("adminPhotoPanel").classList.remove("hidden");
      document.getElementById("adminAnnouncementPanel").classList.remove("hidden");
      document.getElementById("adminMessagePanel").classList.remove("hidden");
      loadUserList();
    } else {
      document.getElementById("adminPanel").classList.add("hidden");
      document.getElementById("adminVideoPanel").classList.add("hidden");
      document.getElementById("adminPhotoPanel").classList.add("hidden");
      document.getElementById("adminAnnouncementPanel").classList.add("hidden");
      document.getElementById("adminMessagePanel").classList.add("hidden");
    }
    
    // Giriş yapan kullanıcılar için çıkış yap ve şifre değiştir butonlarını göster
    document.querySelectorAll('.settings-btn').forEach(btn => btn.classList.remove('hidden'));
    document.querySelector('.home-btn').classList.add('hidden');
    
    checkAdminMessages();
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Çıkış yap
async function cikisYap() {
  const result = await apiCall('/api/logout', 'POST');
  
  if (result.success) {
    currentUser = null;
    isAdmin = false;
    isGuest = false;
    
    if (messageCheckInterval) {
      clearInterval(messageCheckInterval);
      messageCheckInterval = null;
    }
    lastCheckedMessageCount = 0;
    
    document.body.classList.remove('logged-in');
    backgroundInterval = setInterval(changeBackground, 2500);
    
    hideAllScreens();
    document.getElementById("loginScreen").classList.remove("hidden");
    
    document.getElementById("kullanici").value = '';
    document.getElementById("sifre").value = '';
    document.getElementById("sonuc").textContent = '';
  }
}

// Şifre değiştirme modal
function sifreDegistirModal() {
  document.getElementById("passwordModal").classList.remove("hidden");
  document.getElementById("oldPassword").value = '';
  document.getElementById("newPasswordInput").value = '';
  document.getElementById("passwordSonuc").textContent = '';
}

function sifreDegistirKapat() {
  document.getElementById("passwordModal").classList.add("hidden");
}

async function sifreDegistir() {
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPasswordInput").value;
  const sonuc = document.getElementById("passwordSonuc");
  
  if (!newPassword) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Yeni şifre boş olamaz!";
    return;
  }
  
  const result = await apiCall('/api/change-password', 'POST', { oldPassword, newPassword });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    setTimeout(() => {
      sifreDegistirKapat();
    }, 2000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Kullanıcı listesini yükle
async function loadUserList() {
  const users = await apiCall('/api/users');
  const listDiv = document.getElementById('userListDiv');
  
  listDiv.innerHTML = users.map(user => `
    <div class="user-item">
      <span>${user.username} ${user.isAdmin ? '(Admin)' : ''}</span>
      <div style="display: flex; gap: 5px;">
        ${!user.isAdmin ? `<button onclick="kullaniciSil('${user.username}')">🗑️ Sil</button>` : ''}
        ${!user.isAdmin ? `<button onclick="yetkiArttir('${user.username}')" class="admin-btn" style="margin: 0; padding: 5px 10px; font-size: 12px;">⬆️ Yetki Artır</button>` : ''}
        ${user.isAdmin ? `<button onclick="yetkiDusur('${user.username}')" style="margin: 0; padding: 5px 10px; font-size: 12px; background-color: rgba(255, 165, 0, 0.5);">⬇️ Yetki Düşür</button>` : ''}
      </div>
    </div>
  `).join('');
}

// Kullanıcı yetkisini artır
async function yetkiArttir(username) {
  if (!isAdmin) {
    alert('Sadece yöneticiler yetki değiştirebilir!');
    return;
  }
  
  if (confirm(`${username} kullanıcısını admin yapmak istediğinizden emin misiniz?`)) {
    const result = await apiCall(`/api/users/${username}/promote`, 'POST');
    
    if (result.success) {
      alert('✓ ' + result.message);
      loadUserList();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Kullanıcı yetkisini düşür
async function yetkiDusur(username) {
  if (!isAdmin) {
    alert('Sadece yöneticiler yetki değiştirebilir!');
    return;
  }
  
  if (confirm(`${username} kullanıcısının admin yetkisini kaldırmak istediğinizden emin misiniz?`)) {
    const result = await apiCall(`/api/users/${username}/demote`, 'POST');
    
    if (result.success) {
      alert('✓ ' + result.message);
      loadUserList();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Kullanıcı ekle
async function kullaniciEkle() {
  if (!isAdmin) {
    alert('Sadece yöneticiler kullanıcı ekleyebilir!');
    return;
  }
  
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const sonuc = document.getElementById('adminSonuc');
  
  if (!username || !password) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Kullanıcı adı ve şifre boş olamaz!";
    return;
  }
  
  const result = await apiCall('/api/users', 'POST', { username, password });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    
    loadUserList();
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Kullanıcı sil
async function kullaniciSil(username) {
  if (!isAdmin) {
    alert('Sadece yöneticiler kullanıcı silebilir!');
    return;
  }
  
  if (confirm(`${username} kullanıcısını silmek istediğinizden emin misiniz?`)) {
    const result = await apiCall(`/api/users/${username}`, 'DELETE');
    
    if (result.success) {
      alert('✓ ' + result.message);
      loadUserList();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Robot seç
async function robotSec(robotType) {
  selectedRobotType = robotType;
  document.getElementById("selectedRobot").textContent = robotType;
  hideAllScreens();
  document.getElementById("timerScreen").classList.remove("hidden");
  
  // Misafir ise sadece görüntüleme
  if (isGuest) {
    document.getElementById("timerControlsDiv").classList.add("hidden");
    document.getElementById("robotSettingsDiv").classList.add("hidden");
    document.getElementById("guestTimerBackBtn").classList.remove("hidden");
  } else {
    document.getElementById("timerControlsDiv").classList.remove("hidden");
    document.getElementById("guestTimerBackBtn").classList.add("hidden");
    
    // Admin ise robot ayarlarını göster
    if (isAdmin) {
      document.getElementById("robotSettingsDiv").classList.remove("hidden");
      await loadRobotSettings();
    } else {
      document.getElementById("robotSettingsDiv").classList.add("hidden");
    }
  }
  
  await displaySavedTimes();
}

// Robot ayarlarını yükle
async function loadRobotSettings() {
  const settings = await apiCall(`/api/robot-settings/${selectedRobotType}`);
  document.getElementById("robotSpeed").value = settings.speed || '';
  document.getElementById("robotKp").value = settings.kp || '';
  document.getElementById("robotKd").value = settings.kd || '';
}

// Robot ayarlarını kaydet
async function robotAyarlariKaydet() {
  if (!isAdmin) {
    alert('Sadece yöneticiler ayarları değiştirebilir!');
    return;
  }
  
  const speed = document.getElementById("robotSpeed").value.trim();
  const kp = document.getElementById("robotKp").value.trim();
  const kd = document.getElementById("robotKd").value.trim();
  const sonuc = document.getElementById("settingsSonuc");
  
  const result = await apiCall('/api/robot-settings', 'POST', {
    robot: selectedRobotType,
    speed: speed,
    kp: kp,
    kd: kd
  });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Kaydedilen süreleri göster
async function displaySavedTimes() {
  const times = await apiCall(`/api/times/${selectedRobotType}`);
  const listDiv = document.getElementById('savedTimesList');
  
  if (times.length === 0) {
    listDiv.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Henüz kayıtlı süre yok</p>';
    return;
  }
  
  const reversedTimes = [...times].reverse();
  listDiv.innerHTML = reversedTimes.map((entry, index) => {
    const deleteBtn = isAdmin ? 
      `<button onclick="deleteTime(${times.length - 1 - index})">🗑️ Sil</button>` : '';
    
    const settingsInfo = entry.settings ? 
      `<div class="settings-info" style="display: none; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 5px; font-size: 12px;">
        <strong>Ayarlar:</strong> Hız: ${entry.settings.speed || '-'} | Sert Dönüş: ${entry.settings.kp || '-'} | Titreme: ${entry.settings.kd || '-'}
      </div>` : '';
    
    // 0000 kullanıcısını gizle
    const displayUser = entry.user === '0000' ? 'Admin' : entry.user;
    
    return `
      <div class="time-entry" onclick="toggleSettings(this)" style="cursor: pointer;">
        <span class="time-info"><strong>${entry.time}</strong> - ${displayUser} - ${entry.date}</span>
        ${deleteBtn}
        ${settingsInfo}
      </div>
    `;
  }).join('');
}

// Ayarları göster/gizle
function toggleSettings(element) {
  const settingsDiv = element.querySelector('.settings-info');
  if (settingsDiv) {
    settingsDiv.style.display = settingsDiv.style.display === 'none' ? 'block' : 'none';
  }
}

// Süre sil
async function deleteTime(index) {
  if (!isAdmin) {
    alert('Sadece yöneticiler süreleri silebilir!');
    return;
  }
  
  const result = await apiCall(`/api/times/${selectedRobotType}/${index}`, 'DELETE');
  
  if (result.success) {
    await displaySavedTimes();
  } else {
    alert('❌ ' + result.message);
  }
}

// Video göster
async function showVideos() {
  hideAllScreens();
  document.getElementById("videosScreen").classList.remove("hidden");
  
  if (isAdmin) {
    document.getElementById("adminVideoManagement").classList.remove("hidden");
  } else {
    document.getElementById("adminVideoManagement").classList.add("hidden");
  }
  
  await loadVideos();
}

// Videoları yükle
async function loadVideos() {
  const videos = await apiCall('/api/videos');
  const listDiv = document.getElementById('videoListDiv');
  
  if (videos.length === 0) {
    listDiv.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Henüz video yok</p>';
    return;
  }
  
  const reversedVideos = [...videos].reverse();
  listDiv.innerHTML = reversedVideos.map(video => {
    const deleteBtn = isAdmin ? 
      `<button onclick="videoSil(${video.id})">🗑️ Sil</button>` : '';
    
    // 0000 kullanıcısını gizle
    const displayUser = video.uploadedBy === '0000' ? 'Admin' : video.uploadedBy;
    
    return `
      <div class="media-entry">
        <div class="media-info">
          <strong>${video.title}</strong><br>
          ${video.description ? video.description + '<br>' : ''}
          <small>${video.uploadDate} - ${displayUser}</small><br>
          <video controls style="max-width: 100%; margin-top: 10px;">
            <source src="/${video.path}" type="video/mp4">
            Tarayıcınız video etiketini desteklemiyor.
          </video>
        </div>
        ${deleteBtn}
      </div>
    `;
  }).join('');
}

// Video yükle
async function videoYukle() {
  if (!isAdmin) {
    alert('Sadece yöneticiler video ekleyebilir!');
    return;
  }
  
  const title = document.getElementById('newVideoTitle').value.trim();
  const description = document.getElementById('newVideoDescription').value.trim();
  const fileInput = document.getElementById('newVideoFile');
  const sonuc = document.getElementById('newVideoSonuc');
  
  if (!title) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık boş olamaz!";
    return;
  }
  
  if (!fileInput.files || fileInput.files.length === 0) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Lütfen bir video dosyası seçin!";
    return;
  }
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('video', fileInput.files[0]);
  
  sonuc.style.color = "rgba(255, 255, 255, 0.9)";
  sonuc.textContent = "⏳ Yükleniyor...";
  
  const result = await uploadFile('/api/videos', formData);
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('newVideoTitle').value = '';
    document.getElementById('newVideoDescription').value = '';
    fileInput.value = '';
    
    await loadVideos();
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Video sil
async function videoSil(id) {
  if (!isAdmin) {
    alert('Sadece yöneticiler video silebilir!');
    return;
  }
  
  if (confirm('Bu videoyu silmek istediğinizden emin misiniz?')) {
    const result = await apiCall(`/api/videos/${id}`, 'DELETE');
    
    if (result.success) {
      await loadVideos();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Fotoğraf göster
async function showPhotos() {
  hideAllScreens();
  document.getElementById("photosScreen").classList.remove("hidden");
  
  if (isAdmin) {
    document.getElementById("adminPhotoManagement").classList.remove("hidden");
  } else {
    document.getElementById("adminPhotoManagement").classList.add("hidden");
  }
  
  await loadPhotos();
}

// Fotoğrafları yükle
async function loadPhotos() {
  const photos = await apiCall('/api/photos');
  const listDiv = document.getElementById('photoListDiv');
  
  if (photos.length === 0) {
    listDiv.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Henüz fotoğraf yok</p>';
    return;
  }
  
  const reversedPhotos = [...photos].reverse();
  listDiv.innerHTML = reversedPhotos.map(photo => {
    const deleteBtn = isAdmin ? 
      `<button onclick="fotografSil(${photo.id})">🗑️ Sil</button>` : '';
    
    // 0000 kullanıcısını gizle
    const displayUser = photo.uploadedBy === '0000' ? 'Admin' : photo.uploadedBy;
    
    return `
      <div class="media-entry">
        <div class="media-info">
          <strong>${photo.title}</strong><br>
          ${photo.description ? photo.description + '<br>' : ''}
          <small>${photo.uploadDate} - ${displayUser}</small><br>
          <img src="/${photo.path}" alt="${photo.title}" style="max-width: 100%; margin-top: 10px;">
        </div>
        ${deleteBtn}
      </div>
    `;
  }).join('');
}

// Fotoğraf yükle
async function fotografYukle() {
  if (!isAdmin) {
    alert('Sadece yöneticiler fotoğraf ekleyebilir!');
    return;
  }
  
  const title = document.getElementById('newPhotoTitle').value.trim();
  const description = document.getElementById('newPhotoDescription').value.trim();
  const fileInput = document.getElementById('newPhotoFile');
  const sonuc = document.getElementById('newPhotoSonuc');
  
  if (!title) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık boş olamaz!";
    return;
  }
  
  if (!fileInput.files || fileInput.files.length === 0) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Lütfen bir fotoğraf dosyası seçin!";
    return;
  }
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('photo', fileInput.files[0]);
  
  sonuc.style.color = "rgba(255, 255, 255, 0.9)";
  sonuc.textContent = "⏳ Yükleniyor...";
  
  const result = await uploadFile('/api/photos', formData);
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('newPhotoTitle').value = '';
    document.getElementById('newPhotoDescription').value = '';
    fileInput.value = '';
    
    await loadPhotos();
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Fotoğraf sil
async function fotografSil(id) {
  if (!isAdmin) {
    alert('Sadece yöneticiler fotoğraf silebilir!');
    return;
  }
  
  if (confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) {
    const result = await apiCall(`/api/photos/${id}`, 'DELETE');
    
    if (result.success) {
      await loadPhotos();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Video ekle (admin panelinden)
async function videoEkle() {
  if (!isAdmin) {
    alert('Sadece yöneticiler video ekleyebilir!');
    return;
  }
  
  const title = document.getElementById('videoTitle').value.trim();
  const description = document.getElementById('videoDescription').value.trim();
  const fileInput = document.getElementById('videoFile');
  const sonuc = document.getElementById('videoSonuc');
  
  if (!title) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık boş olamaz!";
    return;
  }
  
  if (!fileInput.files || fileInput.files.length === 0) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Lütfen bir video dosyası seçin!";
    return;
  }
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('video', fileInput.files[0]);
  
  sonuc.style.color = "rgba(255, 255, 255, 0.9)";
  sonuc.textContent = "⏳ Yükleniyor...";
  
  const result = await uploadFile('/api/videos', formData);
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('videoTitle').value = '';
    document.getElementById('videoDescription').value = '';
    fileInput.value = '';
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Fotoğraf ekle (admin panelinden)
async function fotografEkle() {
  if (!isAdmin) {
    alert('Sadece yöneticiler fotoğraf ekleyebilir!');
    return;
  }
  
  const title = document.getElementById('photoTitle').value.trim();
  const description = document.getElementById('photoDescription').value.trim();
  const fileInput = document.getElementById('photoFile');
  const sonuc = document.getElementById('photoSonuc');
  
  if (!title) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık boş olamaz!";
    return;
  }
  
  if (!fileInput.files || fileInput.files.length === 0) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Lütfen bir fotoğraf dosyası seçin!";
    return;
  }
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('photo', fileInput.files[0]);
  
  sonuc.style.color = "rgba(255, 255, 255, 0.9)";
  sonuc.textContent = "⏳ Yükleniyor...";
  
  const result = await uploadFile('/api/photos', formData);
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('photoTitle').value = '';
    document.getElementById('photoDescription').value = '';
    fileInput.value = '';
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Kronometre fonksiyonları
function formatTime(totalCentiseconds) {
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const cs = totalCentiseconds % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    centiseconds++;
    document.getElementById("timerDisplay").textContent = formatTime(centiseconds);
  }, 10);
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTimer() {
  pauseTimer();
  centiseconds = 0;
  document.getElementById("timerDisplay").textContent = formatTime(centiseconds);
}

function yenidenBaslat() {
  hideAllScreens();
  document.getElementById("panelScreen").classList.remove("hidden");
  resetTimer();
}

function geriDon() {
  hideAllScreens();
  document.getElementById("panelScreen").classList.remove("hidden");
  resetTimer();
}

async function bitir() {
  pauseTimer();
  const timeString = formatTime(centiseconds);
  
  const result = await apiCall('/api/times', 'POST', {
    robot: selectedRobotType,
    time: timeString
  });
  
  if (result.success) {
    hideAllScreens();
    document.getElementById("saveScreen").classList.remove("hidden");
    document.getElementById("finalTime").textContent = timeString;
  } else {
    alert('❌ Süre kaydedilemedi: ' + result.message);
  }
}

// Enter tuşu ile giriş
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !document.getElementById("loginScreen").classList.contains("hidden")) {
    girisYap();
  }
});

// Duyurular göster
async function showAnnouncements() {
  hideAllScreens();
  document.getElementById("announcementsScreen").classList.remove("hidden");
  
  if (isAdmin) {
    document.getElementById("adminAnnouncementManagement").classList.remove("hidden");
  } else {
    document.getElementById("adminAnnouncementManagement").classList.add("hidden");
  }
  
  await loadAnnouncements();
}

// Duyuruları yükle
async function loadAnnouncements() {
  const announcements = await apiCall('/api/announcements');
  const listDiv = document.getElementById('announcementListDiv');
  
  if (announcements.length === 0) {
    listDiv.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Henüz duyuru yok</p>';
    return;
  }
  
  const reversedAnnouncements = [...announcements].reverse();
  listDiv.innerHTML = reversedAnnouncements.map(announcement => {
    const deleteBtn = isAdmin ? 
      `<button onclick="duyuruSil(${announcement.id})">🗑️ Sil</button>` : '';
    
    const displayUser = announcement.createdBy === '0000' ? 'Admin' : announcement.createdBy;
    
    return `
      <div class="media-entry" style="flex-direction: column; align-items: flex-start;">
        <div class="media-info" style="width: 100%;">
          <h4 style="color: rgba(255,255,255,0.9); margin: 0 0 10px 0;">${announcement.title}</h4>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0; white-space: pre-wrap;">${announcement.content}</p>
          <small style="color: rgba(255,255,255,0.5);">${announcement.date} - ${displayUser}</small>
        </div>
        ${deleteBtn}
      </div>
    `;
  }).join('');
}

// Duyuru yayınla (duyurular ekranından)
async function duyuruYayinla() {
  if (!isAdmin) {
    alert('Sadece yöneticiler duyuru ekleyebilir!');
    return;
  }
  
  const title = document.getElementById('newAnnouncementTitle').value.trim();
  const content = document.getElementById('newAnnouncementContent').value.trim();
  const sonuc = document.getElementById('newAnnouncementSonuc');
  
  if (!title || !content) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık ve içerik boş olamaz!";
    return;
  }
  
  const result = await apiCall('/api/announcements', 'POST', { title, content });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('newAnnouncementTitle').value = '';
    document.getElementById('newAnnouncementContent').value = '';
    
    await loadAnnouncements();
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Duyuru ekle (admin panelinden)
async function duyuruEkle() {
  if (!isAdmin) {
    alert('Sadece yöneticiler duyuru ekleyebilir!');
    return;
  }
  
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  const sonuc = document.getElementById('announcementSonuc');
  
  if (!title || !content) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık ve içerik boş olamaz!";
    return;
  }
  
  const result = await apiCall('/api/announcements', 'POST', { title, content });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('announcementTitle').value = '';
    document.getElementById('announcementContent').value = '';
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Duyuru sil
async function duyuruSil(id) {
  if (!isAdmin) {
    alert('Sadece yöneticiler duyuru silebilir!');
    return;
  }
  
  if (confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) {
    const result = await apiCall(`/api/announcements/${id}`, 'DELETE');
    
    if (result.success) {
      await loadAnnouncements();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Notları göster
async function showNotes() {
  if (isGuest) {
    alert('Misafirler notları görüntüleyemez!');
    return;
  }
  
  hideAllScreens();
  document.getElementById("notesScreen").classList.remove("hidden");
  
  await loadNotes();
}

// Notları yükle
async function loadNotes() {
  const notes = await apiCall('/api/notes');
  const listDiv = document.getElementById('noteListDiv');
  
  if (notes.length === 0) {
    listDiv.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Henüz not yok</p>';
    return;
  }
  
  listDiv.innerHTML = '';
  const reversedNotes = [...notes].reverse();
  
  reversedNotes.forEach(note => {
    const entry = document.createElement('div');
    entry.className = 'media-entry';
    entry.style.cursor = 'pointer';
    entry.onclick = () => notDuzenleAc(note.id, note.title, note.content);
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'media-info';
    
    const titleStrong = document.createElement('strong');
    titleStrong.style.cssText = 'color: rgba(255,255,255,0.95); font-size: 16px;';
    titleStrong.textContent = note.title;
    
    const contentP = document.createElement('p');
    contentP.style.cssText = 'color: rgba(255,255,255,0.7); margin: 5px 0; font-size: 14px; max-height: 40px; overflow: hidden;';
    contentP.textContent = note.content.substring(0, 80) + (note.content.length > 80 ? '...' : '');
    
    const displayUser = note.createdBy === '0000' ? 'Admin' : note.createdBy;
    const metaSmall = document.createElement('small');
    metaSmall.style.color = 'rgba(255,255,255,0.5)';
    metaSmall.textContent = `${note.date} - ${displayUser}${note.lastModified ? ' (Düzenlendi: ' + note.lastModified + ')' : ''}`;
    
    infoDiv.appendChild(titleStrong);
    infoDiv.appendChild(contentP);
    infoDiv.appendChild(metaSmall);
    entry.appendChild(infoDiv);
    
    if (isAdmin) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️ Sil';
      deleteBtn.onclick = (e) => notSil(e, note.id);
      entry.appendChild(deleteBtn);
    }
    
    listDiv.appendChild(entry);
  });
}

// Not ekle
async function notEkle() {
  if (isGuest) {
    alert('Misafirler not ekleyemez!');
    return;
  }
  
  const title = document.getElementById('newNoteTitle').value.trim();
  const content = document.getElementById('newNoteContent').value.trim();
  const sonuc = document.getElementById('newNoteSonuc');
  
  if (!title || !content) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık ve içerik boş olamaz!";
    return;
  }
  
  const result = await apiCall('/api/notes', 'POST', { title, content });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('newNoteTitle').value = '';
    document.getElementById('newNoteContent').value = '';
    
    await loadNotes();
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Not sil
async function notSil(event, id) {
  event.stopPropagation();
  if (!isAdmin) {
    alert('Sadece adminler not silebilir!');
    return;
  }
  
  if (confirm('Bu notu silmek istediğinizden emin misiniz?')) {
    const result = await apiCall(`/api/notes/${id}`, 'DELETE');
    
    if (result.success) {
      await loadNotes();
    } else {
      alert('❌ ' + result.message);
    }
  }
}

// Not düzenleme modalını aç
let currentEditNoteId = null;

function notDuzenleAc(id, title, content) {
  currentEditNoteId = id;
  document.getElementById('editNoteTitle').value = title;
  document.getElementById('editNoteContent').value = content;
  document.getElementById('noteEditModal').classList.remove('hidden');
  document.getElementById('editNoteSonuc').textContent = '';
}

function notDuzenleKapat() {
  document.getElementById('noteEditModal').classList.add('hidden');
  currentEditNoteId = null;
}

// Not güncelle
async function notGuncelle() {
  if (!currentEditNoteId) return;
  
  const title = document.getElementById('editNoteTitle').value.trim();
  const content = document.getElementById('editNoteContent').value.trim();
  const sonuc = document.getElementById('editNoteSonuc');
  
  if (!title || !content) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Başlık ve içerik boş olamaz!";
    return;
  }
  
  const result = await apiCall(`/api/notes/${currentEditNoteId}`, 'PUT', { title, content });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    setTimeout(async () => {
      notDuzenleKapat();
      await loadNotes();
    }, 1000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Admin mesajı gönder
async function adminMesajGonder() {
  if (!isAdmin) {
    alert('Sadece yöneticiler mesaj gönderebilir!');
    return;
  }
  
  const message = document.getElementById('adminMessage').value.trim();
  const sonuc = document.getElementById('adminMessageSonuc');
  
  if (!message) {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ Mesaj içeriği boş olamaz!";
    return;
  }
  
  const result = await apiCall('/api/admin-messages', 'POST', { message });
  
  if (result.success) {
    sonuc.style.color = "rgba(100, 255, 100, 0.9)";
    sonuc.textContent = "✓ " + result.message;
    
    document.getElementById('adminMessage').value = '';
    
    setTimeout(() => {
      sonuc.textContent = '';
    }, 3000);
  } else {
    sonuc.style.color = "rgba(255, 100, 100, 0.9)";
    sonuc.textContent = "❌ " + result.message;
  }
}

// Admin mesajlarını kontrol et (giriş sonrası)
let messageCheckInterval = null;
let lastCheckedMessageCount = 0;

async function checkAdminMessages() {
  const messages = await apiCall('/api/admin-messages');
  if (messages.length > 0 && messages.length > lastCheckedMessageCount) {
    const latestMessage = messages[messages.length - 1];
    showAdminMessageModal(latestMessage);
    
    await apiCall(`/api/admin-messages/${latestMessage.id}`, 'DELETE');
  }
  
  lastCheckedMessageCount = messages.length;
  
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
  }
  messageCheckInterval = setInterval(async () => {
    if (currentUser) {
      const newMessages = await apiCall('/api/admin-messages');
      if (newMessages.length > 0 && newMessages.length > lastCheckedMessageCount) {
        const latestMessage = newMessages[newMessages.length - 1];
        showAdminMessageModal(latestMessage);
        
        await apiCall(`/api/admin-messages/${latestMessage.id}`, 'DELETE');
        lastCheckedMessageCount = newMessages.length;
      }
    }
  }, 2000);
}

function showAdminMessageModal(message) {
  const modal = document.getElementById('adminMessageModal');
  const messageContent = document.getElementById('modalMessageContent');
  const messageInfo = document.getElementById('modalMessageInfo');
  
  if (!modal || !messageContent || !messageInfo) {
    console.error('Modal elementleri bulunamadı!');
    return;
  }
  
  const displayUser = message.sentBy === '0000' ? 'Admin' : message.sentBy;
  
  messageContent.textContent = message.message;
  messageInfo.textContent = `${message.date} - Gönderen: ${displayUser}`;
  
  modal.classList.add('show');
}

function closeAdminMessageModal() {
  const modal = document.getElementById('adminMessageModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

