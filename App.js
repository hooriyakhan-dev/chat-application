/* Hoories - chat page (index.html)
   Uses: Firebase (login check, real-time chats), Cloudinary (photo uploads),
   Groq (Hoories AI). The keys are read from env.js. */
const $ = (i) => document.getElementById(i);
const toast = (m) => {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
};
const ENV = window.ENV,
  fb = {};
const esc = (s) =>
  (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const FB_URL = "https://www.gstatic.com/firebasejs/13.0.0/";
async function initFB() {
  if (fb.ready) return fb;
  const [A, Au, D] = await Promise.all([
    import(FB_URL + "firebase-app.js"),
    import(FB_URL + "firebase-auth.js"),
    import(FB_URL + "firebase-database.js"),
  ]);
  const app = A.initializeApp(ENV.FIREBASE);
  Object.assign(fb, {
    Au,
    D,
    auth: Au.getAuth(app),
    db: D.getDatabase(app),
    ready: true,
  });
  return fb;
}
async function uploadToCloudinary(file) {
  if (!ENV.CLOUDINARY_CLOUD_NAME) return URL.createObjectURL(file); // not set yet: preview on this device only
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", ENV.CLOUDINARY_UPLOAD_PRESET);
  const r = await fetch(
    "https://api.cloudinary.com/v1_1/" +
      ENV.CLOUDINARY_CLOUD_NAME +
      "/image/upload",
    { method: "POST", body: fd },
  );
  if (!r.ok) throw new Error("Cloudinary upload failed");
  return (await r.json()).secure_url;
}
const ERR = {
  "auth/email-already-in-use":
    "This email already has an account. Try logging in.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "Wrong email or password.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/popup-closed-by-user": "Google sign-in was closed.",
  "auth/network-request-failed": "No internet connection.",
  "auth/operation-not-allowed":
    "Turn this sign-in method on in Firebase > Authentication > Sign-in method.",
  "auth/unauthorized-domain":
    "Open the app at http://localhost:PORT, or add this address in Firebase > Authentication > Settings > Authorized domains.",
};
const errMsg = (e) =>
  /PERMISSION_DENIED/i.test(e.message || "")
    ? "The database rules are blocking this. Paste firebase-rules.json into Realtime Database > Rules."
    : ERR[e.code] || e.message || "Something went wrong.";

const tf = (d) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const grad = (h) =>
  `linear-gradient(135deg,hsl(${h} 70% 80%),hsl(${h + 30} 65% 62%))`;
function av(p, c = "") {
  const bg = p.photo
    ? `background-image:url('${p.photo}')`
    : `background:${grad(p.h || 40)}`;
  return `<span class="av ${c}" style="${bg}">${p.photo ? "" : p.ic || esc(p.name[0])}${p.on && c !== "lg" && !p.group ? "<i></i>" : ""}</span>`;
}
let me,
  cur = "bot",
  reply = null,
  nid = 0,
  view = "chat";
const MEMBERS = {}; // people who write in the group chat
const C = [
  {
    id: "bot",
    name: "Hoories AI",
    role: "AI assistant",
    h: 165,
    on: 1,
    ic: "✦",
    m: [],
    u: 0,
  },
];
const g = (c) => C.find((x) => x.id === c),
  who = (u) => (u === "me" ? me : g(u) || MEMBERS[u]);
function add(id, from, text, ago = 0, rp = null) {
  const m = {
    id: "m" + ++nid,
    from,
    text,
    at: new Date(Date.now() - ago * 6e4),
    rp,
    rd: from === "me",
  };
  g(id).m.push(m);
  return m;
}
add(
  "bot",
  "bot",
  "Hi, I'm Hoories AI. Ask me anything, or try “my stats” or “what time is it?”.",
  1,
);
g("bot").u = 1;

$("meBtn").onclick = () => $("af2").click();
document
  .querySelectorAll(".nav[data-v]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.v)));
function setView(v) {
  view = v;
  const M = { chat: "chatv", prof: "profv" };
  document
    .querySelectorAll(".nav[data-v]")
    .forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  Object.values(M).forEach((i) => ($(i).hidden = i !== M[v]));
  all();
}
function renderApp() {
  $("meAv").innerHTML = av(me, "sm");
  list();
  room();
  if (view === "prof") prof();
  const n = C.reduce((a, c) => a + c.u, 0);
  $("unr").textContent = n || "";
  $("unr").hidden = !n;
}

/* list + room */
function last(c) {
  return (
    c.m[c.m.length - 1] || { from: "", text: "Say hi", at: new Date(c.ts || 0) }
  );
}
function list() {
  renderList();
  if (!$("list").children.length)
    $("list").innerHTML =
      '<p style="padding:24px;color:var(--mut)">No chats yet. Tap + and add someone by their username.</p>';
}
function renderList() {
  const q = $("q").value.toLowerCase();
  $("list").innerHTML = [...C]
    .filter((c) => c.id !== "bot" && c.name.toLowerCase().includes(q))
    .sort((a, b) => last(b).at - last(a).at)
    .map((c) => {
      const l = last(c);
      return `<button class="it ${c.id === cur ? "on" : ""}" data-id="${c.id}">${av(c)}<span class="mid"><b>${esc(c.name)}</b><small>${l.from === "me" ? "You: " : c.group && who(l.from) ? esc(who(l.from).name) + ": " : ""}${esc(l.text)}</small></span><span class="rt">${tf(l.at)}${c.u ? `<span class="badge">${c.u}</span>` : ""}</span></button>`;
    })
    .join("");
}
$("q").oninput = list;
$("list").onclick = (e) => {
  const b = e.target.closest(".it");
  if (!b) return;
  cur = b.dataset.id;
  g(cur).u = 0;
  reply = null;
  $("rb").hidden = true;
  $("chatv").classList.add("open");
  all();
};
$("bk").onclick = () => $("chatv").classList.remove("open");
function renderRoom() {
  const c = g(cur);
  $("hav").innerHTML = av(c);
  $("hn").textContent = c.name;
  $("hr").textContent = c.role;
  $("hed").hidden = !!c.group; // only people can be renamed
  $("hs").className = c.typing ? "t" : "";
  $("hs").textContent = c.typing
    ? c.group
      ? "someone is typing…"
      : "typing…"
    : c.group
      ? "Open to everyone on Hoories"
      : c.on
        ? "online"
        : c.seen;
  let prev = null;
  $("msgs").innerHTML =
    '<span class="day">Today</span>' +
    c.m
      .map((m) => {
        const mine = m.from === "me",
          u = who(m.from),
          f = prev !== m.from;
        prev = m.from;
        const q = m.rp
          ? `<button type="button" class="qt" data-j="${m.rp.id}"><b>${esc(m.rp.name)}</b><span>${esc(m.rp.text)}</span></button>`
          : "";
        return `<div class="row ${mine ? "me" : ""} ${f ? "f" : ""}" id="m-${m.id}">${f ? av(u, "sm").replace("<i></i>", "") : '<span style="width:32px;flex:none"></span>'}<div class="bub">${f && !mine && c.group ? `<div class="nm">${esc(u.name)}</div>` : ""}${q}${m.from === "bot" ? md2(m.text) + `<button class="cp" data-cp="${m.id}">Copy</button>` : esc(m.text)}${rxHtml(m)}<span class="tm">${tf(m.at)}${mine ? ` <span class="tk">${m.rd ? "✓✓" : "✓"}</span>` : ""}</span></div><button class="rp" data-x="${m.id}" aria-label="React" title="React">☺</button><button class="rp" data-r="${m.id}" aria-label="Reply" title="Reply">↩</button></div>`;
      })
      .join("");
  $("msgs").scrollTop = 1e9;
}
$("msgs").onclick = (e) => {
  const j = e.target.closest("[data-j]"),
    r = e.target.closest("[data-r]");
  if (j) {
    const el = $("m-" + j.dataset.j);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("fl");
      setTimeout(() => el.classList.remove("fl"), 1500);
    }
  }
  if (r) {
    const m = g(cur).m.find((x) => x.id === r.dataset.r),
      n = who(m.from).name;
    reply = { id: m.id, name: n, text: m.text.slice(0, 80) };
    $("rn").textContent = "Replying to " + n;
    $("rt").textContent = reply.text;
    $("rb").hidden = false;
    $("tx").focus();
  }
};
/* ---------- reactions ---------- */
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
let pickId = null;
const rxPick = $("rxpick");
rxPick.innerHTML = REACTIONS.map(
  (e) => `<button type="button" data-pe="${e}">${e}</button>`,
).join("");
/* m.rx is { userId: emoji }; show one pill per emoji with its count */
function rxHtml(m) {
  const counts = {};
  Object.values(m.rx || {}).forEach((e) => (counts[e] = (counts[e] || 0) + 1));
  const mine = (m.rx || {})[me.uid];
  const pills = Object.entries(counts)
    .map(
      ([e, n]) =>
        `<button type="button" class="rxp${e === mine ? " on" : ""}" data-e="${e}" data-m="${m.id}">${e} ${n}</button>`,
    )
    .join("");
  return pills ? `<div class="rxs">${pills}</div>` : "";
}
function react(id, emoji) {
  const c = g(cur),
    m = c.m.find((x) => x.id === id);
  if (!m) return;
  const next = (m.rx || {})[me.uid] === emoji ? null : emoji; // same emoji again removes it
  m.rx = { ...(m.rx || {}) };
  if (next) m.rx[me.uid] = next;
  else delete m.rx[me.uid];
  all();
  if (c.id !== "bot")
    fb.D.set(R(msgPath(c) + "/" + id + "/reactions/" + me.uid), next).catch(
      (x) => toast(errMsg(x)),
    );
}
$("msgs").addEventListener("click", (e) => {
  const pill = e.target.closest("[data-e]"),
    btn = e.target.closest("[data-x]");
  if (pill) return react(pill.dataset.m, pill.dataset.e);
  if (!btn) return;
  pickId = btn.dataset.x;
  const r = btn.getBoundingClientRect();
  rxPick.hidden = false;
  rxPick.style.top = Math.max(8, r.top - 54) + "px";
  rxPick.style.left =
    Math.min(Math.max(8, r.left - 100), window.innerWidth - 260) + "px";
});
rxPick.onclick = (e) => {
  const b = e.target.closest("[data-pe]");
  if (b) react(pickId, b.dataset.pe);
  rxPick.hidden = true;
};
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-x], #rxpick")) rxPick.hidden = true;
});
$("rx").onclick = () => {
  reply = null;
  $("rb").hidden = true;
};
$("emo").innerHTML = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "😢",
  "😡",
  "👍",
  "👏",
  "🙏",
  "💪",
  "🔥",
  "❤️",
  "💯",
  "🎉",
  "✨",
  "🌸",
  "🍕",
  "☕",
  "🎶",
  "👋",
  "🤝",
  "😴",
]
  .map((x) => `<button type="button">${x}</button>`)
  .join("");
