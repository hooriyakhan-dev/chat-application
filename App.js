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
  const person = p || {};
  const letter = esc((person.ic || person.name || "?").toString().trim().slice(0, 1) || "?");
  const bg = `background:${grad(person.h || 40)}`;
  const photo = person.photo
    ? `<img class="av-photo" src="${esc(person.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : "";
  return `<span class="av ${c}" style="${bg}"><span class="av-fallback">${letter}</span>${photo}${person.on && c !== "lg" && !person.group ? "<i></i>" : ""}</span>`;
}
let me,
  cur = "bot",
  reply = null,
  nid = 0,
  view = "chat",
  listMode = "all";
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
  const M = { dash: "dashv", chat: "chatv", stat: "statv", prof: "profv" };
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
  if (view === "dash") dashboard();
  if (view === "prof") prof();
  if (view === "stat") stv();
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
const FAVS = {}; // chats marked with a star: { chatId: true }
const ARCH = {}; // archived chats persist per account
const REMOVED = {}; // contacts removed from this account only
function chatRow(c) {
  const l = last(c);
  return `<button class="it ${c.id === cur ? "on" : ""}" data-id="${esc(c.id)}" aria-label="Open chat with ${esc(c.name)}">${av(c)}<span class="mid"><b>${esc(c.name)}</b><small>${l.from === "me" ? "You: " : c.group && who(l.from) ? esc(who(l.from).name) + ": " : ""}${esc(prevTxt(l))}</small></span><span class="rt">${tf(l.at)}${c.u ? `<span class="badge">${c.u}</span>` : ""}<span class="chat-more" data-chat-menu="${esc(c.id)}" role="button" tabindex="0" title="Chat options" aria-label="Options for ${esc(c.name)}">⋯</span></span></button>`;
}
function renderList() {
  const q = $("q").value.toLowerCase(),
    shown = [...C]
      .filter((c) => c.id !== "bot" && !HID[c.id] && !REMOVED[c.id] && !!ARCH[c.id] === (listMode === "archived") && c.name.toLowerCase().includes(q))
      .sort((a, b) => last(b).at - last(a).at),
    favs = shown.filter((c) => FAVS[c.id]),
    rest = shown.filter((c) => !FAVS[c.id]);
  $("arcCount").textContent = Object.keys(ARCH).filter((id) => ARCH[id] && !REMOVED[id]).length;
  document.querySelectorAll(".folder-tab").forEach((b) => b.classList.toggle("on", b.dataset.folder === listMode));
  $("list").innerHTML = (favs.length
      ? '<div class="sec">★ Favorites</div>' + favs.map(chatRow).join("") + (rest.length ? '<div class="sec">All chats</div>' : "")
      : "") + rest.map(chatRow).join("");
  if (!shown.length) $("list").innerHTML = `<div class="folder-empty"><span>${listMode === "archived" ? "▣" : "♡"}</span><b>${listMode === "archived" ? "Nothing archived yet" : "Your chats live here"}</b><small>${listMode === "archived" ? "Archive a chat from its ⋯ menu to keep it out of your main inbox." : "Add a person or start a group to begin chatting."}</small></div>`;
}
document.querySelectorAll(".folder-tab").forEach((b) => b.addEventListener("click", () => { listMode = b.dataset.folder; renderList(); }));
function chatOptions(id) {
  const c = g(id); if (!c || c.id === "bot") return;
  const archived = !!ARCH[id];
  openMd(`<div class="chat-options-head">${av(c, "lg")}<div><h3>${esc(c.name)}</h3><small>${c.group ? "Group chat" : "Personal chat"}</small></div></div><div class="chat-option-list"><button data-do="toggle-archive" data-val="${esc(id)}"><span>▣</span><span><b>${archived ? "Move to All chats" : "Archive chat"}</b><small>${archived ? "Return it to your inbox" : "Keep it without deleting messages"}</small></span></button><button data-do="toggle-fav" data-val="${esc(id)}"><span>☆</span><span><b>${FAVS[id] ? "Remove favorite" : "Add to favorites"}</b><small>Keep important chats easy to find</small></span></button><button class="danger" data-do="remove-contact" data-val="${esc(id)}"><span>⌫</span><span><b>Delete from my chats</b><small>Only removes it from your chat list</small></span></button></div><div class="mb2"><button data-x>Done</button></div>`);
}
$("fav").onclick = () => {
  const on = !FAVS[cur];
  if (on) FAVS[cur] = true;
  else delete FAVS[cur];
  all();
  toast(on ? "Added to favorites" : "Removed from favorites");
  fb.D.set(R("users/" + me.uid + "/favs/" + cur), on ? true : null).catch((x) =>
    toast(errMsg(x)),
  );
};
$("q").oninput = list;
$("list").onclick = (e) => {
  const menu = e.target.closest("[data-chat-menu]");
  if (menu) { e.preventDefault(); e.stopPropagation(); chatOptions(menu.dataset.chatMenu); return; }
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
/* ---------- v2 helpers: ticks, delete, pin, polls ---------- */
let lastRoom = "";
const DEL = {}; // messages deleted "for me": { msgId: 1 }
const base = (c) => (c.group ? "groups/" + c.id : "chats/" + c.chatId);
const fx = (d) => ({
  text: d.text || "",
  img: d.img || "",
  rx: d.reactions || {},
  ed: !!d.edited,
  del: !!d.deleted,
  pin: d.pinned || 0,
  poll: d.poll || null,
  vt: d.votes || {},
  call: d.call || null,
});
const lsf = (t) => {
  const d = new Date(t);
  return (
    (d.toDateString() === new Date().toDateString()
      ? "today"
      : d.toLocaleDateString([], { day: "numeric", month: "short" })) +
    " at " +
    tf(d)
  );
};
const prevTxt = (l) =>
  l.del
    ? "🚫 Message deleted"
    : l.call
      ? "📞 Call"
    : l.poll
      ? "📊 " + l.poll.q
      : (isPic(l.img) ? "📷 " : "") + (l.text || (isPic(l.img) ? "Photo" : ""));
/* who has seen my message m (DM: the other person, group: anyone) */
const seenBy = (c, m) =>
  c.id === "bot"
    ? m.rd
      ? [{}]
      : []
    : Object.entries(c.sn || {})
        .filter(
          ([k, v]) =>
            k !== me.uid && v && v.t >= +m.at && (c.group || k === c.id),
        )
        .map(([k, v]) => ({ k, n: v.n, t: v.t }));
const tick = (c, m) => {
  const s = seenBy(c, m).length > 0;
  return `<span class="tk${s ? " sn" : ""}" data-i="${m.id}" title="${s ? "Seen" : "Sent"}">${s ? "✓✓" : "✓"}</span>`;
};
const pollHtml = (m) => {
  const v = Object.values(m.vt || {}),
    n = v.length,
    mine = (m.vt || {})[me.uid];
  return `<div class="poll"><b>📊 ${esc(m.poll.q)}</b><small>${n ? n + " vote" + (n > 1 ? "s" : "") : "Tap an option to vote"}</small>${(m.poll.o || [])
    .map((o, i) => {
      const k = v.filter((x) => x === i).length,
        p = n ? Math.round((k * 100) / n) : 0;
      return `<button type="button" class="popt${mine === i ? " on" : ""}" data-v="${m.id}|${i}"><i style="width:${p}%"></i><span>${esc(o)}</span><em>${k}</em></button>`;
    })
    .join("")}</div>`;
};
function paintPin(c) {
  const pins = c.m.filter((m) => m.pin && !m.del).sort((a, b) => b.pin - a.pin),
    pb = $("pinb");
  if (!pins.length) return (pb.hidden = true);
  const i = (c.pi || 0) % pins.length,
    p = pins[i];
  pb.hidden = false;
  pb.innerHTML = `<span>📌</span><button type="button" class="pj" data-pj="${p.id}"><b>Pinned${pins.length > 1 ? " · " + (i + 1) + "/" + pins.length : ""}</b><span>${esc(prevTxt(p))}</span></button><button type="button" class="pu" data-pu="${p.id}" aria-label="Unpin">✕</button>`;
}
/* tell the other side I have read the chat (blue ticks) */
function markSeen() {
  const c = g(cur);
  if (!c || c.id === "bot" || view !== "chat" || document.hidden) return;
  if (me.priv && me.priv.noRR) return;
  const l = c.m[c.m.length - 1];
  if (!l || l.from === "me" || (c._ms || 0) >= +l.at) return;
  c._ms = +l.at;
  fb.D.set(R(base(c) + "/seen/" + me.uid), {
    t: Date.now(),
    n: me.name,
  }).catch(() => {});
}
function renderRoom() {
  const c = g(cur);
  $("hav").innerHTML = av(c);
  $("hn").textContent = c.name;
  $("hr").textContent = c.role;
  $("hed").hidden = !!c.group; // only people can be renamed
  $("fav").hidden = c.id === "bot";
  $("att").hidden = c.id === "bot";
  $("pollb").hidden = c.id === "bot";
  hdrBtns(c);
  $("fav").classList.toggle("on", !!FAVS[c.id]);
  $("hs").className = c.typing ? "t" : "";
  $("hs").textContent = c.typing
    ? c.group
      ? (c.tpn || "Someone") + " is typing…"
      : "typing…"
    : c.group
      ? c.sub || "Open to everyone on Hoories"
      : c.on
        ? "online"
        : c.ls
          ? "last seen " + lsf(c.ls)
          : c.seen || "";
  paintPin(c);
  const el = $("msgs"),
    stick =
      c.id !== lastRoom || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  lastRoom = c.id;
  let prev = null;
  el.innerHTML =
    '<span class="day">Today</span>' +
    c.m
      .filter((m) => !DEL[m.id])
      .map((m) => {
        const mine = m.from === "me",
          u = who(m.from),
          f = prev !== m.from;
        prev = m.from;
        const q =
          m.rp && !m.del
            ? `<button type="button" class="qt" data-j="${m.rp.id}"><b>${esc(m.rp.name)}</b><span>${esc(m.rp.text)}</span></button>`
            : "";
        const body = m.del
          ? '<i class="gone">🚫 This message was deleted</i>'
          : m.poll
            ? pollHtml(m)
            : m.call
              ? callHtml(m.call)
              : m.from === "bot"
              ? md2(m.text) + `<button class="cp" data-cp="${m.id}">Copy</button>`
              : picHtml(m) + linkify(m.text);
        return `<div class="row ${mine ? "me" : ""} ${f ? "f" : ""}" id="m-${m.id}">${f ? av(u, "sm").replace("<i></i>", "") : '<span style="width:32px;flex:none"></span>'}<div class="bub${m.del ? " gone" : ""}">${f && !mine && c.group ? `<div class="nm">${esc(u.name)}</div>` : ""}${q}${body}${m.del ? "" : rxHtml(m)}<span class="tm">${m.pin && !m.del ? "📌 " : ""}${m.ed && !m.del ? "edited " : ""}${tf(m.at)}${mine && !m.del ? " " + tick(c, m) : ""}</span></div>${m.del ? "" : `<button class="rp" data-x="${m.id}" aria-label="React" title="React">☺</button><button class="rp" data-r="${m.id}" aria-label="Reply" title="Reply">↩</button>`}<button class="rp" data-a="${m.id}" aria-label="Message actions" title="Copy, translate, pin or delete">⋯</button></div>`;
      })
      .join("") +
    (c.typing
      ? '<div class="row f"><span style="width:32px;flex:none"></span><div class="bub tpd"><u></u><u></u><u></u></div></div>'
      : "");
  if (stick) el.scrollTop = 1e9;
  markSeen();
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
/* ---------- sending messages, photos (Cloudinary) and links ---------- */
function sendMsg(c, extra, rp) {
  return fb.D.push(R(msgPath(c)), {
    from: me.uid,
    name: me.name,
    h: me.h,
    photo:
      me.photo.startsWith("blob:") || (me.priv && me.priv.dp && me.priv.dp !== "all")
        ? ""
        : me.photo,
    at: Date.now(),
    rp: rp || null,
    ...extra,
  });
}
const isPic = (u) =>
  typeof u === "string" && u.startsWith("https://res.cloudinary.com/"); // only our own Cloudinary photos are shown
const picHtml = (m) =>
  isPic(m.img)
    ? `<img class="pic" src="${m.img}" alt="Photo" loading="lazy" data-pic="${m.img}">`
    : "";
const linkify = (t) =>
  esc(t).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
$("att").onclick = () => $("pic").click();
$("pic").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f || cur === "bot") return;
  const c = g(cur),
    rp = reply;
  toast("Uploading photo...");
  try {
    const url = await uploadToCloudinary(f);
    if (!isPic(url))
      return toast("Cloudinary isn't set up, so photos can't be shared");
    reply = null;
    $("rb").hidden = true;
    const caption = $("tx").value.trim().slice(0, 1000);
    $("tx").value = "";
    await sendMsg(c, { text: caption, img: url }, rp);
  } catch {
    toast("Photo upload failed, try again");
  }
};
/* tap a photo to see it big */
$("msgs").addEventListener("click", (e) => {
  const p = e.target.closest("[data-pic]");
  if (!p) return;
  $("lbi").src = p.dataset.pic;
  $("lb").hidden = false;
});
$("lb").onclick = () => ($("lb").hidden = true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("lb").hidden = true;
});

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
  $("thb").innerHTML = root.dataset.th === "dark"
    ? '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>';
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
/* ---------- Hoories AI (offline FAQ; no API key required) ---------- */
function aiStats() {
  const sent = C.reduce((a, c) => a + c.m.filter((m) => m.from === "me").length, 0);
  const all = C.reduce((a, c) => a + c.m.length, 0);
  return { sent, received: all - sent, chats: C.filter((c) => c.m.length).length };
}
function aiText(t) {
  // Curated local answers: no API key, server function, or online AI service.
  return Promise.resolve(aiLocal(t));
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
const BASE_TITLE = document.title;
function all() {
  renderApp();
  const unread = C.reduce((n, c) => n + (c.u || 0), 0);
  document.title = (unread ? "(" + unread + ") " : "") + BASE_TITLE;
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
  if (/full.?stack|career|scope|future|job|salary|developer|web development|roadmap/.test(s))
    return "A Full-Stack Developer builds both sides of a website/app:\n• Frontend: HTML, CSS, JavaScript, responsive UI and often a framework such as React.\n• Backend: server-side logic, APIs, authentication, validation and security.\n• Database: storing and retrieving data (for example, SQL or Firebase).\n• Deployment: Git/GitHub, hosting, debugging and maintenance.\nLearning path: HTML/CSS → JavaScript → Git/GitHub → frontend projects → backend + APIs → databases/authentication → deployment. Build projects and practise explaining your own code. Jobs and salaries depend on skills, experience, portfolio and location. 💻";
  if (/what is hoories|about hoories|hoories app|app features|features of|feature list|kya kya|kiya kiya|what can.*app|what can you do|what features/.test(s))
    return "Welcome to Hoories 💗 Here’s what this app includes:\n• Chats: personal and group chat, emoji picker, message reactions, reply, edit, copy, pin and delete options.\n• Organisation: favorites, chat search, archive/restore and hidden chats.\n• Groups: Blooming Bonds 🌸 demo group, member info, invite links/QR and polls.\n• Sharing: profile pictures, image messages and 24-hour Status.\n• Personalisation: dashboard, chat stats, light/dark mode, colour themes, wallpaper and privacy settings.\n• Extras: voice/video call interface and this built-in Hoories AI FAQ.\nSome live features depend on Firebase rules/configuration, HTTPS, browser support and camera/microphone permissions. The AI helper uses predefined answers and does not need an API key. 💗";
  if (/what is full.?stack|difference.*frontend.*backend/.test(s))
    return "Frontend is the part users see and interact with. Backend handles server logic, APIs, authentication and data processing. A full-stack developer works across both, plus the database and deployment.";

  if (/archive|archived/.test(s) && /how|where|kaise|kese|kahan|karu|karoon|rakh|option|chat/.test(s))
    return "To archive a chat, open Chats and tap the ⋯ menu on that person's or group's row, then choose Archive chat. Open the Archived folder above the chat list to find it later; choose Move to All chats to restore it. Archiving keeps the chat and messages. 💗";
  if (/delete|remove/.test(s) && /contact|person|chat|list|kisi|banday|banda/.test(s))
    return "To remove a contact from your own list, tap the ⋯ menu on their chat and choose ‘Delete from my chats’, then confirm. This does not delete their Hoories account or erase the chat for other people. You can find them again in People and add them back. 💗";
  if (/cherry|theme|colour|color|rang/.test(s))
    return "Open the ⚙ Settings icon on the left sidebar → Colour theme → choose the Cherry Red swatch. Your theme is saved on this device. You can also switch Light/Dark mode and choose a chat wallpaper there. 🍒";
  if (/group/.test(s) && /create|make|new|ban|bana|member|invite|qr|feature|bloom/.test(s))
    return "Blooming Bonds 🌸 is the default demo group, with sample members Gufraan, Fizza, Hasan and Aizal plus your account. These sample names are for preview only, not real registered users. In any group, tap ⓘ for member info/invites; use the composer for messages, emoji, reactions and polls. Use a message’s ⋯ menu to copy, translate, pin/unpin, or delete. You can create another group using the group-plus button above the chat list. 💗";
  if (/photo|dp|profile picture|avatar/.test(s) && /change|upload|add|nahi|not|show|lag/.test(s))
    return "To add a profile photo, tap your avatar at the bottom of the sidebar or open Profile → Change photo. The image upload needs the Cloudinary cloud name and unsigned upload preset in env.js. If upload fails, check those settings and the browser console. 💗";
  if (/feature|what can you do|what does this app|what does hoories|app mein kya|is app mein|kya kya|kiya kiya|features/.test(s))
    return "Welcome to Hoories 💗 Here is your app guide:\n• Chats: real-time personal and group messages, emoji, reactions, reply, edit, copy, translate, pin and delete-for-me/delete-for-everyone (for your own messages).\n• Organise: Favorites, search, Archive/Restore and remove a contact from your own list.\n• Groups: Blooming Bonds 🌸, group info, members, invite links, QR and polls.\n• Share: profile photos, image messages and 24-hour Status.\n• Personalise: Dashboard, chat statistics, Light/Dark, Cherry Red and other colour themes, wallpaper and privacy settings.\n• Extras: voice/video calls, AI chat summary and this Hoories AI helper.\nSome live features need Firebase rules/configuration, HTTPS and permissions; the AI helper uses predefined answers and does not require an API key. I’ll explain how to use any feature step by step. 💗";
  if (/call|voice|video|camera|mic|microphone/.test(s) && /not|issue|problem|error|work|stop|end|cut|band|disconnect|nahi|nahin/.test(s))
    return "For calls, open Hoories on localhost or HTTPS and allow microphone/camera access. If the End Call button does not disconnect the other person, both accounts need Firebase Realtime Database read/write permission for the calls path. I've included call signalling and cleanup in the app, but the live connection still depends on your Firebase rules and browser permissions. 💗";
  if (/scan|qr|camera/.test(s) && /not|nahi|nahin|work|error|problem|issue/.test(s))
    return "QR scanning needs HTTPS or localhost, camera permission, and the jsQR script to load. Open the QR scanner in a supported browser, allow camera access, and check the browser console if the camera view stays blank.";
  if (/joke|mazak/.test(s))
    return [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "I told my laptop I needed a break. Now it won't stop sending me Kit Kat ads.",
    ][(Math.random() * 2) | 0];
  if (/who are you|kaun ho|tum kon|your name/.test(s))
    return "I’m Hoories AI 💗, the built-in helper for the Hoories chat app. I answer common questions about the app, web development and general learning topics using saved FAQ answers. I don’t need an API key.";
  if (/write|draft|likh/.test(s))
    return "Here's a friendly one:\n**“Hey! Just checking in. Are you free for a quick chat later?”**\nWant it shorter or more formal?";
  if (/pin|pinned/.test(s))
    return "To pin a message, open its ⋯ menu and choose 📌 Pin. It appears in the pinned-message strip at the top of that chat. Open the menu again and choose Unpin when it is no longer needed. 💗";
  if (/copy|clipboard/.test(s))
    return "Open the message’s ⋯ menu and choose Copy. You can then paste the text into another chat or app. If copying is blocked, run Hoories on localhost/HTTPS and allow clipboard access. 💗";
  if (/delete.*every|everyone|sab.*delete|delete.*me|delete message/.test(s))
    return "Open the message’s ⋯ menu → Delete. ‘Delete for me’ hides it only from your account. ‘Delete for everyone’ is available for messages you sent and marks that message as deleted for all group/chat members, provided Firebase rules allow the update. 💗";
  if (/translate|tarjuma/.test(s))
    return "Open a text message’s ⋯ menu and choose ✦ Translate. In this no-API version, automatic translation is not available without an online language service. You can copy the message and use a translator separately. 💗";
  if (/thank|shukriya/.test(s)) return "You're so welcome! 💗 I'm here whenever you need me.";
  if (/sad|upset|pareshan|udaas/.test(s)) return "I'm sorry you're feeling this way. 💗 Want to tell me what's been going on?";
  if (/help|madad/.test(s)) return "Of course! 💗 Try asking: “What features does Hoories have?”, “What is Full-Stack Development?”, “How do I archive a chat?”, “How do favorites work?”, or “Show my stats.” I work with built-in answers, without an API key.";
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
  listenMeta(c);
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
        at: new Date(d.at),
        rp: d.rp || null,
        rd: true,
        ...fx(d),
      });
      if (!mine && d.at > t0 && !(cur === c.id && view === "chat")) c.u++;
      all();
    }),
  );
  unsubs.push(
    fb.D.onChildChanged(q, (s) => {
      const m = c.m.find((x) => x.id === s.key);
      if (m) {
        Object.assign(m, fx(s.val() || {}));
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
    photo: dpOK(u) ? u.photo || "" : "",
    on: 0,
    un: u.username || "",
    m: [],
    u: 0,
    chatId,
    ts: Date.now(),
  };
  C.push(c);
  listen(c);
  watchPres(c);
  return c;
}

/* the default chat: a group that every user joins automatically */
function mkGroup() {
  const c = {
    id: "community",
    name: "Blooming Bonds 🌸",
    role: "Group · everyone",
    sub: "5-person demo community · say hello!",
    h: 330,
    ic: "🌸",
    group: true,
    demoCommunity: true,
    m: [],
    u: 0,
    ts: Date.now(),
  };
  // Friendly sample members are demo identities for the teacher preview, not registered accounts.
  const demoPeople = [
    ["demo-gufraan", "Gufraan", 24, "🌿"],
    ["demo-fizza", "Fizza", 330, "🌷"],
    ["demo-hasan", "Hasan", 205, "✨"],
    ["demo-aizal", "Aizal", 285, "🦋"],
  ];
  demoPeople.forEach(([id, name, h, ic]) => { MEMBERS[id] = { name, h, ic, demo: true }; });
  C.push(c);
  listen(c);
  if (!c.m.length) {
    const samples = [
      ["demo-gufraan", "Assalam o alaikum everyone! 🌸 Kese ho sab?"],
      ["demo-fizza", "Walaikum assalam! Alhamdulillah, tum sunao? 💗"],
      ["demo-hasan", "Group ki vibe hi alag hai 😂✨"],
      ["demo-aizal", "Aaj sab ka din kaisa guzra? 🌷"],
    ];
    samples.forEach(([from, text], i) => c.m.push({ id: "demo-community-" + i, from, text, at: new Date(Date.now() - (4-i) * 60000), demo: true, rd: true, rx: {}, pin: 0 }));
  }
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
  Object.assign(FAVS, p.favs || {});
  Object.assign(ARCH, p.archived || {});
  Object.assign(REMOVED, p.removed || {});
  Object.assign(DEL, p.del || {});
  me.priv = p.priv || {};
  Object.assign(HID, p.hid || {});
  me.vault = p.vault || "";
  fb.D.set(R("publicProfiles/" + me.uid), {
    name: me.name, username: me.username || "", photo: dpShow(p, true) ? (p.photo || "") : "", h: me.h,
  }).catch(() => {});
  setPres();
  boot2();
  mkGroup();
  cur = "community"; // open the group first, so the app never looks empty
  unsubs.push(
    fb.D.onValue(R("userChats/" + me.uid), (s) => {
      const v = s.val() || {};
      for (const pid of Object.keys(v)) {
        if (REMOVED[pid]) continue;
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
              c.photo = dpOK(u) ? u.photo || "" : "";
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
  sendMsg(g(id), { text: t.slice(0, 1000) }, rp).catch((x) => toast(errMsg(x)));
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
  const ex = C.find((c) => c.un === v && !REMOVED[c.id]);
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
    delete REMOVED[p.uid];
    delete ARCH[p.uid];
    await fb.D.set(R("users/" + me.uid + "/removed/" + p.uid), null);
    await fb.D.set(R("users/" + me.uid + "/archived/" + p.uid), null);
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
    await fb.D.update(R("publicProfiles/" + me.uid), { photo: (me.priv && me.priv.dp && me.priv.dp !== "all") ? "" : u }).catch(() => {});
    me.photo = u;
    all();
    toast("Profile photo updated");
  } catch {
    toast("Upload failed, try again");
  }
};

/* =====================================================================
   v2 features: typing dots, online status, message menu (edit, delete,
   pin, info), polls, colour themes, wallpapers, privacy toggles
   ===================================================================== */

/* ---------- seen + typing listeners for one chat ---------- */
function listenMeta(c) {
  const b = base(c);
  unsubs.push(
    fb.D.onValue(R(b + "/seen"), (s) => {
      c.sn = s.val() || {};
      all();
    }),
  );
  unsubs.push(
    fb.D.onValue(R(b + "/typing"), (s) => {
      const v = s.val() || {},
        k = Object.keys(v).filter(
          (x) => x !== me.uid && v[x] && Date.now() - v[x].t < 8000,
        );
      c.typing = k.length ? 1 : 0;
      c.tpn = k.length ? v[k[0]].n : "";
      all();
    }),
  );
}

/* ---------- online / last seen ---------- */
function setPres() {
  const pr = R("presence/" + me.uid);
  if (me.priv.hideOn) {
    fb.D.onDisconnect(pr).cancel();
    return fb.D.set(pr, { on: false, t: 0 }).catch(() => {});
  }
  fb.D.onDisconnect(pr).set({ on: false, t: fb.D.serverTimestamp() });
  fb.D.set(pr, { on: !document.hidden, t: Date.now() }).catch(() => {});
}
function watchPres(c) {
  unsubs.push(
    fb.D.onValue(R("presence/" + c.id), (s) => {
      const v = s.val() || {};
      c.on = v.on ? 1 : 0;
      c.ls = v.t || 0;
      all();
    }),
  );
}
document.addEventListener("visibilitychange", () => {
  if (!me) return;
  if (!me.priv.hideOn)
    fb.D.set(R("presence/" + me.uid), {
      on: !document.hidden,
      t: Date.now(),
    }).catch(() => {});
  markSeen();
});

/* ---------- typing (I am typing) ---------- */
let tpT = 0,
  tpOff,
  tpR = null;
function setTyping(on) {
  const c = g(cur);
  if (!me || !c || c.id === "bot") return;
  if (on) {
    const r = R(base(c) + "/typing/" + me.uid);
    if (Date.now() - tpT > 2500 || tpR !== r.toString()) {
      tpT = Date.now();
      tpR = r.toString();
      fb.D.set(r, { t: Date.now(), n: me.name.split(" ")[0] }).catch(() => {});
      fb.D.onDisconnect(r).remove();
    }
    clearTimeout(tpOff);
    tpOff = setTimeout(() => setTyping(0), 3500);
  } else {
    clearTimeout(tpOff);
    tpT = 0;
    tpR = null;
    fb.D.remove(R(base(c) + "/typing/" + me.uid)).catch(() => {});
  }
}
$("tx").addEventListener("input", () => setTyping($("tx").value.trim() ? 1 : 0));
$("cf").addEventListener("submit", () => setTyping(0));

/* ---------- message menu (copy, pin, edit, info, delete) ---------- */
const amenu = document.createElement("div");
amenu.className = "amenu";
amenu.hidden = true;
document.body.appendChild(amenu);
let amId = null;
const mref = (c, id) => R(base(c) + "/messages/" + id);
const fail = (x) => toast(errMsg(x));
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-a], .amenu")) amenu.hidden = true;
});
$("msgs").addEventListener("click", (e) => {
  const c = g(cur),
    a = e.target.closest("[data-a]"),
    t = e.target.closest("[data-i]"),
    v = e.target.closest("[data-v]");
  if (t && cur !== "bot") {
    const m = c.m.find((x) => x.id === t.dataset.i);
    if (m) msgInfo(c, m);
  }
  if (v) {
    const [id, i] = v.dataset.v.split("|"),
      m = c.m.find((x) => x.id === id);
    if (!m) return;
    const nx = (m.vt || {})[me.uid] === +i ? null : +i;
    m.vt = { ...(m.vt || {}) };
    if (nx === null) delete m.vt[me.uid];
    else m.vt[me.uid] = nx;
    all();
    fb.D.set(R(base(c) + "/messages/" + id + "/votes/" + me.uid), nx).catch(
      fail,
    );
  }
  if (!a) return;
  const m = c.m.find((x) => x.id === a.dataset.a);
  if (!m) return;
  amId = m.id;
  const mine = m.from === "me",
    real = c.id !== "bot",
    it = [];
  if (!m.del) {
    if (m.text) it.push(["copy", "⧉  Copy"], ["tr", "✦  Translate"]);
    if (real) it.push(["pin", m.pin ? "📌  Unpin" : "📌  Pin"]);
    if (mine && real && !m.poll) it.push(["edit", "✎  Edit"]);
    if (mine && real) it.push(["info", "ⓘ  Message info"]);
  }
  it.push(["del", "🗑  Delete"]);
  amenu.innerHTML = it
    .map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`)
    .join("");
  amenu.hidden = false;
  const r = a.getBoundingClientRect();
  amenu.style.left =
    Math.min(Math.max(8, r.left - 150), innerWidth - amenu.offsetWidth - 8) +
    "px";
  amenu.style.top =
    Math.min(r.bottom + 4, innerHeight - amenu.offsetHeight - 8) + "px";
});
amenu.onclick = (e) => {
  const k = e.target.closest("[data-k]");
  if (!k) return;
  amenu.hidden = true;
  const c = g(cur),
    m = c.m.find((x) => x.id === amId);
  if (!m) return;
  if (k.dataset.k === "copy" && navigator.clipboard)
    navigator.clipboard.writeText(m.text).then(() => toast("Copied"), () => toast("Copy is available on localhost/HTTPS"));
  if (k.dataset.k === "pin") {
    const v = m.pin ? null : Date.now();
    m.pin = v || 0;
    all();
    if (!m.demo) fb.D.update(mref(c, m.id), { pinned: v }).catch(fail);
    toast(v ? "Message pinned" : "Message unpinned");
  }
  if (k.dataset.k === "edit") {
    openMd(
      `<h3>Edit message</h3><p>Everyone will see it as edited.</p><input id="edt" maxlength="1000" value="${esc(m.text)}" aria-label="Message"><div class="mb2"><button data-x>Cancel</button><button class="go" data-do="edok">Save</button></div>`,
    );
    setTimeout(() => $("edt") && $("edt").focus(), 50);
  }
  if (k.dataset.k === "info") msgInfo(c, m);
  if (k.dataset.k === "tr") trans(m);
  if (k.dataset.k === "del")
    openMd(
      `<h3>Delete message?</h3><p>Choose whether to hide this message only for you or remove your sent message for everyone.</p><div class="mb2 col"><button class="go" data-do="dlme">Delete for me</button>${m.from === "me" && c.id !== "bot" && !m.del ? '<button class="go danger-action" data-do="dlall">Delete for everyone</button>' : ""}<button data-x>Cancel</button></div>`,
    );
};
function msgInfo(c, m) {
  const s = seenBy(c, m);
  openMd(
    `<h3>Message info</h3><p>Sent at ${tf(m.at)}</p>` +
      (s.length
        ? `<div class="seenl">${s.map((x) => `<div><b>${esc(x.n || "Seen")}</b><small>${tf(new Date(x.t))}</small></div>`).join("")}</div>`
        : "<p>Not seen yet.</p>") +
      '<div class="mb2"><button data-x>Close</button></div>',
  );
}
$("pinb").onclick = (e) => {
  const c = g(cur),
    j = e.target.closest("[data-pj]"),
    u = e.target.closest("[data-pu]");
  if (j) {
    const el = $("m-" + j.dataset.pj);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("fl");
      setTimeout(() => el.classList.remove("fl"), 1500);
    }
    c.pi = (c.pi || 0) + 1;
    paintPin(c);
  }
  if (u) {
    const m = c.m.find((x) => x.id === u.dataset.pu);
    if (m) {
      m.pin = 0;
      all();
      fb.D.update(mref(c, m.id), { pinned: null }).catch(fail);
    }
  }
};

