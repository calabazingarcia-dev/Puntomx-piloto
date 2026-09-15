const SUPABASE_URL = "https://tjqdpvltjpvknvsvtqur.supabase.co";
const SUPABASE_KEY = "sb_publishable_S2hNm3j2F_08I8aFQXwzog_TA82P26h";

const REPORTS_API = `${SUPABASE_URL}/rest/v1/reports`;
const STORAGE_API = `${SUPABASE_URL}/storage/v1/object`;
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/reports`;

let map;
let markersLayer;
let currentLocation = null;
let selectedPhoto = null;
let selectedVideo = null;
let reports = [];

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

function formatDate(date) {
  try {
    return new Date(date).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return date || "";
  }
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
   CARGAR REPORTES
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

    marker.bindPopup(createPopupContent(report), {
      maxWidth: 320
    });

    marker.addTo(markersLayer);
  });
}

/* =========================
   CONTENIDO DEL MARCADOR
========================= */

function createPopupContent(report) {
  const type = escapeHtml(report.type || "Problema reportado");
  const description = escapeHtml(
    report.description || "Sin descripción."
  );

  const status = escapeHtml(report.status || "Pendiente");
  const code = escapeHtml(report.report_code || "");

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
          <source src="${escapeHtml(report.video_url)}">
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
        💡 ${type}
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

      <div style="
        font-size:12px;
        color:#666;
        margin-top:3px;
      ">
        ${formatDate(report.created_at)}
      </div>

      ${media}

    </div>
  `;
}

/* =========================
   VISUALIZAR FOTO
========================= */

function openMedia(url, type) {
  const existing = document.getElementById("mediaViewer");

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
        cursor:pointer;
      "
    >

      ${
        type === "video"
          ? `
            <video
              controls
              autoplay
              playsinline
              style="
                max-width:95%;
                max-height:90%;
                border-radius:12px;
              "
              onclick="event.stopPropagation()"
            >
              <source src="${escapeHtml(url)}">
            </video>
          `
          : `
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
          `
      }

    </div>
  `;

  document.body.appendChild(viewer);
}

function closeMediaViewer() {
  const viewer = document.getElementById("mediaViewer");

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

  const totalElement = $("totalReports");
  const pendingElement = $("pendingReports");
  const resolvedElement = $("resolvedReports");

  if (totalElement) {
    totalElement.textContent = total;
  }

  if (pendingElement) {
    pendingElement.textContent = pending;
  }

  if (resolvedElement) {
    resolvedElement.textContent = resolved;
  }
}

/* =========================
   GPS
========================= */

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no permite obtener GPS."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
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
   MODAL DE REPORTE
========================= */

function openReportForm() {
  const modal = $("reportModal");

  if (!modal) {
    console.error("No se encontró reportModal.");
    return;
  }

  modal.style.display = "flex";

  selectedPhoto = null;
  selectedVideo = null;

  const photoInput = $("photoInput");
  const videoInput = $("videoInput");

  if (photoInput) photoInput.value = "";
  if (videoInput) videoInput.value = "";

  const photoPreview = $("photoPreview");
  const videoPreview = $("videoPreview");

  if (photoPreview) {
    photoPreview.innerHTML = "";
  }

  if (videoPreview) {
    videoPreview.innerHTML = "";
  }

  getLocation()
    .then(location => {
      const gpsElement = $("gpsStatus");

      if (gpsElement) {
        gpsElement.textContent =
          `📍 Ubicación obtenida ±${Math.round(location.accuracy)} m`;
      }

      const lat = $("latitude");
      const lng = $("longitude");

      if (lat) lat.value = location.latitude;
      if (lng) lng.value = location.longitude;

    })
    .catch(error => {
      console.error(error);

      const gpsElement = $("gpsStatus");

      if (gpsElement) {
        gpsElement.textContent =
          "⚠️ No se pudo obtener la ubicación.";
      }
    });
}

function closeReportForm() {
  const modal = $("reportModal");

  if (modal) {
    modal.style.display = "none";
  }
}

/* =========================
   FOTO
========================= */

function handlePhoto(event) {
  const file = event.target.files[0];

  if (!file) return;

  selectedPhoto = file;

  const preview = $("photoPreview");

  if (!preview) return;

  const url = URL.createObjectURL(file);

  preview.innerHTML = `
    <img
      src="${url}"
      style="
        width:100%;
        max-height:220px;
        object-fit:cover;
        border-radius:10px;
        margin-top:8px;
      "
    >
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

      const preview = $("videoPreview");

      if (preview) {
        preview.innerHTML = "";
      }

      selectedVideo = null;

      return;
    }

    selectedVideo = file;

    const preview = $("videoPreview");

    if (preview) {
      const url = URL.createObjectURL(file);

      preview.innerHTML = `
        <video
          controls
          playsinline
          style="
            width:100%;
            max-height:220px;
            border-radius:10px;
            margin-top:8px;
          "
        >
          <source src="${url}">
        </video>

        <div style="
          font-size:12px;
          margin-top:4px;
          color:#666;
        ">
          Video válido: máximo 10 segundos.
        </div>
      `;
    }
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