$("eb").onclick = () => ($("emo").hidden = !$("emo").hidden);
$("emo").onclick = (e) => {
  if (e.target.tagName === "BUTTON") {
    $("tx").value += e.target.textContent;
    $("tx").focus();
  }
};

/* theme (remembered between pages) */
const root = document.documentElement;
root.dataset.th = localStorage.getItem("hoories-th") || "light";
const paintTh = () => {
  $("thb").textContent = root.dataset.th === "dark" ? "☀" : "☾";
};
$("thb").onclick = () => {
  root.dataset.th = root.dataset.th === "dark" ? "light" : "dark";
  localStorage.setItem("hoories-th", root.dataset.th);
  paintTh();
};
paintTh();
/* profile */
function prof() {
  $("profv").innerHTML =
    `<div class="cover"></div><div class="ph">${av(me, "lg")}<div><h1>${esc(me.name)}</h1><small>@${esc(me.username)} · ${esc(me.email)}</small></div><div class="acts"><button class="p" id="chp">Change photo</button><button id="lop">Log out</button></div></div>
 <p style="margin:0 22px;max-width:60ch;line-height:1.5">${esc(me.bio || "Hey there! I'm on Hoories.")}</p>
 <div class="pstats"><div><b>${Math.max(C.length - 1, 0)}</b><small>Chats</small></div></div>
 <div class="pf"><input id="pnm" value="${esc(me.name)}" aria-label="Name"><input id="pbi" value="${esc(me.bio || "")}" placeholder="Write a short bio" aria-label="Bio"><button class="plus" id="psv">Save</button></div>`;
}
$("profv").onclick = (e) => {
  const i = e.target.id;
  if (i === "chp") $("af2").click();
  if (i === "lop") $("lo").click();
  if (i === "psv") {
    me.name = $("pnm").value.trim() || me.name;
    me.bio = $("pbi").value.trim();
    fb.D.update(R("users/" + me.uid), { name: me.name, bio: me.bio })
      .then(() => toast("Profile saved"))
      .catch((x) => toast(errMsg(x)));
    all();
  }
};
/* ---------- Hoories AI (Groq) ---------- */
const GROQ_KEY = ENV.GROQ_API_KEY || ""; // <- apni Groq API key yahan lagayein
const GROQ_MODEL = "llama-3.3-70b-versatile";
const aiTools = [
  {
    type: "function",
    function: {
      name: "get_chat_stats",
      description: "Get the user's messaging stats for today",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_time",
      description: "Get the current local time",
      parameters: { type: "object", properties: {} },
    },
  },
];
function aiStats() {
  const sent = C.reduce(
      (a, c) => a + c.m.filter((m) => m.from === "me").length,
      0,
    ),
    all = C.reduce((a, c) => a + c.m.length, 0);
  return {
    sent,
    received: all - sent,
    chats: C.filter((c) => c.m.length).length,
  };
}
const aiRun = (n) =>
  n === "get_time"
    ? new Date().toLocaleTimeString()
    : JSON.stringify(aiStats());