/* ---------- polls ---------- */
$("pollb").onclick = () => {
  openMd(
    '<h3>Create poll</h3><p>Ask a question and let everyone vote.</p><input id="pq" maxlength="120" placeholder="Your question" aria-label="Question"><div id="po"><input class="pi" maxlength="60" placeholder="Option 1"><input class="pi" maxlength="60" placeholder="Option 2"></div><button type="button" class="lnk" data-do="pladd">+ Add option</button><div class="mb2"><button data-x>Cancel</button><button class="go" data-do="plsend">Send poll</button></div>',
  );
  setTimeout(() => $("pq") && $("pq").focus(), 50);
};

/* ---------- colours, wallpapers, privacy ---------- */
const AC = {
  rose: ["Rose", "#ff8da1", "#d94a6c"],
  cherry: ["Cherry Red", "#ff7b8b", "#d7264d", "#b91338", "#7f102b", "#fff0f2"],
  ocean: ["Ocean", "#6fd3ff", "#4a9bff", "#2f86d6", "#1f5fb0", "#eaf3fb"],
  violet: ["Violet", "#c9a6ff", "#9a6bff", "#7d4fd6", "#5b34b0", "#f1ecfb"],
  mint: ["Mint", "#7fe8c0", "#35c99a", "#1f9d78", "#137a5c", "#e9f7f1"],
  sunset: ["Sunset", "#ffb36b", "#ff7a59", "#e2641f", "#b8431a", "#fbf0e4"],
  gold: ["Gold", "#f3d58a", "#e8b84a", "#c8901a", "#946a0c", "#fbf4df"],
};
const WP = { dots: "Dots", plain: "Plain", aurora: "Aurora", grid: "Grid", hearts: "Hearts" };
(() => {
  let s = "";
  for (const [k, [, a, b, c, d, e]] of Object.entries(AC)) {
    if (k === "rose") continue;
    s += `html[data-th=dark][data-ac=${k}]{--acc:linear-gradient(120deg,${a},${b});--mine:linear-gradient(135deg,${a},${b});--acn:${a};--acx:#14101a;--mtx:#14101a;--ring:linear-gradient(135deg,${a},${b},${a});--tl:${a};--g1:${d};--g2:${b};--g3:${a}}html[data-th=light][data-ac=${k}]{--bg:${e};--acc:linear-gradient(120deg,${c},${d});--mine:linear-gradient(135deg,${c},${d});--acn:${d};--acx:#fff;--mtx:#fff;--ring:linear-gradient(135deg,${c},${d},${c});--tl:${c};--g1:${e};--g2:${a};--g3:${b}}html[data-th=light][data-ac=${k}] body{background:radial-gradient(1100px 700px at 8% -10%,${a}55,transparent 60%),radial-gradient(900px 640px at 100% 0%,${b}44,transparent 60%),var(--bg)}`;
  }
  document.head.appendChild(
    Object.assign(document.createElement("style"), { textContent: s }),
  );
})();
function applyLook() {
  const ac = localStorage.getItem("hoories-ac") || "rose";
  if (ac === "rose") delete root.dataset.ac;
  else root.dataset.ac = ac;
  $("msgs").dataset.wp = localStorage.getItem("hoories-wp") || "dots";
}
applyLook();
function openSettings() {
  const th = root.dataset.th,
    ac = localStorage.getItem("hoories-ac") || "rose",
    wp = localStorage.getItem("hoories-wp") || "dots",
    pv = me.priv || {};
  openMd(
    `<h3>Appearance & privacy</h3><p>Colours and wallpaper are saved on this device.</p>
<h4>Mode</h4><div class="sg"><button data-do="th" data-val="light" class="${th === "light" ? "on" : ""}">☀ Light</button><button data-do="th" data-val="dark" class="${th === "dark" ? "on" : ""}">☾ Dark</button></div>
<h4>Colour theme</h4><div class="sg">${Object.entries(AC)
      .map(
        ([k, v]) =>
          `<button class="sw${k === ac ? " on" : ""}" data-do="ac" data-val="${k}" title="${v[0]}" aria-label="${v[0]}" style="background:linear-gradient(135deg,${v[1]},${v[2] || v[3]})"></button>`,
      )
      .join("")}</div>
<h4>Chat wallpaper</h4><div class="sg">${Object.entries(WP)
      .map(
        ([k, l]) =>
          `<button data-do="wp" data-val="${k}" class="${k === wp ? "on" : ""}">${l}</button>`,
      )
      .join("")}</div>
<h4>Privacy</h4><label class="pv"><input type="checkbox" data-do="pv" data-val="hideOn" ${pv.hideOn ? "" : "checked"}>Show when I'm online and last seen</label><label class="pv"><input type="checkbox" data-do="pv" data-val="noRR" ${pv.noRR ? "" : "checked"}>Send read receipts (blue ticks)</label>
<h4>Who can see my profile photo</h4><div class="sg">${[["all", "Everyone"], ["contacts", "My contacts"], ["none", "Nobody"]].map(([k, l]) => `<button data-do="dp" data-val="${k}" class="${(pv.dp || "all") === k ? "on" : ""}">${l}</button>`).join("")}</div>
<div class="mb2"><button data-x>Done</button></div>`,
  );
}
$("stg").onclick = openSettings;

