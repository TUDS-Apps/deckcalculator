/**
 * Firebase Configuration and Services
 * Handles authentication and Firestore database operations
 *
 * Data Structure:
 * - /stores/{storeId} - Store info and member list
 * - /users/{email} - User profile and store memberships
 * - /projects/{projectId} - Projects with storeId for team sharing
 */

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3ZGbM_SWcnpeZTy9bTOJKtZiz-oDCuHU",
  authDomain: "tuds-pro-deck-estimator.firebaseapp.com",
  projectId: "tuds-pro-deck-estimator",
  storageBucket: "tuds-pro-deck-estimator.firebasestorage.app",
  messagingSenderId: "762759711782",
  appId: "1:762759711782:web:a67f45f30ad48aac4deae7",
  measurementId: "G-1BSYDC1J0Z"
};

// Firebase instances (initialized after SDK loads)
let app = null;
let auth = null;
let db = null;
let googleProvider = null;

// Current user state
let currentUser = null;
let currentUserProfile = null; // User profile from Firestore

// Auth state change callbacks
const authStateCallbacks = [];

/**
 * Initialize Firebase
 * Called after Firebase SDK scripts are loaded
 */
function initializeFirebase() {
  try {
    // Initialize Firebase app
    app = firebase.initializeApp(firebaseConfig);

    // Initialize services
    auth = firebase.auth();
    db = firebase.firestore();

    // Set up Google provider
    googleProvider = new firebase.auth.GoogleAuthProvider();

    // Listen for auth state changes
    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      console.log('[Firebase] Auth state changed:', user ? user.email : 'signed out');

      // Load/create user profile when signed in
      if (user) {
        await loadOrCreateUserProfile(user);
      } else {
        currentUserProfile = null;
      }

      // Notify all callbacks
      authStateCallbacks.forEach(callback => {
        try {
          callback(user, currentUserProfile);
        } catch (err) {
          console.error('[Firebase] Auth callback error:', err);
        }
      });
    });

    console.log('[Firebase] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    return false;
  }
}

// Internal staff email domain - users with this domain auto-join their store
const INTERNAL_EMAIL_DOMAIN = '@tuds.ca';
const DEFAULT_STORE_ID = 'tuds-main'; // Default store for TUDS employees

/**
 * Check if email is an internal staff email
 */
function isInternalStaffEmail(email) {
  return email.toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN);
}

/**
 * Check if current user is internal staff (has store membership)
 */
function isInternalStaff() {
  return currentUserProfile?.stores?.length > 0;
}

/**
 * Load or create user profile in Firestore
 */
async function loadOrCreateUserProfile(user) {
  try {
    const userEmail = user.email.toLowerCase();
    const userRef = db.collection('users').doc(userEmail);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      currentUserProfile = { id: userEmail, ...userDoc.data() };

      // Check if internal staff without store assignment (edge case)
      if (isInternalStaffEmail(userEmail) && (!currentUserProfile.stores || currentUserProfile.stores.length === 0)) {
        await autoAssignToStore(userEmail, DEFAULT_STORE_ID);
        currentUserProfile.stores = [DEFAULT_STORE_ID];
      }

      console.log('[Firebase] Loaded user profile:', currentUserProfile);
    } else {
      // Create new user profile
      const isInternal = isInternalStaffEmail(userEmail);
      const newProfile = {
        email: userEmail,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || null,
        phone: null, // Phone number for lead capture
        phoneAddedAt: null,
        stores: isInternal ? [DEFAULT_STORE_ID] : [], // Auto-assign internal staff
        isInternalStaff: isInternal,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await userRef.set(newProfile);
      currentUserProfile = { id: userEmail, ...newProfile };

      // If internal staff, also add to store's members list
      if (isInternal) {
        await autoAssignToStore(userEmail, DEFAULT_STORE_ID);
      }

      console.log('[Firebase] Created new user profile:', currentUserProfile);
    }
  } catch (error) {
    console.error('[Firebase] Load user profile error:', error);
    currentUserProfile = null;
  }
}

/**
 * Auto-assign user to a store (used for internal staff auto-detection)
 */
async function autoAssignToStore(userEmail, storeId) {
  try {
    // Add user to store's members array
    const storeRef = db.collection('stores').doc(storeId);
    await storeRef.set({
      members: firebase.firestore.FieldValue.arrayUnion(userEmail)
    }, { merge: true });

    console.log('[Firebase] Auto-assigned', userEmail, 'to store', storeId);
  } catch (error) {
    console.error('[Firebase] Auto-assign to store error:', error);
  }
}

/**
 * Register a callback for auth state changes
 */
function onAuthStateChanged(callback) {
  authStateCallbacks.push(callback);
  // Immediately call with current state if available
  if (auth) {
    callback(currentUser, currentUserProfile);
  }
}

