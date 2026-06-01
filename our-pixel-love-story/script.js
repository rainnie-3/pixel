(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const data = window.LOVE_STORY_DATA || LOVE_STORY_DATA;
  const saveKey = "ourPixelLoveStorySave.v1";
  const world = { w: canvas.width, h: canvas.height };
  const keys = new Set();
  let last = 0;
  let running = false;
  let finalePlaying = false;
  let toastTimer = 0;
  let catLineAt = 0;
  let activeArea = "Blossom Town";
  let transitionFlash = 0;
  let portalCooldown = 0;
  let saveTimer = 0;

  const areaOrder = ["Blossom Town", "Love Cafe", "Moonlight Lake", "Teddy Meadow", "Memory Sky"];
  const palettes = {
    "Blossom Town": { sky: "#bde7ff", ground: "#94dea5", path: "#ffc1d5", flower: "#ff6fa3" },
    "Love Cafe": { sky: "#f5bd89", ground: "#bc8a5f", path: "#ffe0a3", flower: "#f75f8f" },
    "Moonlight Lake": { sky: "#36316f", ground: "#495f8f", path: "#7db7d6", flower: "#ffd36e" },
    "Teddy Meadow": { sky: "#a9e3ff", ground: "#b4df82", path: "#f5c68c", flower: "#d8755d" },
    "Memory Sky": { sky: "#6b79c8", ground: "#ffe4f0", path: "#fff3a9", flower: "#ffffff" }
  };

  const save = loadSave();
  activeArea = areaOrder.includes(save.area) ? save.area : "Blossom Town";
  const player = {
    x: save.x || 92,
    y: save.y || 385,
    w: 22,
    h: 30,
    speed: 118,
    dir: "down",
    step: 0,
    mood: "idle",
    hair: save.hair || "#6a3b2e",
    outfit: save.outfit || "#6b79c8"
  };
  const cat = { x: player.x - 34, y: player.y + 18, step: 0 };
  const girl = { x: 820, y: 215, appear: 0 };
  const particles = [];
  const petals = Array.from({ length: 36 }, (_, i) => ({ x: i * 31 % world.w, y: i * 47 % world.h, s: 1 + i % 3, v: 10 + i % 16 }));
  const fireflies = Array.from({ length: 24 }, (_, i) => ({ x: 420 + i * 19 % 420, y: 92 + i * 31 % 260, t: i }));
  const memoryPositions = {
    "Blossom Town": [[148, 250], [282, 148], [344, 360], [760, 250]],
    "Love Cafe": [[154, 324], [312, 222], [644, 288], [806, 382]],
    "Moonlight Lake": [[144, 112], [270, 424], [556, 226], [790, 342]],
    "Teddy Meadow": [[176, 346], [468, 194], [684, 404], [840, 210]],
    "Memory Sky": [[250, 286], [390, 180], [612, 312], [760, 226]]
  };
  const areaCounts = {};

  const memories = data.memories.map((memory, i) => {
    const areaIndex = areaCounts[memory.area] || 0;
    areaCounts[memory.area] = areaIndex + 1;
    const pos = memoryPositions[memory.area][areaIndex] || [world.w / 2, world.h / 2];
    return { ...memory, id: i, x: pos[0], y: pos[1], collected: save.memories.includes(i) };
  });

  const animals = [
    { area: "Blossom Town", x: 165, y: 360, kind: "bunny", text: "Hop toward pink petals for a sweet surprise." },
    { area: "Love Cafe", x: 564, y: 362, kind: "bear", text: "The cafe keeps warm memories beside the tables." },
    { area: "Moonlight Lake", x: 736, y: 92, kind: "cat", text: "The moon knows where the shiny hearts hide." },
    { area: "Teddy Meadow", x: 210, y: 226, kind: "bunny", text: "A glowing path appears after the meadow hearts." }
  ];

  const portals = {
    "Blossom Town": [
      { x: 900, y: 360, w: 42, h: 90, to: "Love Cafe", spawn: { x: 86, y: 392 }, label: "Cafe" },
      { x: 438, y: 486, w: 92, h: 42, to: "Moonlight Lake", spawn: { x: 468, y: 86 }, label: "Lake" }
    ],
    "Love Cafe": [
      { x: 18, y: 360, w: 42, h: 90, to: "Blossom Town", spawn: { x: 852, y: 392 }, label: "Town" },
      { x: 438, y: 486, w: 92, h: 42, to: "Teddy Meadow", spawn: { x: 468, y: 86 }, label: "Meadow" }
    ],
    "Moonlight Lake": [
      { x: 438, y: 18, w: 92, h: 42, to: "Blossom Town", spawn: { x: 468, y: 436 }, label: "Town" },
      { x: 900, y: 360, w: 42, h: 90, to: "Teddy Meadow", spawn: { x: 86, y: 392 }, label: "Meadow" }
    ],
    "Teddy Meadow": [
      { x: 18, y: 360, w: 42, h: 90, to: "Moonlight Lake", spawn: { x: 852, y: 392 }, label: "Lake" },
      { x: 438, y: 18, w: 92, h: 42, to: "Love Cafe", spawn: { x: 468, y: 436 }, label: "Cafe" },
      { x: 900, y: 198, w: 42, h: 112, to: "Memory Sky", spawn: { x: 92, y: 260 }, label: "Sky", lockedUntilSky: true }
    ],
    "Memory Sky": [
      { x: 18, y: 198, w: 42, h: 112, to: "Teddy Meadow", spawn: { x: 852, y: 260 }, label: "Meadow" }
    ]
  };

  sanitizeLoadedSave();

  const ui = {
    start: document.getElementById("startScreen"),
    game: document.getElementById("gameScreen"),
    finale: document.getElementById("finaleScreen"),
    heartCount: document.getElementById("heartCount"),
    areaName: document.getElementById("areaName"),
    toast: document.getElementById("toast"),
    speaker: document.getElementById("speaker"),
    dialogue: document.getElementById("dialogueText"),
    memoryModal: document.getElementById("memoryModal"),
    scrapbookModal: document.getElementById("scrapbookModal"),
    letterModal: document.getElementById("letterModal"),
    scrapbookContent: document.getElementById("scrapbookContent"),
    music: document.getElementById("musicPlayer"),
    musicToggle: document.getElementById("musicToggle"),
    volume: document.getElementById("volumeSlider")
  };

  function loadSave() {
    try {
      return { memories: [], notes: [], achievements: [], ending: false, area: "Blossom Town", ...JSON.parse(localStorage.getItem(saveKey) || "{}") };
    } catch {
      return { memories: [], notes: [], achievements: [], ending: false, area: "Blossom Town" };
    }
  }

  function persist() {
    localStorage.setItem(saveKey, JSON.stringify({
      x: Math.round(player.x), y: Math.round(player.y),
      area: activeArea,
      hair: player.hair,
      outfit: player.outfit,
      memories: memories.filter(m => m.collected).map(m => m.id),
      notes: save.notes,
      achievements: save.achievements,
      ending: save.ending
    }));
  }

  function currentArea() {
    return activeArea;
  }

  function sanitizeLoadedSave() {
    if (activeArea === "Memory Sky" && !skyUnlocked()) {
      activeArea = "Teddy Meadow";
      player.x = 468;
      player.y = 436;
    }
    player.x = clamp(Number.isFinite(player.x) ? player.x : 92, 24, world.w - player.w - 24);
    player.y = clamp(Number.isFinite(player.y) ? player.y : 385, 24, world.h - player.h - 24);
    cat.x = player.x - 34;
    cat.y = player.y + 18;
    persist();
  }

  function skyUnlocked() {
    return memories.filter(memory => memory.area !== "Memory Sky").every(memory => memory.collected);
  }

  function changeArea(portal) {
    if (portal.lockedUntilSky && !skyUnlocked()) {
      say("Cat", "The Memory Sky opens after every heart in town, cafe, lake, and meadow is found.");
      showToast("Memory Sky is still locked");
      player.x = Math.min(player.x, world.w - 76);
      portalCooldown = .45;
      return;
    }
    activeArea = portal.to;
    player.x = clamp(portal.spawn.x, 22, world.w - player.w - 22);
    player.y = clamp(portal.spawn.y, 22, world.h - player.h - 22);
    cat.x = player.x - 34;
    cat.y = player.y + 18;
    transitionFlash = 1;
    portalCooldown = .55;
    say("Cat", "Welcome to " + activeArea + ".");
    showToast("Entering " + activeArea);
    persist();
  }

  function handlePortals() {
    if (portalCooldown > 0) return;
    const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };
    const portal = (portals[activeArea] || []).find(exit => rectsTouch(playerRect, exit));
    if (portal) changeArea(portal);
  }

  function addAchievement(id) {
    if (!save.achievements.includes(id)) save.achievements.push(id);
  }

  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2400);
  }

  function say(speaker, text) {
    ui.speaker.textContent = speaker;
    ui.dialogue.textContent = text;
  }

  function setScreens(active) {
    [ui.start, ui.game, ui.finale].forEach(screen => screen.classList.toggle("active", screen === active));
  }

  function rectsTouch(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function collect(memory) {
    if (memory.collected) return;
    memory.collected = true;
    player.mood = "happy";
    addAchievement("firstHeart");
    if (memories.filter(m => m.collected).length >= 10) addAchievement("halfHeart");
    if (memories.every(m => m.collected)) addAchievement("allHeart");
    for (let i = 0; i < 34; i++) particles.push({ x: memory.x, y: memory.y, vx: (Math.random() - .5) * 85, vy: -Math.random() * 90, life: .9, color: i % 2 ? "#ff5f9d" : "#ffd36e" });
    openMemory(memory);
    showToast("Memory unlocked");
    if (skyUnlocked() && activeArea !== "Memory Sky") {
      say("Her note", "The Memory Sky is awake. Find the glowing path in Teddy Meadow.");
    }
    persist();
  }

  function openMemory(memory) {
    document.getElementById("memoryPhoto").src = memory.image;
    document.getElementById("memoryArea").textContent = memory.area;
    document.getElementById("memoryTitle").textContent = memory.title;
    document.getElementById("memoryMessage").textContent = memory.message;
    document.getElementById("memoryDate").textContent = memory.date;
    ui.memoryModal.classList.add("open");
    ui.memoryModal.setAttribute("aria-hidden", "false");
  }

  function openScrapbook(tab = "memories") {
    document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
    if (tab === "memories") {
      ui.scrapbookContent.innerHTML = `<div class="memoryGrid">${memories.map(memory => `
        <article class="memoryCard ${memory.collected ? "" : "locked"}">
          <img src="${memory.image}" alt="">
          <h3>${memory.collected ? memory.title : "Locked Memory"}</h3>
          <p>${memory.collected ? memory.message : "Find this Memory Heart in the world."}</p>
        </article>`).join("")}</div>`;
    }
    if (tab === "achievements") {
      ui.scrapbookContent.innerHTML = data.achievements.map(item => `
        <article class="achievement ${save.achievements.includes(item.id) ? "" : "locked"}">
          <h3>${item.title}</h3><p>${item.description}</p>
        </article>`).join("");
    }
    if (tab === "notes") {
      const notes = data.hiddenNotes.map((note, i) => ({ ...note, found: save.notes.includes(i) }));
      ui.scrapbookContent.innerHTML = notes.map(note => `
        <article class="noteCard ${note.found ? "" : "locked"}">
          <h3>${note.found ? note.title : "Secret Note"}</h3>
          <p>${note.found ? note.message : "A hidden note is waiting somewhere cozy."}</p>
        </article>`).join("");
    }
    ui.scrapbookModal.classList.add("open");
    ui.scrapbookModal.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function resetAdventure() {
    const ok = confirm("Reset the adventure and start over?");
    if (!ok) return;
    localStorage.removeItem(saveKey);
    location.reload();
  }

  function drawPixelText(text, x, y, color = "#3e2d44") {
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.fillRect(x - 8, y - 18, text.length * 7 + 16, 24);
    ctx.fillStyle = color;
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(text, x, y);
  }

  function drawHeart(x, y, size, color) {
    ctx.fillStyle = color;
    const s = size;
    ctx.fillRect(x, y + s, s, s);
    ctx.fillRect(x + s, y, s, s);
    ctx.fillRect(x + s, y + s, s, s);
    ctx.fillRect(x + s, y + s * 2, s, s);
    ctx.fillRect(x + s * 2, y + s, s, s);
    ctx.fillRect(x + s * 3, y, s, s);
    ctx.fillRect(x + s * 3, y + s, s, s);
    ctx.fillRect(x + s * 2, y + s * 2, s, s);
  }

  function drawBoy(p) {
    const bob = Math.sin(p.step * 9) * 2;
    const x = Math.round(p.x), y = Math.round(p.y + bob);
    ctx.fillStyle = p.hair; ctx.fillRect(x + 5, y, 12, 7); ctx.fillRect(x + 3, y + 5, 16, 4);
    ctx.fillStyle = "#ffd0b8"; ctx.fillRect(x + 5, y + 8, 14, 12);
    ctx.fillStyle = p.mood === "happy" ? "#ff86a9" : "#3e2d44"; ctx.fillRect(x + 8, y + 13, 2, 2); ctx.fillRect(x + 15, y + 13, 2, 2);
    if (p.mood === "happy") { ctx.fillStyle = "#ff7896"; ctx.fillRect(x + 4, y + 16, 3, 2); ctx.fillRect(x + 18, y + 16, 3, 2); }
    ctx.fillStyle = p.outfit; ctx.fillRect(x + 3, y + 21, 18, 16);
    ctx.fillStyle = "#fff6df"; ctx.fillRect(x + 9, y + 24, 6, 5);
    ctx.fillStyle = "#2f365f"; ctx.fillRect(x + 5, y + 37, 6, 9); ctx.fillRect(x + 15, y + 37, 6, 9);
  }

  function drawGirl() {
    const x = girl.x, y = girl.y + Math.sin(last / 420) * 2;
    ctx.globalAlpha = Math.min(1, girl.appear);
    ctx.fillStyle = "#4a2a32"; ctx.fillRect(x + 2, y, 24, 35); ctx.fillRect(x, y + 12, 28, 34);
    ctx.fillStyle = "#ffd0b8"; ctx.fillRect(x + 6, y + 8, 16, 16);
    ctx.fillStyle = "#2c2347"; ctx.fillRect(x + 7, y + 14, 5, 2); ctx.fillRect(x + 16, y + 14, 5, 2); ctx.fillRect(x + 12, y + 14, 4, 1);
    ctx.fillStyle = "#ff8dac"; ctx.fillRect(x + 3, y + 25, 24, 24);
    ctx.fillStyle = "#fff6df"; ctx.fillRect(x + 8, y + 30, 14, 8);
    ctx.fillStyle = "#5a4e8c"; ctx.fillRect(x + 6, y + 49, 7, 9); ctx.fillRect(x + 17, y + 49, 7, 9);
    ctx.globalAlpha = 1;
  }

  function drawCat(c) {
    const x = Math.round(c.x), y = Math.round(c.y + Math.sin(c.step * 8) * 1.5);
    ctx.fillStyle = "#fff7ef"; ctx.fillRect(x + 5, y + 8, 18, 12);
    ctx.fillRect(x + 8, y + 2, 12, 9);
    ctx.fillStyle = "#fff7ef"; ctx.fillRect(x + 7, y, 4, 4); ctx.fillRect(x + 17, y, 4, 4);
    ctx.fillStyle = "#3e2d44"; ctx.fillRect(x + 11, y + 6, 2, 2); ctx.fillRect(x + 16, y + 6, 2, 2);
    ctx.fillRect(x + 22, y + 10, 8, 3);
  }

  function drawAnimal(animal) {
    ctx.fillStyle = animal.kind === "bear" ? "#b77b55" : animal.kind === "bunny" ? "#fff4f8" : "#6a3b2e";
    ctx.fillRect(animal.x, animal.y + 10, 24, 18);
    ctx.fillRect(animal.x + 4, animal.y, 16, 14);
    if (animal.kind === "bunny") { ctx.fillRect(animal.x + 3, animal.y - 12, 5, 14); ctx.fillRect(animal.x + 16, animal.y - 12, 5, 14); }
    else { ctx.fillRect(animal.x + 2, animal.y - 3, 6, 6); ctx.fillRect(animal.x + 16, animal.y - 3, 6, 6); }
    ctx.fillStyle = "#3e2d44"; ctx.fillRect(animal.x + 8, animal.y + 6, 2, 2); ctx.fillRect(animal.x + 15, animal.y + 6, 2, 2);
  }

  function drawWorld(area) {
    const p = palettes[area];
    ctx.fillStyle = p.sky; ctx.fillRect(0, 0, world.w, world.h);
    if (area === "Moonlight Lake" || area === "Memory Sky") {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 38; i++) ctx.fillRect((i * 73 + 20) % world.w, (i * 37 + 18) % 185, 3, 3);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.78)";
      for (let i = 0; i < 6; i++) {
        const x = (i * 170 + last / 70) % (world.w + 90) - 80;
        ctx.fillRect(x, 50 + i % 3 * 38, 58, 18); ctx.fillRect(x + 16, 38 + i % 3 * 38, 36, 16);
      }
    }
    ctx.fillStyle = p.ground; ctx.fillRect(0, 188, world.w, world.h - 188);
    ctx.fillStyle = p.path; ctx.fillRect(0, 390, world.w, 54); ctx.fillRect(438, 188, 80, 352);
    drawDecor(area, p);
    drawPortals(area);
  }

  function drawPortals(area) {
    (portals[area] || []).forEach(portal => {
      const locked = portal.lockedUntilSky && !skyUnlocked();
      ctx.globalAlpha = locked ? .46 : 1;
      ctx.fillStyle = locked ? "#6f6484" : "#fff6df";
      ctx.fillRect(portal.x, portal.y, portal.w, portal.h);
      ctx.fillStyle = locked ? "#3e2d44" : "#ff8dac";
      ctx.fillRect(portal.x + 6, portal.y + 6, portal.w - 12, portal.h - 12);
      ctx.fillStyle = locked ? "#ffd36e" : "#fff6df";
      ctx.fillRect(portal.x + 12, portal.y + 12, portal.w - 24, portal.h - 24);
      ctx.globalAlpha = 1;
      const textX = Math.max(20, Math.min(world.w - 92, portal.x - 18));
      const textY = portal.y > 250 ? portal.y - 8 : portal.y + portal.h + 24;
      drawPixelText(locked ? "Locked" : portal.label, textX, textY, locked ? "#6f6484" : "#b83f73");
    });
  }

  function drawDecor(area, p) {
    ctx.fillStyle = "#ffffff";
    if (area === "Blossom Town") {
      drawHouse(56, 102, "#f58ead"); drawHouse(646, 70, "#78b5ef");
      for (let i = 0; i < 70; i++) drawFlower((i * 57) % world.w, 210 + (i * 31) % 250, p.flower);
    } else if (area === "Love Cafe") {
      drawCafe(455, 126);
      for (let i = 0; i < 5; i++) drawTable(165 + i * 135, 318 + (i % 2) * 50);
    } else if (area === "Moonlight Lake") {
      ctx.fillStyle = "#284a78"; ctx.fillRect(350, 266, 470, 150);
      ctx.fillStyle = "rgba(255,255,255,.28)"; for (let i = 0; i < 14; i++) ctx.fillRect(380 + i * 27, 296 + i % 3 * 20, 42, 3);
      fireflies.forEach(f => { ctx.globalAlpha = .45 + Math.sin(last / 300 + f.t) * .35; ctx.fillStyle = "#fff6a8"; ctx.fillRect(f.x, f.y, 4, 4); ctx.globalAlpha = 1; });
    } else if (area === "Teddy Meadow") {
      drawTeddy(84, 245, 46); drawTeddy(710, 320, 54); drawPicnic(520, 210);
      for (let i = 0; i < 42; i++) drawFlower((i * 83) % world.w, 215 + (i * 37) % 260, p.flower);
    } else {
      drawHeartTree(430, 105);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(80 + i * 92, 130 + i % 3 * 62, 74, 16); }
    }
  }

  function drawHouse(x, y, color) {
    ctx.fillStyle = color; ctx.fillRect(x, y + 35, 88, 62);
    ctx.fillStyle = "#7d4b67"; ctx.fillRect(x - 8, y + 24, 104, 18); ctx.fillRect(x + 10, y + 10, 68, 18);
    ctx.fillStyle = "#fff6df"; ctx.fillRect(x + 16, y + 54, 16, 16); ctx.fillRect(x + 56, y + 54, 16, 16);
  }

  function drawCafe(x, y) {
    ctx.fillStyle = "#8e5e4f"; ctx.fillRect(x, y + 20, 140, 80);
    ctx.fillStyle = "#ffd36e"; ctx.fillRect(x + 12, y, 116, 26);
    ctx.fillStyle = "#fff6df"; ctx.fillRect(x + 18, y + 40, 26, 24); ctx.fillRect(x + 58, y + 40, 26, 24); ctx.fillRect(x + 98, y + 40, 26, 24);
    ctx.fillStyle = "#5a2e44"; ctx.font = "18px Trebuchet MS"; ctx.fillText("Cafe", x + 48, y + 19);
  }

  function drawTable(x, y) {
    ctx.fillStyle = "#8e5e4f"; ctx.fillRect(x, y, 44, 14); ctx.fillRect(x + 18, y + 14, 8, 22);
    ctx.fillStyle = "#fff6df"; ctx.fillRect(x + 9, y - 10, 10, 10); ctx.fillStyle = "#ff8dac"; ctx.fillRect(x + 24, y - 12, 8, 8);
  }

  function drawFlower(x, y, color) {
    ctx.fillStyle = "#3f9b64"; ctx.fillRect(x + 3, y + 4, 2, 8);
    ctx.fillStyle = color; ctx.fillRect(x, y, 3, 3); ctx.fillRect(x + 5, y, 3, 3); ctx.fillRect(x + 2, y + 3, 4, 4);
  }

  function drawTeddy(x, y, s) {
    ctx.fillStyle = "#b77b55"; ctx.fillRect(x, y + s * .4, s, s); ctx.fillRect(x + s * .18, y, s * .64, s * .52);
    ctx.fillRect(x, y, s * .24, s * .24); ctx.fillRect(x + s * .76, y, s * .24, s * .24);
    ctx.fillStyle = "#fff0d2"; ctx.fillRect(x + s * .28, y + s * .56, s * .44, s * .28);
  }

  function drawPicnic(x, y) {
    ctx.fillStyle = "#ff8dac"; ctx.fillRect(x, y, 96, 54);
    ctx.fillStyle = "#fff6df"; for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 16, y, 8, 54);
  }

  function drawHeartTree(x, y) {
    ctx.fillStyle = "#7b533f"; ctx.fillRect(x + 54, y + 145, 34, 130);
    ctx.fillStyle = "#ff85aa";
    drawHeart(x + 12, y + 58, 22, "#ff85aa"); drawHeart(x + 78, y + 22, 22, "#ff6f9d"); drawHeart(x + 108, y + 92, 19, "#ffc1d5");
    drawHeart(x + 50, y + 100, 24, "#ff5f9d");
  }

  function update(dt) {
    const area = currentArea();
    ui.areaName.textContent = area;
    ui.heartCount.textContent = memories.filter(m => m.collected).length;
    player.step += dt;
    cat.step += dt;
    girl.appear += area === "Memory Sky" ? dt : -dt;
    girl.appear = Math.max(0, Math.min(1, girl.appear));

    let dx = 0, dy = 0;
    if (!finalePlaying && !document.querySelector(".modal.open")) {
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;
      if (keys.has("arrowup") || keys.has("w")) dy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dy += 1;
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx = dx / len * player.speed * dt;
      dy = dy / len * player.speed * dt;
      movePlayer(dx, dy);
      handlePortals();
      player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      player.mood = "walk";
    } else if (player.mood !== "happy") player.mood = "idle";

    const follow = { x: player.x - 34, y: player.y + 18 };
    cat.x += (follow.x - cat.x) * Math.min(1, dt * 4);
    cat.y += (follow.y - cat.y) * Math.min(1, dt * 4);

    memories.forEach(memory => {
      if (!memory.collected && memory.area === area && distance(player, memory) < 30 && (memory.area !== "Memory Sky" || skyUnlocked())) collect(memory);
    });

    data.hiddenNotes.forEach((note, i) => {
      if (!save.notes.includes(i) && note.area === area && distance(player, note) < 28) {
        save.notes.push(i);
        addAchievement("secretFinder");
        say("Hidden note", note.message);
        showToast(note.title + " found");
        persist();
      }
    });

    animals.filter(animal => animal.area === area).forEach(animal => {
      if (distance(player, animal) < 34) say(animal.kind[0].toUpperCase() + animal.kind.slice(1), animal.text);
    });

    if (Date.now() > catLineAt && !document.querySelector(".modal.open")) {
      catLineAt = Date.now() + 9000;
      say("Cat", data.catLines[Math.floor(Math.random() * data.catLines.length)]);
    }

    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; });
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    petals.forEach(p => { p.y += p.v * dt; p.x += Math.sin(last / 600 + p.y) * dt * 16; if (p.y > world.h) p.y = -10; });
    transitionFlash = Math.max(0, transitionFlash - dt * 2.4);
    portalCooldown = Math.max(0, portalCooldown - dt);

    if (area === "Memory Sky" && memories.every(m => m.collected) && distance(player, girl) < 52 && !save.ending) startFinale();
    saveTimer += dt;
    if (saveTimer > 1) {
      saveTimer = 0;
      persist();
    }
  }

  function movePlayer(dx, dy) {
    player.x = clamp(player.x + dx, 18, world.w - player.w - 18);
    player.y = clamp(player.y + dy, 18, world.h - player.h - 18);
  }

  function startFinale() {
    finalePlaying = true;
    save.ending = true;
    addAchievement("finale");
    persist();
    for (let i = 0; i < 90; i++) particles.push({ x: world.w / 2, y: 160, vx: (Math.random() - .5) * 200, vy: -Math.random() * 160, life: 1.8, color: i % 2 ? "#ff8dac" : "#fff6df" });
    setTimeout(() => setScreens(ui.finale), 1700);
  }

  function draw() {
    const area = currentArea();
    drawWorld(area);
    memories.forEach(memory => {
      if (!memory.collected && memory.area === area && (memory.area !== "Memory Sky" || skyUnlocked())) {
        const float = Math.sin(last / 260 + memory.id) * 4;
        drawHeart(memory.x, memory.y + float, 5, "#ff3f85");
        ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(memory.x - 6, memory.y + 30 + float, 38, 4);
      }
    });
    data.hiddenNotes.forEach((note, i) => {
      if (!save.notes.includes(i) && note.area === area) { ctx.fillStyle = "#fff6df"; ctx.fillRect(note.x, note.y, 14, 10); ctx.fillStyle = "#ff8dac"; ctx.fillRect(note.x + 3, note.y + 3, 8, 2); }
    });
    animals.filter(animal => animal.area === area).forEach(drawAnimal);
    if (area === "Memory Sky") drawGirl();
    drawCat(cat);
    drawBoy(player);
    if (distance(player, girl) < 84 && area === "Memory Sky") drawPixelText("I was waiting for you.", girl.x - 42, girl.y - 18, "#b83f73");
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); drawHeart(p.x, p.y, 3, p.color); ctx.globalAlpha = 1; });
    if (area !== "Moonlight Lake") {
      petals.forEach(p => { ctx.globalAlpha = .5; ctx.fillStyle = "#ff8dac"; ctx.fillRect(p.x, p.y, p.s * 3, p.s * 2); ctx.globalAlpha = 1; });
    }
    if (transitionFlash > 0) {
      ctx.globalAlpha = transitionFlash;
      ctx.fillStyle = "#fff6df";
      ctx.fillRect(0, 0, world.w, world.h);
      ctx.globalAlpha = 1;
    }
  }

  function loop(t) {
    const dt = Math.min(.033, (t - last) / 1000 || .016);
    last = t;
    if (running) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  document.getElementById("startButton").addEventListener("click", async () => {
    player.hair = document.getElementById("hairColor").value;
    player.outfit = document.getElementById("outfitColor").value;
    persist();
    setScreens(ui.game);
    running = true;
    try { await ui.music.play(); ui.musicToggle.textContent = "Pause Music"; } catch { showToast("Drop your MP3 into assets/music/our-song.mp3"); }
  });

  ui.musicToggle.addEventListener("click", async () => {
    if (ui.music.paused) {
      try { await ui.music.play(); ui.musicToggle.textContent = "Pause Music"; } catch { showToast("Add assets/music/our-song.mp3 to play music"); }
    } else {
      ui.music.pause();
      ui.musicToggle.textContent = "Play Music";
    }
  });
  ui.volume.addEventListener("input", () => { ui.music.volume = Number(ui.volume.value); });
  ui.music.volume = Number(ui.volume.value);
  document.getElementById("hairColor").value = player.hair;
  document.getElementById("outfitColor").value = player.outfit;
  document.getElementById("hairColor").addEventListener("change", event => { player.hair = event.target.value; persist(); });
  document.getElementById("outfitColor").addEventListener("change", event => { player.outfit = event.target.value; persist(); });

  document.getElementById("scrapbookButton").addEventListener("click", () => openScrapbook());
  document.getElementById("resetButton").addEventListener("click", resetAdventure);
  document.querySelectorAll(".closeButton").forEach(btn => btn.addEventListener("click", () => closeModal(btn.dataset.close)));
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => openScrapbook(btn.dataset.tab)));
  document.getElementById("letterButton").addEventListener("click", () => {
    document.getElementById("finalLetter").textContent = data.finalLetter;
    document.getElementById("letterPhotos").innerHTML = data.memories.slice(0, 8).map(m => `<img src="${m.image}" alt="">`).join("");
    ui.letterModal.classList.add("open");
  });
  document.getElementById("replayButton").addEventListener("click", startFinale);

  addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "m"].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === "m" && ui.game.classList.contains("active")) openScrapbook();
  });
  addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));

  if (save.ending) addAchievement("finale");
  requestAnimationFrame(loop);
})();