/* one click handler for every v2 modal button */
$("md").addEventListener("click", (e) => {
  const b = e.target.closest("[data-do]");
  if (!b) return;
  const d = b.dataset.do,
    val = b.dataset.val,
    c = g(cur);
  if (d === "th") {
    root.dataset.th = val;
    localStorage.setItem("hoories-th", val);
    paintTh();
    openSettings();
  }
  if (d === "ac") {
    localStorage.setItem("hoories-ac", val);
    applyLook();
    openSettings();
  }
  if (d === "wp") {
    localStorage.setItem("hoories-wp", val);
    applyLook();
    openSettings();
  }
  if (d === "pv") {
    me.priv = { ...(me.priv || {}), [val]: !b.checked };
    fb.D.update(R("users/" + me.uid), { priv: me.priv }).catch(fail);
    if (val === "hideOn") setPres();
  }
  const m = c && c.m.find((x) => x.id === amId);
  if (d === "edok" && m) {
    const v = $("edt").value.trim().slice(0, 1000);
    if (!v && !m.img) return toast("Message can't be empty");
    closeMd();
    if (v === m.text) return;
    m.text = v;
    m.ed = true;
    all();
    fb.D.update(mref(c, m.id), { text: v, edited: true }).catch(fail);
  }
  if (d === "dlme" && m) {
    closeMd();
    DEL[m.id] = 1;
    all();
    if (c.id !== "bot" && !m.demo)
      fb.D.set(R("users/" + me.uid + "/del/" + m.id), true).catch(() => {});
  }
  if (d === "dlall" && m) {
    closeMd();
    Object.assign(m, { del: true, text: "", img: "", poll: null, pin: 0 });
    all();
    if (!m.demo) fb.D.update(mref(c, m.id), {
      deleted: true,
      text: "",
      img: null,
      poll: null,
      pinned: null,
      reactions: null,
    }).catch(fail);
  }
  if (d === "pladd") {
    const n = document.querySelectorAll("#po .pi").length;
    if (n >= 6) return toast("Up to 6 options");
    $("po").insertAdjacentHTML(
      "beforeend",
      `<input class="pi" maxlength="60" placeholder="Option ${n + 1}">`,
    );
  }
  if (d === "plsend") {
    const q = $("pq").value.trim(),
      o = [...document.querySelectorAll("#po .pi")]
        .map((x) => x.value.trim())
        .filter(Boolean);
    if (!q || o.length < 2) return toast("Add a question and 2 options");
    closeMd();
    sendMsg(c, { text: "", poll: { q, o } }, null).catch(fail);
  }
});
$("md").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && $("edt")) {
    e.preventDefault();
    document.querySelector('[data-do="edok"]').click();
  }
});

