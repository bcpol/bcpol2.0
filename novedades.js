/* BCPOL — novedades por usuario y navegador. Solo se consulta material autorizado. */
(function () {
  'use strict';

  // Avisos de publicación: cambia el identificador cuando publiques otro comunicado.
  const AVISOS = [
    {
      id: 'planning-estudio-novedad-2026-11-10',
      tipo: 'NUEVA FUNCIÓN BCPOL',
      titulo: 'PLANNING DE ESTUDIO',
      descripcion: '¡Estrenamos una herramienta para organizar tu preparación! Elige tus días y tiempo de estudio, consulta qué apuntes BCPOL trabajar cada día y planifica el supuesto, la clase semanal y los repasos según tu progreso. Entra con tu usuario habitual y configura tu planning.',
      enlace: 'mi-preparador.html',
      texto_enlace: 'Abrir mi Planning de Estudio',
      destacado: true
    },
    {
      id: 'supuesto-10-trafico-2026-11-06',
      tipo: 'SUPUESTO PRÁCTICO',
      titulo: 'Supuesto 10 de Tráfico disponible',
      descripcion: 'Ya puedes acceder al supuesto para realizarlo.',
      enlace: 'aula.html'
    },
    {
      id: 'podcasts-trafico-ampliados-2026-11-08',
      tipo: 'PÓDCASTS',
      titulo: 'Ampliación de los pódcast de Tráfico',
      descripcion: 'Consulta los audios incorporados a la biblioteca de apuntes.',
      enlace: 'apuntes.html?materia=trafico'
    },
    {
      id: 'podcasts-seguridad-seis-2026-11-10',
      tipo: 'PÓDCASTS',
      titulo: '6 nuevos pódcast de Seguridad Ciudadana',
      descripcion: 'Nuevos audios de los temas 104 a 109: defraudaciones, violencia contra transexuales, aborto, piratería audiovisual, insolvencias punibles y delitos contra la salud pública.',
      enlace: 'apuntes.html?materia=seguridad'
    }
  ];
  const BASE = 'https://axgbiqbyserypsbtwnjr.supabase.co/functions/v1/';
  const STORAGE_PREFIX = 'bcpol_novedades_v1_';
  const MATERIAS = [
    ['trafico', 'Tráfico'],
    ['administrativa', 'Policía Administrativa'],
    ['seguridad', 'Seguridad Ciudadana']
  ];
  const popup = document.getElementById('bcpol-novedades-popup');
  const listado = document.getElementById('bcpol-novedades-list');
  const resumen = document.getElementById('bcpol-novedades-resumen');
  let solicitud = 0;
  let pendiente = null;
  let previoFoco = null;

  function clave(usuario) {
    return STORAGE_PREFIX + encodeURIComponent(String(usuario).trim().toLowerCase());
  }
  function leer(usuario) {
    try {
      const guardado = JSON.parse(localStorage.getItem(clave(usuario)) || 'null');
      if (guardado && typeof guardado === 'object' &&
          Array.isArray(guardado.avisos) && guardado.catalogos &&
          typeof guardado.catalogos === 'object') return guardado;
    } catch (_) { /* almacenamiento del navegador no disponible */ }
    return { avisos: [], catalogos: {} };
  }
  function guardar(usuario, estado) {
    try { localStorage.setItem(clave(usuario), JSON.stringify(estado)); }
    catch (_) { /* la página sigue funcionando aunque se bloquee localStorage */ }
  }
  function huella(valor) {
    // Firma para comparar cambios; evita guardar enlaces de Drive en el navegador.
    let hash = 2166136261;
    const texto = String(valor);
    for (let i = 0; i < texto.length; i++) {
      hash ^= texto.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  async function consultar(recurso, datos) {
    const abortador = new AbortController();
    const reloj = setTimeout(function () { abortador.abort(); }, 8500);
    try {
      const response = await fetch(BASE + recurso, {
        method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos), signal: abortador.signal
      });
      if (!response.ok) throw new Error('Recurso no disponible');
      const result = await response.json();
      if (!result || result.ok !== true) throw new Error('Recurso no autorizado');
      return result;
    } finally { clearTimeout(reloj); }
  }
  function elemento(etiqueta, clase, contenido) {
    const node = document.createElement(etiqueta);
    if (clase) node.className = clase;
    if (contenido !== undefined) node.textContent = String(contenido);
    return node;
  }
  function enlaceInterno(url) {
    // Solo enlaces internos expresamente autorizados, nunca URLs devueltas por catálogos.
    return /^(mi-preparador\.html|aula\.html|apuntes\.html\?materia=(trafico|administrativa|seguridad))$/.test(url);
  }
  function construirNoticiasApuntes(datos, materia, etiqueta, anterior, existe) {
    const firmas = {};
    const noticias = [];
    const apuntes = Array.isArray(datos.apuntes) ? datos.apuntes : [];
    for (const apunte of apuntes) {
      const id = String(apunte.tema_id || '');
      if (!id) continue;
      const titulo = String(apunte.titulo || ('Apunte ' + id));
      for (const tipo of ['pdf', 'audio']) {
        const url = apunte[tipo + '_url'];
        if (typeof url !== 'string' || !url) continue;
        const key = id + ':' + tipo;
        firmas[key] = huella([titulo, url, apunte[tipo + '_fecha'] || ''].join('|'));
        if (existe && anterior[key] !== firmas[key]) {
          noticias.push({
            id: 'apunte:' + materia + ':' + key + ':' + firmas[key],
            tipo: tipo === 'pdf' ? 'APUNTE' : 'PÓDCAST',
            titulo: titulo,
            descripcion: (anterior[key] ? 'Material actualizado' : 'Nuevo material disponible') + ' · ' + etiqueta,
            enlace: 'apuntes.html?materia=' + materia
          });
        }
      }
    }
    return { firmas: firmas, noticias: noticias };
  }
  function construirNoticiasAula(datos, anterior, existe) {
    const firmas = {};
    const noticias = [];
    const meses = Array.isArray(datos.months) ? datos.months : [];
    for (const mes of meses) {
      if (mes.granted !== true || mes.drive_ready !== true) continue;
      const clases = Array.isArray(mes.classes) ? mes.classes : [];
      for (const clase of clases) {
        const titulo = String(clase.title || 'Clase BCPOL');
        const keyBase = String(mes.id || '') + ':' + String(clase.id || titulo);
        for (const tipo of ['drive_url', 'youtube_url']) {
          const url = clase[tipo];
          if (typeof url !== 'string' || !url) continue;
          const key = keyBase + ':' + tipo;
          firmas[key] = huella(titulo + '|' + url);
          if (existe && anterior[key] !== firmas[key]) {
            noticias.push({
              id: 'aula:' + key + ':' + firmas[key],
              tipo: tipo === 'drive_url' ? 'MATERIAL DE CLASE' : 'VÍDEO DE CLASE',
              titulo: titulo,
              descripcion: anterior[key] ? 'Enlace actualizado en el Aula Virtual' : 'Nuevo recurso en el Aula Virtual',
              enlace: 'aula.html'
            });
          }
        }
      }
    }
    return { firmas: firmas, noticias: noticias };
  }

  let scrollAnterior = '';
  function ocultar(restaurarFoco) {
    if (popup) popup.hidden = true;
    document.body.style.overflow = scrollAnterior;
    if (restaurarFoco && previoFoco && document.contains(previoFoco)) previoFoco.focus();
    previoFoco = null;
  }
  function cerrar() {
    if (pendiente) {
      // Lo que no cabe en el emergente queda en cola para el próximo acceso.
      pendiente.estado.pendientes = pendiente.noticias.slice(20).map(function (n) {
        return { id:n.id, tipo:n.tipo, titulo:n.titulo, descripcion:n.descripcion,
                 enlace:n.enlace, texto_enlace:n.texto_enlace, destacado:n.destacado === true };
      });
      guardar(pendiente.usuario, pendiente.estado);
      pendiente = null;
    }
    ocultar(true);
  }
  function cancelar() {
    solicitud++;
    pendiente = null;
    ocultar(false);
  }
  function pintarNoticias(noticias) {
    if (!popup || !listado) return;
    listado.replaceChildren();
    const maximo = 20;
    for (const noticia of noticias.slice(0, maximo)) {
      const destacada = noticia.destacado === true;
      const item = elemento('li', 'bcpol-news-item' + (destacada ? ' bcpol-news-featured' : ''));
      item.append(elemento('span', 'bcpol-news-type', noticia.tipo));
      if (destacada) item.append(elemento('span', 'bcpol-news-feature-icon', '📅'));
      item.append(elemento('strong', 'bcpol-news-title', noticia.titulo));
      if (noticia.descripcion) item.append(elemento('p', 'bcpol-news-description', noticia.descripcion));
      if (enlaceInterno(noticia.enlace)) {
        const a = elemento('a', 'bcpol-news-link' + (destacada ? ' bcpol-news-feature-link' : ''), noticia.texto_enlace || 'Ver contenido');
        a.href = noticia.enlace;
        a.addEventListener('click', cerrar);
        item.append(a);
      }
      listado.append(item);
    }
    if (noticias.length > maximo) {
      listado.append(elemento('li', 'bcpol-news-more',
        'Hay ' + (noticias.length - maximo) + ' novedades adicionales pendientes. Se mostrarán en tu próximo acceso, sin perderse.'));
    }
    if (resumen) resumen.textContent = noticias.length > 1
      ? 'Novedades publicadas desde tu última consulta. Se guardarán como vistas al cerrar este aviso.'
      : 'Esta novedad se mostrará una vez por navegador y usuario.';
  }
  function mostrar(usuario, estado, noticias, actual) {
    if (!popup || !listado || !noticias.length) return;
    if (popup.hidden) {
      previoFoco = document.activeElement;
      scrollAnterior = document.body.style.overflow;
    }
    pendiente = { usuario: usuario, estado: estado, noticias: noticias, solicitud: actual };
    pintarNoticias(noticias);
    popup.hidden = false;
    document.body.style.overflow = 'hidden';
    const boton = popup.querySelector('.bcpol-popup-accept');
    if (boton) boton.focus();
  }
  async function revisar(usuario, token) {
    if (!usuario || !token || !popup) return;
    const actual = ++solicitud;
    const previo = leer(usuario);
    const siguiente = {
      avisos: previo.avisos.slice(),
      catalogos: Object.assign({}, previo.catalogos),
      pendientes: []
    };
    const novedadesDirectas = [];
    for (const aviso of AVISOS) {
      if (!previo.avisos.includes(aviso.id)) {
        novedadesDirectas.push(aviso);
        siguiente.avisos.push(aviso.id);
      }
    }
    // Priorizar los comunicados, pero no perder novedades pendientes previas.
    const pendientesPrevios = Array.isArray(previo.pendientes) ? previo.pendientes.slice(0, 500) : [];
    const idsDirectos = new Set(novedadesDirectas.map(function (n) { return n.id; }));
    for (const n of pendientesPrevios) {
      if (!n || typeof n !== 'object' || typeof n.id !== 'string' || idsDirectos.has(n.id)) continue;
      novedadesDirectas.push(n); idsDirectos.add(n.id);
    }
    // La comunicación principal aparece sin esperar cuatro consultas externas.
    if (novedadesDirectas.length) mostrar(usuario, siguiente, novedadesDirectas, actual);
    const tareas = MATERIAS.map(async function (par) {
      const materia = par[0], etiqueta = par[1];
      const datos = await consultar('bcpol-apuntes', { action: 'list', materia: materia, token: token });
      const anterior = previo.catalogos[materia];
      return Object.assign({ grupo: materia },
        construirNoticiasApuntes(datos, materia, etiqueta, anterior || {}, !!anterior));
    });
    tareas.push((async function () {
      const datos = await consultar('bcpol-aula', { action: 'mine', token: token });
      const anterior = previo.catalogos.aula;
      return Object.assign({ grupo: 'aula' },
        construirNoticiasAula(datos, anterior || {}, !!anterior));
    })());
    const resultados = await Promise.allSettled(tareas);
    if (actual !== solicitud || sessionStorage.getItem('bcpol_session_v2') !== token) return;
    const novedadesCatalogos = [];
    let consultasCorrectas = 0;
    for (const resultado of resultados) {
      if (resultado.status !== 'fulfilled') continue;
      consultasCorrectas++;
      const valor = resultado.value;
      siguiente.catalogos[valor.grupo] = valor.firmas;
      novedadesCatalogos.push.apply(novedadesCatalogos, valor.noticias);
    }
    if (pendiente && pendiente.solicitud === actual && !popup.hidden) {
      // Si la ventana sigue abierta, añadimos las novedades y actualizamos su estado.
      pendiente.noticias.push.apply(pendiente.noticias, novedadesCatalogos);
      pintarNoticias(pendiente.noticias);
    } else if (!novedadesDirectas.length) {
      if (novedadesCatalogos.length) mostrar(usuario, siguiente, novedadesCatalogos, actual);
      else if (consultasCorrectas) guardar(usuario, siguiente);
    }
    // Si el aviso se cerró durante la consulta, no damos por vistas las novedades tardías.
  }

  if (popup) {
    popup.addEventListener('click', function (event) {
      if (event.target === popup) cerrar();
    });
    popup.addEventListener('keydown', function (event) {
      if (popup.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); cerrar(); return; }
      if (event.key !== 'Tab') return;
      const focos = Array.from(popup.querySelectorAll('a[href],button:not([disabled])'));
      if (!focos.length) return;
      if (event.shiftKey && document.activeElement === focos[0]) {
        event.preventDefault(); focos[focos.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focos[focos.length - 1]) {
        event.preventDefault(); focos[0].focus();
      }
    });
  }
  window.BCPOLNovedades = { revisar: revisar, cerrar: cerrar, cancelar: cancelar };
})();