async function aiGroq(msgs) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + GROQ_KEY,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: msgs,
      tools: aiTools,
      tool_choice: "auto",
    }),
  });
  if (!r.ok) throw new Error("groq");
  return (await r.json()).choices[0].message;
}
function aiBasicReply(t) {
  const s = t.toLowerCase(),
    k = aiStats();
  if (/stat|message|kitne|count/.test(s))
    return `Today you've sent ${k.sent} messages and received ${k.received}, across ${k.chats} chats.`;
  if (/time|waqt|baje/.test(s))
    return (
      "It's " +
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }) +
      " right now."
    );
  if (/^(hi|hello|hey|salam|assalam)/.test(s))
    return `Hi ${me.name.split(" ")[0]}! What can I help you with?`;
  if (/weather|mausam/.test(s))
    return "I can check live weather once the Groq key and a weather tool are connected.";
  return [
    "This is the preview mode. Connect the Groq key and I'll answer for real.",
    "Good question. In the final version I'll think it through with Groq.",
    "I can read your chat stats and the time right now. Try “my stats”.",
  ][(Math.random() * 3) | 0];
}
async function aiText(t) {
  if (GROQ_KEY) {
    try {
      const hist = g("bot")
        .m.slice(-8)
        .map((x) => ({
          role: x.from === "me" ? "user" : "assistant",
          content: x.text,
        }));
      const msgs = [
        {
          role: "system",
          content: `You are Hoories AI, a friendly assistant inside a chat app. The user is ${me.name}. Reply briefly in the user's language (English, Urdu or Roman Urdu). Use tools when they help.`,
        },
        ...hist,
      ];
      let r = await aiGroq(msgs);
      if (r.tool_calls) {
        msgs.push(r);
        for (const c of r.tool_calls)
          msgs.push({
            role: "tool",
            tool_call_id: c.id,
            content: aiRun(c.function.name),
          });
        r = await aiGroq(msgs);
      }
      return r.content;
    } catch {}
  }
  return aiLocal(t);
}
async function askAI(t, m) {
  const c = g("bot");
  setTimeout(() => {
    c.typing = 1;
    if (cur === "bot") room();
  }, 400);
  const [a] = await Promise.all([
    aiText(t),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  c.typing = 0;
  m.rd = true;
  const mm = add("bot", "bot", "", 0, {
    id: m.id,
    name: me.name,
    text: t.slice(0, 80),
  });
  for (let i = 0; i < a.length; i += 3) {
    mm.text = a.slice(0, i + 3);
    if (cur === "bot") room();
    await new Promise((r) => setTimeout(r, 16));
  }
  if (cur !== "bot") c.u++;
  all();
}
/* ---------- AI floating button ---------- */
$("aifab").onclick = () => {
  cur = "bot";
  g("bot").u = 0;
  reply = null;
  $("rb").hidden = true;
  $("chatv").classList.add("open");
  if (view !== "chat") setView("chat");
  else all();
  setTimeout(() => $("tx").focus(), 60);
};
function all() {
  renderApp();
  const u = g("bot").u;
  $("aib").textContent = u || "";
  $("aib").hidden = !u;
}
/* ---------- modal helpers, rename ---------- */
function openMd(html) {
  $("mc").innerHTML =
    html + '<button class="xx2" data-x aria-label="Close">✕</button>';
  $("md").hidden = false;
}
const closeMd = () => {
  $("md").hidden = true;
};
$("hed").onclick = () => {
  const c = g(cur);
  openMd(
    `<h3>Rename</h3><p>Only you can see this name.</p><input id="rni" value="${esc(c.name)}" maxlength="24" aria-label="Name"><div class="mb2"><button data-x>Cancel</button><button class="go" id="rnok">Save</button></div>`,
  );
  setTimeout(() => {
    const r = $("rni");
    if (r) {
      r.focus();
      r.select();
    }
  }, 50);
};
$("md").onclick = (e) => {
  const t = e.target;
  if (t.id === "md" || t.closest("[data-x]")) return closeMd();
  if (t.id === "rnok") return saveRn();
  if (t.id === "fnd") return findU();
  const u = t.closest("[data-u]");
  if (u) {
    $("fui").value = u.dataset.u;
    return findU();
  }
  const a = t.closest("[data-add]");
  if (a) addP(a.dataset.add);
};
$("md").onkeydown = (e) => {
  if (e.key === "Escape") closeMd();
  if (e.key === "Enter") {
    e.preventDefault();
    $("rni") ? saveRn() : $("fui") && findU();
  }
};
function room() {
  renderRoom();
  $("chips").hidden = cur !== "bot";
}
/* AI chat extras */
const md2 = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
$("msgs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cp]");
  if (!b) return;
  const m = g("bot").m.find((x) => x.id === b.dataset.cp);
  if (m && navigator.clipboard)
    navigator.clipboard.writeText(m.text).then(
      () => toast("Copied"),
      () => toast("Couldn't copy"),
    );
});
$("chips").innerHTML = [
  "My stats",
  "What time is it?",
  "Tell me a joke",
  "Write a friendly message",
  "Who are you?",
]
  .map((t) => `<button type="button">${t}</button>`)
  .join("");