/* =====================================================================
   v3: groups, status, QR + invite links, calls, hidden chats (PIN),
   DP privacy, people directory, AI summary + translate
   ===================================================================== */
const HID = {},
  ST = {},
  MYST = {};
const q3 = new URLSearchParams(location.search);
if (q3.get("add")) localStorage.setItem("hoories-add", q3.get("add"));
if (q3.get("join")) localStorage.setItem("hoories-join", q3.get("join"));
const siteUrl = () =>
  location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
const dpShow = (u, contact) =>
  !u.priv ||
  !u.priv.dp ||
  u.priv.dp === "all" ||
  (u.priv.dp === "contacts" && contact);
const dpOK = (u) => dpShow(u, true);
const contacts = () => C.filter((c) => c.chatId && !c.group && !REMOVED[c.id]);
const cp = (t) =>
  navigator.clipboard
    ? navigator.clipboard.writeText(t).then(() => toast("Link copied"))
    : prompt("Copy this link", t);
const fmtD = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const callHtml = (k) =>
  `<span class="cm">${k.v ? "🎥" : "📞"} ${k.s === "ok" ? (k.v ? "Video" : "Voice") + " call · " + fmtD(k.d) : k.s === "declined" ? "Call declined" : "Missed call"}</span>`;
function hdrBtns(c) {
  const dm = !!c.chatId && !c.group;
  $("cv").hidden = $("cvv").hidden = !dm;
  $("gi").hidden = !c.group;
  $("hid").hidden = !dm;
  $("hid").innerHTML = HID[c.id] ? '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0"/></svg>' : '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  $("sum").hidden = c.id === "bot";
}
$("hed").insertAdjacentHTML(
  "beforebegin",
  '<button class="ed" id="cv" title="Voice call" aria-label="Voice call"><svg class="ic" viewBox="0 0 24 24"><path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2C10 20 4 14 3 5c0-1 1-2 2-2Z"/></svg></button><button class="ed" id="cvv" title="Video call" aria-label="Video call"><svg class="ic" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg></button><button class="ed" id="gi" title="Group info" aria-label="Group info"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg></button><button class="ed" id="hid" title="Hide chat" aria-label="Hide chat"><svg class="ic" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button><button class="ed" id="sum" title="AI chat summary" aria-label="AI chat summary"><svg class="ic" viewBox="0 0 24 24"><path d="m12 2 2.1 6.1L20 10l-5.9 2.1L12 18l-2.1-5.9L4 10l5.9-1.9zM19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg></button>',
);
$("addp").insertAdjacentHTML(
  "beforebegin",
  '<button class="addp" id="newg" title="New group" aria-label="New group"><svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.8-5.5 6.5-5.5 2.1 0 3.8.6 4.9 1.7M16 8h6m-3-3v6M16 16h6v5h-6z"/></svg></button><button class="addp" id="vlt" title="Hidden chats" aria-label="Hidden chats"><svg class="ic" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg></button><button class="addp" id="qrb" title="My QR code" aria-label="My QR code"><svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2v2h-2zm4 0h2v6h-6v-2m0-2h2"/></svg></button>',
);
document.body.insertAdjacentHTML(
  "beforeend",
  '<input type="file" id="gpf" accept="image/*" hidden>',
);
// Sidebar shortcuts are wired after their controls have been inserted.
$("newg").title = "Create a group";
$("vlt").title = "Hidden chats";
$("qrb").title = "My QR code";

