const SUPABASE_URL = "https://bmcrddfememxexwjcqcz.supabase.co";
const SUPABASE_KEY = "sb_publishable_xivSQJ7FQD-iF5NIECMc_Q_L-u9oWwy";

const bringForm = document.querySelector("#bringForm");
const bringList = document.querySelector("#bringList");
const bringEmptyState = document.querySelector("#emptyState");
const entryCount = document.querySelector("#entryCount");
const cancelEdit = document.querySelector("#cancelEdit");
const commentForm = document.querySelector("#commentForm");
const commentList = document.querySelector("#commentList");
const commentEmptyState = document.querySelector("#commentEmptyState");
const commentCount = document.querySelector("#commentCount");

let entries = [];
let comments = [];

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
    throw new Error(details.message || "Die Verbindung ist gerade fehlgeschlagen.");
  }

  return response.status === 204 ? null : response.json();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function formatCommentDate(value) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderEntries() {
  entryCount.textContent = entries.length;
  bringEmptyState.classList.toggle("hidden", entries.length > 0);
  bringList.innerHTML = entries.map((entry) => {
    const meta = categoryMeta[entry.category] || categoryMeta.Sonstiges;
    return `<article class="list-item">
      <span class="item-emoji">${meta.emoji}</span>
      <div>
        <h4>${escapeHtml(entry.item)}</h4>
        <p class="item-by">${escapeHtml(entry.name)} · ${meta.label}</p>
        ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
      </div>
      <div class="item-actions">
        <button class="edit-own" data-edit="${entry.id}">Bearbeiten</button>
        <button class="delete-own" data-delete="${entry.id}">Löschen</button>
      </div>
    </article>`;
  }).join("");
}

async function loadEntries({ quiet = false } = {}) {
  if (!quiet) {
    bringEmptyState.classList.remove("hidden");
    bringEmptyState.innerHTML = `<span>✿</span><h4>Liste wird gedeckt …</h4><p>Einen kleinen Moment bitte.</p>`;
  }

  try {
    entries = await rpc("list_bbq_contributions");
    bringEmptyState.innerHTML = `<span>✿</span><h4>Noch ist der Tisch leer.</h4><p>Mach den Anfang und trag etwas ein.</p>`;
    renderEntries();
  } catch (error) {
    bringEmptyState.classList.remove("hidden");
    bringEmptyState.innerHTML = `<span>!</span><h4>Die Liste macht kurz Pause</h4><p>${escapeHtml(error.message)} Bitte lade die Seite noch einmal.</p>`;
  }
}

function openEntryEditor(entry) {
  document.querySelector("#entryId").value = entry.id;
  document.querySelector("#name").value = entry.name;
  document.querySelector("#item").value = entry.item;
  document.querySelector(`input[name="category"][value="${entry.category}"]`).checked = true;
  document.querySelector("#formTitle").textContent = "Beitrag bearbeiten";
  document.querySelector("#submitText").textContent = "Änderungen speichern";
  cancelEdit.classList.remove("hidden");
  bringForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetEntryForm() {
  bringForm.reset();
  document.querySelector("#entryId").value = "";
  document.querySelector("#formTitle").textContent = "Was bringst du mit?";
  document.querySelector("#submitText").textContent = "Mitbringen";
  cancelEdit.classList.add("hidden");
}

function setFormBusy(form, active) {
  const button = form.querySelector("button[type=submit]");
  button.disabled = active;
  button.style.opacity = active ? ".65" : "1";
}

bringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(bringForm);
  const id = document.querySelector("#entryId").value;
  const payload = {
    p_name: data.get("name").trim(),
    p_item: data.get("item").trim(),
    p_category: data.get("category"),
    p_note: "",
  };

  setFormBusy(bringForm, true);
  try {
    if (id) {
      const updated = await rpc("update_bbq_contribution", { p_id: id, ...payload });
      if (!updated) throw new Error("Der Beitrag konnte nicht aktualisiert werden.");
      showToast("Änderungen gespeichert");
    } else {
      await rpc("add_bbq_contribution", payload);
      showToast("Steht auf der Liste!");
    }
    resetEntryForm();
    await loadEntries({ quiet: true });
  } catch (error) {
    showToast(error.message);
  } finally {
    setFormBusy(bringForm, false);
  }
});

