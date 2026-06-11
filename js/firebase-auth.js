/**
 * BeamMaster AI — Firebase Authentication Module
 * Handles login/signup gate with Email/Password and Google Sign-In
 */

// Firebase Configuration (civilportal-76872)
const firebaseConfig = {
    apiKey: "AIzaSyDd45rm7WW_ygTvM1tpEi2F0mAu27Vs2Wg",
    authDomain: "civilportal-76872.firebaseapp.com",
    projectId: "civilportal-76872",
    storageBucket: "civilportal-76872.firebasestorage.app",
    messagingSenderId: "1092223476673",
    appId: "1:1092223476673:web:f474080e91e4c022508540",
    measurementId: "G-BDR1RHWCJJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

/**
 * BeamMaster Auth Controller
 */
const BeamAuth = {
    currentUser: null,
    _onAuthReady: null, // callback when auth state resolves

    /**
     * Initialize auth state listener — called once on page load
     */
    init(onAuthReady) {
        this._onAuthReady = onAuthReady;

        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this._showApp(user);
            } else {
                this._showAuthScreen();
            }
            if (this._onAuthReady) {
                this._onAuthReady(user);
                this._onAuthReady = null; // only call once
            }
        });

        this._bindUI();
    },

    /**
     * Bind all auth UI event listeners
     */
    _bindUI() {
        // Toggle between Login and Sign Up forms
        const authToggleLinks = document.querySelectorAll('.auth-toggle-link');
        authToggleLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this._toggleAuthMode();
            });
        });

        // Login form submit
        const loginForm = document.getElementById('auth-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this._handleEmailLogin();
            });
        }

        // Signup form submit
        const signupForm = document.getElementById('auth-signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this._handleEmailSignup();
            });
        }

        // Google Sign-In buttons
        document.querySelectorAll('.btn-google-signin').forEach(btn => {
            btn.addEventListener('click', () => this._handleGoogleSignIn());
        });

        // Forgot password link
        const forgotLink = document.getElementById('auth-forgot-password');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this._handleForgotPassword();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },

    /**
     * Toggle between login and signup views
     */
    _toggleAuthMode() {
        const loginPanel = document.getElementById('auth-login-panel');
        const signupPanel = document.getElementById('auth-signup-panel');
        
        if (loginPanel.classList.contains('auth-panel-active')) {
            loginPanel.classList.remove('auth-panel-active');
            signupPanel.classList.add('auth-panel-active');
        } else {
            signupPanel.classList.remove('auth-panel-active');
            loginPanel.classList.add('auth-panel-active');
        }

        this._clearErrors();
    },

    /**
     * Email/Password Login
     */
    async _handleEmailLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            this._showError('login', 'Please fill in all fields.');
            return;
        }

        this._setLoading('login', true);
        this._clearErrors();

        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            this._showError('login', this._friendlyError(error.code));
        } finally {
            this._setLoading('login', false);
        }
    },

    /**
     * Email/Password Sign Up
     */
    async _handleEmailSignup() {
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (!name || !email || !password || !confirmPassword) {
            this._showError('signup', 'Please fill in all fields.');
            return;
        }

        if (password.length < 6) {
            this._showError('signup', 'Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            this._showError('signup', 'Passwords do not match.');
            return;
        }

        this._setLoading('signup', true);
        this._clearErrors();

        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            // Update display name
            await cred.user.updateProfile({ displayName: name });
        } catch (error) {
            this._showError('signup', this._friendlyError(error.code));
        } finally {
            this._setLoading('signup', false);
        }
    },

    /**
     * Google Sign-In (popup)
     */
    async _handleGoogleSignIn() {
        this._clearErrors();
        try {
            await auth.signInWithPopup(googleProvider);
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                this._showError('login', this._friendlyError(error.code));
            }
        }
    },

    /**
     * Forgot Password — sends reset email
     */
    async _handleForgotPassword() {
        const emailInput = document.getElementById('login-email');
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email) {
            this._showError('login', 'Enter your email address above, then click "Forgot Password".');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            this._showSuccess('login', `Password reset email sent to ${email}. Check your inbox.`);
        } catch (error) {
            this._showError('login', this._friendlyError(error.code));
        }
    },

    /**
     * Logout
     */
    async logout() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    /**
     * Show the main app, hide auth screen
     */
    _showApp(user) {
        const authScreen = document.getElementById('auth-screen');
        const appShell = document.getElementById('app-shell');
        
        if (authScreen) {
            authScreen.classList.add('auth-hidden');
            authScreen.classList.remove('auth-visible');
        }
        if (appShell) {
            appShell.classList.add('app-visible');
            appShell.classList.remove('app-hidden');
        }

        // Update navbar user badge
        this._updateUserBadge(user);
    },

    /**
     * Show auth screen, hide main app
     */
    _showAuthScreen() {
        const authScreen = document.getElementById('auth-screen');
        const appShell = document.getElementById('app-shell');
        
        if (authScreen) {
            authScreen.classList.remove('auth-hidden');
            authScreen.classList.add('auth-visible');
        }
        if (appShell) {
            appShell.classList.remove('app-visible');
            appShell.classList.add('app-hidden');
        }

        // Reset forms
        const loginForm = document.getElementById('auth-login-form');
        const signupForm = document.getElementById('auth-signup-form');
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();

        // Show login panel by default
        const loginPanel = document.getElementById('auth-login-panel');
        const signupPanel = document.getElementById('auth-signup-panel');
        if (loginPanel) loginPanel.classList.add('auth-panel-active');
        if (signupPanel) signupPanel.classList.remove('auth-panel-active');

        this._clearErrors();
    },

    /**
     * Update the navbar user info badge
     */
    _updateUserBadge(user) {
        const badge = document.getElementById('user-badge');
        const userName = document.getElementById('user-display-name');
        const userAvatar = document.getElementById('user-avatar');

        if (!badge) return;

        if (user) {
            badge.style.display = 'flex';
            const displayName = user.displayName || user.email.split('@')[0];
            if (userName) userName.textContent = displayName;
            
            if (userAvatar) {
                if (user.photoURL) {
                    userAvatar.src = user.photoURL;
                    userAvatar.style.display = 'block';
                } else {
                    // Generate initials avatar
                    const initials = displayName.charAt(0).toUpperCase();
                    userAvatar.style.display = 'none';
                    const initialsEl = document.getElementById('user-avatar-initials');
                    if (initialsEl) {
                        initialsEl.textContent = initials;
                        initialsEl.style.display = 'flex';
                    }
                }
            }
        } else {
            badge.style.display = 'none';
        }
    },

    /**
     * Show error message on auth form
     */
    _showError(form, message) {
        const errorEl = document.getElementById(`auth-${form}-error`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    },

    /**
     * Show success message on auth form
     */
    _showSuccess(form, message) {
        const errorEl = document.getElementById(`auth-${form}-error`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            errorEl.classList.add('auth-success');
        }
    },

    /**
     * Clear all error messages
     */
    _clearErrors() {
        document.querySelectorAll('.auth-error-msg').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
            el.classList.remove('auth-success');
        });
    },

    /**
     * Toggle loading state on submit buttons
     */
    _setLoading(form, isLoading) {
        const btn = document.getElementById(`auth-${form}-btn`);
        if (!btn) return;

        if (isLoading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.innerHTML = `<span class="auth-spinner"></span> Please wait...`;
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || 'Submit';
        }
    },

    /**
     * Convert Firebase error codes to friendly messages
     */
    _friendlyError(code) {
        const map = {
            'auth/user-not-found': 'No account found with this email. Please sign up first.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
            'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
            'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
            'auth/network-request-failed': 'Network error. Check your internet connection.',
            'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.',
            'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
            'auth/requires-recent-login': 'Please sign in again to complete this action.',
        };
        return map[code] || `Authentication error. Please try again. (${code})`;
    }
};