/* ---------- startup: groups, status feed, incoming calls, links ---------- */
function gAdd(gid, m) {
  if (g(gid)) return g(gid);
  const c = {
    id: gid,
    name: m.name,
    role: "Group",
    sub: "Group · tap ⓘ for members",
    h: m.h || 330,
    ic: m.ic || "👥",
    photo: m.photo || "",
    group: true,
    own: m.owner,
    m: [],
    u: 0,
    ts: Date.now(),
  };
  C.push(c);
  listen(c);
  return c;
}
function boot2() {
  unsubs.push(
    fb.D.onValue(R("userGroups/" + me.uid), (s) => {
      Object.keys(s.val() || {}).forEach(async (gid) => {
        if (g(gid)) return;
        const m = (await fb.D.get(R("groups/" + gid + "/meta"))).val();
        if (m) {
          gAdd(gid, m);
          all();
        }
      });
    }),
  );
  unsubs.push(
    fb.D.onValue(R("statusFeed/" + me.uid), (s) => {
      Object.keys(ST).forEach((k) => delete ST[k]);
      Object.assign(ST, s.val() || {});
      if (view === "stat") stv();
    }),
  );
  unsubs.push(
    fb.D.onValue(R("status/" + me.uid), (s) => {
      Object.keys(MYST).forEach((k) => delete MYST[k]);
      Object.assign(MYST, s.val() || {});
      if (view === "stat") stv();
    }),
  );
  unsubs.push(
    fb.D.onValue(R("incoming/" + me.uid), (s) => {
      const v = s.val();
      if (v && !CALL) ring(v);
      if (!v && CALL && CALL.ring) {
        clearTimeout(CALL.rt);
        CALL = null;
        $("cl").hidden = true;
      }
    }),
  );
  const a = localStorage.getItem("hoories-add"),
    j = localStorage.getItem("hoories-join");
  if (a) {
    localStorage.removeItem("hoories-add");
    quickAdd(a);
  }
  if (j) {
    localStorage.removeItem("hoories-join");
    joinG(j);
  }
  if (location.search) history.replaceState(null, "", location.pathname);
}

/* ---------- add people: username, directory, QR, invite ---------- */
async function quickAdd(un) {
  un = un.toLowerCase();
  if (un === me.username) return toast("That's your own code");
  const ex = C.find((c) => c.un === un);
  if (ex) {
    cur = ex.id;
    all();
    return toast(ex.name + " is already in your chats");
  }
  try {
    const s = await fb.D.get(R("usernames/" + un));
    if (!s.exists()) return toast("No one found with @" + un);
    const uid = s.val(),
      u = (await fb.D.get(R("users/" + uid))).val();
    FOUND[un] = { uid, ...u };
    await addP(un);
  } catch (x) {
    fail(x);
  }
}
$("addp").onclick = () => {
  openMd(
    '<h3>Add a person</h3><p>Find someone by username, or pick from everyone on Hoories.</p><div class="w2"><span>@</span><input id="fui" placeholder="username" maxlength="20" autocomplete="off" aria-label="Username"></div><p id="fr" class="fr" role="status"></p><div class="mb2"><button data-do="myqr">My QR</button><button data-do="invl">Invite link</button><button class="go" id="fnd">Find</button></div><h4>People on Hoories</h4><div id="pl" class="pl">Loading…</div>',
  );
  setTimeout(() => $("fui") && $("fui").focus(), 50);
  fb.D.get(R("users"))
    .then((s) => {
      const h = Object.entries(s.val() || {})
        .filter(([k, u]) => k !== me.uid && (!g(k) || REMOVED[k]) && u.username && !u.deleted)
        .map(([k, u]) => {
          FOUND[u.username] = { uid: k, ...u };
          return `<div class="res">${av(dpShow(u, false) ? u : { ...u, photo: "" }, "sm")}<span><b>${esc(u.name)}</b><small>@${esc(u.username)}</small></span><button class="go" data-add="${esc(u.username)}">Add</button></div>`;
        })
        .join("");
      if ($("pl"))
        $("pl").innerHTML = h || "<p>Everyone is already in your chats.</p>";
    })
    .catch((x) => $("pl") && ($("pl").textContent = errMsg(x)));
};
$("qrb").onclick = () => myQR();
function myQR() {
  const url = siteUrl() + "?add=" + me.username;
  openMd(
    `<h3>My QR code</h3><p>Friends scan this to add you instantly.</p><div id="qrc" class="qrc"></div><p class="mut">@${esc(me.username)}</p><div class="mb2 col"><button class="go" data-do="qcp">Copy invite link</button><button class="go" data-do="qsc">Scan a QR code</button><button data-x>Close</button></div>`,
  );
  try {
    new QRCode($("qrc"), {
      text: url,
      width: 200,
      height: 200,
      colorDark: "#2b1519",
      colorLight: "#ffffff",
    });
  } catch {
    $("qrc").textContent = url;
  }
}
let scS = null;
const scQ = () => {
  if (scS) {
    scS.getTracks().forEach((t) => t.stop());
    scS = null;
  }
};
async function qrScan() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("QR scanning needs a supported browser and HTTPS or localhost.");
    return;
  }
  if (typeof window.jsQR !== "function") {
    toast("QR scanner library did not load. Refresh the page and try again.");
    return;
  }
  openMd(
    '<h3>Scan QR</h3><p>Point the camera at a Hoories QR code.</p><div class="scv"><video id="scv" playsinline muted></video></div><div class="mb2"><button data-x>Close</button></div>',
  );
  try {
    scS = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const v = $("scv"),
      cv = document.createElement("canvas"),
      cx = cv.getContext("2d", { willReadFrequently: true });
    v.srcObject = scS;
    await v.play();
    const lp = () => {
      if (!scS || $("md").hidden) return scQ();
      if (v.videoWidth) {
        cv.width = v.videoWidth;
        cv.height = v.videoHeight;
        cx.drawImage(v, 0, 0);
        const r =
          window.jsQR &&
          jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
        const m =
          r &&
          (/[?&]add=([a-z0-9]+)/i.exec(r.data) ||
            /^@?([a-z0-9]{3,20})$/i.exec(r.data));
        if (m) {
          scQ();
          closeMd();
          return quickAdd(m[1]);
        }
      }
      requestAnimationFrame(lp);
    };
    lp();
  } catch {
    toast("Camera not available. Allow camera access (use localhost or https).");
  }
}

/* ---------- groups ---------- */
$("newg").onclick = () => {
  const cs = contacts();
  openMd(
    `<h3>New group</h3><p>Pick a name, an emoji and who to add.</p><input id="gn" maxlength="24" placeholder="Group name"><input id="gie" class="pi" maxlength="2" placeholder="Emoji, e.g. 🎉"><div class="mlist">${cs.length ? cs.map((c) => `<label class="pv"><input type="checkbox" class="gm" value="${c.id}">${esc(c.name)}</label>`).join("") : "<p>Add people first, then make a group.</p>"}</div><div class="mb2"><button data-x>Cancel</button><button class="go" data-do="gmk">Create</button></div>`,
  );
};
async function gInfo() {
  const c = g(cur),
    isC = c.id === "community";
  let mem = [];
  if (isC) {
    mem = [{ k: me.uid, name: me.name, username: me.username, current: true }, ...Object.entries(MEMBERS).filter(([k,v]) => v.demo).map(([k,v]) => ({ k, name: v.name, username: "demo member", demo: true }))];
  } else {
    const ks = Object.keys((await fb.D.get(R("groups/" + c.id + "/members"))).val() || {});
    mem = await Promise.all(ks.map(async (k) => ({ k, ...((await fb.D.get(R("users/" + k))).val() || { name: "?" }) })));
  }
  openMd(
    `<h3>${esc(c.name)}</h3><p>${mem.length} people${isC ? " · sample members for preview" : ""}</p><div class="seenl">${mem.map((u) => `<div><b>${esc(u.name)}${u.current ? " · you" : u.k === c.own ? " · admin" : ""}</b><small>${u.demo ? "Demo profile · not a registered account" : "@" + esc(u.username || "")}</small></div>`).join("")}</div>${isC ? '<p class="mut">This community is included by default for the project demo. Sample members are local preview identities.</p>' : `<div class="mb2 col"><button class="go" data-do="ginv">Copy invite link</button>${c.own === me.uid ? '<button class="go" data-do="gaddm">＋ Add members</button><button class="go" data-do="gren">Rename group</button><button class="go" data-do="gpic">Change group photo</button>' : ""}<button data-do="glv">Leave group</button></div>`}<div class="mb2"><button data-x>Close</button></div>`,
  );
}
$("gi").onclick = gInfo;
$("gpf").onchange = async (e) => {
  const f = e.target.files[0],
    c = g(cur);
  e.target.value = "";
  if (!f) return;
  toast("Uploading photo...");
  try {
    const u = await uploadToCloudinary(f);
    if (!isPic(u)) return toast("Cloudinary isn't set up");
    c.photo = u;
    await fb.D.update(R("groups/" + c.id + "/meta"), { photo: u });
    all();
    toast("Group photo updated");
  } catch (x) {
    fail(x);
  }
};
async function joinG(gid) {
  if (g(gid)) return;
  try {
    const m = (await fb.D.get(R("groups/" + gid + "/meta"))).val();
    if (!m) return toast("Group not found");
    await fb.D.set(R("groups/" + gid + "/members/" + me.uid), true);
    await fb.D.set(R("userGroups/" + me.uid + "/" + gid), true);
    gAdd(gid, m);
    all();
    toast("Joined " + m.name);
  } catch (x) {
    fail(x);
  }
}

/* ---------- hidden chats (PIN vault) ---------- */
const hash = async (s) => {
  try {
    return [
      ...new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(me.uid + s),
        ),
      ),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return btoa(me.uid + s);
  }
};
function pinAsk(then) {
  const set = !!me.vault;
  openMd(
    `<h3>${set ? "Enter your PIN" : "Create a PIN"}</h3><p>${set ? "Hidden chats stay locked behind it." : "Choose 4 digits to lock hidden chats."}</p><input id="pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"><div class="mb2"><button data-x>Cancel</button><button class="go" id="pinok">OK</button></div>`,
  );
  $("pinok").onclick = async () => {
    const p = $("pin").value;
    if (!/^\d{4}$/.test(p)) return toast("PIN must be 4 digits");
    const h = await hash(p);
    if (set && h !== me.vault) return toast("Wrong PIN");
    if (!set) {
      me.vault = h;
      fb.D.update(R("users/" + me.uid), { vault: h }).catch(fail);
    }
    closeMd();
    then();
  };
}
$("hid").onclick = () => {
  const id = cur;
  if (HID[id]) {
    delete HID[id];
    fb.D.set(R("users/" + me.uid + "/hid/" + id), null).catch(fail);
    all();
    return toast("Chat unhidden");
  }
  pinAsk(() => {
    HID[id] = 1;
    fb.D.set(R("users/" + me.uid + "/hid/" + id), true).catch(fail);
    cur = "community";
    all();
    toast("Chat hidden. Open it with the 🔒 button in the list");
  });
};
$("vlt").onclick = () =>
  pinAsk(() => {
    const hs = C.filter((c) => HID[c.id]);
    openMd(
      `<h3>Hidden chats</h3>${hs.length ? hs.map((c) => `<div class="res"><b>${esc(c.name)}</b><span><button class="go" data-do="vop" data-val="${c.id}">Open</button> <button data-do="vun" data-val="${c.id}">Unhide</button></span></div>`).join("") : "<p>Nothing hidden yet.</p>"}<div class="mb2"><button data-x>Close</button></div>`,
    );
  });

/* ---------- status (24 hours, with audience) ---------- */
const BG = [
  "linear-gradient(135deg,#ff8da1,#ff6f8f)",
  "linear-gradient(135deg,#6fd3ff,#9a6bff)",
  "linear-gradient(135deg,#7fe8c0,#2f86d6)",
  "linear-gradient(135deg,#ffb36b,#ff5f7e)",
  "linear-gradient(135deg,#c9a6ff,#5b34b0)",
  "linear-gradient(135deg,#3a2f4f,#12101a)",
];
const live = (o) =>
  Object.entries(o || {})
    .map(([id, s]) => ({ id, ...s }))
    .filter((s) => Date.now() - s.at < 864e5)
    .sort((a, b) => a.at - b.at);
