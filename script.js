import * as THREE from './js/three.module.js';
import { OrbitControls } from './js/OrbitControls.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.sortObjects = true;
document.body.appendChild(renderer.domElement);

// --- SPHERE SETTINGS ---
const sphereRadius = 4.5;
const glowRadius = sphereRadius * 3;

const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.4,
    metalness: 0.7,
    transparent: true,
    opacity: 0.2,
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

const glowGeometry = new THREE.SphereGeometry(glowRadius, 64, 64);
const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
    c: { value: 0.7 },
    p: { value: 5.0 },
    glowColor: { value: new THREE.Color(0xffffff) },
    viewVector: { value: new THREE.Vector3() }
    },
    vertexShader: `
    uniform vec3 viewVector;
    uniform float c;
    uniform float p;
    varying float intensity;
    void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vView = normalize(normalMatrix * viewVector);
        float dotProduct = dot(vNormal, -vView);
        intensity = pow(c - dotProduct, p);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    uniform vec3 glowColor;
    varying float intensity;
    void main() {
        float alpha = smoothstep(0.0, 1.0, intensity) * 0.6;
        gl_FragColor = vec4(glowColor, alpha);
    }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
});

const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
scene.add(glowMesh);

// --- LIGHTS ---
const ambientLight = new THREE.AmbientLight(0x888888, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// --- PARTICLES ---
const geometry = new THREE.SphereGeometry(sphereRadius, 128, 128);
const vertices = geometry.attributes.position.array;
const vertexCount = geometry.attributes.position.count;

const visibleIndices = [];
const maxVisible = Math.floor(vertexCount * 0.1);

while(visibleIndices.length < maxVisible) {
    const idx = Math.floor(Math.random() * vertexCount);
    if(!visibleIndices.includes(idx)) visibleIndices.push(idx);
}

const angles = visibleIndices.map(idx => {
    const x = vertices[3*idx];
    const y = vertices[3*idx+1];
    const z = vertices[3*idx+2];
    const spherical = new THREE.Spherical().setFromVector3(new THREE.Vector3(x, y, z));
    return { theta: spherical.theta, phi: spherical.phi, radius: spherical.radius };
});

const positions = new Float32Array(maxVisible * 3);
const pointsGeometry = new THREE.BufferGeometry();
pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const spriteTexture = new THREE.TextureLoader().load('./assets/whiteparticle.png');

const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.07,
    sizeAttenuation: true,
    transparent: true,
    alphaTest: 0.05,
    opacity: 0.9,
    map: spriteTexture,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(pointsGeometry, material);
scene.add(points);

// --- CONTROLS ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableRotate = true;

// Particle hızları
const speeds = angles.map(() => ({
    dTheta: (Math.random() - 0.5) * 0.0015,
    dPhi: (Math.random() - 0.5) * 0.0015,
}));

// Mouse pozisyonu normalized -1...1 arası
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let mouseMoved = false;

window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseMoved = true;
});

// Animasyon ve butonlar
const parallaxIntensity = 0.5;

const buttons = {
    'btn-top-left': {
    textId: 'animated-text-top-left',
    sphereTargetPos: new THREE.Vector3(7, -4.5, 0),
    sphereEndScale: 5.5
    },
    'btn-top-right': {
    textId: 'animated-text-top-right',
    sphereTargetPos: new THREE.Vector3(-7, -4.5, 0),
    sphereEndScale: 5.5
    },
    'btn-bottom-left': {
    textId: 'animated-text-bottom-left',
    sphereTargetPos: new THREE.Vector3(7, 4.5, 0),
    sphereEndScale: 5.5
    },
    'btn-bottom-right': {
    textId: 'animated-text-bottom-right',
    sphereTargetPos: new THREE.Vector3(-7, 4.5, 0),
    sphereEndScale: 5.5
    },
};

let activeButton = null;
let animating = false;
let animationStartTime = 0;
const animationDuration = 2000;

function lerp(start, end, t) {
    return start + (end - start) * t;
}

function startAnimation(buttonId) {
    if(animating) return;
    animating = true;
    animationStartTime = performance.now();
    activeButton = buttonId;

    for (const key in buttons) {
    const textElem = document.getElementById(buttons[key].textId);
    textElem.style.opacity = '0';
    textElem.style.pointerEvents = 'none';
    textElem.style.display = 'none';
    }

    const activeText = document.getElementById(buttons[buttonId].textId);
    activeText.style.display = 'flex';
    activeText.style.opacity = '0';

    for (const key in buttons) {
    const btn = document.getElementById(key);
    btn.style.transition = 'opacity 0.5s ease';
    btn.style.opacity = '0';
    }

    controls.enabled = false;
}

function returnToMenu() {
    if(animating) return;
    animating = true;
    animationStartTime = performance.now();
    activeButton = null;

    for (const key in buttons) {
    const btn = document.getElementById(key);
    btn.style.transition = 'opacity 0.5s ease';
    btn.style.opacity = '1';
    }

    for (const key in buttons) {
    const textElem = document.getElementById(buttons[key].textId);
    textElem.style.opacity = '0';
    textElem.style.pointerEvents = 'none';
    setTimeout(() => {
        textElem.style.display = 'none';
    }, 500);
    }

    const aboutMeDiv = document.getElementById('about-me-text');
    aboutMeDiv.style.opacity = '0';
    aboutMeDiv.style.pointerEvents = 'none';

    galleryContainer.style.display = 'none';
    controls.enabled = true;
}

for (const key in buttons) {
    const btn = document.getElementById(key);
    btn.addEventListener('click', () => {
    startAnimation(key);
    });
}

document.querySelectorAll('.back-button').forEach(backBtn => {
    backBtn.addEventListener('click', () => {
    returnToMenu();
    });
});

// --- GALERİ İŞLEMLERİ ---

// Görsellerin dosya yolları - Windows yoluna göre ayarlanmış (senin verdiğin)
const imagePaths = [
    './assets/PortfolioImages/portfolio_im1.jpg',
    './assets/PortfolioImages/portfolio_im2.jpg',
    './assets/PortfolioImages/portfolio_im3.jpg',
    './assets/PortfolioImages/portfolio_im4.jpg',
    './assets/PortfolioImages/portfolio_im5.jpeg',
    './assets/PortfolioImages/portfolio_im6.jpeg',
    './assets/PortfolioImages/portfolio_im7.jpeg',
    './assets/PortfolioImages/portfolio_im8_1.jpg',
    './assets/PortfolioImages/portfolio_im8.png',
    './assets/PortfolioImages/portfolio_im9.png',
    './assets/PortfolioImages/portfolio_im10.png',
    './assets/PortfolioImages/portfolio_im11.png',
    './assets/PortfolioImages/portfolio_im12.png',
    './assets/PortfolioImages/portfolio_im13.png',
    './assets/PortfolioImages/portfolio_im14.png',
    './assets/PortfolioImages/portfolio_im15.png',
    './assets/PortfolioImages/portfolio_im16.png'
];

const galleryWrap = document.getElementById('gallery-wrap');
const galleryContainer = document.getElementById('gallery-container');
const galleryBackBtn = document.getElementById('gallery-back-button');

// Galeriyi oluştur
function createGallery() {
    galleryWrap.innerHTML = ''; // Temizle

    imagePaths.forEach((path, i) => {
    const div = document.createElement('div');
    div.classList.add('item');
    div.style.backgroundImage = `url('${path}')`;
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Portfolio image ${i + 1}`);
    galleryWrap.appendChild(div);
    });
}