bringList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const entry = entries.find((item) => item.id === editButton.dataset.edit);
    if (entry) openEntryEditor(entry);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (!deleteButton) return;
  if (!confirm("Möchtest du diesen Beitrag wirklich von der Liste löschen?")) return;

  deleteButton.disabled = true;
  try {
    const deleted = await rpc("delete_bbq_contribution", { p_id: deleteButton.dataset.delete });
    if (!deleted) throw new Error("Der Beitrag konnte nicht gelöscht werden.");
    await loadEntries({ quiet: true });
    showToast("Beitrag gelöscht");
  } catch (error) {
    showToast(error.message);
    deleteButton.disabled = false;
  }
});

cancelEdit.addEventListener("click", resetEntryForm);

function renderComments() {
  commentCount.textContent = comments.length;
  commentEmptyState.classList.toggle("hidden", comments.length > 0);
  commentList.innerHTML = comments.map((comment) => `
    <article class="comment-item">
      <div class="comment-avatar">${escapeHtml(comment.name.trim().charAt(0).toUpperCase())}</div>
      <div class="comment-bubble">
        <div class="comment-meta"><strong>${escapeHtml(comment.name)}</strong><span>${formatCommentDate(comment.created_at)}</span></div>
        <p>${escapeHtml(comment.message).replace(/\n/g, "<br>")}</p>
      </div>
      <button class="comment-delete" data-comment-delete="${comment.id}" aria-label="Nachricht von ${escapeHtml(comment.name)} löschen">×</button>
    </article>
  `).join("");
}

async function loadComments({ quiet = false } = {}) {
  if (!quiet) {
    commentEmptyState.classList.remove("hidden");
    commentEmptyState.innerHTML = `<span>✿</span><h4>Nachrichten werden geladen …</h4><p>Einen kleinen Moment bitte.</p>`;
  }

  try {
    comments = await rpc("list_bbq_comments");
    commentEmptyState.innerHTML = `<span>✿</span><h4>Noch herrscht Funkstille.</h4><p>Starte den Buschfunk mit der ersten Nachricht.</p>`;
    renderComments();
  } catch (error) {
    commentEmptyState.classList.remove("hidden");
    commentEmptyState.innerHTML = `<span>!</span><h4>Das Gästebuch macht kurz Pause</h4><p>${escapeHtml(error.message)} Bitte lade die Seite noch einmal.</p>`;
  }
}

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(commentForm);
  setFormBusy(commentForm, true);
  try {
    await rpc("add_bbq_comment", {
      p_name: data.get("name").trim(),
      p_message: data.get("message").trim(),
    });
    commentForm.reset();
    await loadComments({ quiet: true });
    showToast("Nachricht veröffentlicht");
  } catch (error) {
    showToast(error.message);
  } finally {
    setFormBusy(commentForm, false);
  }
});

commentList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-comment-delete]");
  if (!deleteButton) return;
  if (!confirm("Möchtest du diese Nachricht wirklich löschen?")) return;

  deleteButton.disabled = true;
  try {
    const deleted = await rpc("delete_bbq_comment", { p_id: deleteButton.dataset.commentDelete });
    if (!deleted) throw new Error("Die Nachricht konnte nicht gelöscht werden.");
    await loadComments({ quiet: true });
    showToast("Nachricht gelöscht");
  } catch (error) {
    showToast(error.message);
    deleteButton.disabled = false;
  }
});

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

async function loadWeather() {
  const eventDate = new Date("2026-08-08T12:00:00+02:00");
  const daysAway = Math.ceil((eventDate - new Date()) / 86400000);
  if (daysAway > 16 || daysAway < 0) return;

  try {
    const geo = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=Kapellen-Drusweiler&count=1&language=de&format=json").then((response) => response.json());
    const place = geo.results?.[0];
    if (!place) return;

    const forecast = await fetch(`${"https://api.open-meteo.com/v1/forecast"}?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin&start_date=2026-08-08&end_date=2026-08-08`).then((response) => response.json());
    const max = Math.round(forecast.daily.temperature_2m_max[0]);
    const min = Math.round(forecast.daily.temperature_2m_min[0]);
    const rain = forecast.daily.precipitation_probability_max[0];

    document.querySelector("#weatherTitle").textContent = `${min}–${max} °C`;
    document.querySelector("#weatherText").textContent = `${rain} % Regenwahrscheinlichkeit · Prognose für Kapellen-Drusweiler`;
  } catch {
    // Der freundliche Platzhalter bleibt sichtbar.
  }
}

loadEntries();
loadComments();
loadWeather();
