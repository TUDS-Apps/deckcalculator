// deckViewer3D.js - Three.js 3D Deck Viewer
// Renders the deck structure in 3D with orbit controls

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// Constants
// ============================================

const PIXELS_PER_FOOT = 24; // From config - 1 foot = 24 pixels in model space

// Actual lumber dimensions in feet (for 3D rendering)
const LUMBER_DIMENSIONS = {
  '2x4': { width: 3.5 / 12, height: 1.5 / 12 },
  '2x6': { width: 5.5 / 12, height: 1.5 / 12 },
  '2x8': { width: 7.25 / 12, height: 1.5 / 12 },
  '2x10': { width: 9.25 / 12, height: 1.5 / 12 },
  '2x12': { width: 11.25 / 12, height: 1.5 / 12 },
  '4x4': { width: 3.5 / 12, height: 3.5 / 12 },
  '6x6': { width: 5.5 / 12, height: 5.5 / 12 },
};

// Deck board thickness
const DECK_BOARD_THICKNESS = 1.0 / 12; // ~1 inch for 5/4 boards

// Colors for different components
const COLORS = {
  ledger: 0x8B7355,      // Darker brown (against house)
  beam: 0xA0522D,        // Sienna brown
  joist: 0xDEB887,       // Burlywood (lighter)
  rimJoist: 0xCD853F,    // Peru (medium brown)
  post: 0x654321,        // Dark brown
  blocking: 0xD2B48C,    // Tan
  decking: 0xE8D4B8,     // Light wood
  deckingAlt: 0xDCC8AC,  // Alternate board color
  stairStringer: 0x8B7355,
  stairTread: 0xE8D4B8,
  ground: 0x90EE90,      // Light green grass
  house: 0xD3D3D3,       // Light gray
};

// ============================================
// DeckViewer3D Class
// ============================================

class DeckViewer3D {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.deckGroup = null;
    this.animationId = null;
    this.isInitialized = false;
    this.deckHeightFeet = 4; // Default deck height