/**
 * Get current user
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Get current user profile (includes stores)
 */
function getCurrentUserProfile() {
  return currentUserProfile;
}

/**
 * Get user's store IDs
 */
function getUserStores() {
  return currentUserProfile?.stores || [];
}

/**
 * Check if user is signed in
 */
function isSignedIn() {
  return currentUser !== null;
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Sign up with email and password
 */
async function signUpWithEmail(email, password, displayName) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);

    // Update profile with display name
    if (displayName && result.user) {
      await result.user.updateProfile({ displayName });
    }

    console.log('[Firebase] Sign up successful:', result.user.email);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('[Firebase] Sign up error:', error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

/**
 * Sign in with email and password
 */
async function signInWithEmail(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    console.log('[Firebase] Sign in successful:', result.user.email);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('[Firebase] Sign in error:', error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    console.log('[Firebase] Google sign in successful:', result.user.email);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('[Firebase] Google sign in error:', error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

/**
 * Sign out
 */
async function signOut() {
  try {
    await auth.signOut();
    console.log('[Firebase] Sign out successful');
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Sign out error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    console.log('[Firebase] Password reset email sent');
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Password reset error:', error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

/**
 * Update user's phone number
 * @param {string} phone - Phone number to save
 */
async function updateUserPhone(phone) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    const userEmail = currentUser.email.toLowerCase();
    const userRef = db.collection('users').doc(userEmail);

    await userRef.update({
      phone: phone,
      phoneAddedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update local profile
    currentUserProfile.phone = phone;
    currentUserProfile.phoneAddedAt = new Date().toISOString();

    console.log('[Firebase] Phone updated for:', userEmail);
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Update phone error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if current user needs to provide phone number
 * @returns {boolean} True if user is signed in but has no phone
 */
function needsPhoneNumber() {
  return currentUser && currentUserProfile && !currentUserProfile.phone;
}

/**
 * Get user-friendly auth error messages
 */
function getAuthErrorMessage(error) {
  const errorMessages = {
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Please check your connection.'
  };

  return errorMessages[error.code] || error.message;
}

// ============================================
// FIRESTORE - PROJECT FUNCTIONS
// ============================================

/**
 * Save a project to Firestore
 * Projects are stored in top-level collection with storeId for sharing
 */
async function saveProjectToCloud(projectData) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in to save projects.' };
  }

  try {
    const projectsRef = db.collection('projects');

    const dataToSave = {
      ...projectData,
      // Ownership
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email.toLowerCase(),
      createdByName: currentUser.displayName || currentUser.email.split('@')[0],
      // Store association (required for team sharing)
      storeId: projectData.storeId || projectData.store || null,
      // Timestamps
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: projectData.createdAt || firebase.firestore.FieldValue.serverTimestamp()
    };

    // Remove any undefined values
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === undefined) {
        delete dataToSave[key];
      }
    });

    let docRef;
    if (projectData.id && !projectData.id.startsWith('local_')) {
      // Update existing cloud project
      docRef = projectsRef.doc(projectData.id);
      await docRef.set(dataToSave, { merge: true });
    } else {
      // Create new project
      docRef = await projectsRef.add(dataToSave);
    }

    console.log('[Firebase] Project saved:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('[Firebase] Save project error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load user's own projects
 */
async function loadMyProjects() {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.', projects: [] };
  }

  try {
    const projectsRef = db.collection('projects');
    const snapshot = await projectsRef
      .where('createdByEmail', '==', currentUser.email.toLowerCase())
      .orderBy('updatedAt', 'desc')
      .get();

    const projects = [];
    snapshot.forEach(doc => {
      projects.push(formatProjectData(doc));
    });

    console.log('[Firebase] Loaded', projects.length, 'personal projects');
    return { success: true, projects };
  } catch (error) {
    console.error('[Firebase] Load my projects error:', error);
    return { success: false, error: error.message, projects: [] };
  }
}

/**
 * Load all projects from user's stores (team projects)
 */
async function loadStoreProjects(storeId = null) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.', projects: [] };
  }

  try {
    const userStores = getUserStores();

    if (userStores.length === 0 && !storeId) {
      console.log('[Firebase] User has no store memberships');
      return { success: true, projects: [] };
    }

    const projectsRef = db.collection('projects');
    let query;

    if (storeId) {
      // Load projects for a specific store
      query = projectsRef.where('storeId', '==', storeId);
    } else if (userStores.length === 1) {
      // Single store - simple query
      query = projectsRef.where('storeId', '==', userStores[0]);
    } else {
      // Multiple stores - use 'in' query (max 10 stores)
      query = projectsRef.where('storeId', 'in', userStores.slice(0, 10));
    }

    const snapshot = await query.orderBy('updatedAt', 'desc').get();

    const projects = [];
    snapshot.forEach(doc => {
      projects.push(formatProjectData(doc));
    });

    console.log('[Firebase] Loaded', projects.length, 'store projects');
    return { success: true, projects };
  } catch (error) {
    console.error('[Firebase] Load store projects error:', error);
    return { success: false, error: error.message, projects: [] };
  }
}

/**
 * Load all projects (my + store projects combined)
 */
async function loadAllAccessibleProjects() {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.', projects: [] };
  }

  try {
    // Load both in parallel
    const [myResult, storeResult] = await Promise.all([
      loadMyProjects(),
      loadStoreProjects()
    ]);

    // Combine and deduplicate (my projects might also be in store projects)
    const projectMap = new Map();

    // Add my projects first
    if (myResult.success) {
      myResult.projects.forEach(p => {
        projectMap.set(p.id, { ...p, isMine: true });
      });
    }

    // Add store projects (mark as mine if already exists)
    if (storeResult.success) {
      storeResult.projects.forEach(p => {
        if (projectMap.has(p.id)) {
          // Already have this one, it's mine
        } else {
          projectMap.set(p.id, { ...p, isMine: false });
        }
      });
    }

    // Convert to array and sort by updatedAt
    const projects = Array.from(projectMap.values());
    projects.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0);
      const dateB = new Date(b.updatedAt || 0);
      return dateB - dateA;
    });

    console.log('[Firebase] Loaded', projects.length, 'total accessible projects');
    return { success: true, projects };
  } catch (error) {
    console.error('[Firebase] Load all projects error:', error);
    return { success: false, error: error.message, projects: [] };
  }
}

