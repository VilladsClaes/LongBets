// LongBets – små snedigheder i browseren. Ingen biblioteker, bare glæde.

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

// Mobilmenu
const burger = $("#burger");
const menu = $("#mobilmenu");
if (burger && menu) {
  burger.addEventListener("click", () => {
    const open = menu.hasAttribute("hidden");
    if (open) menu.removeAttribute("hidden");
    else menu.setAttribute("hidden", "");
    burger.setAttribute("aria-expanded", String(open));
  });
}

// Aktiv menu-pille
const path = document.body.dataset.path || "/";
$$(".nav-pill").forEach((a) => {
  const href = a.getAttribute("href");
  if (href === path || (href !== "/" && path.startsWith(href))) a.classList.add("is-active");
});

// Pop ind når noget scrolles frem
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    });
  },
  { rootMargin: "0px 0px -8% 0px" },
);
$$(".reveal").forEach((el) => io.observe(el));

// Hurtige indsats-knapper
$$(".stake-quick").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target || "stake";
    const input = document.getElementById(target);
    if (input) {
      input.value = btn.dataset.stake;
      input.focus();
    }
    $$(".stake-quick").forEach((b) => b.classList.remove("btn-sun"));
    btn.classList.add("btn-sun");
  });
});

// Foreslåede formuleringer
$$("[data-suggest]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const title = $("#f-title");
    if (title) {
      title.value = btn.dataset.suggest;
      title.focus();
    }
  });
});

// Hent oplysninger fra et indsat link
const fetchBtn = $("#fetch-meta");
if (fetchBtn) {
  fetchBtn.addEventListener("click", async () => {
    const url = $("#linkurl").value.trim();
    const status = $("#meta-status");
    if (!url) {
      status.textContent = "Indsæt først et link.";
      return;
    }
    fetchBtn.disabled = true;
    status.textContent = "Henter oplysninger… 🔍";
    try {
      const res = await fetch(`/api/link-meta?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.error && !data.title) {
        status.textContent = `⚠️ ${data.error}`;
      } else {
        status.textContent = data.title ? `✅ Hentet: ${data.title}` : "Ingen titel fundet – skriv selv.";
      }
      const title = data.title || "";
      const desc = data.description || "";
      const image = data.image || "";
      const site = data.site || "";
      $("#f-source-url").value = data.url || url;
      $("#f-source-name").value = title;
      $("#f-source-image").value = image;
      $("#meta-title").textContent = title || "Din overskrift vises her";
      $("#meta-desc").textContent = desc;
      $("#meta-site").textContent = site;
      const prev = $("#meta-preview");
      const img = $("#meta-img");
      if (image && img) {
        img.src = image;
        prev.classList.remove("is-empty");
      }
      const titleField = $("#f-title");
      if (title && titleField && !titleField.value.trim()) titleField.value = title;
      const kind = $('#create-form input[name="kind"]');
      if (kind) kind.value = "link";
    } catch (err) {
      status.textContent = "⚠️ Kunne ikke hente den side.";
    } finally {
      fetchBtn.disabled = false;
    }
  });
}

// Konfetti når nogen har fået ret
function confetti(count = 26) {
  const farver = ["#ffd23f", "#ff6b6b", "#06d6a0", "#a66cff", "#4d96ff", "#ff8fab"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "confetti-piece";
    p.style.left = `${45 + Math.random() * 10}vw`;
    p.style.top = `${35 + Math.random() * 10}vh`;
    p.style.background = farver[i % farver.length];
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 70}vw`);
    p.style.setProperty("--dy", `${Math.random() * 55 + 15}vh`);
    p.style.setProperty("--rot", `${Math.random() * 900 - 450}deg`);
    p.style.animationDelay = `${Math.random() * 0.25}s`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2600);
  }
}

if ($(".win-note")) confetti(24);
const winForm = $(".win-form form");
if (winForm) winForm.addEventListener("submit", () => confetti(40));

// Bonus-beskeden forsvinder af sig selv
const toast = $("#bonus-toast");
if (toast) setTimeout(() => toast.remove(), 6000);