$("chips").onclick = (e) => {
  if (e.target.tagName === "BUTTON") {
    $("tx").value = e.target.textContent;
    $("cf").dispatchEvent(new Event("submit", { cancelable: true }));
  }
};
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$("mic").onclick = () => {
  if (!SR) {
    toast("Voice typing isn't supported in this browser");
    return;
  }
  const r = new SR();
  r.lang = "en-US";
  r.onresult = (e) => {
    $("tx").value = e.results[0][0].transcript;
    $("tx").focus();
  };
  try {
    r.start();
    toast("Listening…");
  } catch {}
};
function aiLocal(t) {
  const s = t.toLowerCase();
  if (/joke|mazak/.test(s))
    return [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "I told my laptop I needed a break. Now it won't stop sending me Kit Kat ads.",
    ][(Math.random() * 2) | 0];
  if (/who are you|kaun ho|tum kon/.test(s))
    return "I'm **Hoories AI**, the assistant inside your chat app. I can check your chat stats, tell the time, and help you write messages.";
  if (/write|draft|likh/.test(s))
    return "Here's a friendly one:\n**“Hey! Just checking in. Are you free for a quick chat later?”**\nWant it shorter or more formal?";
  return aiBasicReply(t);
}
/* ---------- Firebase: session, chats, people ---------- */
const R = (p) => fb.D.ref(fb.db, p);
let unsubs = [];
const FOUND = {};

