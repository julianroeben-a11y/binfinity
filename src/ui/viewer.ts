import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Plate, PreviewMesh, PreviewPiece } from "../worker/protocol";

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
  private colors = { body: "#4f8fd6", accent: "#e3a33b" };

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
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      this.group.remove(child);
    }
    pieces.forEach((p, i) => {
      const piece = new THREE.Group();
      // Split pieces alternate between the colour and a slightly darker shade.
      const shade = pieces.length > 1 && i % 2 ? 0.82 : 1;
      piece.add(this.mesh(p, this.colors.body, shade, "body"));
      if (p.accent) piece.add(this.mesh(p.accent, this.colors.accent, shade, "accent"));
      this.place(piece, p);
      piece.name = p.name;
      this.group.add(piece);
    });
    this.drawBeds();
    if (!this.hasFramed) {
      this.frame();
      this.hasFramed = true;
    }
  }

  private mesh(m: PreviewMesh, color: string, shade: number, role: string) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(shade), roughness: 0.55, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { role, shade };
    return mesh;
  }

  /** Preview colours of the body and the accent part (CSS colours). */
  setColors(body: string, accent: string) {
    this.colors = { body, accent };
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const c = m.userData.role === "accent" ? accent : body;
      (m.material as THREE.MeshStandardMaterial).color.set(c).multiplyScalar(m.userData.shade as number);
    });
  }

  /** Put a piece on its bed, or where it goes in the assembled model (some parts tilted, like desk inlays). */
  private place(obj: THREE.Object3D, p: PreviewPiece) {
    const plates = this.mode === "plates";
    obj.position.set(...(plates ? p.onPlate : p.assembled));
    obj.rotation.x = plates ? 0 : (p.assembledRotX ?? 0);
  }

  /** Switch between pieces laid out on print beds and the assembled model. */
  setMode(mode: "plates" | "assembled") {
    if (mode === this.mode) return;
    this.mode = mode;
    this.group.children.forEach((child, i) => {
      const p = this.pieces[i];
      if (p) this.place(child, p);
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
