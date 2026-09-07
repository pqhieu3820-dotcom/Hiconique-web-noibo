/**
 * HICONIQUE Auth Module
 * Đăng nhập bằng email công ty + role từ Google Sheets
 *
 * Flow:
 * 1. User nhập email + tên hiển thị
 * 2. Check email trong sheet Members
 * 3. Lấy roleLevel từ sheet
 * 4. Lưu session vào localStorage
 * 5. Áp dụng quyền cho toàn bộ UI
 */

const Auth = (function() {
  'use strict';

  const SESSION_KEY = 'hiconique_auth_session';
  const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  function sessionStorageSkip() {
    try { return localStorage.getItem('skip_auto_login') === '1'; } catch(e) { return false; }
  }

  // Domain whitelist - chấp nhận mọi email hợp lệ
  const ALLOWED_DOMAINS = []; // rỗng = chấp nhận mọi email hợp lệ

  // Role permissions matrix
  const PERMISSIONS = {
    admin: {
      canCreateProject: true,
      canEditProject: true,
      canDeleteProject: true,
      canCreateTask: true,
      canEditAnyTask: true,
      canDeleteAnyTask: true,
      canApproveProposal: true,
      canManageMembers: true,
      canAccessSettings: true,
      canViewAllProjects: true
    },
    manager: {
      canCreateProject: true,
      canEditProject: true,
      canDeleteProject: false, // chỉ admin xóa
      canCreateTask: true,
      canEditAnyTask: true,
      canDeleteAnyTask: false,
      canApproveProposal: true,
      canManageMembers: false,
      canAccessSettings: false,
      canViewAllProjects: true
    },
    member: {
      canCreateProject: false,
      canEditProject: false,
      canDeleteProject: false,
      canCreateTask: true,
      canEditAnyTask: false, // chỉ sửa task của mình
      canDeleteAnyTask: false,
      canApproveProposal: false, // chỉ tạo
      canManageMembers: false,
      canAccessSettings: false,
      canViewAllProjects: true // vẫn xem được
    }
  };

  // Current session
  let currentUser = null;

  // Get current session from localStorage
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      // Check expiry
      if (session.expiresAt && session.expiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  // Save session
  function saveSession(user) {
    var session = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLevel: user.roleLevel,
      color: user.color,
      avatar: user.avatar,
      hometown: user.hometown,
      createdAt: user.createdAt,
      loggedInAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    currentUser = session;
    return session;
  }

  // Check if email is in allowed domain
  function isAllowedEmail(email) {
    if (!email) return false;
    // Nếu ALLOWED_DOMAINS rỗng thì chấp nhận mọi email
    if (ALLOWED_DOMAINS.length === 0) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    var domain = email.split('@')[1];
    return ALLOWED_DOMAINS.indexOf(domain) !== -1;
  }

  // Login by email - match with Members sheet
  function login(email, callback) {
    if (!email) {
      if (callback) callback({ success: false, error: 'Vui lòng nhập email' });
      return;
    }

    if (!isAllowedEmail(email)) {
      if (callback) callback({
        success: false,
        error: 'Vui lòng nhập email hợp lệ'
      });
      return;
    }

    // Find member by email from TaskManager
    var members = TaskManager.getMembers();
    var member = members.find(function(m) {
      return m.email && m.email.toLowerCase() === email.toLowerCase();
    });

    if (!member) {
      if (callback) callback({
        success: false,
        error: 'Email chưa được đăng ký. Vui lòng liên hệ Admin để được cấp tài khoản.'
      });
      return;
    }

    var session = saveSession(member);
    if (callback) callback({ success: true, user: session });
  }

  // Logout
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    // Flag to prevent auto-login after explicit logout, survives reload/navigation
    try { localStorage.setItem('skip_auto_login', '1'); } catch(e) {}
    return true;
  }

  // Get current user (synchronous)
  function getCurrentUser() {
    if (currentUser) return currentUser;
    var session = getSession();
    if (session) {
      currentUser = session;
      return session;
    }
    return null;
  }

  // Check if user has permission
  function hasPermission(perm) {
    var user = getCurrentUser();
    if (!user) return false;
    var perms = PERMISSIONS[user.roleLevel] || PERMISSIONS.member;
    return perms[perm] === true;
  }

  // Check role level
  function isAdmin() {
    var user = getCurrentUser();
    return user && user.roleLevel === 'admin';
  }

  function isManager() {
    var user = getCurrentUser();
    return user && (user.roleLevel === 'manager' || user.roleLevel === 'admin');
  }

  function isMember() {
    return getCurrentUser() !== null;
  }

  // Show login modal
  function showLoginModal() {
    var existing = document.getElementById('authLoginModal');
    if (existing) existing.remove();

    var html = `
      <div id="authLoginModal" style="position: fixed; inset: 0; background: rgba(11,13,16,0.85); backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; max-width: 440px; width: 100%; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: var(--color-bronze); border-radius: 14px; display: grid; place-items: center; font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; color: #0B0D10;">H</div>
            <h2 style="font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--color-text); margin: 0 0 4px;">HICONIQUE Internal Hub</h2>
            <p style="font-size: 0.875rem; color: var(--color-text-muted); margin: 0;">Đăng nhập hoặc đăng ký tài khoản</p>
          </div>

          <!-- Login Form -->
          <form id="authLoginForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Email công ty</label>
              <input type="email" id="authEmailInput" required placeholder="ten@gmail.com" value="pqhieu3820@gmail.com"
                style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none; transition: border 0.2s;"
                onfocus="this.style.borderColor='var(--color-bronze)'"
                onblur="this.style.borderColor='var(--color-border)'"
                autocomplete="email">
            </div>

            <div>
              <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Mật khẩu</label>
              <input type="password" id="authPasswordInput" required placeholder="Nhập mật khẩu" value="123456"
                style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none; transition: border 0.2s;"
                onfocus="this.style.borderColor='var(--color-bronze)'"
                onblur="this.style.borderColor='var(--color-border)'"
                autocomplete="current-password">
            </div>

            <div id="authError" style="display: none; padding: 10px 12px; background: rgba(160,72,72,0.1); border: 1px solid rgba(160,72,72,0.3); border-radius: 6px; color: #A04848; font-size: 0.8125rem;"></div>

            <button type="submit"
              style="width: 100%; padding: 12px; background: var(--color-bronze); color: #0B0D10; border: none; border-radius: 8px; font-size: 0.9375rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s;">
              Đăng nhập
            </button>
          </form>

          <div style="text-align: center; margin-top: 16px;">
            <button type="button" id="showRegisterBtn" style="background: none; border: none; color: var(--color-bronze); font-size: 0.875rem; cursor: pointer; text-decoration: underline;">
              Chưa có tài khoản? Đăng ký ngay
            </button>
          </div>

          <p style="margin: 20px 0 0; padding-top: 20px; border-top: 1px solid var(--color-border); text-align: center; font-size: 0.75rem; color: var(--color-text-muted);">
            🔒 Chỉ nhân viên HICONIQUE được cấp quyền truy cập
          </p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    var form = document.getElementById('authLoginForm');
    var emailInput = document.getElementById('authEmailInput');
    var passwordInput = document.getElementById('authPasswordInput');
    var errorEl = document.getElementById('authError');
    var registerBtn = document.getElementById('showRegisterBtn');

    emailInput.focus();

    // Auto-login với tài khoản CEO mặc định
    setTimeout(function() {
      var savedSession = localStorage.getItem(SESSION_KEY);
      if (!savedSession && !sessionStorageSkip() && typeof window.Auth !== 'undefined') {
        // Chưa có session, auto-login với tài khoản CEO
        emailInput.value = 'pqhieu3820@gmail.com';
        passwordInput.value = '123456';
        // Tự động đăng nhập
        window.Auth.loginWithPassword('pqhieu3820@gmail.com', '123456', function(result) {
          if (result.success) {
            try { localStorage.removeItem('skip_auto_login'); } catch(e) {}
            document.getElementById('authLoginModal').remove();
            if (window.onAuthSuccess) window.onAuthSuccess(result.user);
            else window.location.reload();
          }
        });
      }
    }, 500);

    // Login handler
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = emailInput.value.trim();
      var password = passwordInput.value;
      errorEl.style.display = 'none';

      loginWithPassword(email, password, function(result) {
        if (result.success) {
          try { localStorage.removeItem('skip_auto_login'); } catch(e) {}
          document.getElementById('authLoginModal').remove();
          if (window.onAuthSuccess) window.onAuthSuccess(result.user);
          else window.location.reload();
        } else {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
      });
    });

    // Show register form
    if (registerBtn) {
      registerBtn.addEventListener('click', function() {
        showRegisterModal();
      });
    }
  }

  // Show registration modal
  function showRegisterModal() {
    var existing = document.getElementById('authLoginModal');
    if (existing) existing.remove();

    var html = `
      <div id="authLoginModal" style="position: fixed; inset: 0; background: rgba(11,13,16,0.85); backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; max-width: 440px; width: 100%; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: var(--color-bronze); border-radius: 14px; display: grid; place-items: center; font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; color: #0B0D10;">H</div>
            <h2 style="font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--color-text); margin: 0 0 4px;">Đăng ký tài khoản</h2>
            <p style="font-size: 0.875rem; color: var(--color-text-muted); margin: 0;">Nhập thông tin để đăng ký</p>
          </div>

          <form id="authRegisterForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Họ và tên *</label>
              <input type="text" id="regNameInput" required placeholder="Nguyễn Văn A"
                style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none; transition: border 0.2s;">
            </div>

            <div>
              <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Email công ty *</label>
              <input type="email" id="regEmailInput" required placeholder="a@gmail.com"
                style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none; transition: border 0.2s;">
            </div>

            <div>
              <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Chức vụ</label>
              <input type="text" id="regRoleInput" placeholder="Nhân viên thiết kế"
                style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none; transition: border 0.2s;">
            </div>

            <div>
              <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Mật khẩu *</label>
              <input type="password" id="regPasswordInput" required placeholder="Nhập mật khẩu bất kỳ"
                style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none; transition: border 0.2s;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Ngày sinh</label>
                <input type="date" id="regDobInput"
                  style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">CCCD/CMND</label>
                <input type="text" id="regCccdInput" placeholder="Số CCCD"
                  style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Số điện thoại</label>
                <input type="tel" id="regPhoneInput" placeholder="09xxxxxxxx"
                  style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Quê quán</label>
                <input type="text" id="regHometownInput" placeholder="Địa chỉ quê quán"
                  style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Ngân hàng</label>
                <input type="text" id="regBankNameInput" placeholder="Vd: Vietcombank"
                  style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); margin-bottom: 6px;">Số tài khoản</label>
                <input type="text" id="regBankAccountInput" placeholder="Số TK nhận lương"
                  style="width: 100%; padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; color: var(--color-text); font-size: 0.9375rem; font-family: inherit; outline: none;">
              </div>
            </div>

            <div id="authError" style="display: none; padding: 10px 12px; background: rgba(160,72,72,0.1); border: 1px solid rgba(160,72,72,0.3); border-radius: 6px; color: #A04848; font-size: 0.8125rem;"></div>
            <div id="authSuccess" style="display: none; padding: 10px 12px; background: rgba(79,111,82,0.1); border: 1px solid rgba(79,111,82,0.3); border-radius: 6px; color: #4F6F52; font-size: 0.8125rem;"></div>

            <button type="submit"
              style="width: 100%; padding: 12px; background: var(--color-bronze); color: #0B0D10; border: none; border-radius: 8px; font-size: 0.9375rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s;">
              Đăng ký
            </button>
          </form>

          <div style="text-align: center; margin-top: 16px;">
            <button type="button" id="showLoginBtn" style="background: none; border: none; color: var(--color-bronze); font-size: 0.875rem; cursor: pointer; text-decoration: underline;">
              Đã có tài khoản? Đăng nhập
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    var form = document.getElementById('authRegisterForm');
    var nameInput = document.getElementById('regNameInput');
    var emailInput = document.getElementById('regEmailInput');
    var roleInput = document.getElementById('regRoleInput');
    var passwordInput = document.getElementById('regPasswordInput');
    var dobInput = document.getElementById('regDobInput');
    var cccdInput = document.getElementById('regCccdInput');
    var phoneInput = document.getElementById('regPhoneInput');
    var hometownInput = document.getElementById('regHometownInput');
    var bankNameInput = document.getElementById('regBankNameInput');
    var bankAccountInput = document.getElementById('regBankAccountInput');
    var errorEl = document.getElementById('authError');
    var successEl = document.getElementById('authSuccess');
    var loginBtn = document.getElementById('showLoginBtn');

    nameInput.focus();

    // Register handler
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      var role = roleInput.value.trim() || 'Nhân viên';
      var password = passwordInput.value;
      var dob = dobInput.value;
      var cccd = cccdInput.value.trim();
      var phone = phoneInput.value.trim();
      var hometown = hometownInput.value.trim();
      var bankName = bankNameInput.value.trim();
      var bankAccount = bankAccountInput.value.trim();
      errorEl.style.display = 'none';
      successEl.style.display = 'none';

      if (!isAllowedEmail(email)) {
        errorEl.textContent = 'Vui lòng nhập email hợp lệ';
        errorEl.style.display = 'block';
        return;
      }

      register(name, email, role, password, dob, cccd, phone, hometown, bankName, bankAccount, function(result) {
        if (result.success) {
          successEl.textContent = '✓ Đăng ký thành công! Đang chuyển sang đăng nhập...';
          successEl.style.display = 'block';
          setTimeout(function() {
            showLoginModal();
          }, 1500);
        } else {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
      });
    });

    // Show login
    if (loginBtn) {
      loginBtn.addEventListener('click', function() {
        showLoginModal();
      });
    }
  }

  // Register new member
  function register(name, email, role, password, dob, cccd, phone, hometown, bankName, bankAccount, callback) {
    if (!isAllowedEmail(email)) {
      if (callback) callback({ success: false, error: 'Email không hợp lệ' });
      return;
    }

    // Check if email already exists
    var members = TaskManager.getMembers();
    var existing = members.find(function(m) {
      return m.email && m.email.toLowerCase() === email.toLowerCase();
    });

    if (existing) {
      if (callback) callback({ success: false, error: 'Email đã được đăng ký. Vui lòng đăng nhập.' });
      return;
    }

    // Generate member ID
    var id = 'MEM_' + Date.now().toString(36).toUpperCase();

    // Generate avatar from name
    var avatar = name.split(' ').map(function(w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();

    // Generate random color
    var colors = ['#B08D57', '#8E7CC3', '#C7A464', '#4F6F52', '#3B6B8C', '#B8725A', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1'];
    var color = colors[Math.floor(Math.random() * colors.length)];

    // Create new member object with all fields
    var newMember = {
      id: id,
      name: name,
      role: role,
      roleLevel: 'member',
      email: email,
      password: password,
      dob: dob || '',
      cccd: cccd || '',
      phone: phone || '',
      hometown: hometown || '',
      bank: bankName || '',
      bankAccount: bankAccount || '',
      color: color,
      avatar: avatar,
      createdAt: new Date().toISOString().split('T')[0]
    };

    // Save to localStorage first (will sync to sheet)
    var currentMembers = TaskManager.getMembers();
    currentMembers.push(newMember);
    localStorage.setItem('hiconique_members', JSON.stringify(currentMembers));

    // Sync to Google Sheets
    if (typeof syncToGSheets === 'function') {
      syncToGSheets('members', 'add', newMember);
    }

    if (callback) callback({ success: true, member: newMember });
  }

  // Login with password
  function loginWithPassword(email, password, callback) {
    if (!email) {
      if (callback) callback({ success: false, error: 'Vui lòng nhập email' });
      return;
    }

    if (!isAllowedEmail(email)) {
      if (callback) callback({ success: false, error: 'Vui lòng nhập email hợp lệ' });
      return;
    }

    // Find member by email
    var members = TaskManager.getMembers();
    var member = members.find(function(m) {
      return m.email && m.email.toLowerCase() === email.toLowerCase();
    });

    if (!member) {
      // Try to register automatically if email is allowed
      if (isAllowedEmail(email)) {
        if (callback) callback({ success: false, error: 'Tài khoản chưa tồn tại. Vui lòng đăng ký trước.' });
        return;
      }
      if (callback) callback({ success: false, error: 'Email chưa được đăng ký' });
      return;
    }

    // Check password - convert both to string for comparison
    if (member.password && String(member.password) !== String(password)) {
      if (callback) callback({ success: false, error: 'Mật khẩu không đúng' });
      return;
    }

    var session = saveSession(member);
    if (callback) callback({ success: true, user: session });
  }

  // Logout function
  function showLogout() {
    logout();
    showLoginModal();
  }

  // Initialize auth - require login
  function init(required) {
    var user = getCurrentUser();
    if (!user && required) {
      showLoginModal();
      return null;
    }
    return user;
  }

  return {
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    hasPermission: hasPermission,
    isAdmin: isAdmin,
    isManager: isManager,
    isMember: isMember,
    showLoginModal: showLoginModal,
    showLogout: showLogout,
    init: init,
    PERMISSIONS: PERMISSIONS,
    ALLOWED_DOMAINS: ALLOWED_DOMAINS,
    loginWithPassword: loginWithPassword,
    register: register,
    isAllowedEmail: isAllowedEmail
  };
})();

// Export for browser
if (typeof window !== 'undefined') {
  window.Auth = Auth;
}