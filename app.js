const SUPABASE_URL = "https://tjqdpvltjpvknvsvtqur.supabase.co";
const SUPABASE_KEY = "sb_publishable_S2hNm3j2F_08I8aFQXwzog_TA82P26h";

const REPORTS_API = `${SUPABASE_URL}/rest/v1/reports`;
const STORAGE_API = `${SUPABASE_URL}/storage/v1/object`;
const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/reports`;
const AUTH_API = `${SUPABASE_URL}/auth/v1`;

let map;
let markersLayer;
let reports = [];
let currentLocation = null;
let selectedPhoto = null;
let selectedVideo = null;

let currentUser = null;
let accessToken = null;


/* =========================
   UTILIDADES
========================= */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateReportCode() {

  return "MX-" +
    Math.floor(
      10000000 +
      Math.random() * 90000000
    );
}


/* =========================
   AUTENTICACIÓN
========================= */

function authHeaders() {

  return {
    apikey: SUPABASE_KEY,
    Authorization:
      `Bearer ${accessToken || SUPABASE_KEY}`
  };
}


/* =========================
   OBTENER SESIÓN
========================= */

async function getSession() {

  const savedSession =
    localStorage.getItem("puntomx_session");

  if (!savedSession) {
    currentUser = null;
    accessToken = null;
    updateAuthUI();
    return;
  }

  try {

    const session =
      JSON.parse(savedSession);

    if (
      !session.access_token ||
      !session.user
    ) {

      localStorage.removeItem(
        "puntomx_session"
      );

      currentUser = null;
      accessToken = null;

      updateAuthUI();

      return;
    }

    accessToken =
      session.access_token;

    currentUser =
      session.user;

    /*
      Comprobamos que el token
      siga siendo válido.
    */

    const response =
      await fetch(
        `${AUTH_API}/user`,
        {
          headers: authHeaders()
        }
      );

    if (!response.ok) {

      localStorage.removeItem(
        "puntomx_session"
      );

      currentUser = null;
      accessToken = null;

    } else {

      currentUser =
        await response.json();
    }

  } catch (error) {

    console.error(
      "Error recuperando sesión:",
      error
    );

    localStorage.removeItem(
      "puntomx_session"
    );

    currentUser = null;
    accessToken = null;
  }

  updateAuthUI();
}


/* =========================
   INTERFAZ DE USUARIO
========================= */

function updateAuthUI() {

  const authArea =
    $("authArea");

  if (!authArea) {
    return;
  }

  if (currentUser) {

    const email =
      escapeHtml(
        currentUser.email || ""
      );

    authArea.innerHTML = `

      <div style="
        display:flex;
        align-items:center;
        gap:8px;
      ">

        <span style="
          font-size:12px;
          max-width:150px;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">
          👤 ${email}
        </span>

        <button
          id="logoutBtn"
          class="secondary"
          type="button"
        >
          Salir
        </button>

      </div>
    `;

    $("logoutBtn")
      .addEventListener(
        "click",
        logout
      );

  } else {

    authArea.innerHTML = `

      <button
        id="loginBtn"
        class="secondary"
        type="button"
      >
        👤 Iniciar sesión
      </button>

    `;

    $("loginBtn")
      .addEventListener(
        "click",
        openAuthModal
      );
  }
}


/* =========================
   ABRIR LOGIN
========================= */

function openAuthModal() {

  $("authModal")
    .classList
    .remove("hidden");

  $("authMessage")
    .textContent = "";

  $("authForm")
    .reset();

  $("authSubmit")
    .textContent =
    "Iniciar sesión";
}


/* =========================
   CERRAR LOGIN
========================= */

function closeAuthModal() {

  $("authModal")
    .classList
    .add("hidden");
}


/* =========================
   INICIAR SESIÓN
========================= */

async function loginUser() {

  const email =
    $("authEmail")
      .value
      .trim();

  const password =
    $("authPassword")
      .value;

  if (!email || !password) {

    $("authMessage")
      .textContent =
      "Escribe tu correo y contraseña.";

    return;
  }

  $("authSubmit")
    .disabled = true;

  $("authSubmit")
    .textContent =
    "Iniciando sesión...";

  $("authMessage")
    .textContent = "";

  try {

    const response =
      await fetch(
        `${AUTH_API}/token?grant_type=password`,
        {
          method: "POST",

          headers: {
            apikey:
              SUPABASE_KEY,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.msg ||
        data.message ||
        data.error_description ||
        "No fue posible iniciar sesión."
      );
    }

    /*
      Guardamos la sesión
      solamente en este navegador.
    */

    localStorage.setItem(
      "puntomx_session",
      JSON.stringify(data)
    );

    accessToken =
      data.access_token;

    currentUser =
      data.user;

    updateAuthUI();

    closeAuthModal();

    await loadReports();

    alert(
      "Sesión iniciada correctamente."
    );

  } catch (error) {

    console.error(
      "Error de inicio de sesión:",
      error
    );

    $("authMessage")
      .textContent =
      error.message;

  } finally {

    $("authSubmit")
      .disabled = false;

    $("authSubmit")
      .textContent =
      "Iniciar sesión";
  }
}


/* =========================
   CREAR CUENTA
========================= */

async function signupUser() {

  const email =
    $("authEmail")
      .value
      .trim();

  const password =
    $("authPassword")
      .value;

  if (!email || !password) {

    $("authMessage")
      .textContent =
      "Escribe correo y contraseña para crear la cuenta.";

    return;
  }

  if (password.length < 6) {

    $("authMessage")
      .textContent =
      "La contraseña debe tener al menos 6 caracteres.";

    return;
  }

  $("signupBtn")
    .disabled = true;

  $("signupBtn")
    .textContent =
    "Creando cuenta...";

  $("authMessage")
    .textContent = "";

  try {

    const response =
      await fetch(
        `${AUTH_API}/signup`,
        {
          method: "POST",

          headers: {
            apikey:
              SUPABASE_KEY,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.msg ||
        data.message ||
        data.error_description ||
        "No fue posible crear la cuenta."
      );
    }

    /*
      Si Confirm email está activado,
      Supabase normalmente pedirá
      confirmar el correo.
    */

    if (
      data.user &&
      !data.access_token
    ) {

      $("authMessage")
        .textContent =
        "Cuenta creada. Revisa tu correo para confirmar la cuenta.";

      return;
    }

    /*
      Si Supabase devuelve sesión
      inmediatamente, guardamos sesión.
    */

    if (
      data.access_token &&
      data.user
    ) {

      localStorage.setItem(
        "puntomx_session",
        JSON.stringify(data)
      );

      accessToken =
        data.access_token;

      currentUser =
        data.user;

      updateAuthUI();

      closeAuthModal();

      await loadReports();

      alert(
        "Cuenta creada correctamente."
      );
    }

  } catch (error) {

    console.error(
      "Error creando cuenta:",
      error
    );

    $("authMessage")
      .textContent =
      error.message;

  } finally {

    $("signupBtn")
      .disabled = false;

    $("signupBtn")
      .textContent =
      "Crear cuenta";
  }
}


/* =========================
   CERRAR SESIÓN
========================= */

function logout() {

  localStorage.removeItem(
    "puntomx_session"
  );

  currentUser = null;
  accessToken = null;

  updateAuthUI();

  alert(
    "Sesión cerrada."
  );
}


/* =========================
   MAPA
========================= */

function initMap() {

  if (typeof L === "undefined") {

    console.error(
      "Leaflet no está cargado."
    );

    return;
  }

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
        "&copy; OpenStreetMap"
    }
  ).addTo(map);

  markersLayer =
    L.layerGroup()
      .addTo(map);

  setTimeout(() => {

    map.invalidateSize();

  }, 300);
}


/* =========================
   REPORTES
========================= */

async function loadReports() {

  try {

    const response =
      await fetch(
        `${REPORTS_API}?select=*&order=created_at.desc`,
        {
          headers: authHeaders()
        }
      );

    if (!response.ok) {

      throw new Error(
        await response.text()
      );
    }

    reports =
      await response.json();

    renderReports();
    updateStats();
    renderReportList();

  } catch (error) {

    console.error(
      "Error cargando reportes:",
      error
    );
  }
}


/* =========================
   MARCADORES
========================= */

function renderReports() {

  if (!map || !markersLayer) {
    return;
  }

  markersLayer.clearLayers();

  reports.forEach(
    report => {

      if (
        typeof report.latitude !== "number" ||
        typeof report.longitude !== "number"
      ) {
        return;
      }

      const marker =
        L.marker([
          report.latitude,
          report.longitude
        ]);

      marker.bindPopup(
        createPopupContent(report),
        {
          maxWidth: 320
        }
      );

      marker.addTo(
        markersLayer
      );
    }
  );
}


/* =========================
   POPUP
========================= */

function createPopupContent(report) {

  const type =
    escapeHtml(
      report.type ||
      "Problema reportado"
    );

  const description =
    escapeHtml(
      report.description ||
      "Sin descripción."
    );

  const status =
    escapeHtml(
      report.status ||
      "Pendiente"
    );

  const code =
    escapeHtml(
      report.report_code ||
      ""
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

  const existing =
    $("mediaViewer");

  if (existing) {
    existing.remove();
  }

  const viewer =
    document.createElement("div");

  viewer.id =
    "mediaViewer";

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

  document.body.appendChild(
    viewer
  );
}

function closeMediaViewer() {

  const viewer =
    $("mediaViewer");

  if (viewer) {
    viewer.remove();
  }
}


/* =========================
   ESTADÍSTICAS
========================= */

function updateStats() {

  const total =
    reports.length;

  const pending =
    reports.filter(
      r =>
        (r.status || "Pendiente") ===
        "Pendiente"
    ).length;

  const resolved =
    reports.filter(
      r =>
        (r.status || "") ===
        "Resuelto"
    ).length;

  if ($("totalCount")) {
    $("totalCount")
      .textContent =
      total;
  }

  if ($("pendingCount")) {
    $("pendingCount")
      .textContent =
      pending;
  }

  if ($("resolvedCount")) {
    $("resolvedCount")
      .textContent =
      resolved;
  }
}


/* =========================
   LISTA DE REPORTES
========================= */

function renderReportList() {

  const container =
    $("reports");

  if (!container) {
    return;
  }

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

  container.innerHTML =
    reports.map(
      report => {

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
              ${escapeHtml(
                report.description || ""
              )}
            </div>

            <div style="
              font-size:12px;
              color:#666;
              margin-top:6px;
            ">
              ${escapeHtml(
                report.report_code
              )}
              ·
              ${escapeHtml(
                report.status ||
                "Pendiente"
              )}
            </div>

          </div>
        `;
      }
    ).join("");
}