async function uploadFile(file, reportCode, prefix) {
  if (!file) return null;

  const extension =
    file.name.includes(".")
      ? file.name.substring(file.name.lastIndexOf("."))
      : "";

  const filename =
    `${reportCode}/${prefix}_${Date.now()}${extension}`;

  const url =
    `${STORAGE_API}/reports/${filename}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!response.ok) {
    const errorText = await response.text();

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
   CREAR REPORTE
========================= */

async function publishReport() {
  const typeElement = $("reportType");
  const descriptionElement = $("description");

  const type =
    typeElement?.value || "Problema ciudadano";

  const description =
    descriptionElement?.value?.trim() || "";

  const latitude =
    parseFloat($("latitude")?.value);

  const longitude =
    parseFloat($("longitude")?.value);

  const accuracy =
    parseFloat($("gpsAccuracy")?.value || "0");

  if (!Number.isFinite(latitude) ||
      !Number.isFinite(longitude)) {

    alert(
      "Primero necesitamos obtener tu ubicación GPS."
    );

    return;
  }

  if (!selectedPhoto && !selectedVideo) {
    alert(
      "Agrega una fotografía o un video como evidencia."
    );

    return;
  }

  const reportCode = generateReportCode();

  try {

    showPublishingMessage(
      "Publicando reporte..."
    );

    let photoUrl = null;
    let videoUrl = null;

    if (selectedPhoto) {
      showPublishingMessage(
        "Subiendo fotografía..."
      );

      photoUrl = await uploadFile(
        selectedPhoto,
        reportCode,
        "foto"
      );
    }

    if (selectedVideo) {
      showPublishingMessage(
        "Subiendo video..."
      );

      videoUrl = await uploadFile(
        selectedVideo,
        reportCode,
        "video"
      );
    }

    showPublishingMessage(
      "Guardando reporte..."
    );

    const body = {
      report_code: reportCode,
      type: type,
      description: description,
      latitude: latitude,
      longitude: longitude,
      gps_accuracy: Number.isFinite(accuracy)
        ? accuracy
        : null,
      photo_url: photoUrl,
      video_url: videoUrl,
      status: "Pendiente"
    };

    const response = await fetch(REPORTS_API, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Error creando reporte:",
        response.status,
        errorText
      );

      throw new Error(
        `Error guardando reporte (${response.status})`
      );
    }

    const created = await response.json();

    closeReportForm();

    alert(
      `Reporte ${reportCode} creado correctamente.`
    );

    if (created && created[0]) {
      reports.unshift(created[0]);
    } else {
      await loadReports();
    }

    renderReports();
    updateStats();

    if (map) {
      map.setView(
        [latitude, longitude],
        16
      );
    }

  } catch (error) {

    console.error(
      "ERROR COMPLETO AL PUBLICAR:",
      error
    );

    alert(
      "Hubo un error al publicar el reporte.\n\n" +
      error.message
    );

  } finally {
    hidePublishingMessage();
  }
}

/* =========================
   MENSAJE DE PUBLICACIÓN
========================= */

function showPublishingMessage(message) {
  let element = $("publishingMessage");

  if (!element) {
    element = document.createElement("div");

    element.id = "publishingMessage";

    element.style.position = "fixed";
    element.style.left = "50%";
    element.style.top = "50%";
    element.style.transform = "translate(-50%, -50%)";
    element.style.background = "rgba(0,0,0,.85)";
    element.style.color = "white";
    element.style.padding = "20px 25px";
    element.style.borderRadius = "12px";
    element.style.zIndex = "100000";
    element.style.fontSize = "16px";
    element.style.textAlign = "center";
    element.style.maxWidth = "80%";

    document.body.appendChild(element);
  }

  element.textContent = message;
  element.style.display = "block";
}

function hidePublishingMessage() {
  const element = $("publishingMessage");

  if (element) {
    element.style.display = "none";
  }
}

/* =========================
   BOTONES / EVENTOS
========================= */

function setupEvents() {

  const reportButton = $("reportButton");

  if (reportButton) {
    reportButton.addEventListener(
      "click",
      openReportForm
    );
  }

  const closeButton = $("closeReportModal");

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      closeReportForm
    );
  }

  const cancelButton = $("cancelReport");

  if (cancelButton) {
    cancelButton.addEventListener(
      "click",
      closeReportForm
    );
  }

  const publishButton = $("publishReport");

  if (publishButton) {
    publishButton.addEventListener(
      "click",
      publishReport
    );
  }

  const photoInput = $("photoInput");

  if (photoInput) {
    photoInput.addEventListener(
      "change",
      handlePhoto
    );
  }

  const videoInput = $("videoInput");

  if (videoInput) {
    videoInput.addEventListener(
      "change",
      handleVideo
    );
  }

  const locateButton = $("locateButton");

  if (locateButton) {
    locateButton.addEventListener(
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
  }
}

/* =========================
   INICIALIZACIÓN
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
