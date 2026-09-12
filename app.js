const KEY = "puntomx_reports_v1";

let reports = JSON.parse(localStorage.getItem(KEY) || "[]");
let loc = null;
let map = null;
let markers = [];

const $ = id => document.getElementById(id);

function save() {
  localStorage.setItem(KEY, JSON.stringify(reports));
}

function esc(s) {
  return (s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

/* =========================
   MAPA
========================= */

function initMap() {

  const mapElement = $("map");

  if (!mapElement) {
    console.error("No existe el elemento #map");
    return;
  }

  if (typeof L === "undefined") {
    mapElement.innerHTML =
      "<div style='padding:30px;text-align:center;font-weight:bold'>" +
      "No se pudo cargar el mapa. Comprueba tu conexión a Internet." +
      "</div>";

    console.error("Leaflet no está disponible");
    return;
  }

  try {

    map = L.map("map", {
      zoomControl: true
    }).setView([23.6345, -102.5528], 5);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 500);

    markersRender();

    console.log("PuntoMX: mapa iniciado correctamente");

  } catch (error) {

    console.error("Error iniciando mapa:", error);

    mapElement.innerHTML =
      "<div style='padding:30px;text-align:center'>" +
      "<b>Error al cargar el mapa.</b><br><br>" +
      error.message +
      "</div>";
  }
}

/* =========================
   ESTADÍSTICAS
========================= */

function stats() {

  $("totalCount").textContent = reports.length;

  $("pendingCount").textContent =
    reports.filter(r => r.status === "Pendiente").length;

  $("resolvedCount").textContent =
    reports.filter(r => r.status === "Resuelto").length;
}

/* =========================
   MARCADORES
========================= */

function markersRender() {

  if (!map) return;

  markers.forEach(marker => marker.remove());

  markers = [];

  reports.forEach(report => {

    if (
      typeof report.lat === "number" &&
      typeof report.lng === "number"
    ) {

      const marker = L.marker([
        report.lat,
        report.lng
      ])
      .addTo(map)
      .bindPopup(
        "<b>" +
        esc(report.type) +
        "</b><br>" +
        esc(report.description) +
        "<br>" +
        report.status
      );

      markers.push(marker);
    }
  });
}

/* =========================
   REPORTES
========================= */

function reportsRender() {

  stats();

  if (!reports.length) {

    $("reports").innerHTML =
      "<p style='text-align:center;color:#64748b'>" +
      "Todavía no tienes reportes." +
      "</p>";

    return;
  }

  $("reports").innerHTML = reports
    .slice()
    .reverse()
    .map(report => {

      const lat =
        typeof report.lat === "number"
          ? report.lat.toFixed(5)
          : "—";

      const lng =
        typeof report.lng === "number"
          ? report.lng.toFixed(5)
          : "—";

      return `
        <article
          class="report-card"
          onclick="detail('${report.id}')"
        >
          <b>${esc(report.type)}</b>

          <div class="report-meta">
            ${new Date(report.createdAt).toLocaleString("es-MX")}
            · ${lat}, ${lng}
          </div>

          <span class="badge pending">
            ${report.status}
          </span>
        </article>
      `;
    })
    .join("");
}

/* =========================
   GPS
========================= */

function gps() {

  $("locationStatus").textContent =
    "Solicitando GPS…";

  if (!navigator.geolocation) {

    $("locationStatus").textContent =
      "Este dispositivo no permite GPS.";

    return;
  }

  navigator.geolocation.getCurrentPosition(

    position => {

      loc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      $("locationStatus").textContent =
        `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)} ` +
        `(±${Math.round(loc.accuracy)} m)`;

      if (map) {

        map.setView(
          [loc.lat, loc.lng],
          17
        );

        L.marker([
          loc.lat,
          loc.lng
        ])
        .addTo(map)
        .bindPopup("Tu ubicación")
        .openPopup();
      }
    },

    error => {

      $("locationStatus").textContent =
        "No se pudo obtener GPS: " +
        error.message;
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

/* =========================
   INICIO
========================= */

window.addEventListener("DOMContentLoaded", () => {

  console.log("PuntoMX iniciando...");

  initMap();

  reportsRender();

  $("newReportBtn").onclick = () => {

    $("modal").classList.remove("hidden");

    gps();
  };

  $("closeModal").onclick = () => {
    $("modal").classList.add("hidden");
  };

  $("getLocation").onclick = gps;

  $("locateBtn").onclick = gps;

  $("clearBtn").onclick = () => {

    if (confirm("¿Borrar todos los reportes del piloto?")) {

      reports = [];

      save();

      reportsRender();

      markersRender();
    }
  };

  $("photo").onchange = () => {

    const file = $("photo").files[0];

    if (!file) return;

    $("preview").innerHTML =
      `<img src="${URL.createObjectURL(file)}"
            style="max-width:100%;border-radius:12px;margin-top:8px;">`;
  };

  $("video").onchange = () => {

    const file = $("video").files[0];

    if (!file) return;

    const url = URL.createObjectURL(file);

    const video = document.createElement("video");

    video.preload = "metadata";

    video.src = url;

    video.onloadedmetadata = () => {

      if (video.duration > 10.05) {

        alert(
          "El video debe durar máximo 10 segundos."
        );

        $("video").value = "";

        return;
      }

      $("preview").innerHTML =
        `<video
          controls
          src="${url}"
          style="max-width:100%;max-height:240px;border-radius:12px;margin-top:8px;">
        </video>`;
    };
  };

  $("reportForm").onsubmit = event => {

    event.preventDefault();

    if (!loc) {

      alert("Obtén la ubicación GPS antes de publicar.");

      return;
    }

    const report = {

      id:
        "MX-" +
        Date.now().toString().slice(-8),

      type:
        $("type").value,

      description:
        $("description").value,

      lat:
        loc.lat,

      lng:
        loc.lng,

      accuracy:
        loc.accuracy,

      status:
        "Pendiente",

      createdAt:
        new Date().toISOString(),

      photoName:
        $("photo").files[0]?.name || null,

      videoName:
        $("video").files[0]?.name || null
    };

    reports.push(report);

    save();

    reportsRender();

    markersRender();

    event.target.reset();

    loc = null;

    $("preview").innerHTML = "";

    $("locationStatus").textContent =
      "Aún no obtenida";

    $("modal").classList.add("hidden");

    alert(
      "Reporte " +
      report.id +
      " creado correctamente."
    );
  };

  window.detail = id => {

    const report =
      reports.find(r => r.id === id);

    if (!report) return;

    $("detail").innerHTML = `
      <p><b>ID:</b> ${report.id}</p>
      <p><b>Tipo:</b> ${esc(report.type)}</p>
      <p><b>Descripción:</b> ${esc(report.description)}</p>
      <p><b>GPS:</b>
        ${report.lat.toFixed(6)},
        ${report.lng.toFixed(6)}
      </p>
      <p><b>Estado:</b> ${report.status}</p>
    `;

    $("detailModal").classList.remove("hidden");
  };

  $("closeDetail").onclick = () => {
    $("detailModal").classList.add("hidden");
  };

});
