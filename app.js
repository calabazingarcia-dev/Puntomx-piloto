const SUPABASE_URL = "https://tjqdpvltjpvknvsvtqur.supabase.co";
const SUPABASE_KEY = "sb_publishable_S2hNm3j2F_08I8aFQXwzog_TA82P26h";

const REPORTS_API = `${SUPABASE_URL}/rest/v1/reports`;
const STORAGE_API = `${SUPABASE_URL}/storage/v1/object`;
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/reports`;

let map;
let markersLayer;
let reports = [];
let currentLocation = null;
let selectedPhoto = null;
let selectedVideo = null;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateReportCode() {
  return "MX-" + Math.floor(10000000 + Math.random() * 90000000);
}

/* =========================
   MAPA
========================= */

function initMap() {
  if (typeof L === "undefined") {
    console.error("Leaflet no está cargado.");
    return;
  }

  map = L.map("map").setView([23.6345, -102.5528], 5);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }
  ).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

/* =========================
   REPORTES
========================= */

async function loadReports() {
  try {
    const response = await fetch(
      `${REPORTS_API}?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    reports = await response.json();

    renderReports();
    updateStats();
    renderReportList();

  } catch (error) {
    console.error("Error cargando reportes:", error);
  }
}

/* =========================
   MARCADORES
========================= */

function renderReports() {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();

  reports.forEach(report => {

    if (
      typeof report.latitude !== "number" ||
      typeof report.longitude !== "number"
    ) {
      return;
    }

    const marker = L.marker([
      report.latitude,
      report.longitude
    ]);

    marker.bindPopup(
      createPopupContent(report),
      {
        maxWidth: 320
      }
    );

    marker.addTo(markersLayer);
  });
}

/* =========================
   POPUP
========================= */

function createPopupContent(report) {

  const type = escapeHtml(
    report.type || "Problema reportado"
  );

  const description = escapeHtml(
    report.description || "Sin descripción."
  );

  const status = escapeHtml(
    report.status || "Pendiente"
  );

  const code = escapeHtml(
    report.report_code || ""
  );

  let media = "";

  if (report.photo_url) {

    media += `
      <div style="margin-top:10px;">

        <img
          src="${escapeHtml(report.photo_url)}"
          alt="Evidencia fotográfica"
          style="
            width:100%;
            max-height:220px;
            object-fit:cover;
            border-radius:10px;
            display:block;
            cursor:pointer;
          "
          onclick="openMedia('${escapeHtml(report.photo_url)}','photo')"
        >

      </div>
    `;
  }

  if (report.video_url) {

    media += `
      <div style="margin-top:10px;">

        <video
          controls
          playsinline
          preload="metadata"
          style="
            width:100%;
            max-height:220px;
            border-radius:10px;
            display:block;
          "
        >

          <source
            src="${escapeHtml(report.video_url)}"
          >

          Tu navegador no puede reproducir este video.

        </video>

      </div>
    `;
  }

  return `
    <div style="
      font-family:Arial,sans-serif;
      min-width:230px;
      max-width:300px;
    ">

      <div style="
        font-size:17px;
        font-weight:bold;
        margin-bottom:7px;
      ">
        ${type}
      </div>

      <div style="
        margin-bottom:8px;
        line-height:1.4;
      ">
        ${description}
      </div>

      <div style="
        font-size:13px;
        margin-top:6px;
      ">
        <strong>Estado:</strong> ${status}
      </div>

      <div style="
        font-size:12px;
        color:#666;
        margin-top:5px;
      ">
        <strong>Reporte:</strong> ${code}
      </div>

      ${media}

    </div>
  `;
}

/* =========================
   FOTO GRANDE
========================= */

function openMedia(url, type) {

  const existing = $("mediaViewer");

  if (existing) {
    existing.remove();
  }

  const viewer = document.createElement("div");

  viewer.id = "mediaViewer";

  viewer.innerHTML = `
    <div
      onclick="closeMediaViewer()"
      style="
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.85);
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
      "
    >

      <img
        src="${escapeHtml(url)}"
        style="
          max-width:95%;
          max-height:90%;
          object-fit:contain;
          border-radius:12px;
        "
        onclick="event.stopPropagation()"
      >

    </div>
  `;

  document.body.appendChild(viewer);
}

function closeMediaViewer() {

  const viewer = $("mediaViewer");

  if (viewer) {
    viewer.remove();
  }
}

/* =========================
   ESTADÍSTICAS
========================= */

function updateStats() {

  const total = reports.length;

  const pending = reports.filter(
    r => (r.status || "Pendiente") === "Pendiente"
  ).length;

  const resolved = reports.filter(
    r => (r.status || "") === "Resuelto"
  ).length;

  if ($("totalCount")) {
    $("totalCount").textContent = total;
  }

  if ($("pendingCount")) {
    $("pendingCount").textContent = pending;
  }

  if ($("resolvedCount")) {
    $("resolvedCount").textContent = resolved;
  }
}