const SEEN = JSON.parse(localStorage.getItem("hoories-ss") || "{}");
let stDraft = {},
  svS = null;
function dashboard() {
  const people = C.filter(c => c.id !== "bot" && !c.group && !REMOVED[c.id]);
  const groups = C.filter(c => c.group);
  const totalMessages = C.reduce((n, c) => n + c.m.filter(m => !m.demo).length, 0);
  const pinned = C.reduce((n, c) => n + c.m.filter(m => m.pin && !m.del).length, 0);
  const favCount = Object.values(FAVS).filter(Boolean).length;
  const archivedCount = Object.values(ARCH).filter(Boolean).length;
  const recent = [...C].filter(c => c.id !== "bot" && !REMOVED[c.id]).sort((a,b) => last(b).at - last(a).at).slice(0,4);
  $("dashv").innerHTML = `
    <div class="dash-shell">
      <div class="dash-top"><div><span class="eyebrow">YOUR SPACE · YOUR PEOPLE</span><h1>Good to see you, ${esc((me.name || "there").split(" ")[0])} <span>✦</span></h1><p>Your conversations, community and little moments — all in one place.</p></div><button class="dash-primary" data-dash="new-chat">＋ Start a chat</button></div>
      <div class="dash-hero"><div class="hero-copy"><span class="hero-tag">HOORIES COMMUNITY</span><h2>Small moments.<br>Closer connections.</h2><p>Pick up a conversation, share a status, or bring your group together.</p><button data-dash="community">Open Blooming Bonds <span>↗</span></button></div><div class="hero-art"><span class="orb orb-one">💬</span><span class="orb orb-two">🌸</span><span class="orb orb-three">✨</span><div class="hero-ring"></div></div></div>
      <div class="dash-metrics"><article><span class="metric-icon pink">◌</span><small>Personal chats</small><strong>${people.length}</strong><em>your conversations</em></article><article><span class="metric-icon lilac">♧</span><small>Groups</small><strong>${groups.length}</strong><em>communities you joined</em></article><article><span class="metric-icon peach">📌</span><small>Pinned messages</small><strong>${pinned}</strong><em>quickly find important notes</em></article><article><span class="metric-icon mint">☆</span><small>Favorites</small><strong>${favCount}</strong><em>people close to you</em></article></div>
      <div class="dash-grid"><section class="dash-panel"><div class="panel-heading"><div><h3>Jump back in</h3><p>Your latest conversations</p></div><button data-dash="chats">View chats ↗</button></div>${recent.length ? recent.map(c => `<button class="dash-recent" data-open-chat="${esc(c.id)}">${av(c)}<span><b>${esc(c.name)}</b><small>${esc(prevTxt(last(c)))}</small></span><i>↗</i></button>`).join("") : '<div class="dash-empty">Your conversations will appear here.</div>'}</section><section class="dash-panel"><div class="panel-heading"><div><h3>Quick actions</h3><p>Everything one click away</p></div></div><div class="quick-grid"><button data-dash="new-chat"><span>＋</span><b>New chat</b><small>Find a person</small></button><button data-dash="new-group"><span>♧</span><b>New group</b><small>Bring people together</small></button><button data-dash="status"><span>◉</span><b>Share status</b><small>A moment for 24 hours</small></button><button data-dash="ai"><span>✦</span><b>Ask Hoories AI</b><small>Tips, writing & help</small></button><button data-dash="pinned"><span>📌</span><b>Pinned messages</b><small>Important notes</small></button><button data-dash="settings"><span>⚙</span><b>Personalise</b><small>Theme & privacy</small></button></div></section></div>
      <section class="dash-panel feature-panel"><div class="panel-heading"><div><h3>Made for your everyday chats</h3><p>Helpful tools built into Hoories</p></div></div><div class="feature-chips"><span>♡ Favorites</span><span>▣ Archive & restore</span><span>☺ Emoji & reactions</span><span>↩ Reply & edit</span><span>📌 Pin messages</span><span>🌐 Translate</span><span>📊 Polls</span><span>📞 Voice & video calls</span><span>◉ 24-hour status</span><span>🍒 Cherry Red theme</span></div></section>
      <div class="dash-foot"><span>✦ Hoories · your people, always close</span><span>${archivedCount} archived chat${archivedCount === 1 ? "" : "s"} · ${totalMessages} live message${totalMessages === 1 ? "" : "s"}</span></div>
    </div>`;
}
$("dashv").addEventListener("click", e => {
  const b = e.target.closest("[data-dash], [data-open-chat]"); if (!b) return;
  if (b.dataset.openChat) { cur = b.dataset.openChat; setView("chat"); $("chatv").classList.add("open"); return; }
  const a = b.dataset.dash;
  if (a === "chats") return setView("chat");
  if (a === "new-chat") return $("addp").click();
  if (a === "new-group") return $("newg").click();
  if (a === "status") { setView("stat"); return stNew(); }
  if (a === "ai") { cur = "bot"; setView("chat"); $("chatv").classList.add("open"); return; }
  if (a === "community") { cur = "community"; setView("chat"); $("chatv").classList.add("open"); return; }
  if (a === "settings") return openSettings();
  if (a === "pinned") {
    const pins = C.flatMap(c => c.m.filter(m => m.pin && !m.del).map(m => ({c,m})));
    openMd(`<h3>📌 Pinned messages</h3><p>${pins.length ? "Select a message to open its chat." : "No pinned messages yet. Open any message’s ⋯ menu and choose Pin."}</p><div class="seenl">${pins.map(({c,m}) => `<button class="dash-recent" data-pin-open="${esc(c.id)}" data-pin-msg="${esc(m.id)}">${av(c)}<span><b>${esc(c.name)}</b><small>${esc((m.text || "Media message").slice(0,80))}</small></span></button>`).join("")}</div><div class="mb2"><button data-x>Close</button></div>`);
  }
});
$("md").addEventListener("click", e => {
  const b = e.target.closest("[data-pin-open]"); if (!b) return;
  cur = b.dataset.pinOpen; closeMd(); setView("chat"); $("chatv").classList.add("open"); setTimeout(() => { const el = $("m-" + b.dataset.pinMsg); if (el) el.scrollIntoView({block:"center"}); }, 80);
});

function stv() {
  const mine = live(MYST),
    rows = Object.keys(ST)
      .map((uid) => ({ uid, l: live(ST[uid]) }))
      .filter((x) => x.l.length && g(x.uid));
  $("statv").innerHTML =
    `<div class="cover status-cover"></div><div class="ph status-heading"><div><h1>Status</h1><small>Little moments, shared for 24 hours</small></div><div class="acts"><button class="p" data-do="stnew">＋ Add status</button></div></div><div class="stl status-list"><button class="it" data-do="stopen" data-val="me"><span class="ring ${mine.length ? "new" : ""}">${av(me)}</span><span class="mid"><b>My status</b><small>${mine.length ? mine.length + " update" + (mine.length > 1 ? "s" : "") + " · tap to view" : "Tap + to share something"}</small></span></button>` +
    (rows
      .map((r) => {
        const c = g(r.uid),
          un = r.l.some((s) => !SEEN[s.id]);
        return `<button class="it" data-do="stopen" data-val="${r.uid}"><span class="ring ${un ? "new" : ""}">${av(c)}</span><span class="mid"><b>${esc(c.name)}</b><small>${tf(new Date(r.l[r.l.length - 1].at))}</small></span></button>`;
      })
      .join("") || '<p class="mut">No updates from your contacts yet.</p>') +
    "</div>";
}
function stNew() {
  const cs = contacts(),
    pv = me.priv || {};
  stDraft = { bg: 0, img: "", aud: pv.st || "all" };
  openMd(
    `<h3>New status</h3><div id="stp" class="stp" style="background:${BG[0]}"><textarea id="stt" maxlength="200" placeholder="Type a status"></textarea></div><div class="sg">${BG.map((b, i) => `<button class="sw" data-do="stbg" data-val="${i}" style="background:${b}" aria-label="Background ${i + 1}"></button>`).join("")}<button data-do="stimg">📷 Photo</button></div><input type="file" id="stf" accept="image/*" hidden><h4>Who can see this</h4><div class="sg">${[["all", "My contacts"], ["only", "Only share with…"], ["except", "My contacts except…"]].map(([k, l]) => `<button data-do="staud" data-val="${k}" class="${stDraft.aud === k ? "on" : ""}">${l}</button>`).join("")}</div><div class="mlist" id="stc" ${stDraft.aud === "all" ? "hidden" : ""}>${cs.map((c) => `<label class="pv"><input type="checkbox" class="sc" value="${c.id}" ${pv.stl && pv.stl[c.id] ? "checked" : ""}>${esc(c.name)}</label>`).join("")}</div><div class="mb2"><button data-x>Cancel</button><button class="go" data-do="stpost">Post</button></div>`,
  );
  $("stf").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    toast("Uploading...");
    try {
      const u = await uploadToCloudinary(f);
      if (!isPic(u)) return toast("Cloudinary isn't set up");
      stDraft.img = u;
      $("stp").style.background = `center/cover url('${u}')`;
      $("stt").placeholder = "Add a caption";
    } catch {
      toast("Upload failed");
    }
  };
}
async function stPost() {
  const t = $("stt").value.trim();
  if (!t && !stDraft.img) return toast("Write something or add a photo");
  const sel = [...document.querySelectorAll(".sc:checked")].map((x) => x.value),
    ids = contacts().map((c) => c.id),
    aud =
      stDraft.aud === "only"
        ? sel
        : stDraft.aud === "except"
          ? ids.filter((x) => !sel.includes(x))
          : ids;
  me.priv = {
    ...(me.priv || {}),
    st: stDraft.aud,
    stl: Object.fromEntries(sel.map((x) => [x, true])),
  };
  fb.D.update(R("users/" + me.uid), { priv: me.priv }).catch(() => {});
  const id = fb.D.push(R("status/" + me.uid)).key,
    d = { tx: t, bg: stDraft.bg, img: stDraft.img || null, at: Date.now(), n: me.name };
  closeMd();
  await fb.D.set(R("status/" + me.uid + "/" + id), {
    ...d,
    aud: Object.fromEntries(aud.map((x) => [x, 1])),
  });
  await Promise.all(
    aud.map((u) => fb.D.set(R("statusFeed/" + u + "/" + me.uid + "/" + id), d)),
  );
  toast("Status posted");
}
function stOpen(uid) {
  const mine = uid === "me",
    l = live(mine ? MYST : ST[uid]);
  if (!l.length) return mine ? stNew() : toast("No updates");
  svS = { l, i: 0, c: mine ? me : g(uid), mine, uid, t: 0 };
  stShow();
}
function stShow() {
  const S = svS,
    s = S.l[S.i],
    sv = $("sv");
  clearTimeout(S.t);
  sv.hidden = false;
  if (!S.mine) {
    SEEN[s.id] = 1;
    localStorage.setItem("hoories-ss", JSON.stringify(SEEN));
    fb.D.set(R("statusViews/" + S.uid + "/" + s.id + "/" + me.uid), {
      t: Date.now(),
      n: me.name,
    }).catch(() => {});
  }
  sv.innerHTML = `<div class="svb">${S.l.map((_, i) => `<i class="${i < S.i ? "d" : i === S.i ? "a" : ""}"></i>`).join("")}</div><div class="svh">${av(S.c, "sm")}<b>${esc(S.c.name)}</b><small>${tf(new Date(s.at))}</small><button data-do="stx" aria-label="Close">✕</button></div><div class="svc" style="background:${s.img ? "#000" : BG[s.bg || 0]}" data-do="stnx">${s.img ? `<img src="${s.img}" alt="Status">` : ""}<p>${esc(s.tx || "")}</p></div>${S.mine ? '<div class="svf"><button data-do="stvw">👁 Views</button><button data-do="stdl">🗑 Delete</button></div>' : `<form class="svf" id="svr"><input id="svt" placeholder="Reply to ${esc(S.c.name)}" autocomplete="off"><button class="send" aria-label="Send">➤</button></form>`}`;
  S.t = setTimeout(stNx, 5000);
  const f = $("svr");
  if (f) {
    f.onfocusin = () => clearTimeout(S.t);
    f.onsubmit = (e) => {
      e.preventDefault();
      const t = $("svt").value.trim();
      if (!t) return;
      $("svt").value = "";
      sendMsg(g(S.uid), { text: t.slice(0, 1000) }, { id: "st", name: "Status", text: s.tx || "📷 Photo" })
        .then(() => toast("Reply sent"))
        .catch(fail);
    };
  }
}
const stNx = () => {
  const S = svS;
  if (!S) return;
  if (S.i < S.l.length - 1) {
    S.i++;
    stShow();
  } else stX();
};
const stX = () => {
  if (svS) clearTimeout(svS.t);
  svS = null;
  $("sv").hidden = true;
  stv();
};

