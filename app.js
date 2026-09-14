// PuntoMX — conexión con Supabase

const SUPABASE_URL = "https://tjqdpvltjpvknvsvtqur.supabase.co";
const SUPABASE_KEY = "sb_publishable_S2hNm3j2F_08I8aFQXwzog_TA82P26h";

const REPORTS_API = `${SUPABASE_URL}/rest/v1/reports`;
const STORAGE_API = `${SUPABASE_URL}/storage/v1/object`;
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/reports`;

let reports = [];
let loc = null;
let map = null;
let markers = [];

const $ = id => document.getElementById(id);

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
};

const jsonHeaders = {
  ...headers,
  "Content-Type": "application/json"
};

function esc(s) {
  return (s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function cls(s) {
  return s === "Resuelto" ? "resolved" :
         s === "En proceso" ? "progress" : "pending";
}

function stats() {
  $("totalCount").textContent = reports.length;

  $("pendingCount").textContent =
    reports.filter(r => r.status === "Pendiente").length;

  $("resolvedCount").textContent =
    reports.filter(r => r.status === "Resuelto").length;
}

function markersRender() {
  markers.forEach(m => m.remove());
  markers = [];

  reports.forEach(r => {
    if (r.latitude != null && r.longitude != null) {

      const m = L.marker([
        r.latitude,
        r.longitude
      ])
      .addTo(map)
      .bindPopup(
        "<b>" + esc(r.type) + "</b><br>" +
        esc(r.description || "") +
        "<br>" +
        esc(r.status)
      );

      markers.push(m);
    }
  });
}

function reportsRender() {
  stats();

  $("reports").innerHTML = reports.length
    ? reports.slice().reverse().map(r => `
        <article
          class="report-card"
          onclick="detail('${esc(r.report_code)}')"
        >
          <b>${esc(r.type)}</b>

          <div class="report-meta">
            ${new Date(r.created_at).toLocaleString("es-MX")}
            ·
            ${Number(r.latitude).toFixed(5)},
            ${Number(r.longitude).toFixed(5)}
          </div>

          <span class="badge ${cls(r.status)}">
            ${esc(r.status)}
          </span>
        </article>
      `).join("")

    : '<p style="text-align:center;color:#64748b">Todavía no tienes reportes.</p>';
}

async function loadReports() {
  try {

    const response = await fetch(
      `${REPORTS_API}?select=*&order=created_at.desc`,
      {
        headers
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    reports = await response.json();

    reportsRender();
    markersRender();

  } catch (error) {

    console.error("Error cargando reportes:", error);

    $("reports").innerHTML =
      '<p style="text-align:center;color:#991b1b">No se pudieron cargar los reportes.</p>';
  }
}

function gps() {

  $("locationStatus").textContent =
    "Solicitando GPS…";

  if (!navigator.geolocation) {

    $("locationStatus").textContent =
      "Este dispositivo no permite GPS.";

    return;
  }

  navigator.geolocation.getCurrentPosition(

    p => {

      loc = {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy
      };

      $("locationStatus").textContent =
        `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)} (±${Math.round(loc.accuracy)} m)`;

      map.setView(
        [loc.lat, loc.lng],
        17
      );
    },

    e => {

      $("locationStatus").textContent =
        "No se pudo obtener GPS: " +
        e.message;
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function makeReportCode() {

  return "MX-" +
    Date.now()
      .toString()
      .slice(-8);
}

function safeFileName(name) {

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadFile(
  file,
  reportCode,
  type
) {

  if (!file) return null;

  const extension =
    safeFileName(file.name)
      .split(".")
      .pop() || "bin";

  const filename =
    `${reportCode}/${type}_${Date.now()}.${extension}`;

  const response = await fetch(
    `${STORAGE_API}/reports/${filename}`,
    {
      method: "POST",

      headers: {
        ...headers,

        "Content-Type":
          file.type ||
          "application/octet-stream",

        "x-upsert": "false"
      },

      body: file
    }
  );

  if (!response.ok) {

    const message =
      await response.text();

    throw new Error(
      `Error subiendo ${type}: ${message}`
    );
  }

  return `${STORAGE_PUBLIC}/${filename}`;
}

async function createReport(report) {

  const response = await fetch(
    REPORTS_API,
    {
      method: "POST",

      headers: {
        ...jsonHeaders,

        "Prefer":
          "return=representation"
      },

      body: JSON.stringify(report)
    }
  );

  if (!response.ok) {

    throw new Error(
      await response.text()
    );
  }

  const data =
    await response.json();

  return data[0];
}

function resetForm() {

  $("reportForm").reset();

  $("preview").innerHTML = "";

  $("locationStatus").textContent =
    "Aún no obtenida";

  loc = null;
}

function getVideoDuration(file) {

  return new Promise((resolve, reject) => {

    const url =
      URL.createObjectURL(file);

    const video =
      document.createElement("video");

    video.preload = "metadata";

    video.onloadedmetadata = () => {

      const duration =
        video.duration;

      URL.revokeObjectURL(url);

      resolve(duration);
    };

    video.onerror = () => {

      URL.revokeObjectURL(url);

      reject(
        new Error(
          "No se pudo comprobar la duración del video."
        )
      );
    };

    video.src = url;
  });
}

async function publishReport(e) {

  e.preventDefault();

  if (!loc) {

    alert(
      "Obtén la ubicación GPS antes de publicar."
    );

    return;
  }

  const type =
    $("type").value;

  const description =
    $("description").value.trim();

  const photoFile =
    $("photo").files[0] || null;

  const videoFile =
    $("video").files[0] || null;

  if (!type || !description) {

    alert(
      "Completa el tipo y la descripción."
    );

    return;
  }

  if (videoFile) {

    const duration =
      await getVideoDuration(videoFile);

    if (duration > 10.05) {

      alert(
        "El video debe durar máximo 10 segundos."
      );

      $("video").value = "";

      return;
    }
  }

  const button =
    $("reportForm")
      .querySelector(".primary");

  const originalText =
    button.textContent;

  try {

    button.disabled = true;

    button.textContent =
      "Subiendo reporte…";

    const reportCode =
      makeReportCode();

    let photoUrl = null;
    let videoUrl = null;

    if (photoFile) {

      button.textContent =
        "Subiendo fotografía…";

      photoUrl =
        await uploadFile(
          photoFile,
          reportCode,
          "foto"
        );
    }

    if (videoFile) {

      button.textContent =
        "Subiendo video…";

      videoUrl =
        await uploadFile(
          videoFile,
          reportCode,
          "video"
        );
    }

    button.textContent =
      "Guardando reporte…";

    const saved =
      await createReport({

        report_code:
          reportCode,

        type:
          type,

        description:
          description,

        latitude:
          loc.lat,

        longitude:
          loc.lng,

        gps_accuracy:
          loc.accuracy,

        photo_url:
          photoUrl,

        video_url:
          videoUrl,

        status:
          "Pendiente"
      });

    reports.push(saved);

    reportsRender();
    markersRender();

    $("modal").classList.add("hidden");

    resetForm();

    alert(
      `Reporte ${reportCode} creado correctamente.`
    );

  } catch (error) {

    console.error(error);

    alert(
      "No se pudo publicar el reporte.\n\n" +
      "Detalle: " +
      error.message
    );

  } finally {

    button.disabled = false;

    button.textContent =
      originalText;
  }
}

function init() {

  map =
    L.map("map")
      .setView(
        [23.6345, -102.5528],
        5
      );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,

      attribution:
        "© OpenStreetMap"
    }
  ).addTo(map);

  setTimeout(
    () => map.invalidateSize(),
    200
  );

  $("newReportBtn").onclick = () => {

    $("modal")
      .classList
      .remove("hidden");

    gps();
  };

  $("closeModal").onclick = () => {

    $("modal")
      .classList
      .add("hidden");
  };

  $("getLocation").onclick =
    gps;

  $("locateBtn").onclick =
    gps;

  $("photo").onchange = () => {

    const file =
      $("photo").files[0];

    if (file) {

      $("preview").innerHTML =
        `<img src="${URL.createObjectURL(file)}">`;
    }
  };

  $("video").onchange = async () => {

    const file =
      $("video").files[0];

    if (!file) return;

    try {

      const duration =
        await getVideoDuration(file);

      if (duration > 10.05) {

        alert(
          "El video debe durar máximo 10 segundos."
        );

        $("video").value = "";

        return;
      }

      $("preview").innerHTML =
        `<video controls src="${URL.createObjectURL(file)}"></video>`;

    } catch (error) {

      alert(error.message);

      $("video").value = "";
    }
  };

  $("reportForm").onsubmit =
    publishReport;

  loadReports();
}

window.detail = function(id) {

  const r =
    reports.find(
      x => x.report_code === id
    );

  if (!r) return;

  let media = "";

  if (r.photo_url) {

    media += `
      <p><b>Fotografía:</b></p>

      <img
        src="${esc(r.photo_url)}"
        style="max-width:100%;border-radius:12px"
        alt="Evidencia fotográfica"
      >
    `;
  }

  if (r.video_url) {

    media += `
      <p><b>Video:</b></p>

      <video
        controls
        playsinline
        style="max-width:100%;border-radius:12px"
        src="${esc(r.video_url)}"
      ></video>
    `;
  }

  $("detail").innerHTML = `

    <p>
      <b>ID:</b>
      ${esc(r.report_code)}
    </p>

    <p>
      <b>Tipo:</b>
      ${esc(r.type)}
    </p>

    <p>
      <b>Descripción:</b>
      ${esc(r.description)}
    </p>

    <p>
      <b>GPS:</b>
      ${Number(r.latitude).toFixed(6)},
      ${Number(r.longitude).toFixed(6)}
    </p>

    <p>
      <b>Precisión GPS:</b>
      ±${Math.round(Number(r.gps_accuracy || 0))} m
    </p>

    <p>
      <b>Estado:</b>
      ${esc(r.status)}
    </p>

    ${media}
  `;

  $("detailModal")
    .classList
    .remove("hidden");
};

$("closeDetail").onclick = () => {

  $("detailModal")
    .classList
    .add("hidden");
};

document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (typeof L === "undefined") {

      alert(
        "No se pudo cargar el mapa. Recarga la página."
      );

      return;
    }

    init();
  }
);