/* =========================
   GPS
========================= */

function getLocation() {

  return new Promise(
    (resolve, reject) => {

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

          resolve(
            currentLocation
          );
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
    }
  );
}


/* =========================
   ABRIR FORMULARIO
========================= */

function openReportForm() {

  /*
    Por ahora mantenemos el
    formulario disponible.
    Después podremos exigir
    login para publicar.
  */

  $("modal")
    .classList
    .remove("hidden");

  selectedPhoto = null;
  selectedVideo = null;

  $("photo").value = "";
  $("video").value = "";

  $("preview").innerHTML = "";

  $("locationStatus")
    .textContent =
    "Obteniendo ubicación...";

  getLocation()

    .then(location => {

      currentLocation =
        location;

      $("locationStatus")
        .textContent =
        `📍 Ubicación obtenida ±${Math.round(location.accuracy)} m`;

    })

    .catch(error => {

      console.error(error);

      $("locationStatus")
        .textContent =
        "⚠️ No se pudo obtener la ubicación.";
    });
}

function closeReportForm() {

  $("modal")
    .classList
    .add("hidden");
}


/* =========================
   FOTO
========================= */

function handlePhoto(event) {

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  selectedPhoto =
    file;

  const url =
    URL.createObjectURL(file);

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

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  selectedVideo =
    null;

  const video =
    document.createElement("video");

  video.preload =
    "metadata";

  video.onloadedmetadata =
    () => {

      URL.revokeObjectURL(
        video.src
      );

      if (video.duration > 10.05) {

        alert(
          "El video no puede durar más de 10 segundos."
        );

        event.target.value =
          "";

        selectedVideo =
          null;

        return;
      }

      selectedVideo =
        file;

      const url =
        URL.createObjectURL(file);

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

  video.onerror =
    () => {

      alert(
        "No fue posible comprobar la duración del video."
      );

      event.target.value =
        "";

      selectedVideo =
        null;
    };

  video.src =
    URL.createObjectURL(file);
}


/* =========================
   SUBIR ARCHIVO
========================= */

async function uploadFile(
  file,
  reportCode,
  prefix
) {

  if (!file) {
    return null;
  }

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

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {

          apikey:
            SUPABASE_KEY,

          Authorization:
            `Bearer ${
              accessToken ||
              SUPABASE_KEY
            }`,

          "Content-Type":
            file.type ||
            "application/octet-stream"
        },

        body:
          file
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
    $("description")
      .value
      .trim();

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

  if (
    !selectedPhoto &&
    !selectedVideo
  ) {

    alert(
      "Agrega una fotografía o un video."
    );

    return;
  }

  const reportCode =
    generateReportCode();

  const publishButton =
    $("reportForm")
      .querySelector(
        'button[type="submit"]'
      );

  if (publishButton) {

    publishButton.disabled =
      true;

    publishButton.textContent =
      "Publicando...";
  }

  try {

    let photoUrl =
      null;

    let videoUrl =
      null;


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
        "Pendiente",

      /*
        NUEVO:
        asociamos el reporte
        con el usuario conectado.
      */

      user_id:
        currentUser
          ? currentUser.id
          : null
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
              `Bearer ${
                accessToken ||
                SUPABASE_KEY
              }`,

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

    $("reportForm")
      .reset();

    currentLocation =
      null;

    selectedPhoto =
      null;

    selectedVideo =
      null;

    $("preview")
      .innerHTML = "";

    $("locationStatus")
      .textContent =
      "Aún no obtenida";


    if (
      created &&
      created[0]
    ) {

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

      publishButton.disabled =
        false;

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


  /* CERRAR REPORTE */

  $("closeModal")
    .addEventListener(
      "click",
      closeReportForm
    );


  /* LOGIN */

  $("closeAuthModal")
    .addEventListener(
      "click",
      closeAuthModal
    );


  $("authForm")
    .addEventListener(
      "submit",
      event => {

        event.preventDefault();

        loginUser();
      }
    );


  $("signupBtn")
    .addEventListener(
      "click",
      signupUser
    );


  /* GPS */

  $("getLocation")
    .addEventListener(
      "click",
      async () => {

        $("locationStatus")
          .textContent =
          "Obteniendo ubicación...";

        try {

          const location =
            await getLocation();

          currentLocation =
            location;

          $("locationStatus")
            .textContent =
            `📍 Ubicación obtenida ±${Math.round(location.accuracy)} m`;

        } catch (error) {

          console.error(error);

          $("locationStatus")
            .textContent =
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

    await getSession();

    await loadReports();

    console.log(
      "PuntoMX listo."
    );
  }
);