/* ---------- voice + video calls (WebRTC, signalling in Firebase) ---------- */
let CALL = null;
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const addIce = (S, c) =>
  S.pc.remoteDescription ? S.pc.addIceCandidate(c).catch(() => {}) : S.q.push(c);
function clUI(c, st, video) {
  const o = $("cl");
  o.hidden = false;
  o.classList.remove("incoming");
  o.classList.toggle("a", !video);
  o.classList.toggle("vid", !!video);
  o.innerHTML = `<video id="rv" autoplay playsinline></video><video id="lv" autoplay playsinline muted></video><div class="call-glow"></div><div class="cli"><div class="call-kicker">${video ? "HOORIES VIDEO CALL" : "HOORIES VOICE CALL"}</div><div class="call-avatar">${av(c, "lg")}</div><h2>${esc(c.name)}</h2><p id="cls">${esc(st)}</p><div class="call-wave"><i></i><i></i><i></i><i></i><i></i></div></div><div class="clb"><button data-do="cmu" aria-label="Mute microphone" title="Mute microphone">${callIcon("mic")}</button>${video ? `<button data-do="ccm" aria-label="Toggle camera" title="Toggle camera">${callIcon("camera")}</button>` : ""}<button class="end" data-do="cend" aria-label="End call" title="End call">${callIcon("end")}</button></div>`;
}
async function pcInit(c, video, cid, role) {
  const pc = new RTCPeerConnection(ICE);
  const S = { pc, st: null, cid, c, video, role, t0: 0, subs: [], q: [] };
  CALL = S;
  const st = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: video ? { facingMode: "user" } : false,
  });
  S.st = st;
  const rs = new MediaStream();
  st.getTracks().forEach((t) => pc.addTrack(t, st));
  if ($("lv")) $("lv").srcObject = st;
  if ($("rv")) $("rv").srcObject = rs;
  pc.ontrack = (e) => e.streams[0].getTracks().forEach((t) => rs.addTrack(t));
  pc.onicecandidate = (e) =>
    e.candidate &&
    fb.D.push(R("calls/" + cid + "/ice/" + role), e.candidate.toJSON());
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected" && CALL === S && !S.t0) {
      S.t0 = Date.now();
      if ($("cls")) $("cls").textContent = "Connected";
    }
    if (["failed", "closed"].includes(pc.connectionState) && CALL === S) {
      callEnd(true, "end");
    }
  };
  return pc;
}
async function callStart(video) {
  const c = g(cur);
  if (CALL || !c.chatId || c.group) return;
  if (!navigator.mediaDevices) return toast("Calls need https or localhost");
  clUI(c, "Calling…", video);
  try {
    const cid = fb.D.push(R("calls")).key,
      pc = await pcInit(c, video, cid, "caller"),
      S = CALL,
      off = await pc.createOffer();
    await pc.setLocalDescription(off);
    await fb.D.set(R("calls/" + cid), {
      from: me.uid,
      to: c.id,
      video,
      name: me.name,
      at: Date.now(),
      state: "ring",
      offer: { type: off.type, sdp: off.sdp },
    });
    await fb.D.set(R("incoming/" + c.id), { cid, from: me.uid, name: me.name, video });
    S.subs.push(
      fb.D.onValue(R("calls/" + cid), async (s) => {
        const v = s.val();
        if (!v || !CALL) return;
        if (v.answer && !S.ans) {
          S.ans = 1;
          await pc.setRemoteDescription(v.answer);
          S.q.splice(0).forEach((x) => pc.addIceCandidate(x).catch(() => {}));
        }
        if (v.state === "end" || v.state === "decline") callEnd(false, v.state);
      }),
    );
    S.subs.push(fb.D.onChildAdded(R("calls/" + cid + "/ice/callee"), (s) => addIce(S, s.val())));
    S.to = setTimeout(() => CALL === S && !S.t0 && callEnd(true, "missed"), 40000);
  } catch (error) {
    callEnd(false, "err");
    $("cl").hidden = true;
    $("cl").classList.remove("incoming", "a", "vid");
    toast("Couldn't start the call. Check microphone/camera permission and HTTPS.");
  }
}
function callIcon(name) {
  const paths = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/>',
    camera: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    end: '<path d="M4 15c4-4 12-4 16 0l-2 4a1 1 0 0 1-1.3.5l-3-1.2a1 1 0 0 1-.6-.9V16a12 12 0 0 0-2.2 0v1.4a1 1 0 0 1-.6.9l-3 1.2A1 1 0 0 1 6 19z"/>',
    answer: '<path d="M4 15c4-4 12-4 16 0l-2 4a1 1 0 0 1-1.3.5l-3-1.2a1 1 0 0 1-.6-.9V16a12 12 0 0 0-2.2 0v1.4a1 1 0 0 1-.6.9l-3 1.2A1 1 0 0 1 6 19z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  return `<svg class="call-ic" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.end}</svg>`;
}
function ring(v) {
  const c = g(v.from);
  if (!c || CALL) return;
  const S = { ring: v, subs: [], rt: null };
  CALL = S;
  const o = $("cl");
  o.hidden = false;
  o.classList.add("a", "incoming");
  o.innerHTML = `<div class="call-glow"></div><div class="cli"><div class="call-kicker">HOORIES CALL</div><div class="call-avatar">${av(c, "lg")}</div><h2>${esc(c.name)}</h2><p>${v.video ? "Incoming video call" : "Incoming voice call"}</p><div class="call-wave"><i></i><i></i><i></i><i></i><i></i></div></div><div class="clb"><button class="end" data-do="cdec" aria-label="Decline call" title="Decline">${callIcon("close")}</button><button class="ok" data-do="cacc" aria-label="Answer call" title="Answer">${callIcon("answer")}</button></div>`;
  S.subs.push(fb.D.onValue(R("calls/" + v.cid), (snap) => {
    const state = (snap.val() || {}).state;
    if (CALL === S && S.ring && (state === "end" || state === "decline")) {
      clearTimeout(S.rt);
      S.subs.forEach((off) => off());
      CALL = null;
      o.hidden = true;
      o.classList.remove("incoming", "a");
      fb.D.remove(R("incoming/" + me.uid)).catch(() => {});
    }
  }));
  S.rt = setTimeout(() => { if (CALL === S && S.ring) cDec(); }, 40000);
}
async function cAcc() {
  const pending = CALL;
  if (!pending || !pending.ring) return;
  const v = pending.ring, c = g(v.from);
  clearTimeout(pending.rt);
  (pending.subs || []).forEach((off) => off());
  CALL = null;
  if (!c) return toast("This caller is no longer available");
  clUI(c, "Connecting…", v.video);
  try {
    const pc = await pcInit(c, v.video, v.cid, "callee"),
      S = CALL,
      d = (await fb.D.get(R("calls/" + v.cid))).val();
    await pc.setRemoteDescription(d.offer);
    const an = await pc.createAnswer();
    await pc.setLocalDescription(an);
    S.subs.push(fb.D.onChildAdded(R("calls/" + v.cid + "/ice/caller"), (s) => addIce(S, s.val())));
    await fb.D.update(R("calls/" + v.cid), {
      answer: { type: an.type, sdp: an.sdp },
      state: "on",
    });
    fb.D.remove(R("incoming/" + me.uid)).catch(() => {});
    S.subs.push(
      fb.D.onValue(R("calls/" + v.cid), (snap) => {
        const state = (snap.val() || {}).state;
        if (state === "end" || state === "decline") callEnd(false, state);
      }),
    );
  } catch (error) {
    callEnd(false, "err");
    $("cl").hidden = true;
    $("cl").classList.remove("incoming", "a", "vid");
    fb.D.remove(R("incoming/" + me.uid)).catch(() => {});
    toast("Couldn't answer. Check microphone/camera permission and HTTPS.");
  }
}
function cDec() {
  const S = CALL;
  if (!S || !S.ring) return;
  const v = S.ring;
  clearTimeout(S.rt);
  (S.subs || []).forEach((off) => off());
  CALL = null;
  $("cl").hidden = true;
  $("cl").classList.remove("incoming", "a", "vid");
  $("cl").innerHTML = "";
  fb.D.remove(R("incoming/" + me.uid)).catch(() => {});
  fb.D.update(R("calls/" + v.cid), { state: "decline" }).catch(() => {});
}
function callEnd(notify, why) {
  const S = CALL;
  if (!S || S.ring) return;
  clearTimeout(S.to);
  (S.subs || []).forEach((f) => { try { f(); } catch {} });
  if (S.st) S.st.getTracks().forEach((t) => { try { t.stop(); } catch {} });
  try {
    if (S.pc) S.pc.close();
  } catch {}
  const remoteVideo = $("rv"), localVideo = $("lv");
  if (remoteVideo) remoteVideo.srcObject = null;
  if (localVideo) localVideo.srcObject = null;
  const dur = S.t0 ? Math.round((Date.now() - S.t0) / 1000) : 0;
  CALL = null;
  $("cl").hidden = true;
  $("cl").classList.remove("incoming", "a", "vid");
  $("cl").innerHTML = "";
  if (notify) fb.D.update(R("calls/" + S.cid), { state: "end" }).catch(() => {});
  if (S.role === "caller") {
    fb.D.remove(R("incoming/" + S.c.id)).catch(() => {});
    if (why !== "err")
      sendMsg(S.c, {
        text: "",
        call: { v: S.video ? 1 : 0, d: dur, s: why === "decline" ? "declined" : dur ? "ok" : "missed" },
      }).catch(() => {});
  }
}
$("cv").onclick = () => callStart(false);
$("cvv").onclick = () => callStart(true);

/* ---------- AI extras: chat summary + translate ---------- */
async function localSummary(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length
    ? "Chat summary (local):\n• " + lines.slice(0, 3).join("\n• ") + (lines.length > 3 ? "\n• More messages are available above." : "")
    : "There are no messages to summarize yet.";
}
const aiBox = (h, a) =>
  openMd(`<h3>${h}</h3><p style="white-space:pre-wrap">${esc(a)}</p><div class="mb2"><button data-x>Close</button></div>`);
