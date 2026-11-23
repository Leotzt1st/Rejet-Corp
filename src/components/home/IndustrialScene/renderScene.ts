import * as T from "three";
import { makeWorld } from "./world";
import { CIRCUIT_SECONDS, STOP_SECONDS, journeyAt } from "./journey";

export function renderScene(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  fail: () => void,
) {
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) throw new Error("WebGL 2 indisponível");
  const renderer = new T.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const camera = new T.OrthographicCamera(-50, 50, 25, -25, 0.1, 290);
  const logo = new T.TextureLoader().load("/rejet-mark.png", () => {
    if (!disposed) draw();
  });
  logo.colorSpace = T.SRGBColorSpace;
  const world = makeWorld(logo);
  const labels = [...host.querySelectorAll<HTMLElement>("[data-scene-pin]")];
  const anchors = [...world.labels, ...world.stations];
  const transport = host.querySelector<HTMLElement>("[data-transport]");
  const transportAnchor = new T.Vector3();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const point = new T.Vector3();
  const tangent = new T.Vector3();
  const projected = new T.Vector3();
  let width = 1;
  let height = 1;
  let elapsed = 0;
  let frame = 0;
  let previousTime = 0;
  let visible = true;
  let contextLost = false;
  let disposed = false;
  let lastActive = -2;

  function positionPin(anchor: T.Vector3, pin?: HTMLElement | null) {
    if (!pin) return;
    projected.copy(anchor).project(camera);
    const x = (projected.x + 1) / 2;
    const inset = Math.min(100, width * 0.18);
    const shownX = Math.min(width - inset, Math.max(inset, x * width));
    pin.style.left = `${x * 100}%`;
    pin.style.top = `${(1 - projected.y) * 50}%`;
    pin.style.setProperty("--label-shift", `${shownX - x * width}px`);
  }

  function draw() {
    if (contextLost || disposed || document.hidden || !visible) return;
    const { stop, legTime, stopped, u } = journeyAt(elapsed, world.stops);
    const active = stopped ? stop.company + (stop.station ? 4 : 0) : -1;
    world.road.getPointAt(u, point);
    world.road.getTangentAt(u, tangent);
    world.truck.position.set(point.x, 0.1, point.z);
    world.truck.rotation.y = Math.atan2(-tangent.z, tangent.x);
    world.loads.forEach((load, index) => {
      const loading = !motion.matches && index + 4 === active;
      load.position.y = loading ? 0.42 * Math.sin((legTime / STOP_SECONDS) * Math.PI) : 0;
      world.lights[index].material = index + 4 === active ? world.lime : world.trace;
    });

    const sway = motion.matches ? 0 : Math.sin(elapsed * Math.PI / 25) + point.x * 0.023;
    camera.position.set(0.95 * sway, 61, 76);
    camera.lookAt(0, 0, 4);
    camera.updateMatrixWorld();
    labels.forEach((pin, index) => {
      positionPin(anchors[index], pin);
      if (lastActive !== active) pin.dataset.active = String(index === active);
    });
    lastActive = active;
    transportAnchor.set(point.x, 1.25, point.z);
    positionPin(transportAnchor, transport);
    renderer.render(world.scene, camera);
  }

  function resize() {
    if (contextLost || disposed) return;
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const viewWidth = Math.min(159, Math.max(104, 45 * aspect));
    const viewHeight = viewWidth / aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 720 ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
    host.style.setProperty("--world-scale", `${width / viewWidth}px`);
    draw();
  }

  function tick(now: number) {
    frame = 0;
    if (previousTime) elapsed = (elapsed + (now - previousTime) / 1000) % CIRCUIT_SECONDS;
    previousTime = now;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function synchronize() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    if (contextLost || disposed || document.hidden || !visible) return;
    draw();
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }

  const resizeObserver = new ResizeObserver(resize);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    synchronize();
  });
  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    synchronize();
    fail();
  }
  function onContextRestored() {
    contextLost = false;
    resize();
    host.dataset.sceneState = "ready";
    synchronize();
  }

  resizeObserver.observe(canvas);
  observer.observe(canvas);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  motion.addEventListener("change", synchronize);
  document.addEventListener("visibilitychange", synchronize);
  resize();
  synchronize();
  host.dataset.sceneState = "ready";

  return {
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      motion.removeEventListener("change", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
      const geometries = new Set<T.BufferGeometry>();
      const materials = new Set<T.Material>();
      world.scene.traverse((object) => {
        if (object instanceof T.Mesh) {
          geometries.add(object.geometry);
          const surfaces = Array.isArray(object.material) ? object.material : [object.material];
          surfaces.forEach((surface) => materials.add(surface));
        }
        if (object instanceof T.InstancedMesh) object.dispose();
      });
      materials.add(world.lime);
      materials.add(world.trace);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      logo.dispose();
      renderer.dispose();
    },
  };
}