// Buton click animasyon bittikten sonra galeriyi göster
function showGalleryAfterAnimation() {
    createGallery();
    galleryContainer.style.display = 'block';
    animating = false; // Animasyon bitmiş kabul et
}

// Modify startAnimation fonksiyonunu PORTFOLIO için
const originalStartAnimation = startAnimation;
startAnimation = function(buttonId) {
    if(animating) return;
    animating = true;
    animationStartTime = performance.now();
    activeButton = buttonId;

    for (const key in buttons) {
    const textElem = document.getElementById(buttons[key].textId);
    textElem.style.opacity = '0';
    textElem.style.pointerEvents = 'none';
    textElem.style.display = 'none';
    }

    const activeText = document.getElementById(buttons[buttonId].textId);
    activeText.style.display = 'flex';
    activeText.style.opacity = '0';

    for (const key in buttons) {
    const btn = document.getElementById(key);
    btn.style.transition = 'opacity 0.5s ease';
    btn.style.opacity = '0';
    }

    controls.enabled = false;

    if(buttonId === 'btn-top-left') { 
    // Portfolio butonuna özel animasyon bittiğinde galeriyi göster
    // Animasyon süresini dinliyoruz:
    setTimeout(() => {
        showGalleryAfterAnimation();
    }, animationDuration + 100);
    }
    if(buttonId === 'btn-top-right') {
    setTimeout(() => {
        const aboutMeDiv = document.getElementById('about-me-text');
        aboutMeDiv.style.opacity = '1';
        aboutMeDiv.style.pointerEvents = 'auto';
        animating = false; // animasyon bitti olarak işaretle
    }, animationDuration + 100);
    } else {
    // diğer durumlarda yazıyı gizle
    const aboutMeDiv = document.getElementById('about-me-text');
    aboutMeDiv.style.opacity = '0';
    aboutMeDiv.style.pointerEvents = 'none';
    }
}

