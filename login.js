
     window.$ = window.$ || ((i) => document.getElementById(i));
      const toast = (m) => {
        const t = $("toast");
        t.textContent = m;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 3000);
      };
      const ENV = window.ENV,
        fb = {};
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

      let mode = "login",
        pick = null,
        busy = false;

      /* theme (remembered between pages) */
      const root = document.documentElement;
      root.dataset.th = localStorage.getItem("hoories-th") || "light";
      const paintTh = () => {
        $("thb2").textContent =
          root.dataset.th === "dark" ? "☀ Light" : "☾ Dark";
      };
      $("thb2").onclick = () => {
        root.dataset.th = root.dataset.th === "dark" ? "light" : "dark";
        localStorage.setItem("hoories-th", root.dataset.th);
        paintTh();
      };
      paintTh();

      /* tabs, photo, password eye */
      document.querySelectorAll(".tabs button").forEach(
        (b) =>
          (b.onclick = () => {
            mode = b.dataset.t;
            const s = mode === "signup";
            document
              .querySelectorAll(".tabs button")
              .forEach((x) => x.classList.toggle("on", x === b));
            $("so").hidden = !s;
            $("sb").textContent = s ? "Create account" : "Log in";
            $("err").textContent = "";
            $("ttl").textContent = s ? "Create your account" : "Welcome back";
            $("sub").textContent = s
              ? "Join Hoories in a minute. It's free."
              : "Log in to pick up where you left off.";
            $("fgt").hidden = s;
          }),
      );
      $("pf").onchange = (e) => {
        pick = e.target.files[0];
        if (!pick) return;
        const p = $("pp");
        p.textContent = "";
        p.style.backgroundImage = `url(${URL.createObjectURL(pick)})`;
        p.style.border = "0";
      };
      $("eye").onclick = () => {
        const p = $("pw");
        p.type = p.type === "password" ? "text" : "password";
        $("eye").textContent = p.type === "password" ? "Show" : "Hide";
      };

      /* welcome screen, then open the chat app */
      function welcome() {
        const w = $("wlc");
        w.hidden = false;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => w.classList.add("in")),
        );
        setTimeout(() => {
          location.href = "index.html";
        }, 2700);
      }

      /* Firebase: username + profile */
      async function makeUsername(base, uid) {
        base = (base || "user")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 14);
        if (base.length < 3) base += "user";
        for (let i = 0; i < 6; i++) {
          const n = i ? base + ((Math.random() * 900 + 100) | 0) : base;
          const r = await fb.D.runTransaction(
            fb.D.ref(fb.db, "usernames/" + n),
            (c) => (c === null ? uid : undefined),
          );
          if (r.committed) return n;
        }
        throw new Error("Could not create a username, try again.");
      }
      async function ensureProfile(user, name, photo) {
        const r = fb.D.ref(fb.db, "users/" + user.uid),
          s = await fb.D.get(r);
        if (s.exists()) return;
        const p = {
          name: name || user.displayName || user.email.split("@")[0],
          photo: photo || user.photoURL || "",
          h: (Math.random() * 360) | 0,
        };
        p.username = await makeUsername(user.email.split("@")[0], user.uid);
        await fb.D.set(r, p);
      }

      $("af").onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const n = $("nm").value.trim(),
          em = $("em").value.trim(),
          pw = $("pw").value,
          er = $("err"),
          b = $("sb"),
          t = b.textContent;
        if (mode === "signup" && !n) {
          er.textContent = "Please enter your name.";
          return;
        }
        busy = true;
        er.textContent = "";
        b.disabled = true;
        let ok = false;
        try {
          await initFB();
          let user;
          if (mode === "signup") {
            b.textContent = "Creating account...";
            user = (await fb.Au.createUserWithEmailAndPassword(fb.auth, em, pw))
              .user;
            let photo = "";
            if (pick) {
              try {
                photo = await uploadToCloudinary(pick);
              } catch (x) {
                toast("Photo upload failed, continuing without it");
              }
            }
            if (photo.startsWith("blob:")) photo = "";
            await ensureProfile(user, n, photo);
          } else {
            b.textContent = "Logging in...";
            user = (await fb.Au.signInWithEmailAndPassword(fb.auth, em, pw))
              .user;
            await ensureProfile(user);
          }
          ok = true;
        } catch (x) {
          er.textContent = errMsg(x);
        }
        b.textContent = t;
        b.disabled = false;
        busy = false;
        if (ok) welcome();
      };
      $("gg").onclick = async () => {
        if (busy) return;
        busy = true;
        let ok = false;
        try {
          await initFB();
          const r = await fb.Au.signInWithPopup(
            fb.auth,
            new fb.Au.GoogleAuthProvider(),
          );
          await ensureProfile(r.user);
          ok = true;
        } catch (x) {
          $("err").textContent = errMsg(x);
        }
        busy = false;
        if (ok) welcome();
      };
      $("fgt").onclick = async () => {
        const em = $("em").value.trim();
        if (!em) {
          $("err").textContent = "Type your email first.";
          return;
        }
        try {
          await initFB();
          await fb.Au.sendPasswordResetEmail(fb.auth, em);
          toast("Password reset email sent");
        } catch (x) {
          $("err").textContent = errMsg(x);
        }
      };

      /* already logged in? go straight to the app */
      initFB()
        .then(() =>
          fb.Au.onAuthStateChanged(fb.auth, (u) => {
            if (u && !busy) location.replace("index.html");
          }),
        )
        .catch(() => {});
   