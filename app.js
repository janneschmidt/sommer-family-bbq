const SUPABASE_URL = "https://bmcrddfememxexwjcqcz.supabase.co";
const SUPABASE_KEY = "sb_publishable_xivSQJ7FQD-iF5NIECMc_Q_L-u9oWwy";
const form = document.querySelector("#bringForm");
const list = document.querySelector("#bringList");
const emptyState = document.querySelector("#emptyState");
const entryCount = document.querySelector("#entryCount");
const dialog = document.querySelector("#successDialog");
const cancelEdit = document.querySelector("#cancelEdit");
let entries = [];

const categoryMeta = {
  Salat: { emoji: "🥗", label: "Salat" },
  Nachtisch: { emoji: "🍰", label: "Nachtisch" },
  Sonstiges: { emoji: "🧺", label: "Sonstiges" },
};

async function rpc(name, payload = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.message || "Die Verbindung zur Mitbringliste ist fehlgeschlagen.");
  }
  return response.status === 204 ? null : response.json();
}

function token() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function editCredentials() {
  const params = new URLSearchParams(location.search);
  return { token: params.get("edit"), entryId: params.get("entry") };
}

function render() {
  const own = editCredentials();
  entryCount.textContent = entries.length;
  emptyState.classList.toggle("hidden", entries.length > 0);
  list.innerHTML = entries.map((entry) => {
    const meta = categoryMeta[entry.category] || categoryMeta.Sonstiges;
    const editable = own.token && own.entryId === entry.id;
    return `<article class="list-item">
      <span class="item-emoji">${meta.emoji}</span>
      <div><h4>${escapeHtml(entry.item)}</h4><p class="item-by">${escapeHtml(entry.name)} · ${meta.label}</p>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</div>
      ${editable ? `<div class="item-actions"><button class="edit-own" data-edit="${entry.id}">Bearbeiten</button><button class="delete-own" data-delete="${entry.id}">Löschen</button></div>` : ""}
    </article>`;
  }).join("");
}

async function loadEntries({ quiet = false } = {}) {
  if (!quiet) {
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `<span>✿</span><h4>Liste wird gedeckt …</h4><p>Einen kleinen Moment bitte.</p>`;
  }
  try {
    entries = await rpc("list_bbq_contributions");
    emptyState.innerHTML = `<span>✿</span><h4>Der Tisch ist noch leer</h4><p>Mach den Anfang und trag deine Leckerei ein.</p>`;
    render();
  } catch (error) {
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `<span>!</span><h4>Die Liste macht kurz Pause</h4><p>${escapeHtml(error.message)} Bitte lade die Seite noch einmal.</p>`;
  }
}

function openEditor(entry) {
  const own = editCredentials();
  if (!own.token || own.entryId !== entry.id) return;
  document.querySelector("#entryId").value = entry.id;
  document.querySelector("#editToken").value = own.token;
  document.querySelector("#name").value = entry.name;
  document.querySelector("#item").value = entry.item;
  document.querySelector("#note").value = entry.note || "";
  document.querySelector(`input[name="category"][value="${entry.category}"]`).checked = true;
  document.querySelector("#formTitle").textContent = "Beitrag bearbeiten";
  document.querySelector("#submitText").textContent = "Änderungen speichern";
  cancelEdit.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm() {
  form.reset();
  document.querySelector("#entryId").value = "";
  document.querySelector("#editToken").value = "";
  document.querySelector("#formTitle").textContent = "Zum Buffet beitragen";
  document.querySelector("#submitText").textContent = "Eintragen";
  cancelEdit.classList.add("hidden");
}

function setSubmitting(active) {
  const button = form.querySelector("button[type=submit]");
  button.disabled = active;
  button.style.opacity = active ? ".65" : "1";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const id = document.querySelector("#entryId").value;
  const editToken = document.querySelector("#editToken").value;
  const payload = {
    p_name: data.get("name").trim(), p_item: data.get("item").trim(),
    p_category: data.get("category"), p_note: data.get("note").trim(),
  };
  setSubmitting(true);
  try {
    if (id) {
      const updated = await rpc("update_bbq_contribution", { p_id: id, p_edit_token: editToken, ...payload });
      if (!updated) throw new Error("Der persönliche Bearbeitungslink ist nicht gültig.");
      resetForm(); await loadEntries({ quiet: true }); showToast("Änderungen gespeichert");
      return;
    }
    const newToken = token();
    const newId = await rpc("add_bbq_contribution", { ...payload, p_edit_token: newToken });
    const url = new URL(location.href);
    url.searchParams.set("edit", newToken);
    url.searchParams.set("entry", newId);
    url.hash = "mitbringen";
    history.replaceState({}, "", url);
    document.querySelector("#secretLink").value = url.toString();
    resetForm(); await loadEntries({ quiet: true }); dialog.showModal();
  } catch (error) { showToast(error.message); }
  finally { setSubmitting(false); }
});

list.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const entry = entries.find((item) => item.id === editButton.dataset.edit);
    if (entry) openEditor(entry);
    return;
  }
  const deleteButton = event.target.closest("[data-delete]");
  if (!deleteButton) return;
  const own = editCredentials();
  if (own.entryId !== deleteButton.dataset.delete || !own.token) return;
  if (!confirm("Möchtest du deinen Beitrag wirklich von der Liste löschen?")) return;
  deleteButton.disabled = true;
  try {
    const deleted = await rpc("delete_bbq_contribution", { p_id: own.entryId, p_edit_token: own.token });
    if (!deleted) throw new Error("Der Beitrag konnte nicht gelöscht werden.");
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("edit"); cleanUrl.searchParams.delete("entry");
    history.replaceState({}, "", cleanUrl);
    await loadEntries({ quiet: true }); showToast("Beitrag gelöscht");
  } catch (error) { showToast(error.message); deleteButton.disabled = false; }
});

cancelEdit.addEventListener("click", resetForm);
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
document.querySelector("#copyLink").addEventListener("click", async () => {
  const input = document.querySelector("#secretLink");
  try { await navigator.clipboard.writeText(input.value); showToast("Link kopiert"); }
  catch { input.select(); document.execCommand("copy"); showToast("Link kopiert"); }
});

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

async function loadWeather() {
  const eventDate = new Date("2026-08-08T12:00:00+02:00");
  const daysAway = Math.ceil((eventDate - new Date()) / 86400000);
  if (daysAway > 16 || daysAway < 0) return;
  try {
    const geo = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=Kapellen-Drusweiler&count=1&language=de&format=json").then(r => r.json());
    const place = geo.results?.[0]; if (!place) return;
    const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&start_date=2026-08-08&end_date=2026-08-08`).then(r => r.json());
    const max = Math.round(forecast.daily.temperature_2m_max[0]);
    const min = Math.round(forecast.daily.temperature_2m_min[0]);
    const rain = forecast.daily.precipitation_probability_max[0];
    document.querySelector("#weatherIcon").textContent = rain > 45 ? "☂" : "☀";
    document.querySelector("#weatherTitle").textContent = `${min}–${max} °C`;
    document.querySelector("#weatherText").textContent = `${rain} % Regenwahrscheinlichkeit · Prognose für Kapellen-Drusweiler`;
  } catch { /* Platzhalter bleibt sichtbar. */ }
}

loadEntries();
loadWeather();