/* path of the messages of a chat: a person chat or the group */
const msgPath = (c) =>
  (c.group ? "groups/" + c.id : "chats/" + c.chatId) + "/messages";

/* listen (in real time) to the messages and reactions of one chat */
function listen(c) {
  const t0 = Date.now(),
    q = fb.D.query(R(msgPath(c)), fb.D.limitToLast(300));
  unsubs.push(
    fb.D.onChildAdded(q, (s) => {
      const d = s.val();
      if (!d || c.m.some((x) => x.id === s.key)) return;
      const mine = d.from === me.uid;
      if (c.group && !mine)
        MEMBERS[d.from] = {
          name: d.name || "Someone",
          h: d.h || 40,
          photo: d.photo || "",
        };
      c.m.push({
        id: s.key,
        from: mine ? "me" : d.from,
        text: d.text,
        at: new Date(d.at),
        rp: d.rp || null,
        rx: d.reactions || {},
        rd: true,
      });
      if (!mine && d.at > t0 && !(cur === c.id && view === "chat")) c.u++;
      all();
    }),
  );
  unsubs.push(
    fb.D.onChildChanged(q, (s) => {
      const m = c.m.find((x) => x.id === s.key);
      if (m) {
        m.rx = (s.val() || {}).reactions || {};
        all();
      }
    }),
  );
}

