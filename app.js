// app.js
let currentUser = null;

// ===== STORAGE =====
function getUsers() {
  try { return JSON.parse(localStorage.getItem('bio_users') || '[]'); }
  catch { return []; }
}
function setUsers(u) { localStorage.setItem('bio_users', JSON.stringify(u)); }

function getPosts() {
  try { return JSON.parse(localStorage.getItem('bio_posts') || '[]'); }
  catch { return []; }
}
function setPosts(p) { localStorage.setItem('bio_posts', JSON.stringify(p)); }

// ===== UTILS =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}
function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return Math.floor(diff/60) + ' phút trước';
  if (diff < 86400) return Math.floor(diff/3600) + ' giờ trước';
  if (diff < 604800) return Math.floor(diff/86400) + ' ngày trước';
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
}
function initial(name) { return (name || '?').charAt(0).toUpperCase(); }
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// ===== AUTH UI =====
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('registerForm').classList.toggle('hidden', isLogin);
  hideError();
}
function showError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg; el.classList.add('show');
}
function hideError() {
  document.getElementById('authError').classList.remove('show');
}

function doRegister(e) {
  e.preventDefault(); hideError();
  const username = document.getElementById('regUser').value.trim().toLowerCase();
  const password = document.getElementById('regPass').value;
  const dob = document.getElementById('regDob').value;

  if (username.length < 3) return showError('Tên đăng nhập phải từ 3 ký tự');
  if (!/^[a-z0-9_]+$/.test(username)) return showError('Tên chỉ dùng chữ thường, số, gạch dưới');
  if (password.length < 6) return showError('Mật khẩu từ 6 ký tự');
  if (!dob) return showError('Vui lòng chọn ngày sinh');

  const users = getUsers();
  if (users.find(u => u.username === username)) return showError('Tên đăng nhập đã tồn tại');

  const color = CONFIG.AVATAR_COLORS[Math.floor(Math.random() * CONFIG.AVATAR_COLORS.length)];
  const user = {
    username,
    password,
    displayName: username,
    dob,
    color,
    created_at: new Date().toISOString()
  };
  users.push(user);
  setUsers(users);

  currentUser = user;
  localStorage.setItem('bio_currentUser', JSON.stringify(user));
  showApp();
}

function doLogin(e) {
  e.preventDefault(); hideError();
  const username = document.getElementById('loginUser').value.trim().toLowerCase();
  const password = document.getElementById('loginPass').value;

  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return showError('Sai tên đăng nhập hoặc mật khẩu');

  currentUser = user;
  localStorage.setItem('bio_currentUser', JSON.stringify(user));
  showApp();
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('bio_currentUser');
  showAuth();
}

function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}
function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  const av = document.getElementById('myAvatar');
  av.textContent = initial(currentUser.displayName);
  av.style.background = currentUser.color;
  document.getElementById('myName').textContent = currentUser.displayName;
  loadPosts();
}

// ===== RENDER =====
function renderFile(p) {
  if (!p.file_data) return '';
  const url = p.file_data;
  const name = escapeHtml(p.file_name || 'Tệp đính kèm');
  const t = p.file_type || '';
  if (t.startsWith('image/'))
    return `<a class="attachment" href="${url}" download="${name}">🖼️ ${name}<br><img src="${url}" alt="${name}"></a>`;
  if (t.startsWith('video/'))
    return `<div class="attachment">🎬 ${name}<br><video src="${url}" controls style="max-width:100%;margin-top:8px;border-radius:8px;"></video></div>`;
  if (t.startsWith('audio/'))
    return `<div class="attachment">🎵 ${name}<br><audio src="${url}" controls style="width:100%;margin-top:8px;"></audio></div>`;
  return `<a class="attachment" href="${url}" download="${name}">📎 ${name}</a>`;
}