$("sum").onclick = async () => {
  const c = g(cur),
    t = c.m
      .filter((m) => m.text && !m.del)
      .slice(-40)
      .map((m) => (m.from === "me" ? me.name : who(m.from).name) + ": " + m.text)
      .join("\n");
  if (!t) return toast("Nothing to summarize yet");
  toast("Summarizing…");
  aiBox("✦ Chat summary", await localSummary(t));
};
async function trans(m) {
  if (!m || !m.text) return toast("There is no text to translate");
  aiBox('<span class="ai-modal-icon">✦</span> Translation', "Automatic translation needs an online language service, which has been removed in this no-API version. Copy the message and use a translator separately.");
}

/* ---------- one click handler for all v3 buttons ---------- */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-do]");
  if (!b) return;
  const d = b.dataset.do,
    val = b.dataset.val,
    c = g(cur);
  try {
    if (d === "gaddm") {
      const cs = contacts();
      const rows = await Promise.all(cs.map(async (p) => {
        const exists = (await fb.D.get(R("groups/" + c.id + "/members/" + p.id))).exists();
        return `<label class="pv"><input type="checkbox" class="gma" value="${esc(p.id)}" ${exists ? "checked disabled" : ""}>${esc(p.name)}${p.un ? ` <small>@${esc(p.un)}</small>` : ""}</label>`;
      }));
      openMd(`<h3>Add people to ${esc(c.name)}</h3><p>Select people already in your Hoories chats.</p><div class="mlist">${rows.join("") || "<p>Add people to Hoories first.</p>"}</div><div class="mb2"><button data-x>Cancel</button><button class="go" data-do="gaddsave" data-val="${esc(c.id)}">Save members</button></div>`);
    }
    if (d === "gaddsave") {
      const gid = val;
      const ids = [...document.querySelectorAll(".gma:checked:not(:disabled)")].map((x) => x.value);
      if (!ids.length) return toast("Select at least one new member");
      for (const uid of ids) {
        await fb.D.set(R("groups/" + gid + "/members/" + uid), true);
        await fb.D.set(R("userGroups/" + uid + "/" + gid), true);
      }
      closeMd(); toast(`${ids.length} member${ids.length === 1 ? "" : "s"} added to the group`); await gInfo();
    }
    if (d === "gmk") {
      const nm = $("gn").value.trim();
      if (!nm) return toast("Enter a group name");
      const ids = [...document.querySelectorAll(".gm:checked")].map((x) => x.value),
        gid = fb.D.push(R("groups")).key,
        meta = { name: nm, ic: $("gie").value.trim() || "👥", h: (Math.random() * 360) | 0, owner: me.uid };
      await fb.D.set(R("groups/" + gid + "/meta"), meta);
      for (const u of [me.uid, ...ids]) {
        await fb.D.set(R("groups/" + gid + "/members/" + u), true);
        await fb.D.set(R("userGroups/" + u + "/" + gid), true);
      }
      gAdd(gid, meta);
      closeMd();
      cur = gid;
      $("chatv").classList.add("open");
      all();
      toast("Group created");
    }
    if (d === "ginv") cp(siteUrl() + "?join=" + cur);
    if (d === "gren") {
      const n = prompt("Group name", c.name);
      if (n && n.trim()) {
        c.name = n.trim();
        await fb.D.update(R("groups/" + c.id + "/meta"), { name: c.name });
        closeMd();
        all();
      }
    }
    if (d === "gpic") $("gpf").click();
    if (d === "glv") {
      closeMd();
      await fb.D.remove(R("groups/" + c.id + "/members/" + me.uid));
      await fb.D.remove(R("userGroups/" + me.uid + "/" + c.id));
      C.splice(C.indexOf(c), 1);
      cur = "community";
      all();
      toast("You left the group");
    }
    if (d === "vop") {
      closeMd();
      cur = val;
      $("chatv").classList.add("open");
      all();
    }
    if (d === "vun") {
      delete HID[val];
      fb.D.set(R("users/" + me.uid + "/hid/" + val), null).catch(fail);
      closeMd();
      all();
      toast("Chat unhidden");
    }
    if (d === "stnew") stNew();
    if (d === "stopen") stOpen(val);
    if (d === "stbg") {
      stDraft.bg = +val;
      stDraft.img = "";
      $("stp").style.background = BG[+val];
    }
    if (d === "stimg") $("stf").click();
    if (d === "staud") {
      stDraft.aud = val;
      document.querySelectorAll("[data-do=staud]").forEach((x) => x.classList.toggle("on", x === b));
      $("stc").hidden = val === "all";
    }
    if (d === "stpost") await stPost();
    if (d === "stx") stX();
    if (d === "stnx") stNx();
    if (d === "stvw") {
      clearTimeout(svS.t);
      const s = svS.l[svS.i],
        v = (await fb.D.get(R("statusViews/" + me.uid + "/" + s.id))).val() || {};
      openMd(`<h3>👁 Seen by ${Object.keys(v).length}</h3><div class="seenl">${Object.values(v).map((x) => `<div><b>${esc(x.n)}</b><small>${tf(new Date(x.t))}</small></div>`).join("") || "<p>No views yet.</p>"}</div><div class="mb2"><button data-x>Close</button></div>`);
    }
    if (d === "stdl") {
      const s = svS.l[svS.i],
        a = Object.keys((MYST[s.id] || {}).aud || {});
      await Promise.all([
        fb.D.remove(R("status/" + me.uid + "/" + s.id)),
        ...a.map((u) => fb.D.remove(R("statusFeed/" + u + "/" + me.uid + "/" + s.id))),
      ]);
      stX();
      toast("Status deleted");
    }
    if (d === "toggle-archive") {
      const id = val, next = !ARCH[id];
      if (next) ARCH[id] = true; else delete ARCH[id];
      await fb.D.set(R("users/" + me.uid + "/archived/" + id), next ? true : null);
      closeMd(); renderList(); toast(next ? "Chat archived — messages are kept" : "Chat moved back to All chats");
    }
    if (d === "toggle-fav") {
      const id = val, next = !FAVS[id];
      if (next) FAVS[id] = true; else delete FAVS[id];
      await fb.D.set(R("users/" + me.uid + "/favs/" + id), next ? true : null);
      closeMd(); renderList(); toast(next ? "Added to favorites" : "Removed from favorites");
    }
    if (d === "remove-contact") {
      const id = val, target = g(id);
      if (!target) return;
      if (!confirm(`Remove ${target.name} from your chat list? Their account and messages for other people will not be deleted.`)) return;
      await fb.D.set(R("users/" + me.uid + "/removed/" + id), true);
      await fb.D.remove(R("userChats/" + me.uid + "/" + id));
      REMOVED[id] = true; delete ARCH[id]; delete FAVS[id];
      await Promise.all([
        fb.D.set(R("users/" + me.uid + "/archived/" + id), null),
        fb.D.set(R("users/" + me.uid + "/favs/" + id), null),
      ]);
      if (cur === id) { cur = "community"; reply = null; }
      closeMd(); renderList(); if (cur === "community") all();
      toast("Removed from your chats. You can add them again from People.");
    }
    if (d === "myqr") myQR();
    if (d === "qcp") cp(siteUrl() + "?add=" + me.username);
    if (d === "qsc") qrScan();
    if (d === "invl") {
      const u = siteUrl() + "?add=" + me.username;
      if (navigator.share)
        navigator.share({ title: "Join me on Hoories", text: "Chat with me on Hoories 💬", url: u }).catch(() => {});
      else cp(u);
    }
    if (d === "dp") {
      me.priv = { ...(me.priv || {}), dp: val };
      fb.D.update(R("users/" + me.uid), { priv: me.priv }).catch(fail);
      fb.D.update(R("publicProfiles/" + me.uid), { photo: val === "all" ? (me.photo || "") : "" }).catch(() => {});
      openSettings();
    }
    if (d === "cmu" && CALL) {
      const t = CALL.st && CALL.st.getAudioTracks()[0];
      if (!t) return toast("Microphone is still connecting");
      t.enabled = !t.enabled;
      b.style.opacity = t.enabled ? 1 : 0.45;
      b.title = t.enabled ? "Mute microphone" : "Unmute microphone";
    }
    if (d === "ccm" && CALL) {
      const t = CALL.st && CALL.st.getVideoTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        b.style.opacity = t.enabled ? 1 : 0.45;
      }
    }
    if (d === "cend") callEnd(true, "end");
    if (d === "cacc") cAcc();
    if (d === "cdec") cDec();
  } catch (x) {
    fail(x);
  }
});

// Extra rail shortcuts for everyday chat actions.
$("peopleNav").onclick = () => openPeopleDirectory();
$("groupsNav").onclick = () => $("newg").click();
$("pinsNav").onclick = () => {
  setView("dash");
  const b = document.querySelector('[data-dash="pinned"]');
  if (b) b.click();
};


async function openPeopleDirectory() {
  openMd(`<h3>People on Hoories</h3><p>Registered profiles that have been published to the People directory. Search by name or username.</p><input id="peopleSearch" placeholder="Search people" aria-label="Search people"><div id="peopleResults" class="people-results"><p class="mut">Loading people…</p></div><div class="mb2"><button data-x>Close</button><button class="go" id="peopleAddByName">＋ Add by username</button></div>`);
  const host = $("peopleResults");
  try {
    const snap = await fb.D.get(R("publicProfiles"));
    const rows = Object.entries(snap.val() || {}).filter(([uid, p]) => uid !== me.uid && p && p.username).map(([uid, p]) => ({ uid, ...p }));
    window.__hooriesPeopleRows = rows;
    const paint = () => {
      const q = ($("peopleSearch").value || "").trim().toLowerCase();
      const filtered = rows.filter(p => !REMOVED[p.uid] && ((p.name || "").toLowerCase().includes(q) || (p.username || "").toLowerCase().includes(q)));
      host.innerHTML = filtered.length ? filtered.map(p => `<div class="people-result">${av({name:p.name,photo:p.photo||"",h:p.h||40})}<span><b>${esc(p.name || "Hoories user")}</b><small>@${esc(p.username)}</small></span><button class="go" data-public-add="${esc(p.username)}">Add</button></div>`).join("") : `<div class="folder-empty"><span>⌕</span><b>No people found</b><small>${rows.length ? "Try another name or username." : "No public profiles are available yet. New signups appear here after publicProfiles read/write rules are enabled."}</small></div>`;
    };
    $("peopleSearch").oninput = paint;
    host.onclick = e => { const b = e.target.closest("[data-public-add]"); if (!b) return; const row = rows.find(p => p.username === b.dataset.publicAdd); if (!row) return; FOUND[row.username] = { uid: row.uid, name: row.name || "Hoories user", username: row.username, photo: row.photo || "", h: row.h || 40 }; addP(row.username); };
    $("peopleAddByName").onclick = () => { closeMd(); $("addp").click(); };
    paint();
  } catch (x) {
    host.innerHTML = `<div class="folder-empty"><span>♧</span><b>People directory needs Firebase rules</b><small>Allow signed-in users to read publicProfiles and each account to write only its own public profile. You can still add someone by username.</small></div>`;
    $("peopleAddByName").onclick = () => { closeMd(); $("addp").click(); };
  }
}