function mk(pid, chatId, u) {
  const c = {
    id: pid,
    name: u.name,
    real: u.name,
    role: "@" + (u.username || ""),
    h: u.h || 40,
    photo: u.photo || "",
    on: 0,
    un: u.username || "",
    m: [],
    u: 0,
    chatId,
    ts: Date.now(),
  };
  C.push(c);
  listen(c);
  return c;
}

/* the default chat: a group that every user joins automatically */
function mkGroup() {
  const c = {
    id: "community",
    name: "Blooming Bonds 🌸",
    role: "Group · everyone",
    h: 330,
    ic: "👥",
    group: true,
    m: [],
    u: 0,
    ts: Date.now(),
  };
  C.push(c);
  listen(c);
}

function start(user, p) {
  me = {
    email: user.email || "",
    bio: p.bio || "",
    uid: user.uid,
    name: p.name,
    photo: p.photo || "",
    h: p.h || 40,
    username: p.username,
  };
  mkGroup();
  cur = "community"; // open the group first, so the app never looks empty
  unsubs.push(
    fb.D.onValue(R("userChats/" + me.uid), (s) => {
      const v = s.val() || {};
      for (const pid of Object.keys(v)) {
        let c = g(pid);
        if (!c) {
          c = mk(pid, v[pid].chatId, { name: "...", username: "" });
          fb.D.get(R("users/" + pid)).then((x) => {
            const u = x.val();
            if (u) {
              c.real = u.name;
              c.role = "@" + u.username;
              c.un = u.username;
              c.h = u.h || 40;
              c.photo = u.photo || "";
              c.name = v[pid].alias || u.name;
              all();
            }
          });
        } else if (c.real) c.name = v[pid].alias || c.real;
      }
      all();
    }),
  );
  $("app").hidden = false;
  setView("chat");
}

(async () => {
  try {
    await initFB();
  } catch {
    toast("Could not load Firebase. Check your internet.");
    return;
  }
  fb.Au.onAuthStateChanged(fb.auth, async (u) => {
    if (!u) {
      location.replace("login.html");
      return;
    }
    const s = await fb.D.get(R("users/" + u.uid));
    if (!s.exists()) {
      await fb.Au.signOut(fb.auth);
      location.replace("login.html");
      return;
    }
    if (!me) start(u, s.val());
  });
})();

