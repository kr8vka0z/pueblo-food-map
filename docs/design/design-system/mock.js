// Makes the mockups behave like a real admin: tap a card to fill the side panel, three-dot menus, bottom card on
// a phone, picking several, live search, the review strip's Computer/Phone/Notes buttons. Nothing saves anything.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const qs = new URLSearchParams(location.search);
  if (qs.get("frame")) document.documentElement.classList.add("inframe");

  // Review strip: Computer / Phone view of this same page. The phone view is the same file in a 360px frame
  // (Pueblo Food Map's baseline: an older Android at 360 pixels wide, DESIGN.md "Low-end device guardrails"),
  // so the phone layout shown is the page's real phone layout.
  const view = (phone) => {
    $("#rvphone")?.setAttribute("aria-pressed", phone);
    $("#rvcomp")?.setAttribute("aria-pressed", !phone);
    $(".shell")?.toggleAttribute("hidden", phone);
    const f = $(".phoneframe");
    if (phone && !f) {
      const d = document.createElement("div");
      d.className = "phoneframe";
      d.innerHTML = `<iframe title="Phone view" src="${location.pathname}?frame=1"></iframe>`;
      document.body.append(d);
    } else if (!phone) f?.remove();
    if (phone) localStorage.setItem("rvview", "phone"); else localStorage.removeItem("rvview");
  };
  $("#rvcomp")?.addEventListener("click", () => view(false));
  $("#rvphone")?.addEventListener("click", () => view(true));
  if (!qs.get("frame") && localStorage.getItem("rvview") === "phone" && innerWidth > 700) view(true);
  $("#rvnotesbtn")?.addEventListener("click", () => $(".rvnotes").classList.toggle("show"));
  $("#rvnotesclose")?.addEventListener("click", () => $(".rvnotes").classList.remove("show"));

  const toast = (msg) => {
    // The visible toast fades with visibility: hidden, which hides it from screen readers, so the
    // words are announced by a separate hidden status region that is always exposed.
    const t = $(".toast"), say = $("#toastsay");
    t.textContent = msg;
    if (say) { say.textContent = ""; requestAnimationFrame(() => (say.textContent = msg)); }
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2400);
  };

  // Panel
  const panel = $("#panel");
  const body = $("#panelbody");
  const home = body?.innerHTML;
  const scrim = $(".scrim");
  // On a phone the bottom card is a modal: everything outside it goes inert (no Tab, no taps), it says
  // it is a dialog, focus goes in, and comes back to where it was on close. On a computer it stays
  // part of the page, so nothing goes inert.
  let sheetInert = [], sheetReturn = null;
  const closeSheet = () => {
    panel?.classList.remove("show"); scrim?.classList.remove("show");
    if (!panel || !sheetInert.length) return;
    sheetInert.forEach((el) => (el.inert = false)); sheetInert = [];
    panel.removeAttribute("role"); panel.removeAttribute("aria-modal");
    sheetReturn?.focus?.(); sheetReturn = null;
  };
  const openSheet = () => {
    panel?.classList.add("show"); scrim?.classList.add("show");
    if (!panel || innerWidth >= 1024 || sheetInert.length) return;
    sheetReturn = document.activeElement;
    for (let el = panel; el && el !== document.body; el = el.parentElement)
      for (const sib of el.parentElement.children) if (sib !== el && sib !== scrim && sib.id !== "toastsay" && !sib.classList.contains("toast") && !sib.inert && sib.tagName !== "SCRIPT") { sib.inert = true; sheetInert.push(sib); }
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.tabIndex = -1; panel.focus();
  };
  const clearSel = () => $$(".card.sel,.rowl.sel").forEach((c) => c.classList.remove("sel"));
  const goHome = () => { if (body) { body.innerHTML = home; $$(".pconfirm", body).forEach(gate); } clearSel(); };
  // Must-tick confirms: the danger button gets the real disabled attribute until every tick box in the confirm is
  // ticked, so Tab and Enter can't press it either (CSS alone only stopped the mouse).
  const gate = (pc) => { const off = $$(".cx input", pc).some((i) => !i.checked); $$(".btn.d", pc).forEach((b) => (b.disabled = off)); };
  $$(".pconfirm").forEach(gate);
  document.addEventListener("change", (e) => { const pc = e.target.closest?.(".pconfirm"); if (pc) gate(pc); });
  // The opener is a button carrying data-open (a card's .opencard or a row); the card or row around it shows as picked.
  const openPanel = (opener) => {
    const tpl = document.getElementById("p-" + opener.dataset.open);
    if (!tpl) return;
    clearSel();
    (opener.closest(".card,.rowl") ?? opener).classList.add("sel");
    body.innerHTML = tpl.innerHTML;
    $$(".pconfirm", body).forEach(gate);
    panel.scrollTop = 0;
    openSheet();
  };

  const closeMenus = () => {
    $$(".menu.show").forEach((m) => m.classList.remove("show"));
    $$(".dots[aria-expanded=true]").forEach((d) => d.setAttribute("aria-expanded", "false"));
  };

  const updateBulk = () => {
    const on = $$(".card.on");
    const n = on.length;
    const c = $("[data-bulkcount]");
    // "sum": the bar shows the dollar total of the ticked cards (data-amt on each card).
    const sum = () => "$" + on.reduce((t, el) => t + Number(el.dataset.amt ?? 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
    if (c) c.textContent = n + " selected" + (c.dataset.bulkcount === "sum" ? " · " + sum() : c.dataset.bulkcount ? " · " + c.dataset.bulkcount : "");
    $$("[data-needsel]").forEach((b) => (b.disabled = n === 0 || pending));
    $$(".picking .card[data-tickable]").forEach((el) => el.setAttribute("aria-checked", el.classList.contains("on")));
  };

  // Picking several, with the owner's rulings: the ticks stay after an action works, so a second one can follow;
  // the leave button reads Cancel until an action has worked, then Done (Cancel after a change reads like undo);
  // no visible pop-up, the change on the cards is the confirmation, and a hidden status line tells screen readers;
  // a failure shows in the bar and keeps the ticks; while an action is on its way nothing can leave or restart.
  let pending = false;
  const pickTargets = () => [$("#panel"), $(".search"), $("[data-admin-open]")].filter(Boolean);
  const startPick = () => {
    closeSheet(); goHome();
    $(".layout").classList.add("picking");
    pickTargets().forEach((el) => (el.inert = true)); // inert, not pointer-events: Tab must not reach them either
    $$(".card[data-tickable]").forEach((el) => { el.tabIndex = 0; el.setAttribute("role", "checkbox"); el.setAttribute("aria-label", el.querySelector(".name")?.textContent ?? ""); });
    const stop = $("[data-pick-stop]"); if (stop) stop.textContent = "Cancel";
    updateBulk();
    $(".card[data-tickable]")?.focus();
  };
  const stopPick = () => {
    $(".layout").classList.remove("picking");
    pickTargets().forEach((el) => (el.inert = false));
    $$(".card[data-tickable]").forEach((el) => { el.classList.remove("on"); el.removeAttribute("tabindex"); el.removeAttribute("role"); el.removeAttribute("aria-checked"); el.removeAttribute("aria-label"); });
    const err = $(".pickerr"); if (err) { err.hidden = true; err.textContent = ""; }
    $("[data-pick-start]")?.focus();
  };
  const runPick = (b) => {
    const on = $$(".card.on");
    if (pending || !on.length) return;
    pending = true;
    const lock = [...$$("[data-pick-act]"), ...$$("[data-pick-stop]"), ...$$("[data-pick-start]")];
    lock.forEach((x) => (x.disabled = true));
    b.setAttribute("aria-busy", "true");
    const err = $(".pickerr"); if (err) err.hidden = true;
    setTimeout(() => {
      pending = false;
      b.removeAttribute("aria-busy");
      lock.forEach((x) => (x.disabled = false));
      if (b.dataset.fail) { if (err) { err.textContent = b.dataset.fail; err.hidden = false; } updateBulk(); return; }
      if (b.dataset.mark) on.forEach((c) => { const f = c.querySelector(".facts") ?? c; if (!f.innerHTML.includes(b.dataset.mark)) f.insertAdjacentHTML("beforeend", " " + b.dataset.mark); });
      const say = $("#picksay"); if (say) { say.textContent = ""; requestAnimationFrame(() => (say.textContent = b.dataset.done.replace("{n}", on.length))); }
      const stop = $("[data-pick-stop]"); if (stop) stop.textContent = "Done";
      updateBulk();
    }, 900);
  };
  document.addEventListener("keydown", (e) => {
    const c = e.target.closest?.(".picking .card[data-tickable]");
    if (c && (e.key === " " || e.key === "Enter") && !pending) { e.preventDefault(); c.classList.toggle("on"); updateBulk(); }
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    const dots = t.closest(".dots");
    if (dots) {
      const m = dots.parentElement.querySelector(".menu") ?? dots.closest(".card,.boxh,.head")?.querySelector(".menu");
      const open = m.classList.contains("show");
      closeMenus();
      if (!open) { m.classList.add("show"); dots.setAttribute("aria-expanded", "true"); }
      return;
    }
    if (!t.closest(".menu")) closeMenus();

    const inPick = $(".picking");
    const card = t.closest(".card[data-tickable]");
    if (inPick && card) { if (!pending) { card.classList.toggle("on"); updateBulk(); } return; }
    const act = t.closest("[data-pick-act]");
    if (act) { runPick(act); return; }

    const nav = t.closest("[data-nav-open]");
    if (nav) { $(".drawer").classList.add("show"); return; }
    if (t.closest("[data-nav-close]") || t.classList.contains("drawer")) { $(".drawer").classList.remove("show"); return; }

    const sw = t.closest("[data-tabset] [data-tab]");
    if (sw) {
      const set = sw.closest("[data-tabset]");
      $$("[data-tab]", set).forEach((b) => b.setAttribute("aria-pressed", b === sw));
      $$(`[data-tabpane^="${set.dataset.tabset}:"]`).forEach((p) => (p.hidden = p.dataset.tabpane !== `${set.dataset.tabset}:${sw.dataset.tab}`));
      return;
    }
    const tog = t.closest("[data-toggle]");
    if (tog) { const el = document.getElementById(tog.dataset.toggle); if (el) el.hidden = !el.hidden; return; }
    if (t.closest("[data-pick-start]")) { startPick(); return; }
    if (t.closest("[data-pick-stop]")) { if (!pending) stopPick(); return; }
    if (t.closest("[data-admin-open]")) { e.preventDefault(); goHome(); openSheet(); return; }
    if (t.closest(".pclose") || t === scrim) { closeSheet(); return; }

    const opener = t.closest("[data-open]");
    if (opener && !t.closest("a,.dots,.menu")) { openPanel(opener); return; }

    // Tapping outside the panel returns it to the page's own admin actions.
    if (panel && !t.closest("#panel") && t.closest(".wrap")) goHome();

    const say = t.closest("[data-say]");
    if (say) { toast(say.dataset.say); return; }
    const plain = t.closest("button");
    if (plain && !plain.closest(".rv") && !plain.closest("form[data-keep]") && !plain.hasAttribute("onclick") && !plain.closest(".ds")) toast("Mockup: this button doesn't do anything yet.");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet(); closeMenus(); $(".drawer")?.classList.remove("show"); } });
  document.addEventListener("submit", (e) => e.preventDefault());

  // Live search: hides cards and rows that don't match, then hides any group left empty.
  $$("[data-search]").forEach((inp) => inp.addEventListener("input", () => {
    const q = inp.value.trim().toLowerCase();
    $$(".card,.rowl").forEach((c) => { if (c.closest("template")) return; c.hidden = q && !c.textContent.toLowerCase().includes(q); c.style.display = c.hidden ? "none" : ""; });
    $$(".box,[data-group]").forEach((g) => { g.style.display = $$(".card,.rowl", g).some((c) => c.style.display !== "none") ? "" : "none"; });
  }));
})();