// --- ANİMASYON DÖNGÜSÜ ---

function animate(time=0) {
    requestAnimationFrame(animate);

    glowMaterial.uniforms.viewVector.value = camera.position;

    if (!animating) {
    if (mouseMoved) {
        mouseX += (targetMouseX - mouseX) * 0.1;
        mouseY += (targetMouseY - mouseY) * 0.1;

        if (Math.abs(targetMouseX - mouseX) < 0.001 && Math.abs(targetMouseY - mouseY) < 0.001) {
        mouseMoved = false;
        }
    } else {
        mouseX += (0 - mouseX) * 0.1;
        mouseY += (0 - mouseY) * 0.1;
    }
    }

    for(let i=0; i<maxVisible; i++) {
    if (!animating) {
        const speedFactor = mouseX * 0.002;
        angles[i].theta += speeds[i].dTheta + speedFactor;
        angles[i].phi += speeds[i].dPhi;
    }
    const x = angles[i].radius * Math.sin(angles[i].phi) * Math.cos(angles[i].theta);
    const y = angles[i].radius * Math.cos(angles[i].phi);
    const z = angles[i].radius * Math.sin(angles[i].phi) * Math.sin(angles[i].theta);

    positions[3*i] = x;
    positions[3*i+1] = y;
    positions[3*i+2] = z;
    }
    pointsGeometry.attributes.position.needsUpdate = true;

    if(!animating) {
    if(!activeButton) {
        const rotationSpeed = 0.0015 + mouseX * 0.008;
        sphere.rotation.y -= rotationSpeed;
        glowMesh.rotation.y = 0;
        points.rotation.y = sphere.rotation.y;

        camera.position.x += (mouseX * parallaxIntensity - camera.position.x) * 0.05;
        camera.position.y += (mouseY * parallaxIntensity - camera.position.y) * 0.05;
    } else {
        glowMesh.rotation.y = 0;
        points.rotation.y = 0;
    }
    } else {
    const elapsed = time - animationStartTime;
    let t = elapsed / animationDuration;
    if(t > 1) t = 1;

    const easeInOutQuad = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;

    if(activeButton) {
        const target = buttons[activeButton].sphereTargetPos;
        const scale = lerp(1, buttons[activeButton].sphereEndScale, easeInOutQuad);
        const posX = lerp(0, target.x, easeInOutQuad);
        const posY = lerp(0, target.y, easeInOutQuad);

        sphere.scale.set(scale, scale, scale);
        sphere.position.set(posX, posY, 0);

        points.scale.set(scale, scale, scale);
        points.position.set(posX, posY, 0);

        glowMesh.position.set(posX - 3.5, posY, 0);
        glowMesh.scale.set(scale * (glowRadius / sphereRadius), scale * (glowRadius / sphereRadius), scale * (glowRadius / sphereRadius));
    } else {
        const scale = lerp(buttons['btn-top-left'].sphereEndScale, 1, easeInOutQuad);
        const posX = lerp(sphere.position.x, 0, easeInOutQuad);
        const posY = lerp(sphere.position.y, 0, easeInOutQuad);

        sphere.scale.set(scale, scale, scale);
        sphere.position.set(posX, posY, 0);

        points.scale.set(scale, scale, scale);
        points.position.set(posX, posY, 0);

        glowMesh.position.set(posX - 3.5 * (1 - easeInOutQuad), posY, 0);
        glowMesh.scale.set(scale * (glowRadius / sphereRadius), scale * (glowRadius / sphereRadius), scale * (glowRadius / sphereRadius));
    }

    for (const key in buttons) {
        const textElem = document.getElementById(buttons[key].textId);
        if(activeButton === key) {
        textElem.style.opacity = easeInOutQuad;
        textElem.style.pointerEvents = 'auto';
        textElem.style.display = 'flex';
        } else {
        textElem.style.opacity = 1 - easeInOutQuad;
        textElem.style.pointerEvents = 'none';
        if(t === 1) textElem.style.display = 'none';
        }
    }

    for (const key in buttons) {
        const btn = document.getElementById(key);
        if(activeButton) {
        btn.style.opacity = (t > 0.2) ? '0' : (1 - easeInOutQuad);
        } else {
        btn.style.opacity = (t === 1) ? '1' : '0';
        }
    }

    if(t === 1) animating = false;
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
