import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PreviewPiece } from "../worker/protocol";

const PIECE_COLORS = [0x4f8fd6, 0x3fae8c, 0xd9a441, 0xc96a5b, 0x8b7fd1, 0x5fb3c4];

/** Three.js preview: Z-up, orbit controls, one mesh per printable piece. */
export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  private controls: OrbitControls;
  private group = new THREE.Group();
  private bed: THREE.LineSegments | null = null;
  private hasFramed = false;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);

    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1, -2, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(2, 1, 1);
    this.scene.add(rim);
    this.scene.add(this.group);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setPieces(pieces: PreviewPiece[]) {
    for (const child of [...this.group.children]) {
      const m = child as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.group.remove(m);
    }
    pieces.forEach((p, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(p.positions, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(p.normals, 3));
      geo.setIndex(new THREE.BufferAttribute(p.indices, 1));
      const mat = new THREE.MeshStandardMaterial({
        color: PIECE_COLORS[pieces.length > 1 ? i % PIECE_COLORS.length : 0],
        roughness: 0.55,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.offset);
      mesh.name = p.name;
      this.group.add(mesh);
    });
    if (!this.hasFramed) {
      this.frame();
      this.hasFramed = true;
    }
  }

  /** Re-frame the camera when the next set of pieces arrives (e.g. after switching model). */
  reframeNext() {
    this.hasFramed = false;
  }

  /** Outline of the print bed at z = 0 from the origin, or `null` to hide it. */
  setBed(size: [number, number] | null) {
    if (this.bed) {
      this.bed.geometry.dispose();
      this.scene.remove(this.bed);
      this.bed = null;
    }
    if (!size) return;
    const [x, y] = size;
    const pts = [0, 0, 0, x, 0, 0, x, 0, 0, x, y, 0, x, y, 0, 0, y, 0, 0, y, 0, 0, 0, 0];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.bed = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.6 }));
    this.bed.position.z = -0.05;
    this.scene.add(this.bed);
  }

  /** Point the camera at the current model from the front-left, above. */
  frame() {
    const box = new THREE.Box3().setFromObject(this.group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    // Narrow (portrait) viewports need more distance to fit the model's width.
    const dist = (size / (2 * Math.tan((this.camera.fov * Math.PI) / 360))) * 1.1 / Math.min(1, this.camera.aspect);
    const dir = new THREE.Vector3(-0.45, -1, 0.85).normalize();
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.controls.target.copy(center);
    this.camera.near = Math.max(0.5, dist / 100);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
  }
}
