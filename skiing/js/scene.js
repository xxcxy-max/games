// ===== THREE 渲染层:消费 logic 状态,按实体 id 增量创建/移除/更新 mesh =====
// 坐标约定与 logic 一致:玩家在 z=0,前方为负 z,x 为横向(米)
class SkiScene {
  constructor(container) {
    if (typeof THREE === 'undefined') throw new Error('THREE 未加载');
    this.container = container;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    container.insertBefore(this.renderer.domElement, container.firstChild);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaed6f0);
    this.scene.fog = new THREE.Fog(0xc4dff2, 55, 200);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 400);
    this.camera.position.set(0, 5, 8);
    this.camX = 0;

    // ----- 灯光 -----
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.6);
    sun.position.set(30, 60, 20);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xbfd4e6, 0.75));

    // ----- 起伏雪地(高度场:fBm 自然起伏 + 蜿蜒谷壁 + 弯道侧倾 + 向前下坡) -----
    this.snowTex = this.makeSnowTexture();
    this.groundGeo = new THREE.PlaneGeometry(220, 320, 88, 100);
    this.groundGeo.rotateX(-Math.PI / 2);   // 顶点变为 (x, 0, z),z ∈ [-160,160]
    // 滑道着色:道内亮白,道外偏蓝灰,一眼看出可滑区域
    const pa = this.groundGeo.attributes.position.array;
    const colors = new Float32Array(pa.length);
    for (let i = 0; i < pa.length; i += 3) {
      const t = Math.min(1, Math.max(0, (Math.abs(pa[i]) - SLOPE_HALF_W) / 3));
      colors[i] = 1 - t * 0.12;
      colors[i + 1] = 1 - t * 0.07;
      colors[i + 2] = 1;
    }
    this.groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.ground = new THREE.Mesh(
      this.groundGeo,
      new THREE.MeshLambertMaterial({ map: this.snowTex, color: 0xffffff, vertexColors: true })
    );
    this.ground.position.set(0, 0, -110);
    this.scene.add(this.ground);
    this.groundY = 0;   // 玩家脚下地面高度(平滑值,相机用)

    // ----- 滑道边界标志杆(橙/蓝交替,随速度滚动循环) -----
    this.edgePoles = [];
    const poleGeoC = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5);
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const color = (i >> 1) % 2 === 0 ? 0xe07a2f : 0x2a6ad2;
      const pole = new THREE.Mesh(poleGeoC, new THREE.MeshLambertMaterial({ color }));
      pole.position.set(side * (SLOPE_HALF_W + 0.8), 0, -156 + (i >> 1) * 12);
      this.scene.add(pole);
      this.edgePoles.push(pole);
    }

    // ----- 远景雪山(雾里,静止) -----
    this.buildMountains();

    // ----- 两侧装饰松树(随速度向后滚动并循环) -----
    this.decoTrees = [];
    for (let i = 0; i < 22; i++) {
      const t = this.buildTree();
      const side = i % 2 === 0 ? -1 : 1;
      t.position.set(
        side * (SLOPE_HALF_W + 4 + Math.random() * 22),
        0,
        -140 + Math.random() * 150
      );
      this.scene.add(t);
      this.decoTrees.push(t);
    }

    // ----- 飘雪粒子 -----
    this.snow = this.buildSnow();
    this.scene.add(this.snow);

    // ----- 玩家(积木小人) -----
    this.playerMesh = this.buildSkier();
    this.scene.add(this.playerMesh);

    this.meshById = new Map();    // 实体 id -> Object3D

    window.addEventListener('resize', () => this.onResize());
  }

  // 确定性值噪声(格点 hash + 平滑双线性插值),fBm 叠加出自然起伏
  hash2(ix, iz) {
    let n = (ix * 374761393 + iz * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  vnoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    let fx = x - ix, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx);
    fz = fz * fz * (3 - 2 * fz);
    const a = this.hash2(ix, iz), b = this.hash2(ix + 1, iz);
    const c = this.hash2(ix, iz + 1), d = this.hash2(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  fbm(x, z) {   // 3 个倍频,幅值减半 -> 大起伏上叠小细节
    return this.vnoise(x, z) * 0.55
         + this.vnoise(x * 2.3 + 11, z * 2.3 + 7) * 0.3
         + this.vnoise(x * 5.1 + 23, z * 5.1 + 17) * 0.15;
  }
  // 雪道走向:长波蜿蜒(只作用于谷壁与侧倾,可滑区域始终居中)
  trackCurve(wz) {
    return 12 * Math.sin(wz * 0.011) + 7 * Math.sin(wz * 0.0043 + 1.7);
  }
  trackBank(wz) {   // 弯道侧倾量 ≈ 走向斜率
    return (this.trackCurve(wz + 4) - this.trackCurve(wz - 4)) / 8;
  }

  // 地形高度:wx/wz 为世界坐标(wz = 屏幕 z + 里程)
  // = 向前下坡 + fBm 自然起伏 + 蜿蜒谷壁 + 弯道侧倾
  groundH(wx, wz) {
    const G = 0.07;   // 下坡坡度:前方(负 z)更低
    let h = G * wz;
    h += (this.fbm(wx * 0.045, wz * 0.045) - 0.5) * 3.2;   // 主起伏 ±1.6m
    h += (this.fbm(wx * 0.18 + 31, wz * 0.18) - 0.5) * 0.7; // 表面细节
    const cx = wx - this.trackCurve(wz);
    const side = Math.max(0, Math.abs(cx) - SLOPE_HALF_W - 6);
    if (side > 0) {
      h += side * (0.35 + 0.5 * this.fbm(wx * 0.03 + 5, wz * 0.06)) + side * side * 0.006;
    }
    h += cx * this.trackBank(wz) * 0.35;   // 弯道处雪道倾斜
    return h;
  }

  // 雪地纹理:白底 + 细灰点/横纹,offset 滚动产生速度感
  makeSnowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f8fc';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(180,200,220,0.35)';
    for (let i = 0; i < 60; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    g.fillStyle = 'rgba(190,210,230,0.18)';
    for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 32);
    return tex;
  }

  buildMountains() {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6a8fc0 });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xe8f2fa });
    for (let i = 0; i < 9; i++) {
      const x = -130 + i * 32 + (Math.random() * 20 - 10);
      const z = -170 - Math.random() * 40;
      const h = 40 + Math.random() * 35;
      const r = 22 + Math.random() * 14;
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), rockMat);
      m.position.set(x, h / 2 - 17, z);   // 前方下坡,远处地面比玩家低约 13m,山基埋到坡下
      m.rotation.y = Math.random() * Math.PI;
      this.scene.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.4, 6), snowMat);
      cap.position.set(x, h - h * 0.2 - 17, z);
      cap.rotation.y = m.rotation.y;
      this.scene.add(cap);
    }
  }

  // 程序生成松树:圆柱树干 + 三层圆锥
  buildTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2e })
    );
    trunk.position.y = 0.45;
    g.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e6b3a });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xe8f2fa });
    for (let i = 0; i < 3; i++) {
      const r = 1.15 - i * 0.32;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.1, 7), leafMat);
      cone.position.y = 1.1 + i * 0.75;
      g.add(cone);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, 0.4, 7), snowMat);
      cap.position.y = 1.1 + i * 0.75 + 0.42;
      g.add(cap);
    }
    const s = 0.8 + Math.random() * 0.6;
    g.scale.set(s, s, s);
    return g;
  }

  buildRock() {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.0, 0),
      new THREE.MeshLambertMaterial({ color: 0x8a8f99 })
    );
    rock.scale.set(1, 0.72, 1);
    rock.position.y = 0.5;
    rock.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
    const g = new THREE.Group();
    g.add(rock);
    return g;
  }

  // 旗门:两根杆 + 中间旗面(红/蓝交替)
  buildGate(e) {
    const g = new THREE.Group();
    const red = e.id % 2 === 0;
    const color = red ? 0xd23c2a : 0x2a6ad2;
    const poleMat = new THREE.MeshLambertMaterial({ color });
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), poleMat);
      pole.position.set(side * e.halfGap, 1.15, 0);
      g.add(pole);
    }
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(e.halfGap * 2, 0.55),
      new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true })
    );
    banner.position.y = 1.9;
    g.add(banner);
    g.userData.banner = banner;
    return g;
  }

  buildStar() {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshLambertMaterial({ color: 0xffd23c, emissive: 0x8a6a10 })
    );
    star.position.y = 1.3;
    const g = new THREE.Group();
    g.add(star);
    g.userData.spin = star;
    return g;
  }

  buildBoost() {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.12, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xff8c2a, emissive: 0x7a3800 })
    );
    pad.position.y = 0.06;
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.0, 4),
      new THREE.MeshLambertMaterial({ color: 0xffe08a, emissive: 0x6a5200 })
    );
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.y = 0.2;
    const g = new THREE.Group();
    g.add(pad);
    g.add(arrow);
    return g;
  }

  // 跳台:雪堆 + 前倾起跳面(蓝色),压上去起跳
  buildJump() {
    const g = new THREE.Group();
    const mound = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.2, 4),
      new THREE.MeshLambertMaterial({ color: 0xeef4fb })
    );
    mound.scale.set(1.2, 1, 1.6);
    mound.position.y = 0.6;
    mound.rotation.y = Math.PI / 4;
    g.add(mound);
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.14, 2.8),
      new THREE.MeshLambertMaterial({ color: 0x2a6ad2, emissive: 0x0a2a66 })
    );
    ramp.rotation.x = -0.34;
    ramp.position.set(0, 0.72, -0.15);
    g.add(ramp);
    return g;
  }

  // 积木拼的滑雪小人(随转向倾斜)
  buildSkier() {
    const g = new THREE.Group();
    const box = (w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    // 双板 + 靴
    for (const side of [-1, 1]) {
      box(0.16, 0.06, 1.9, 0xd23c2a, side * 0.24, 0.03, 0);
      box(0.18, 0.16, 0.4, 0x3a3f47, side * 0.24, 0.14, -0.1);
      // 腿(略前倾)
      const leg = box(0.16, 0.5, 0.2, 0x2a4d8f, side * 0.24, 0.48, -0.05);
      leg.rotation.x = 0.25;
      // 手臂 + 雪杖
      const arm = box(0.12, 0.5, 0.12, 0xe07a2f, side * 0.38, 1.15, -0.05);
      arm.rotation.x = 0.5;
      arm.rotation.z = -side * 0.25;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5),
        new THREE.MeshLambertMaterial({ color: 0x555c66 })
      );
      pole.position.set(side * 0.46, 0.7, 0.15);
      pole.rotation.x = 0.35;
      g.add(pole);
    }
    // 躯干(前倾) + 头 + 帽 + 护目镜
    const torso = box(0.55, 0.62, 0.32, 0xe07a2f, 0, 1.02, -0.08);
    torso.rotation.x = 0.22;
    box(0.3, 0.3, 0.3, 0xf0c8a0, 0, 1.5, -0.02);
    box(0.33, 0.14, 0.33, 0xd23c2a, 0, 1.68, -0.02);
    box(0.26, 0.08, 0.06, 0x2a3a4a, 0, 1.52, -0.2);
    return g;
  }

  buildSnow() {
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 35;
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = -70 + Math.random() * 80;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85,
    }));
  }

  // 实体 -> mesh 工厂
  buildEntityMesh(e) {
    if (e.type === 'obstacle') return e.kind === 'tree' ? this.buildTree() : this.buildRock();
    if (e.type === 'gate') return this.buildGate(e);
    if (e.type === 'jump') return this.buildJump();
    return e.kind === 'star' ? this.buildStar() : this.buildBoost();
  }

  // ================= 每帧同步 logic 状态 =================

  sync(world, dt) {
    const p = world.player;
    const dist = world.dist;

    // 地形高度场随里程滚动(顶点按世界坐标重算,雪丘向后流动)
    const pos = this.groundGeo.attributes.position;
    const va = pos.array;
    for (let i = 0; i < va.length; i += 3) {
      va[i + 1] = this.groundH(va[i], va[i + 2] - 110 + dist);
    }
    pos.needsUpdate = true;
    this.groundGeo.computeVertexNormals();

    // 玩家脚下地面高度(平滑),相机跟随
    const targetY = this.groundH(p.x, dist);
    this.groundY += (targetY - this.groundY) * Math.min(1, dt * 8);

    // 玩家:贴地 + 跳台腾空高度 + 随坡度/起跳前倾 + 转向倾斜 + 无敌闪烁
    this.playerMesh.position.x = p.x;
    this.playerMesh.position.y = targetY + p.y;
    const slope = (this.groundH(p.x, dist - 2) - this.groundH(p.x, dist + 2)) / 4;
    this.playerMesh.rotation.x = Math.atan(slope) * 0.7
      - Math.max(-8, Math.min(8, p.vy)) * 0.045;
    this.playerMesh.rotation.z = -p.steerVis * 0.45;
    this.playerMesh.rotation.y = -p.steerVis * 0.25;
    this.playerMesh.visible = p.invincible <= 0 || Math.floor(world.time * 10) % 2 === 0;

    // 实体增量同步
    const seen = new Set();
    for (const e of world.entities) {
      seen.add(e.id);
      let m = this.meshById.get(e.id);
      if (!m) {
        m = this.buildEntityMesh(e);
        this.meshById.set(e.id, m);
        this.scene.add(m);
      }
      m.position.x = e.x;
      m.position.z = e.z;
      m.position.y = this.groundH(e.x, e.z + dist);
      // 星星旋转 / 加速带箭头脉动
      if (m.userData.spin) m.userData.spin.rotation.y += dt * 3;
      // 旗门旗面:穿过变绿,漏过变灰
      if (e.type === 'gate' && m.userData.banner) {
        if (e.passed) m.userData.banner.material.color.setHex(0x3cb54a);
        else if (e.missed) m.userData.banner.material.color.setHex(0x9aa2ac);
      }
      // 被撞的树/岩石倒地
      if (e.type === 'obstacle' && e.hit) m.rotation.x = Math.min(1.2, m.rotation.x + dt * 6);
    }
    for (const [id, m] of this.meshById) {
      if (!seen.has(id)) {
        this.scene.remove(m);
        this.meshById.delete(id);
      }
    }

    // 相机追尾(横向缓动 + 贴地/腾空高度;视线随雪道蜿蜒摆动,营造弯道感)
    this.camX += (p.x * 0.7 - this.camX) * Math.min(1, dt * 5);
    this.camera.position.set(this.camX, this.groundY + 5.0 + p.y * 0.5, 8.0);
    const sway = (this.trackCurve(dist - 70) - this.trackCurve(dist)) * 0.35;
    this.camera.lookAt(p.x * 0.85 + sway, this.groundH(p.x, dist - 12) + 1.0, -12);

    // 雪地纹理滚动 + 两侧装饰树/边界标志杆滚动循环(贴地形)
    this.snowTex.offset.y = (dist / 10) % 1;
    for (const t of this.decoTrees) {
      t.position.z += p.speed * dt;
      if (t.position.z > 15) t.position.z -= 155;
      t.position.y = this.groundH(t.position.x, t.position.z + dist);
    }
    for (const pole of this.edgePoles) {
      pole.position.z += p.speed * dt;
      if (pole.position.z > 8) pole.position.z -= 168;
      pole.position.y = this.groundH(pole.position.x, pole.position.z + dist) + 0.7;
    }

    // 飘雪:下落 + 被风带着向后,出界回收
    const arr = this.snow.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * 3.5;
      arr[i + 2] += dt * p.speed * 0.35;
      if (arr[i + 1] < 0) arr[i + 1] += 22;
      if (arr[i + 2] > 10) arr[i + 2] -= 80;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
    // 飘雪整体跟随地面高度
    this.snow.position.y = this.groundY;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
