/* BCPOL — novedades por usuario y navegador. Solo se consulta material autorizado. */
(function () {
  'use strict';

  // Avisos de publicación: cambia el identificador cuando publiques otro comunicado.
  const AVISOS = [
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
    const response = await fetch(BASE + recurso, {
      method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!response.ok) throw new Error('Recurso no disponible');
    const result = await response.json();
    if (!result || result.ok !== true) throw new Error('Recurso no autorizado');
    return result;
  }
  function elemento(etiqueta, clase, contenido) {
    const node = document.createElement(etiqueta);
    if (clase) node.className = clase;
    if (contenido !== undefined) node.textContent = String(contenido);
    return node;
  }
  function enlaceInterno(url) {
    // Evita enlazar a URLs procedentes de catálogos o contenidos externos.
    return /^(aula\.html|apuntes\.html\?materia=(trafico|administrativa|seguridad))$/.test(url);
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

  function cerrar() {
    if (pendiente) {
      guardar(pendiente.usuario, pendiente.estado);
      pendiente = null;
    }
    if (popup) popup.hidden = true;
    if (previoFoco && document.contains(previoFoco)) previoFoco.focus();
    previoFoco = null;
  }
  function cancelar() {
    solicitud++;
    pendiente = null;
    if (popup) popup.hidden = true;
    previoFoco = null;
  }
  function mostrar(usuario, estado, noticias) {
    if (!popup || !listado) return;
    listado.replaceChildren();
    const maximo = 9;
    for (const noticia of noticias.slice(0, maximo)) {
      const item = elemento('li', 'bcpol-news-item');
      item.append(elemento('span', 'bcpol-news-type', noticia.tipo));
      item.append(elemento('strong', 'bcpol-news-title', noticia.titulo));
      if (noticia.descripcion) item.append(elemento('p', 'bcpol-news-description', noticia.descripcion));
      if (enlaceInterno(noticia.enlace)) {
        const a = elemento('a', 'bcpol-news-link', 'Ver contenido');
        a.href = noticia.enlace;
        a.addEventListener('click', cerrar);
        item.append(a);
      }
      listado.append(item);
    }
    resumen.textContent = noticias.length > maximo
      ? 'Se muestran ' + maximo + ' de ' + noticias.length + ' novedades. Consulta la biblioteca para ver el resto.'
      : 'Estas son las novedades publicadas desde tu última consulta.';
    pendiente = { usuario: usuario, estado: estado };
    previoFoco = document.activeElement;
    popup.hidden = false;
    const boton = popup.querySelector('button');
    if (boton) boton.focus();
  }
  async function revisar(usuario, token) {
    if (!usuario || !token || !popup) return;
    const actual = ++solicitud;
    const previo = leer(usuario);
    const siguiente = {
      avisos: previo.avisos.slice(),
      catalogos: Object.assign({}, previo.catalogos)
    };
    const noticias = [];
    for (const aviso of AVISOS) {
      if (!previo.avisos.includes(aviso.id)) {
        noticias.push(aviso);
        siguiente.avisos.push(aviso.id);
      }
    }
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
    if (actual !== solicitud || !sessionStorage.getItem('bcpol_session_v2')) return;
    for (const resultado of resultados) {
      if (resultado.status !== 'fulfilled') continue;
      const valor = resultado.value;
      siguiente.catalogos[valor.grupo] = valor.firmas;
      noticias.push.apply(noticias, valor.noticias);
    }
    if (noticias.length) mostrar(usuario, siguiente, noticias);
    else guardar(usuario, siguiente);
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
