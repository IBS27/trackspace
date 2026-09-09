import * as THREE from "three";

export const EARTH_RADIUS = 1.8;
export const MOON_RADIUS = EARTH_RADIUS * 0.273;
export const EARTH_POSITION = new THREE.Vector3(-3.0, 0, 0);
export const MOON_POSITION = new THREE.Vector3(4.1, 0.35, -0.5);

export function geographicPoint(radius: number, lat: number, lon: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function createBodies(invalidate: () => void, onReady: () => void) {
  const resources: { dispose(): void }[] = [];
  let disposed = false;
  const loader = new THREE.TextureLoader(new THREE.LoadingManager(onReady));
  const detailLoader = new THREE.TextureLoader();
  const earth = new THREE.Group();
  earth.position.copy(EARTH_POSITION);
  // Fixed geographic orientation. Program inspection does not advance a fictional clock.
  earth.rotation.y = -0.35;
  const moon = new THREE.Group();
  moon.position.copy(MOON_POSITION);
  const sunDirection = new THREE.Vector3(-3, 2, 5).normalize();
  function texture(path: string, color = true) {
    const result = loader.load(path, () => {
      if (disposed) result.dispose();
      else invalidate();
    });
    result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    result.anisotropy = 4;
    resources.push(result);
    return result;
  }
  const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 64);
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: texture("/textures/earth_day_1024.webp"),
    normalMap: texture("/textures/earth_normal_2048.jpg", false),
    specularMap: texture("/textures/earth_specular_2048.jpg", false),
    normalScale: new THREE.Vector2(0.45, 0.45),
    shininess: 24,
    specular: new THREE.Color("#627e91"),
  });
  earth.add(new THREE.Mesh(earthGeometry, earthMaterial));
  const nightMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture("/textures/earth_lights_1024.webp") },
      sun: { value: sunDirection },
    },
    vertexShader: `varying vec2 uvp; varying vec3 n; void main(){uvp=uv;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D map;uniform vec3 sun;varying vec2 uvp;varying vec3 n;void main(){vec3 c=texture2D(map,uvp).rgb;float cities=clamp((c.r-c.b)*3.,0.,1.);float night=1.-smoothstep(-.18,.08,dot(normalize(n),sun));gl_FragColor=vec4(vec3(1.,.78,.43)*cities*night*1.5,1.);}`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  earth.add(new THREE.Mesh(earthGeometry, nightMaterial));
  const cloudsGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 64, 48);
  const cloudsMaterial = new THREE.MeshLambertMaterial({
    map: texture("/textures/earth_clouds_1024.png"),
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  earth.add(new THREE.Mesh(cloudsGeometry, cloudsMaterial));
  const atmosphereGeometry = new THREE.SphereGeometry(
    EARTH_RADIUS * 1.045,
    64,
    48,
  );
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: { sun: { value: sunDirection } },
    vertexShader: `varying vec3 n;varying vec3 wp;void main(){vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `uniform vec3 sun;varying vec3 n;varying vec3 wp;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(cameraPosition-wp))),3.5);float day=smoothstep(-.2,.6,dot(normalize(n),sun));gl_FragColor=vec4(mix(vec3(.04,.09,.2),vec3(.2,.48,1.),day),rim*mix(.12,.65,day));}`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  earth.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));
  const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, 96, 64);
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: texture("/textures/moon_1024.jpg"),
    roughness: 1,
    metalness: 0,
  });
  moon.add(new THREE.Mesh(moonGeometry, moonMaterial));
  resources.push(
    earthGeometry,
    earthMaterial,
    nightMaterial,
    cloudsGeometry,
    cloudsMaterial,
    atmosphereGeometry,
    atmosphereMaterial,
    moonGeometry,
    moonMaterial,
  );
  // Shared by the globe and distant terrain so one 4K image uses one GPU texture.
  let moonColor: Promise<THREE.Texture> | undefined;
  function loadMoonColor() {
    moonColor ??= new Promise<THREE.Texture>((resolve, reject) => {
      const plate = detailLoader.load(
        "/textures/atlas-moon-color.webp",
        () => {
          if (disposed) {
            plate.dispose();
            reject(new Error("Scene disposed"));
            return;
          }
          plate.colorSpace = THREE.SRGBColorSpace;
          plate.anisotropy = 4;
          resolve(plate);
        },
        undefined,
        reject,
      );
      resources.push(plate);
    }).catch((error: unknown) => {
      moonColor = undefined;
      throw error;
    });
    return moonColor;
  }
  let earthDetailed = false;
  let moonDetailed = false;
  let moonHeight: THREE.Texture | undefined;
  function detail(body: "earth" | "moon") {
    if (body === "earth" && !earthDetailed) {
      earthDetailed = true;
      const plate = detailLoader.load(
        "/textures/earth_day_4096.webp",
        () => {
          if (disposed) {
            plate.dispose();
            return;
          }
          plate.colorSpace = THREE.SRGBColorSpace;
          plate.anisotropy = 4;
          earthMaterial.map = plate;
          earthMaterial.needsUpdate = true;
          invalidate();
        },
        undefined,
        () => {
          earthDetailed = false;
        },
      );
      resources.push(plate);
    }
    if (body === "moon" && !moonDetailed) {
      moonDetailed = true;
      void loadMoonColor()
        .then((plate) => {
          if (disposed) return;
          moonMaterial.map = plate;
          moonMaterial.needsUpdate = true;
          invalidate();
        })
        .catch(() => {
          moonDetailed = false;
        });
      const normalMap = detailLoader.load(
        "/textures/atlas-moon-normal.webp",
        () => {
          if (disposed) {
            normalMap.dispose();
            return;
          }
          normalMap.colorSpace = THREE.NoColorSpace;
          normalMap.anisotropy = 4;
          moonMaterial.normalMap = normalMap;
          moonMaterial.needsUpdate = true;
          invalidate();
        },
        undefined,
        () => {
          moonDetailed = false;
        },
      );
      resources.push(normalMap);
      // Elevation is independent of surface albedo. Packed height is decoded in the vertex shader.
      if (!moonHeight) {
        const height = texture("/textures/atlas-moon-height.png", false);
        height.minFilter = THREE.NearestFilter;
        height.magFilter = THREE.NearestFilter;
        moonHeight = height;
        moonMaterial.onBeforeCompile = (shader) => {
          shader.uniforms.lunarHeight = { value: height };
          shader.vertexShader =
            "uniform sampler2D lunarHeight;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\nvec2 h=texture2D(lunarHeight,uv).rg*255.;float km=(h.r*256.+h.g)/2000.-10.;transformed += normal * km * ${MOON_RADIUS / 1737.4};`,
          );
        };
        moonMaterial.customProgramCacheKey = () => "atlas-lola-moon-v1";
        // The material may already be compiled; rebuild so displacement applies
        // even if the color and normal plates never arrive.
        moonMaterial.needsUpdate = true;
      }
    }
  }
  return {
    earth,
    moon,
    detail,
    loadMoonColor,
    dispose() {
      disposed = true;
      resources.forEach((r) => r.dispose());
    },
  };
}