/**
 * Load a single project by ID
 */
async function loadProjectFromCloud(projectId) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    const docRef = db.collection('projects').doc(projectId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { success: false, error: 'Project not found.' };
    }

    const project = formatProjectData(doc);

    // Check access: user owns it OR it's in their store
    const userStores = getUserStores();
    const canAccess =
      project.createdByEmail === currentUser.email.toLowerCase() ||
      userStores.includes(project.storeId);

    if (!canAccess) {
      return { success: false, error: 'You do not have access to this project.' };
    }

    console.log('[Firebase] Loaded project:', projectId);
    return { success: true, project };
  } catch (error) {
    console.error('[Firebase] Load project error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a project from Firestore
 * Only owner can delete
 */
async function deleteProjectFromCloud(projectId) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    const docRef = db.collection('projects').doc(projectId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { success: false, error: 'Project not found.' };
    }

    // Check ownership
    const data = doc.data();
    if (data.createdByEmail !== currentUser.email.toLowerCase()) {
      return { success: false, error: 'Only the project owner can delete it.' };
    }

    await docRef.delete();

    console.log('[Firebase] Project deleted:', projectId);
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Delete project error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format project data from Firestore document
 */
function formatProjectData(doc) {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    // Convert Firestore timestamps to ISO strings
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
  };
}

// ============================================
// FIRESTORE - STORE FUNCTIONS
// ============================================

/**
 * Get all stores
 */
async function loadStores() {
  try {
    const storesRef = db.collection('stores');
    const snapshot = await storesRef.orderBy('name').get();

    const stores = [];
    snapshot.forEach(doc => {
      stores.push({ id: doc.id, ...doc.data() });
    });

    console.log('[Firebase] Loaded', stores.length, 'stores');
    return { success: true, stores };
  } catch (error) {
    console.error('[Firebase] Load stores error:', error);
    return { success: false, error: error.message, stores: [] };
  }
}

/**
 * Save/update a store (admin only)
 */
async function saveStore(storeData) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    const storesRef = db.collection('stores');
    const storeId = storeData.id || storeData.name.toLowerCase().replace(/\s+/g, '-');

    await storesRef.doc(storeId).set({
      ...storeData,
      id: storeId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('[Firebase] Store saved:', storeId);
    return { success: true, id: storeId };
  } catch (error) {
    console.error('[Firebase] Save store error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize default TUDS stores (Regina and Saskatoon)
 * Call this once to seed the stores in Firebase
 */
async function initializeDefaultStores() {
  if (!currentUser) {
    console.error('[Firebase] Must be signed in to initialize stores');
    return { success: false, error: 'You must be signed in.' };
  }

  const defaultStores = [
    {
      id: 'tuds-regina',
      name: 'Regina',
      city: 'Regina',
      province: 'SK',
      salespeople: ['Dale', 'Justin', 'Ricky Lee'],
      color: '#3B82F6'
    },
    {
      id: 'tuds-saskatoon',
      name: 'Saskatoon',
      city: 'Saskatoon',
      province: 'SK',
      salespeople: ['Roberta', 'Megan'],
      color: '#10B981'
    }
  ];

  const results = [];
  for (const store of defaultStores) {
    const result = await saveStore({
      ...store,
      members: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    results.push({ store: store.name, ...result });
    console.log('[Firebase] Initialized store:', store.name, result.success ? 'SUCCESS' : 'FAILED');
  }

  return { success: true, results };
}

/**
 * Get store configuration in the format expected by the app
 * Returns { stores: [...], salespeople: {...} }
 */
async function getStoreConfigFromCloud() {
  try {
    const result = await loadStores();
    if (!result.success || !result.stores.length) {
      return null;
    }

    const config = {
      stores: [],
      salespeople: {},
      storeColors: {}
    };

    for (const store of result.stores) {
      config.stores.push(store.name);
      config.salespeople[store.name] = store.salespeople || [];
      if (store.color) {
        config.storeColors[store.name] = { bg: store.color, text: '#ffffff' };
      }
    }

    console.log('[Firebase] Loaded store config from cloud:', config);
    return config;
  } catch (error) {
    console.error('[Firebase] Error getting store config from cloud:', error);
    return null;
  }
}

/**
 * Update a store's salespeople list
 */
async function updateStoreSalespeople(storeName, salespeople) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    // Find the store by name
    const result = await loadStores();
    const store = result.stores?.find(s => s.name === storeName);

    if (!store) {
      return { success: false, error: 'Store not found.' };
    }

    // Update the store with new salespeople
    await saveStore({
      ...store,
      salespeople: salespeople
    });

    console.log('[Firebase] Updated salespeople for', storeName);
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Error updating salespeople:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add a user to a store
 */
async function addUserToStore(userEmail, storeId) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    const email = userEmail.toLowerCase();
    const userRef = db.collection('users').doc(email);

    // Update user's stores array
    await userRef.set({
      stores: firebase.firestore.FieldValue.arrayUnion(storeId)
    }, { merge: true });

    // Also add to store's members array
    const storeRef = db.collection('stores').doc(storeId);
    await storeRef.set({
      members: firebase.firestore.FieldValue.arrayUnion(email)
    }, { merge: true });

    console.log('[Firebase] Added', email, 'to store', storeId);
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Add user to store error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a user from a store
 */
async function removeUserFromStore(userEmail, storeId) {
  if (!currentUser) {
    return { success: false, error: 'You must be signed in.' };
  }

  try {
    const email = userEmail.toLowerCase();
    const userRef = db.collection('users').doc(email);

    // Remove from user's stores array
    await userRef.update({
      stores: firebase.firestore.FieldValue.arrayRemove(storeId)
    });

    // Remove from store's members array
    const storeRef = db.collection('stores').doc(storeId);
    await storeRef.update({
      members: firebase.firestore.FieldValue.arrayRemove(email)
    });

    console.log('[Firebase] Removed', email, 'from store', storeId);
    return { success: true };
  } catch (error) {
    console.error('[Firebase] Remove user from store error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get members of a store
 */
async function getStoreMembers(storeId) {
  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeRef.get();

    if (!storeDoc.exists) {
      return { success: false, error: 'Store not found.', members: [] };
    }

    const members = storeDoc.data().members || [];
    console.log('[Firebase] Store', storeId, 'has', members.length, 'members');
    return { success: true, members };
  } catch (error) {
    console.error('[Firebase] Get store members error:', error);
    return { success: false, error: error.message, members: [] };
  }
}

// ============================================
// LEGACY COMPATIBILITY FUNCTIONS
// ============================================

// For backwards compatibility with existing code
async function loadProjectsFromCloud() {
  return loadAllAccessibleProjects();
}

async function saveStoreConfig(storeData) {
  return saveStore(storeData);
}

async function loadStoreConfigs() {
  return loadStores();
}

// Export functions to global scope for use in other files
window.firebaseService = {
  // Initialization
  initializeFirebase,

  // Auth state
  onAuthStateChanged,
  getCurrentUser,
  getCurrentUserProfile,
  getUserStores,
  isSignedIn,
  isInternalStaff,

  // Authentication
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  sendPasswordReset,

  // User profile - phone
  updateUserPhone,
  needsPhoneNumber,

  // Firestore - Projects
  saveProjectToCloud,
  loadMyProjects,
  loadStoreProjects,
  loadAllAccessibleProjects,
  loadProjectFromCloud,
  deleteProjectFromCloud,

  // Legacy alias
  loadProjectsFromCloud,

  // Firestore - Stores
  loadStores,
  saveStore,
  addUserToStore,
  removeUserFromStore,
  getStoreMembers,
  initializeDefaultStores,
  getStoreConfigFromCloud,
  updateStoreSalespeople,

  // Legacy aliases
  saveStoreConfig,
  loadStoreConfigs
};