/* =========================
   LISTA DE REPORTES
========================= */

function renderReportList() {

  const container = $("reports");

  if (!container) return;

  if (reports.length === 0) {

    container.innerHTML = `
      <div style="
        padding:20px;
        text-align:center;
        color:#666;
      ">
        Todavía no hay reportes.
      </div>
    `;

    return;
  }

  container.innerHTML = reports.map(report => {

    return `
      <div style="
        border:1px solid #ddd;
        border-radius:10px;
        padding:12px;
        margin-bottom:10px;
      ">

        <strong>
          ${escapeHtml(report.type)}
        </strong>

        <div style="
          font-size:13px;
          margin-top:5px;
        ">
          ${escapeHtml(report.description || "")}
        </div>

        <div style="
          font-size:12px;
          color:#666;
          margin-top:6px;
        ">
          ${escapeHtml(report.report_code)}
          ·
          ${escapeHtml(report.status || "Pendiente")}
        </div>

      </div>
    `;

  }).join("");
}

/* =========================
   GPS
========================= */

function getLocation() {

  return new Promise((resolve, reject) => {

    if (!navigator.geolocation) {

      reject(
        new Error(
          "Este dispositivo no permite obtener GPS."
        )
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(

      position => {

        currentLocation = {

          latitude:
            position.coords.latitude,

          longitude:
            position.coords.longitude,

          accuracy:
            position.coords.accuracy

        };

        resolve(currentLocation);
      },

      error => {
        reject(error);
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

/* =========================
   ABRIR FORMULARIO
========================= */

function openReportForm() {

  $("modal").classList.remove("hidden");

  selectedPhoto = null;
  selectedVideo = null;

  $("photo").value = "";
  $("video").value = "";

  $("preview").innerHTML = "";

  $("locationStatus").textContent =
    "Obteniendo ubicación...";

  getLocation()

    .then(location => {

      currentLocation = location;

      $("locationStatus").textContent =
        `📍 Ubicación obtenida ±${Math.round(location.accuracy)} m`;

    })

    .catch(error => {

      console.error(error);

      $("locationStatus").textContent =
        "⚠️ No se pudo obtener la ubicación.";

    });
}

function closeReportForm() {

  $("modal").classList.add("hidden");
}

/* =========================
   FOTO
========================= */

function handlePhoto(event) {

  const file = event.target.files[0];

  if (!file) return;

  selectedPhoto = file;

  const url = URL.createObjectURL(file);

  $("preview").innerHTML = `
    <div style="margin-top:10px;">

      <img
        src="${url}"
        style="
          width:100%;
          max-height:220px;
          object-fit:cover;
          border-radius:10px;
        "
      >

    </div>
  `;
}

/* =========================
   VIDEO
========================= */

function handleVideo(event) {

  const file = event.target.files[0];

  if (!file) return;

  selectedVideo = null;

  const video = document.createElement("video");

  video.preload = "metadata";

  video.onloadedmetadata = () => {

    URL.revokeObjectURL(video.src);

    if (video.duration > 10.05) {

      alert(
        "El video no puede durar más de 10 segundos."
      );

      event.target.value = "";

      selectedVideo = null;

      return;
    }

    selectedVideo = file;

    const url = URL.createObjectURL(file);

    $("preview").innerHTML += `
      <div style="margin-top:10px;">

        <video
          controls
          playsinline
          style="
            width:100%;
            max-height:220px;
            border-radius:10px;
          "
        >

          <source src="${url}">

        </video>

      </div>
    `;
  };

  video.onerror = () => {

    alert(
      "No fue posible comprobar la duración del video."
    );

    event.target.value = "";

    selectedVideo = null;
  };

  video.src = URL.createObjectURL(file);
}

/* =========================
   SUBIR ARCHIVO
========================= */

async function uploadFile(
  file,
  reportCode,
  prefix
) {

  if (!file) return null;

  const extension =
    file.name.includes(".")
      ? file.name.substring(
          file.name.lastIndexOf(".")
        )
      : "";

  const filename =
    `${reportCode}/${prefix}_${Date.now()}${extension}`;

  const url =
    `${STORAGE_API}/reports/${filename}`;

  const response = await fetch(
    url,
    {
      method: "POST",

      headers: {
        apikey: SUPABASE_KEY,
        Authorization:
          `Bearer ${SUPABASE_KEY}`,

        "Content-Type":
          file.type ||
          "application/octet-stream"
      },

      body: file
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    console.error(
      "Error subiendo archivo:",
      response.status,
      errorText
    );

    throw new Error(
      `Error al subir evidencia (${response.status})`
    );
  }

  return `${STORAGE_PUBLIC}/${filename}`;
}

/* =========================
   PUBLICAR REPORTE
========================= */

async function publishReport() {

  const type =
    $("type").value;

  const description =
    $("description").value.trim();

  if (!type) {

    alert(
      "Selecciona el tipo de problema."
    );

    return;
  }

  if (!description) {

    alert(
      "Escribe una descripción."
    );

    return;
  }

  if (!currentLocation) {

    alert(
      "Primero obtén la ubicación GPS."
    );

    return;
  }

  if (!selectedPhoto &&
      !selectedVideo) {

    alert(
      "Agrega una fotografía o un video."
    );

    return;
  }

  const reportCode =
    generateReportCode();

  const publishButton =
    $("reportForm").querySelector(
      'button[type="submit"]'
    );

  if (publishButton) {
    publishButton.disabled = true;
    publishButton.textContent =
      "Publicando...";
  }

  try {

    let photoUrl = null;
    let videoUrl = null;

    /* FOTO */

    if (selectedPhoto) {

      photoUrl =
        await uploadFile(
          selectedPhoto,
          reportCode,
          "foto"
        );
    }

    /* VIDEO */

    if (selectedVideo) {

      videoUrl =
        await uploadFile(
          selectedVideo,
          reportCode,
          "video"
        );
    }

    /* BASE DE DATOS */

    const body = {

      report_code:
        reportCode,

      type:
        type,

      description:
        description,

      latitude:
        currentLocation.latitude,

      longitude:
        currentLocation.longitude,

      gps_accuracy:
        currentLocation.accuracy,

      photo_url:
        photoUrl,

      video_url:
        videoUrl,

      status:
        "Pendiente"
    };

    const response =
      await fetch(
        REPORTS_API,
        {
          method: "POST",

          headers: {

            apikey:
              SUPABASE_KEY,

            Authorization:
              `Bearer ${SUPABASE_KEY}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation"
          },

          body:
            JSON.stringify(body)
        }
      );

    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        "Error creando reporte:",
        response.status,
        errorText
      );

      throw new Error(
        `Error guardando reporte (${response.status})`
      );
    }

    const created =
      await response.json();

    closeReportForm();

    $("reportForm").reset();

    currentLocation = null;
    selectedPhoto = null;
    selectedVideo = null;

    $("preview").innerHTML = "";

    $("locationStatus").textContent =
      "Aún no obtenida";

    if (created && created[0]) {

      reports.unshift(
        created[0]
      );

    } else {

      await loadReports();

    }

    renderReports();
    renderReportList();
    updateStats();

    if (map) {

      map.setView(
        [
          body.latitude,
          body.longitude
        ],
        16
      );

    }

    alert(
      `Reporte ${reportCode} creado correctamente.`
    );

  } catch (error) {

    console.error(
      "ERROR COMPLETO:",
      error
    );

    alert(
      "Hubo un error al publicar el reporte.\n\n" +
      error.message
    );

  } finally {

    if (publishButton) {

      publishButton.disabled = false;

      publishButton.textContent =
        "Publicar reporte";
    }
  }
}

/* =========================
   EVENTOS
========================= */

function setupEvents() {

  /* NUEVO REPORTE */

  $("newReportBtn")
    .addEventListener(
      "click",
      openReportForm
    );

  /* CERRAR MODAL */

  $("closeModal")
    .addEventListener(
      "click",
      closeReportForm
    );

  /* GPS */

  $("getLocation")
    .addEventListener(
      "click",
      async () => {

        $("locationStatus").textContent =
          "Obteniendo ubicación...";

        try {

          const location =
            await getLocation();

          currentLocation =
            location;

          $("locationStatus").textContent =
            `📍 Ubicación obtenida ±${Math.round(location.accuracy)} m`;

        } catch (error) {

          console.error(error);

          $("locationStatus").textContent =
            "⚠️ No se pudo obtener la ubicación.";
        }
      }
    );

  /* FOTO */

  $("photo")
    .addEventListener(
      "change",
      handlePhoto
    );

  /* VIDEO */

  $("video")
    .addEventListener(
      "change",
      handleVideo
    );

  /* FORMULARIO */

  $("reportForm")
    .addEventListener(
      "submit",
      event => {

        event.preventDefault();

        publishReport();
      }
    );

  /* UBICACIÓN DEL ENCABEZADO */

  $("locateBtn")
    .addEventListener(
      "click",
      async () => {

        try {

          const location =
            await getLocation();

          if (map) {

            map.setView(
              [
                location.latitude,
                location.longitude
              ],
              17
            );

            L.circleMarker(
              [
                location.latitude,
                location.longitude
              ],
              {
                radius: 8
              }
            )
              .addTo(map)
              .bindPopup(
                "📍 Tu ubicación"
              )
              .openPopup();
          }

        } catch (error) {

          alert(
            "No se pudo obtener tu ubicación."
          );
        }
      }
    );

  /* CERRAR DETALLE */

  if ($("closeDetail")) {

    $("closeDetail")
      .addEventListener(
        "click",
        () => {
          $("detailModal")
            .classList
            .add("hidden");
        }
      );
  }
}

/* =========================
   INICIAR
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    console.log(
      "PuntoMX iniciando..."
    );

    initMap();

    setupEvents();

    await loadReports();

    console.log(
      "PuntoMX listo."
    );
  }
);
