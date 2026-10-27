import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Plate, PreviewPiece } from "../worker/protocol";

const PIECE_COLORS = [0x4f8fd6, 0x3fae8c, 0xd9a441, 0xc96a5b, 0x8b7fd1, 0x5fb3c4];

/** Three.js preview: Z-up, orbit controls, one mesh per printable piece. */
export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  private controls: OrbitControls;
  private group = new THREE.Group();
  private beds = new THREE.Group();
  private pieces: PreviewPiece[] = [];
  private plates: Plate[] = [];
  private mode: "plates" | "assembled" = "plates";
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
    this.scene.add(this.beds);

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

  setPieces(pieces: PreviewPiece[], plates: Plate[]) {
    this.pieces = pieces;
    this.plates = plates;
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
      mesh.position.set(...(this.mode === "plates" ? p.onPlate : p.assembled));
      mesh.name = p.name;
      this.group.add(mesh);
    });
    this.drawBeds();
    if (!this.hasFramed) {
      this.frame();
      this.hasFramed = true;
    }
  }

  /** Switch between pieces laid out on print beds and the assembled model. */
  setMode(mode: "plates" | "assembled") {
    if (mode === this.mode) return;
    this.mode = mode;
    this.group.children.forEach((child, i) => {
      const p = this.pieces[i];
      if (p) child.position.set(...(mode === "plates" ? p.onPlate : p.assembled));
    });
    this.drawBeds();
    this.frame();
  }

  /** Re-frame the camera when the next set of pieces arrives (e.g. after switching model). */
  reframeNext() {
    this.hasFramed = false;
  }

  /** Print bed outlines with a faint fill, only in plate mode. */
  private drawBeds() {
    for (const child of [...this.beds.children]) {
      const o = child as THREE.Mesh | THREE.LineSegments;
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
      this.beds.remove(o);
    }
    if (this.mode !== "plates") return;
    for (const pl of this.plates) {
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(pl.w, pl.d),
        new THREE.MeshBasicMaterial({ color: 0x8a94a6, transparent: true, opacity: 0.12, depthWrite: false }),
      );
      fill.position.set(pl.x + pl.w / 2, pl.y + pl.d / 2, -0.1);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(pl.w, pl.d)),
        new THREE.LineBasicMaterial({ color: 0x8a94a6, transparent: true, opacity: 0.7 }),
      );
      edges.position.copy(fill.position);
      this.beds.add(fill, edges);
    }
  }

  /** Point the camera at the current model from the front-left, above. */
  frame() {
    const box = new THREE.Box3().setFromObject(this.group);
    if (this.mode === "plates" && this.beds.children.length) box.union(new THREE.Box3().setFromObject(this.beds));
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