$("lo").onclick = async () => {
  unsubs.forEach((f) => f());
  unsubs = [];
  try {
    await fb.Au.signOut(fb.auth);
  } catch {}
  location.replace("login.html");
};

$("cf").onsubmit = (e) => {
  e.preventDefault();
  const t = $("tx").value.trim();
  if (!t) return;
  $("tx").value = "";
  $("emo").hidden = true;
  const id = cur,
    rp = reply;
  reply = null;
  $("rb").hidden = true;
  if (id === "bot") {
    const m = add(id, "me", t, 0, rp);
    all();
    askAI(t, m);
    return;
  }
  fb.D.push(R(msgPath(g(id))), {
    from: me.uid,
    name: me.name,
    h: me.h,
    photo: me.photo.startsWith("blob:") ? "" : me.photo,
    text: t.slice(0, 1000),
    at: Date.now(),
    rp: rp || null,
  }).catch((x) => toast(errMsg(x)));
};

$("addp").onclick = () => {
  openMd(
    '<h3>Add a person</h3><p>Find someone by their username.</p><div class="w2"><span>@</span><input id="fui" placeholder="username" maxlength="20" autocomplete="off" aria-label="Username"></div><p id="fr" class="fr" role="status"></p><div class="mb2"><button class="go" id="fnd">Find</button></div>',
  );
  setTimeout(() => {
    const i = $("fui");
    if (i) i.focus();
  }, 50);
};
async function findU() {
  const v = $("fui").value.trim().replace(/^@/, "").toLowerCase(),
    r = $("fr");
  if (!/^[a-z0-9]{3,20}$/.test(v)) {
    r.textContent = "Usernames have 3 to 20 letters or numbers.";
    return;
  }
  if (v === me.username) {
    r.textContent = "That's your own username.";
    return;
  }
  const ex = C.find((c) => c.un === v);
  if (ex) {
    r.textContent = ex.name + " is already in your chats.";
    return;
  }
  r.textContent = "Searching...";
  try {
    const s = await fb.D.get(R("usernames/" + v));
    if (!s.exists()) {
      r.textContent =
        "No one found with @" + v + ". Check the spelling and try again.";
      return;
    }
    const uid = s.val(),
      u = (await fb.D.get(R("users/" + uid))).val();
    FOUND[v] = { uid, ...u };
    r.innerHTML = `<span class="res">${av(u, "sm")}<span><b>${esc(u.name)}</b><small>@${v}</small></span><button class="go" data-add="${v}">Add</button></span>`;
  } catch (x) {
    r.textContent = errMsg(x);
  }
}
async function addP(v) {
  const p = FOUND[v];
  if (!p) return;
  const chatId = [me.uid, p.uid].sort().join("_"),
    d = { chatId, ts: Date.now() };
  try {
    await fb.D.update(R("userChats/" + me.uid + "/" + p.uid), d);
    await fb.D.update(R("userChats/" + p.uid + "/" + me.uid), d);
  } catch (x) {
    toast(errMsg(x));
    return;
  }
  if (!g(p.uid)) mk(p.uid, chatId, p);
  cur = p.uid;
  closeMd();
  $("chatv").classList.add("open");
  if (view !== "chat") setView("chat");
  else all();
  toast("Added " + p.name);
}
function saveRn() {
  const v = $("rni").value.trim();
  if (!v) {
    toast("Enter a name first");
    return;
  }
  const id = cur;
  g(id).name = v;
  closeMd();
  all();
  toast("Renamed to " + v);
  if (id !== "bot")
    fb.D.update(R("userChats/" + me.uid + "/" + id), { alias: v }).catch(
      () => {},
    );
}

$("af2").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  toast("Uploading photo...");
  try {
    const u = await uploadToCloudinary(f);
    if (u.startsWith("blob:")) {
      me.photo = u;
      all();
      toast(
        "Cloudinary isn't set up yet, so this photo stays on this device only",
      );
      return;
    }
    await fb.D.update(R("users/" + me.uid), { photo: u });
    me.photo = u;
    all();
    toast("Profile photo updated");
  } catch {
    toast("Upload failed, try again");
  }
};