    // Bind methods
    this.animate = this.animate.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
  }

  // ============================================
  // Initialization
  // ============================================

  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`[3D Viewer] Container #${this.containerId} not found`);
      return false;
    }

    // Get container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 500;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

    // Create camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(30, 20, 30);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground

    // Add lights
    this.setupLighting();

    // Add ground plane
    this.addGround();

    // Create deck group (will hold all deck components)
    this.deckGroup = new THREE.Group();
    this.scene.add(this.deckGroup);

    // Add resize listener
    window.addEventListener('resize', this.onWindowResize);

    this.isInitialized = true;
    console.log('[3D Viewer] Initialized');

    return true;
  }

  setupLighting() {
    // Ambient light (soft overall illumination)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(20, 30, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    this.scene.add(sunLight);

    // Fill light (softer, from opposite side)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Hemisphere light (sky/ground colors)
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x90EE90, 0.3);
    this.scene.add(hemiLight);
  }

  addGround() {
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.ground,
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01; // Slightly below zero
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // ============================================
  // Animation Loop
  // ============================================

  start() {
    if (!this.isInitialized) return;
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ============================================
  // Deck Building Methods
  // ============================================

  /**
   * Build the 3D deck from appState data
   * @param {Object} appState - The application state containing deck data
   */
  buildDeck(appState) {
    if (!this.isInitialized) {
      console.warn('[3D Viewer] Not initialized, cannot build deck');
      return;
    }

    // Clear existing deck
    this.clearDeck();

    const { structuralComponents, points, stairs } = appState;

    if (!structuralComponents || !points || points.length < 3) {
      console.warn('[3D Viewer] No structural data available');
      return;
    }

    // Get deck height from appState
    this.deckHeightFeet = this.getDeckHeight(appState);

    // Calculate deck center for positioning
    const bounds = this.calculateBounds(points);
    const centerX = (bounds.minX + bounds.maxX) / 2 / PIXELS_PER_FOOT;
    const centerY = (bounds.minY + bounds.maxY) / 2 / PIXELS_PER_FOOT;

    // Add house wall (ledger side)
    this.addHouseWall(structuralComponents.ledger, centerX, centerY);

    // Add posts first (they go down to ground)
    if (structuralComponents.posts) {
      this.addPosts(structuralComponents.posts, centerX, centerY);
    }

    // Add beams
    if (structuralComponents.beams) {
      this.addBeams(structuralComponents.beams, centerX, centerY);
    }

    // Add ledger
    if (structuralComponents.ledger) {
      this.addLedger(structuralComponents.ledger, centerX, centerY);
    }

    // Add joists
    if (structuralComponents.joists) {
      this.addJoists(structuralComponents.joists, centerX, centerY);
    }

    // Add rim joists
    if (structuralComponents.rimJoists) {
      this.addRimJoists(structuralComponents.rimJoists, centerX, centerY);
    }

    // Add blocking
    if (structuralComponents.midSpanBlocking) {
      this.addBlocking(structuralComponents.midSpanBlocking, centerX, centerY);
    }

    // Add decking surface
    this.addDeckingSurface(points, centerX, centerY);

    // Add stairs
    if (stairs && stairs.length > 0) {
      this.addStairs(stairs, centerX, centerY);
    }

    // Center camera on deck
    this.centerCamera(bounds);

    console.log('[3D Viewer] Deck built successfully');
  }

  clearDeck() {
    // Remove all children from deck group
    while (this.deckGroup.children.length > 0) {
      const child = this.deckGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.deckGroup.remove(child);
    }
  }

  getDeckHeight(appState) {
    // Try to get height from various sources
    if (appState.tiers && appState.tiers.upper) {
      return appState.tiers.upper.heightFeet + (appState.tiers.upper.heightInches || 0) / 12;
    }
    // Try to get from form inputs
    const heightFeetInput = document.getElementById('modifyHeightFeet');
    const heightInchesInput = document.getElementById('modifyHeightInches');
    if (heightFeetInput && heightInchesInput) {
      return parseFloat(heightFeetInput.value || 4) + parseFloat(heightInchesInput.value || 0) / 12;
    }
    return 4; // Default 4 feet
  }

  calculateBounds(points) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
  }

  // ============================================
  // Component Creation Methods
  // ============================================

  createLumberMesh(p1, p2, size, color, ply = 1) {
    const dims = LUMBER_DIMENSIONS[size] || LUMBER_DIMENSIONS['2x8'];
    const length = Math.sqrt(
      Math.pow((p2.x - p1.x) / PIXELS_PER_FOOT, 2) +
      Math.pow((p2.y - p1.y) / PIXELS_PER_FOOT, 2)
    );

    // Create geometry - lumber oriented along its length
    const geometry = new THREE.BoxGeometry(length, dims.height * ply, dims.width);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Calculate position and rotation
    const centerX = (p1.x + p2.x) / 2 / PIXELS_PER_FOOT;
    const centerZ = (p1.y + p2.y) / 2 / PIXELS_PER_FOOT;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    mesh.position.set(centerX, 0, centerZ);
    mesh.rotation.y = -angle;

    return mesh;
  }

  addHouseWall(ledger, centerX, centerY) {
    if (!ledger) return;

    const wallHeight = this.deckHeightFeet + 8; // 8 feet above deck
    const wallThickness = 0.5;

    const p1 = ledger.p1;
    const p2 = ledger.p2;
    const length = Math.sqrt(
      Math.pow((p2.x - p1.x) / PIXELS_PER_FOOT, 2) +
      Math.pow((p2.y - p1.y) / PIXELS_PER_FOOT, 2)
    );

    const geometry = new THREE.BoxGeometry(length + 2, wallHeight, wallThickness);
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.house,
      roughness: 0.9,
      metalness: 0.0,
    });

    const wall = new THREE.Mesh(geometry, material);
    wall.castShadow = true;
    wall.receiveShadow = true;

    // Position behind ledger
    const wallCenterX = (p1.x + p2.x) / 2 / PIXELS_PER_FOOT - centerX;
    const wallCenterZ = (p1.y + p2.y) / 2 / PIXELS_PER_FOOT - centerY - wallThickness / 2;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    wall.position.set(wallCenterX, wallHeight / 2 - this.deckHeightFeet + 0.5, wallCenterZ);
    wall.rotation.y = -angle;

    this.deckGroup.add(wall);
  }

  addPosts(posts, centerX, centerY) {
    for (const post of posts) {
      const dims = LUMBER_DIMENSIONS[post.size] || LUMBER_DIMENSIONS['4x4'];

      const geometry = new THREE.BoxGeometry(dims.width, post.heightFeet || this.deckHeightFeet, dims.height);
      const material = new THREE.MeshStandardMaterial({
        color: COLORS.post,
        roughness: 0.8,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const postHeight = post.heightFeet || this.deckHeightFeet;
      mesh.position.set(
        post.x / PIXELS_PER_FOOT - centerX,
        postHeight / 2,
        post.y / PIXELS_PER_FOOT - centerY
      );

      this.deckGroup.add(mesh);
    }
  }

  addBeams(beams, centerX, centerY) {
    for (const beam of beams) {
      const mesh = this.createLumberMesh(beam.p1, beam.p2, beam.size, COLORS.beam, beam.ply || 1);

      // Position beam at top of posts, below joists
      const dims = LUMBER_DIMENSIONS[beam.size] || LUMBER_DIMENSIONS['2x8'];
      mesh.position.x -= centerX;
      mesh.position.z -= centerY;
      mesh.position.y = this.deckHeightFeet - dims.height / 2 - LUMBER_DIMENSIONS['2x8'].height;

      this.deckGroup.add(mesh);
    }
  }

  addLedger(ledger, centerX, centerY) {
    const mesh = this.createLumberMesh(ledger.p1, ledger.p2, ledger.size, COLORS.ledger, ledger.ply || 1);

    // Position at deck height
    const dims = LUMBER_DIMENSIONS[ledger.size] || LUMBER_DIMENSIONS['2x8'];
    mesh.position.x -= centerX;
    mesh.position.z -= centerY;
    mesh.position.y = this.deckHeightFeet - dims.height / 2;

    this.deckGroup.add(mesh);
  }

  addJoists(joists, centerX, centerY) {
    for (const joist of joists) {
      const mesh = this.createLumberMesh(joist.p1, joist.p2, joist.size, COLORS.joist);

      // Position at deck height (on top of beams)
      const dims = LUMBER_DIMENSIONS[joist.size] || LUMBER_DIMENSIONS['2x8'];
      mesh.position.x -= centerX;
      mesh.position.z -= centerY;
      mesh.position.y = this.deckHeightFeet - dims.height / 2;

      this.deckGroup.add(mesh);
    }
  }

  addRimJoists(rimJoists, centerX, centerY) {
    for (const rim of rimJoists) {
      const mesh = this.createLumberMesh(rim.p1, rim.p2, rim.size, COLORS.rimJoist);

      // Position at deck height
      const dims = LUMBER_DIMENSIONS[rim.size] || LUMBER_DIMENSIONS['2x8'];
      mesh.position.x -= centerX;
      mesh.position.z -= centerY;
      mesh.position.y = this.deckHeightFeet - dims.height / 2;

      this.deckGroup.add(mesh);
    }
  }

  addBlocking(blocking, centerX, centerY) {
    for (const block of blocking) {
      const mesh = this.createLumberMesh(block.p1, block.p2, block.size, COLORS.blocking);

      // Position at joist level
      const dims = LUMBER_DIMENSIONS[block.size] || LUMBER_DIMENSIONS['2x8'];
      mesh.position.x -= centerX;
      mesh.position.z -= centerY;
      mesh.position.y = this.deckHeightFeet - dims.height / 2;

      this.deckGroup.add(mesh);
    }
  }

  addDeckingSurface(points, centerX, centerY) {
    if (points.length < 3) return;

    // Create a shape from the deck outline
    const shape = new THREE.Shape();

    // Convert points to Three.js coordinates (flip Y for Z)
    const firstPoint = points[0];
    shape.moveTo(
      firstPoint.x / PIXELS_PER_FOOT - centerX,
      -(firstPoint.y / PIXELS_PER_FOOT - centerY)
    );

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      shape.lineTo(
        point.x / PIXELS_PER_FOOT - centerX,
        -(point.y / PIXELS_PER_FOOT - centerY)
      );
    }

    // Extrude the shape to create deck boards
    const extrudeSettings = {
      depth: DECK_BOARD_THICKNESS,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.decking,
      roughness: 0.6,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Rotate to horizontal and position at deck height
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = this.deckHeightFeet + DECK_BOARD_THICKNESS;

    this.deckGroup.add(mesh);

    // Add deck board lines for realism
    this.addDeckBoardLines(points, centerX, centerY);
  }

  addDeckBoardLines(points, centerX, centerY) {
    // Calculate bounds
    const bounds = this.calculateBounds(points);
    const deckWidth = (bounds.maxX - bounds.minX) / PIXELS_PER_FOOT;
    const deckDepth = (bounds.maxY - bounds.minY) / PIXELS_PER_FOOT;

    // Create lines every 5.5 inches (deck board width)
    const boardWidth = 5.5 / 12; // feet
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x8B7355, transparent: true, opacity: 0.3 });

    // Determine board direction (assume horizontal - parallel to ledger)
    for (let x = bounds.minX / PIXELS_PER_FOOT - centerX; x <= bounds.maxX / PIXELS_PER_FOOT - centerX; x += boardWidth) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePoints = [
        new THREE.Vector3(x, this.deckHeightFeet + DECK_BOARD_THICKNESS + 0.005, bounds.minY / PIXELS_PER_FOOT - centerY),
        new THREE.Vector3(x, this.deckHeightFeet + DECK_BOARD_THICKNESS + 0.005, bounds.maxY / PIXELS_PER_FOOT - centerY)
      ];
      lineGeometry.setFromPoints(linePoints);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.deckGroup.add(line);
    }
  }

  addStairs(stairs, centerX, centerY) {
    for (const stair of stairs) {
      if (!stair.calculatedNumSteps || !stair.calculatedRunPerStepInches) continue;

      const stairWidth = stair.widthFt || 4;
      const numSteps = stair.calculatedNumSteps;
      const risePerStep = (stair.calculatedRisePerStepInches || 7) / 12; // Convert to feet
      const runPerStep = (stair.calculatedRunPerStepInches || 10) / 12; // Convert to feet

      // Stair position
      const stairX = stair.positionX / PIXELS_PER_FOOT - centerX;
      const stairZ = stair.positionY / PIXELS_PER_FOOT - centerY;

      // Determine stair direction (perpendicular to rim joist)
      let stairAngle = 0;
      if (stair.rimP1 && stair.rimP2) {
        const rimAngle = Math.atan2(stair.rimP2.y - stair.rimP1.y, stair.rimP2.x - stair.rimP1.x);
        stairAngle = rimAngle + Math.PI / 2; // Perpendicular to rim
      }

      // Create stair group
      const stairGroup = new THREE.Group();
      stairGroup.position.set(stairX, 0, stairZ);
      stairGroup.rotation.y = -stairAngle;

      // Create treads
      const treadMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.stairTread,
        roughness: 0.6,
        metalness: 0.0,
      });

      for (let i = 0; i < numSteps; i++) {
        const treadGeometry = new THREE.BoxGeometry(stairWidth, DECK_BOARD_THICKNESS, runPerStep);
        const tread = new THREE.Mesh(treadGeometry, treadMaterial);
        tread.castShadow = true;
        tread.receiveShadow = true;

        // Position each tread
        const treadY = this.deckHeightFeet - (i + 1) * risePerStep + DECK_BOARD_THICKNESS / 2;
        const treadZ = (i + 0.5) * runPerStep;
        tread.position.set(0, treadY, treadZ);

        stairGroup.add(tread);
      }

      // Create stringers (simplified as angled boxes)
      const stringerMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.stairStringer,
        roughness: 0.7,
        metalness: 0.1,
      });

      const totalRun = numSteps * runPerStep;
      const stringerLength = Math.sqrt(this.deckHeightFeet * this.deckHeightFeet + totalRun * totalRun);
      const stringerAngle = Math.atan2(this.deckHeightFeet, totalRun);

      const numStringers = stair.calculatedStringerQty || Math.ceil(stairWidth) + 1;
      const stringerSpacing = stairWidth / (numStringers - 1);

      for (let i = 0; i < numStringers; i++) {
        const stringerGeometry = new THREE.BoxGeometry(0.125, 0.75, stringerLength);
        const stringer = new THREE.Mesh(stringerGeometry, stringerMaterial);
        stringer.castShadow = true;
        stringer.receiveShadow = true;

        const stringerX = -stairWidth / 2 + i * stringerSpacing;
        stringer.position.set(stringerX, this.deckHeightFeet / 2, totalRun / 2);
        stringer.rotation.x = stringerAngle;

        stairGroup.add(stringer);
      }

      this.deckGroup.add(stairGroup);
    }
  }

  // ============================================
  // Camera Control
  // ============================================

  centerCamera(bounds) {
    const width = (bounds.maxX - bounds.minX) / PIXELS_PER_FOOT;
    const depth = (bounds.maxY - bounds.minY) / PIXELS_PER_FOOT;
    const maxDim = Math.max(width, depth);

    // Position camera based on deck size
    const distance = maxDim * 1.5;
    this.camera.position.set(distance, distance * 0.6, distance);
    this.controls.target.set(0, this.deckHeightFeet / 2, 0);
    this.controls.update();
  }

  // ============================================
  // View Presets
  // ============================================

  setViewPreset(preset) {
    const distance = 25;

    switch (preset) {
      case 'front':
        this.camera.position.set(0, this.deckHeightFeet + 2, distance);
        break;
      case 'back':
        this.camera.position.set(0, this.deckHeightFeet + 2, -distance);
        break;
      case 'left':
        this.camera.position.set(-distance, this.deckHeightFeet + 2, 0);
        break;
      case 'right':
        this.camera.position.set(distance, this.deckHeightFeet + 2, 0);
        break;
      case 'top':
        this.camera.position.set(0, distance, 0.1);
        break;
      case 'isometric':
      default:
        this.camera.position.set(distance, distance * 0.6, distance);
        break;
    }

    this.controls.target.set(0, this.deckHeightFeet / 2, 0);
    this.controls.update();
  }

  // ============================================
  // Cleanup
  // ============================================

  dispose() {
    this.stop();

    // Remove event listener
    window.removeEventListener('resize', this.onWindowResize);

    // Dispose of all geometries and materials
    this.clearDeck();

    // Dispose of scene objects
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container && this.renderer.domElement) {
        this.container.removeChild(this.renderer.domElement);
      }
    }

    // Clear references
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.deckGroup = null;
    this.isInitialized = false;

    console.log('[3D Viewer] Disposed');
  }
}

// ============================================
// Export
// ============================================

export { DeckViewer3D };

// Also expose globally for non-module usage
window.DeckViewer3D = DeckViewer3D;