function renderPost(p) {
  const avColor = p.avatar_color || '#667eea';
  const commentsHtml = (p.comments || []).map(c => {
    const cColor = c.user_color || '#667eea';
    const canDel = currentUser && c.user_id === currentUser.username;
    return `
      <div class="comment">
        <div class="c-avatar" style="background:${cColor}">${initial(c.name)}</div>
        <div class="c-body">
          <div>
            <span class="c-name">${escapeHtml(c.name)}</span>
            <span class="c-time">${formatTime(c.created_at)}</span>
          </div>
          <div class="c-text">${escapeHtml(c.content)}</div>
        </div>
        ${canDel ? `<button class="c-del" onclick="deleteComment('${p.id}', ${c.id})" title="Xóa">✕</button>` : ''}
      </div>`;
  }).join('') || '<div style="color:#999;font-size:13px;text-align:center;padding:8px;">Chưa có bình luận</div>';

  const delBtn = (currentUser && p.user_id === currentUser.username)
    ? `<button class="del-btn" onclick="deletePost('${p.id}')" title="Xóa bài">🗑️</button>` : '';

  const liked = currentUser && (p.hearts_users || []).includes(currentUser.username);
  const heartCount = (p.hearts_users || []).length;

  return `
    <div class="card post" data-id="${p.id}">
      <div class="post-header">
        <div class="avatar" style="background:${avColor}">${initial(p.name)}</div>
        <div class="post-meta">
          <div class="post-name">${escapeHtml(p.name)}</div>
          <div class="post-time">${formatTime(p.created_at)}</div>
        </div>
        ${delBtn}
      </div>
      <div class="post-content">${escapeHtml(p.content)}</div>
      ${renderFile(p)}
      <div class="actions">
        <button class="heart-btn ${liked ? 'liked' : ''}" onclick="likePost('${p.id}', this)">
          ${liked ? '❤️' : '🤍'} <span class="heart-count">${heartCount}</span>
        </button>
        <button class="comment-toggle" onclick="toggleComments('${p.id}')">💬 Bình luận (${(p.comments || []).length})</button>
      </div>
      <div class="comments" id="comments-${p.id}">
        <div class="comment-list">${commentsHtml}</div>
        <div class="comment-form">
          <input type="text" name="ctext" placeholder="Viết bình luận..." maxlength="500">
          <button onclick="submitComment('${p.id}', this)">Gửi</button>
        </div>
      </div>
    </div>
  `;
}

function loadPosts() {
  const posts = getPosts().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  document.getElementById('posts').innerHTML = posts.map(renderPost).join('') ||
    '<div class="card" style="text-align:center;color:#888;">Chưa có bài viết nào</div>';
}

// ===== ACTIONS =====
async function submitPost(e) {
  const content = document.getElementById('content').value.trim();
  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];
  if (!content) return alert('Vui lòng nhập nội dung!');

  const btn = e.target;
  btn.disabled = true; btn.textContent = 'Đang đăng...';

  try {
    const postId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let file_data = null, file_name = null, file_type = null;

    if (file) {
      if (file.size > CONFIG.MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`File quá lớn (max ${CONFIG.MAX_FILE_MB}MB)`);
      }
      file_data = await fileToBase64(file);
      file_name = file.name;
      file_type = file.type || 'application/octet-stream';
    }

    const posts = getPosts();
    posts.push({
      id: postId,
      user_id: currentUser.username,
      name: currentUser.displayName,
      avatar_color: currentUser.color,
      content,
      file_data, file_name, file_type,
      created_at: new Date().toISOString(),
      comments: [],
      hearts_users: []
    });

    try {
      setPosts(posts);
    } catch (err) {
      throw new Error('Bộ nhớ đầy! Xóa bớt bài cũ hoặc file nhỏ hơn.');
    }

    document.getElementById('content').value = '';
    fileInput.value = '';
    loadPosts();
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
  btn.disabled = false; btn.textContent = '🚀 Đăng bài';
}

function deletePost(postId) {
  if (!confirm('Xóa bài này?')) return;
  const posts = getPosts();
  const idx = posts.findIndex(p => p.id === postId);
  if (idx === -1) return;
  if (posts[idx].user_id !== currentUser.username) return alert('Không có quyền');
  posts.splice(idx, 1);
  setPosts(posts);
  loadPosts();
}

function likePost(postId, btn) {
  btn.classList.add('pop');
  setTimeout(() => btn.classList.remove('pop'), 400);

  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  if (!post.hearts_users) post.hearts_users = [];
  post.hearts_users.push(currentUser.username);
  setPosts(posts);

  btn.querySelector('.heart-count').textContent = post.hearts_users.length;
  btn.classList.add('liked');
  btn.childNodes[0].textContent = '❤️ ';
}

function toggleComments(id) {
  document.getElementById('comments-' + id).classList.toggle('open');
}

function submitComment(postId, btn) {
  const form = btn.parentElement;
  const input = form.querySelector('input[name="ctext"]');
  const content = input.value.trim();
  if (!content) return;

  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  if (!post.comments) post.comments = [];
  post.comments.push({
    id: Date.now(),
    user_id: currentUser.username,
    name: currentUser.displayName,
    user_color: currentUser.color,
    content,
    created_at: new Date().toISOString()
  });
  setPosts(posts);

  input.value = '';
  loadPosts();
  document.getElementById('comments-' + postId).classList.add('open');
}

function deleteComment(postId, commentId) {
  if (!confirm('Xóa bình luận này?')) return;
  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const idx = post.comments.findIndex(c => c.id === commentId);
  if (idx === -1) return;
  if (post.comments[idx].user_id !== currentUser.username) return alert('Không có quyền');
  post.comments.splice(idx, 1);
  setPosts(posts);
  loadPosts();
  document.getElementById('comments-' + postId).classList.add('open');
}

// ===== INIT =====
(function init() {
  const saved = localStorage.getItem('bio_currentUser');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showApp();
      return;
    } catch (e) {}
  }
  showAuth();
})();
