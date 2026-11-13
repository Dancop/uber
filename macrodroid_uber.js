// === EVALUADOR V8.9: RITMO 3 VIAJES/HORA (16-18H) + PROTECCION MARGEN ERROR + PANEL LATERAL ===

var resultadoFinal = (function() {

    var B = String.fromCharCode(124);

    var SEP = B + B + B;



    // 1. Lectura unica y temprana del contador de bono (Validado en V8.8.4)

    var bonoContadorRaw = "{v=MD_bono_viajes_completados}";

    var bonoContadorTexto = String(bonoContadorRaw).trim();

    var bonoContadorParseFloat = parseFloat(bonoContadorTexto);

    var bonoContadorNumber = Number(bonoContadorTexto);

    var bonoDiagnostico = function(nombre, valor) {

        try {

            if (typeof console !== "undefined" && typeof console.log === "function") {

                console.log("BONO_V89 " + nombre + "=" + String(valor));

            }

        } catch (_errorLog) {}

    };

    bonoDiagnostico("RAW", JSON.stringify(bonoContadorRaw));

    bonoDiagnostico("FLOAT", bonoContadorParseFloat);

    bonoDiagnostico("NUMBER", bonoContadorNumber);



    try {

        // -- 1. CAPTURA Y LIMPIEZA DE DATOS BASE --

        var rawText = `{lv=pantalla_local}`;

        if (!rawText || rawText.trim() === "") {

            return "SKIP" + SEP + "#607D8B" + SEP + "⚠️ Pantalla vacía" + SEP + "SKIP" + SEP + "0" + SEP + "{v=MD_hora_ultima_oferta}" + SEP + SEP + SEP + "NINGUNA" + SEP + "";

        }



        if (/Navegar/i.test(rawText) && /Llegar por/i.test(rawText)) {

            return "SKIP" + SEP + "#000000" + SEP + "🧭 En navegación" + SEP + "SKIP" + SEP + "{v=MD_ema_mercado}" + SEP + "{v=MD_hora_ultima_oferta}" + SEP + SEP + SEP + "NINGUNA" + SEP + "";

        }



        // Limpia del texto capturado cualquier rastro del cartel flotante previo

        var rxCartel1 = new RegExp("[XCP]\\s*\\" + B + "\\s*[\\d.,]+\\s*Bs[^\\n\\r\"']*", "gi");

        var rxCartel2 = new RegExp("\\d+v(?:\\(\\d+\\/\\d+\\))?·\\d+[ms][^\\n\\r\"']*", "gi");

        var rxCartel3 = new RegExp("\\[(?:ORO" + B + "PLA" + B + "NEU" + B + "VET" + B + "PRO" + B + "DM11" + B + "\\?):[^\\]]*\\]", "gi");

        var rxCartel4 = new RegExp("^[^\\r\\n]*(?:Bs\\/Km" + B + "Bs\\s*\\" + B + "\\s*\\d+m\\()[^\\r\\n]*$", "gim");



        var cleanScreenText = rawText

            .replace(rxCartel1, " ")

            .replace(rxCartel2, " ")

            .replace(rxCartel3, " ")

            .replace(rxCartel4, " ");



        // Variables globales desde MacroDroid

        var precioGasolina     = parseFloat("{v=MD_precio_gasolina}") ? parseFloat("{v=MD_precio_gasolina}") : 6.96;

        var consumoKml         = parseFloat("{v=MD_consumo_kml}") ? parseFloat("{v=MD_consumo_kml}") : 11.0;

        var costoMantenimiento = parseFloat("{v=MD_mantenimiento_km}") ? parseFloat("{v=MD_mantenimiento_km}") : 0.08;

        var costoDepreciacion  = parseFloat("{v=MD_depreciacion_km}") ? parseFloat("{v=MD_depreciacion_km}") : 0.20;

        var pisoNetoUsr        = parseFloat("{v=MD_tarifa_base}") ? parseFloat("{v=MD_tarifa_base}") : 2.0;



        var strModoBono        = "{v=MD_modo_bono}".trim();

        var modoBonoActivo     = (new RegExp("^(true" + B + "verdadero" + B + "1)$", "i")).test(strModoBono);

        var ultimoTripId       = "{v=MD_ultimo_trip_id}";



        var strZonasVet        = "{v=MD_zonas_vetadas}".trim();

        var zonasVetadasStr    = (strZonasVet !== "" && strZonasVet.indexOf("{v=") === -1)

            ? strZonasVet

            : ["Mutualista", "Plan 3000", "Cumavi", "Lujan", "Pampa", "Barrio Lindo"].join(B);



        var rawRecogerMati     = "{v=MD_recoger_mati}".trim();

        var recogerMatiActivo  = !(new RegExp("^(false" + B + "falso" + B + "0" + B + "no" + B + "off)$", "i")).test(rawRecogerMati);



        var limpiarVarMD = function(v) {

            if (!v) return "";

            if (v.indexOf("{v=") !== -1) return "";

            if (v.trim() === "" || v.trim() === "0") return "";

            var rxBordes = new RegExp("^\\" + B + "+\\" + B + "+$", "g");

            return v.trim().replace(rxBordes, "");

        };

        var uvOroExtraStr     = limpiarVarMD("{v=MD_uv_oro_extra}");

        var uvPlataExtraStr   = limpiarVarMD("{v=MD_uv_plata_extra}");

        var uvVetadasExtraStr = limpiarVarMD("{v=MD_uv_vetadas_extra}");



        var costoKm = (precioGasolina / consumoKml) + costoMantenimiento + costoDepreciacion;



        var ahora      = new Date();

        var horaActual = ahora.getHours();

        var minActual  = ahora.getMinutes();

        var esHoraBono = (horaActual >= 16 && horaActual < 20);

        var horaOferta = String(horaActual).padStart(2,'0') + ":"

                       + String(minActual).padStart(2,'0');



        // -- 1b. SEQUÍA DE OFERTAS --

        var MINUTOS_INICIO_SEQUIA = 5;

        var MINUTOS_PISO_MINIMO   = 14;

        var PISO_ABSOLUTO         = 1.5;



        var msUltimaOferta   = parseFloat("{v=MD_hora_ultima_oferta}") ? parseFloat("{v=MD_hora_ultima_oferta}") : 0;

        var minutosSinOferta = msUltimaOferta > 0 ? (ahora.getTime() - msUltimaOferta) / 60000 : 0;



        // -- 2. ANTI-DUPLICADOS --

        var tripId = "TRIP_" + ahora.getFullYear()

            + String(ahora.getMonth()+1).padStart(2,'0')

            + String(ahora.getDate()).padStart(2,'0')

            + "_" + String(horaActual).padStart(2,'0')

            + String(minActual).padStart(2,'0')

            + String(ahora.getSeconds()).padStart(2,'0');



        if (tripId === ultimoTripId) {

            return "SKIP" + SEP + "#607D8B" + SEP + "⏭️ Duplicado" + SEP + "SKIP" + SEP + "{v=MD_ema_mercado}" + SEP + "{v=MD_hora_ultima_oferta}" + SEP + SEP + SEP + "NINGUNA" + SEP + "";

        }



        // -- 3. EXTRACCIÓN --

        var tiempoRecogida = 0, distRecogida = 0;

        var tiempoViaje    = 0, distViaje    = 0;

        var precioBruto    = 0;



        var matchRec = cleanScreenText.match(/A\s*(\d+)\s*min\s*(?:y\s*)?\(([\d.,]+)\s*km\)/i);

        if (matchRec) {

            tiempoRecogida = parseFloat(matchRec[1]);

            distRecogida   = parseFloat(matchRec[2].replace(",", "."));

        }



        var matchViaje = cleanScreenText.match(/Viaje:\s*(\d+)\s*min\s*\(([\d.,]+)\s*km\)/i);

        if (matchViaje) {

            tiempoViaje = parseFloat(matchViaje[1]);

            distViaje   = parseFloat(matchViaje[2].replace(",", "."));

        }



        var bobRegex = /(\+\s*)?BOB\s*([\d.,]+)(\s*incluido)?/gi;

        var matchB;

        while ((matchB = bobRegex.exec(cleanScreenText)) !== null) {

            var esBono = Boolean(matchB[1]) || Boolean(matchB[3]);

            if (!esBono) {

                precioBruto = parseFloat(matchB[2].replace(",", "."));

                break;

            }

        }



        if (precioBruto > 100) {

            return "SKIP" + SEP + "#000000" + SEP + "⚠️ Precio inválido (" + precioBruto.toFixed(0) + " Bs)" + SEP + "SKIP" + SEP + "{v=MD_ema_mercado}" + SEP + "{v=MD_hora_ultima_oferta}" + SEP + SEP + SEP + "NINGUNA" + SEP + "";

        }



        var partesTarjeta = cleanScreenText.split(/Viaje:\s*\d+\s*min\s*\([\d.,]+\s*km\)/i);

        var bloqueRecTxt  = partesTarjeta[0] ? partesTarjeta[0] : cleanScreenText;

        var bloqueDestTxt = partesTarjeta.length > 1 ? partesTarjeta[1] : "";



        var rxDir1 = new RegExp('([^"{\\n:\\]\\[]*?(?:(?:DM' + B + 'UV)[-\\s]?[A-Z0-9]+)[^"}\\n:\\]\\[]*)', "i");

        var rxDir2 = new RegExp('([^"{\\n:\\]\\[]*?(?:URUB[OÓ]' + B + 'PORONGO' + B + 'B[EÉ]LGICA' + B + 'SANTA CRUZ DE LA SIERRA' + B + 'PARQUE INDUSTRIAL' + B + 'BARRIO LINDO' + B + 'VIRU VIRU)[^"}\\n:\\]\\[]*)', "i");



        var extraerDir = function(txt) {

            if (!txt) return "";

            var m1 = txt.match(rxDir1);

            if (m1) return m1[1].trim();

            var m2 = txt.match(rxDir2);

            if (m2) return m2[1].trim();

            return "";

        };



        var tmpRec        = extraerDir(bloqueRecTxt);

        var lugarRecogida = tmpRec !== "" ? tmpRec : "Sin dato";

        var lugarDestino  = extraerDir(bloqueDestTxt);



        if (!lugarDestino) {

            var lugares = [];

            var regexLugares = new RegExp('([^"{\\n:\\]\\[]*?(?:(?:DM' + B + 'UV)[-\\s]?[A-Z0-9]+)[^"}\\n:\\]\\[]*)', "ig");

            var matchL;

            while ((matchL = regexLugares.exec(cleanScreenText)) !== null) {

                var place = matchL[1].trim();

                if (lugares.indexOf(place) === -1) lugares.push(place);

            }

            if (lugares.length >= 2) {

                lugarRecogida = lugares[0];

                lugarDestino  = lugares[1];

            } else {

                lugarDestino = "Sin dato";

            }

        }



        // -- 4. MATEMÁTICA + BLINDAJE CONTRA TARJETA SIN RECOGIDA --

        var distTotal   = distRecogida + distViaje;

        var tiempoTotal = tiempoRecogida + tiempoViaje;



        if (distTotal === 0 || precioBruto === 0 || distViaje === 0 || (tiempoRecogida === 0 && distRecogida === 0)) {

            return "SKIP" + SEP + "#9E9E9E" + SEP + "⏳ Cargando datos..." + SEP + "SKIP" + SEP + "{v=MD_ema_mercado}" + SEP + "{v=MD_hora_ultima_oferta}" + SEP + SEP + SEP + "NINGUNA" + SEP + "";

        }



        var wazeRaw     = `{lv=pantalla_local[com.waze:id/lblTimeToDestination]}`;

        var wazeMinutos = 0;



        if (wazeRaw.indexOf("{lv=") === -1 && wazeRaw.indexOf("not found") === -1 && wazeRaw.trim() !== "") {

            var horasMatch = wazeRaw.match(/(\d+)\s*[hH]/i);

            var minMatch   = wazeRaw.match(/(\d+)\s*m/i);

            if (horasMatch) wazeMinutos += parseInt(horasMatch[1], 10) * 60;

            if (minMatch)   wazeMinutos += parseInt(minMatch[1], 10);

            if (wazeMinutos === 0) {

                var numMatch = wazeRaw.match(/(\d+)/);

                if (numMatch) wazeMinutos = parseInt(numMatch[1], 10);

            }

        }



        var esViajeSobrepuesto = (wazeMinutos > 0 && wazeMinutos <= 9);

        var penalidadWazeLargo = (wazeMinutos >= 10) ? Math.min(8, wazeMinutos - 8) : 0;

        var minEsperaEstimada  = esViajeSobrepuesto ? 1 : 2;

        var tiempoCicloReal    = tiempoTotal + minEsperaEstimada + penalidadWazeLargo;

        var tiempoEfectivoBono = tiempoTotal + penalidadWazeLargo;



        var bsKmBruto      = precioBruto / distTotal;

        var costoOperativo = costoKm * distTotal;

        var gananciaNeta   = precioBruto - costoOperativo;

        var bsKmNeto       = gananciaNeta / distTotal;

        var netoPorHora    = (gananciaNeta / tiempoTotal) * 60;

        var velocidad      = distTotal / (tiempoTotal / 60);

        var velViaje       = (tiempoViaje > 0 && distViaje > 0) ? (distViaje / (tiempoViaje / 60)) : velocidad;

        var velRecogida    = (tiempoRecogida > 0 && distRecogida > 0) ? (distRecogida / (tiempoRecogida / 60)) : 25;



        // -- 5. TARIFA MÍNIMA DINÁMICA POR HORA --

        var pisoNetoPorHora;

        if      (horaActual < 15) pisoNetoPorHora = Math.max(1.60, pisoNetoUsr - 0.40);

        else if (horaActual < 16) pisoNetoPorHora = Math.max(1.80, pisoNetoUsr - 0.20);

        else if (horaActual < 18) pisoNetoPorHora = Math.max(1.90, pisoNetoUsr - 0.10);

        else                      pisoNetoPorHora = pisoNetoUsr;



        var pisoBase = pisoNetoPorHora;



        // -- 5b. RELAJACIÓN POR SEQUÍA --

        var pisoTrasSequia = pisoBase;

        var enSequia = false;

        if (minutosSinOferta > MINUTOS_INICIO_SEQUIA && minutosSinOferta < 120) {

            var progresoSequia = Math.min(

                (minutosSinOferta - MINUTOS_INICIO_SEQUIA) / (MINUTOS_PISO_MINIMO - MINUTOS_INICIO_SEQUIA),

                1

            );

            var reduccionSequia = progresoSequia * (pisoBase - PISO_ABSOLUTO);

            pisoTrasSequia = Math.max(PISO_ABSOLUTO, pisoBase - reduccionSequia);

            enSequia = pisoTrasSequia < pisoBase;

        }



        // -- 5c. MARCAPASOS DE BONO (META: 3 VIAJES DE 16-17H, 6 VIAJES A LAS 18H, Y PROTECCIÓN DE MARGEN DE ERROR) --

        var strMetaBono = "{v=MD_bono_meta}".trim();

        var metaParseada = Number(strMetaBono);

        var metaViajesBono = strMetaBono !== "" && Number.isFinite(metaParseada) && metaParseada > 0 && Number.isInteger(metaParseada)

            ? metaParseada : 13;

        var strContadorBono = bonoContadorTexto;

        var contadorNumero = bonoContadorNumber;

        var contadorBonoValido = strContadorBono !== "" && Number.isFinite(contadorNumero) &&

            Number.isInteger(contadorNumero) && contadorNumero >= 0 && contadorNumero <= metaViajesBono;

        var viajesCompletadosBono = contadorBonoValido ? contadorNumero : 0;

        var viajesRestantesBono = contadorBonoValido ? Math.max(0, metaViajesBono - viajesCompletadosBono) : null;

        var montoBono = parseFloat("{v=MD_bono_monto}") ? parseFloat("{v=MD_bono_monto}") : 130;



        var errorContadorBono = modoBonoActivo && esHoraBono && !contadorBonoValido;

        var buscandoBono130 = modoBonoActivo && esHoraBono && contadorBonoValido && (viajesRestantesBono > 0);

        var esUltimoViajeBono = buscandoBono130 && (viajesRestantesBono === 1);



        // En Modo Bono NUNCA bloquea por velocidad de recogida porque el bono (+10 Bs/viaje) lo compensa

        var recogidaLentaSinPago = !buscandoBono130 && (

            (distRecogida > 1.8 && velRecogida < 14.0 && bsKmNeto < (pisoNetoPorHora + 0.25)) ||

            (tiempoRecogida >= 10 && tiempoViaje <= 8 && bsKmNeto < (pisoNetoPorHora + 0.35))

        );



        var VENTANA_BONO_FIN_H      = 20;

        var minutosRestantesVentana = 0;

        if (horaActual < VENTANA_BONO_FIN_H) {

            var finVentana = new Date(ahora);

            finVentana.setHours(VENTANA_BONO_FIN_H, 0, 0, 0);

            minutosRestantesVentana = Math.max(0, (finVentana.getTime() - ahora.getTime()) / 60000);

        }



        var pisoTrasBono = pisoBase;

        var presionBono  = 0;

        var ritmoDisponibleMinPorViaje = null;

        var atrasoViajes = 0;



        if (buscandoBono130 && minutosRestantesVentana > 0) {

            // Curva de 3 viajes por hora de 16:00 a 18:00 (6 viajes a las 18:00) y cierre a las 19:50

            var horasDesdeLas16 = (240 - minutosRestantesVentana) / 60;

            var viajesEsperadosAhora = (horasDesdeLas16 <= 2.0)

                ? (horasDesdeLas16 * 3.0)

                : (6.0 + (horasDesdeLas16 - 2.0) * 3.6);

            atrasoViajes = viajesEsperadosAhora - viajesCompletadosBono;



            var ciclosRestantesConDuracion = Math.max(0.5, viajesRestantesBono - 0.75);

            var minBaseCalculo = (minutosRestantesVentana > 18) ? (minutosRestantesVentana - 8) : minutosRestantesVentana;

            ritmoDisponibleMinPorViaje = esUltimoViajeBono

                ? Math.max(1, minutosRestantesVentana)

                : (minBaseCalculo / ciclosRestantesConDuracion);



            if (!esUltimoViajeBono && (atrasoViajes > 0.25 || ritmoDisponibleMinPorViaje <= 18.0)) {

                presionBono = Math.min(1, Math.max(0.25, 1 - (ritmoDisponibleMinPorViaje / 19.0)));

                var reduccionBono = presionBono * (pisoBase - PISO_ABSOLUTO);

                pisoTrasBono = Math.max(PISO_ABSOLUTO, pisoBase - reduccionBono);

            } else if (esUltimoViajeBono && minutosRestantesVentana <= 25) {

                presionBono = 1;

                pisoTrasBono = PISO_ABSOLUTO;

            }

        }

        var enPresionBono = pisoTrasBono < pisoBase;



        pisoNetoPorHora = Math.min(pisoTrasSequia, pisoTrasBono);

        var tarifaExigida = pisoNetoPorHora + costoKm;



        // -- 6. EMA DE MERCADO --

        var precalentamiento = {

            6:1.20, 7:1.31, 8:1.35, 9:1.08, 10:1.08, 11:1.19,

            12:1.53, 13:1.31, 14:1.10, 15:1.32, 16:1.35,

            17:1.48, 18:1.78, 19:1.91, 20:1.42, 21:1.12, 22:1.19

        };

        var emaHistorica = precalentamiento[horaActual] ? precalentamiento[horaActual] : 1.50;



        var emaMercado = parseFloat("{v=MD_ema_mercado}") ? parseFloat("{v=MD_ema_mercado}") : 0;

        if (emaMercado === 0) emaMercado = emaHistorica;



        var alpha = 0.3;

        if (bsKmNeto > 0 && !buscandoBono130) {

            emaMercado = alpha * bsKmNeto + (1 - alpha) * emaMercado;

        }



        var pisoEma  = 1.20;

        var techoEma = pisoNetoUsr + 1.20;

        emaMercado = Math.max(pisoEma, Math.min(emaMercado, techoEma));



        var promedioMercado = emaMercado;

        var estadoMercado   = "";



        if (emaMercado > pisoNetoUsr + 0.4 && !buscandoBono130) {

            tarifaExigida = (emaMercado - 0.2) + costoKm;

            estadoMercado = " 🔥";

        }



        var bonoActivoUI = modoBonoActivo && esHoraBono;

        if (bonoActivoUI)  estadoMercado += " 🎁";

        if (enSequia)      estadoMercado += " 🏜️";

        if (enPresionBono) estadoMercado += " 🎯";



        var emaNueva = emaMercado.toFixed(3);



        // -- 7. FORMATO DE RELOJ DE FINALIZACIÓN --

        var tiempoTotalFuturo = tiempoTotal + wazeMinutos;

        var horaFin           = new Date(ahora.getTime() + (tiempoTotalFuturo * 60000));

        var horaFinStr        = horaFin.getHours() + ":"

            + String(horaFin.getMinutes()).padStart(2,'0');



        var textoTiempo = wazeMinutos > 0

            ? (tiempoTotal + "m+" + wazeMinutos + "m(" + horaFinStr + ")")

            : (tiempoTotal + "m(" + horaFinStr + ")");



        // -- 8. CLASIFICACIÓN QUIRÚRGICA DE ZONAS + PUENTE URUBÓ + SALIDA DE CASA + RADAR MATI --

        var textoUpper    = cleanScreenText.toUpperCase();

        var recogidaUpper = lugarRecogida.toUpperCase();

        var destinoUpper  = lugarDestino.toUpperCase();

        var bloqueDestUpp = (bloqueDestTxt !== "" ? bloqueDestTxt : lugarDestino).toUpperCase();



        var rxVVI      = new RegExp("AEROPUERTO\\s*INTERNACIONAL" + B + "\\bVVI\\b", "i");

        var esViruViru = (rxVVI.test(textoUpper) || (/VIRU\s*VIRU/.test(textoUpper) && !/\bAV\.?\s*VIRU/i.test(textoUpper)))

                         && (distViaje >= 11.5 || distRecogida >= 11.5);



        // Seguro anti-falso positivo Urubó: Si el destino tiene explícitamente DM-1, DM-2, DM-4, DM-5 o DM-11, NO es Urubó

        var tieneDinzCiudad = /\bDM[-\s]?(1|2|4|5|11)\b/i.test(destinoUpper);

        var rxCondominiosUrubo = new RegExp("\\b(PORONGO" + B + "LA\\s*B[EÉ]LGICA" + B + "BELGICA" + B + "MAR\\s*ADENTRO" + B + "AQUA\\b" + B + "URUB[OÓ]\\s*GOLF" + B + "URUB[OÓ]\\s*VILLAGE" + B + "CASA\\s*DEL\\s*CAMPO" + B + "LOS\\s*BATOS" + B + "CAM\\.?\\s*AL?\\s*CUCHI" + B + "CAM\\.?\\s*AL?\\s*R[IÍ]O" + B + "VERGER)\\b", "i");

        var mencionaPuenteUrubo = /PUENT[E]?\s*URUB/i.test(bloqueDestUpp) || /PUENT[E]?\s*URUB/i.test(destinoUpper);

        var esComercialPuenteUrubo = mencionaPuenteUrubo && !rxCondominiosUrubo.test(bloqueDestUpp) &&

                                     distViaje <= 3.6 && tiempoViaje <= 10 && distRecogida <= 2.0;



        var listaUrubo = ["URUB[OÓ]", "PORONGO", "COLINAS\\s*DEL\\s*URUB", "LA\\s*B[EÉ]LGICA", "BELGICA", "PUENT[E]?\\s*URUB", "MAR\\s*ADENTRO", "AQUA\\b", "URUB[OÓ]\\s*GOLF", "URUB[OÓ]\\s*VILLAGE", "CASA\\s*DEL\\s*CAMPO", "LOS\\s*BATOS\\s*DEL\\s*URUB"].join(B);

        var regexUrubo = new RegExp("\\b(" + listaUrubo + ")\\b", "i");

        var rxSalUrubo = new RegExp("\\b(UV-54" + B + "UV-58" + B + "UV-59" + B + "UV-59A" + B + "UV-61" + B + "EQUIPETROL)\\b", "i");

        var esUrubo    = !tieneDinzCiudad && !esComercialPuenteUrubo && (

                         regexUrubo.test(bloqueDestUpp) || regexUrubo.test(destinoUpper) ||

                         (lugarDestino === "Sin dato" && rxSalUrubo.test(lugarRecogida) && distViaje >= 3.5)

        );



        var TARIFA_REF_UBERX     = 3.0;

        var TARIFA_REF_COMFORT   = 4.0;

        var TOLERANCIA_CATEGORIA = 0.2;



        var esComfort             = (new RegExp("Comfort" + B + "Confort", "i")).test(cleanScreenText);

        var esUberPet             = (new RegExp("Uber\\s*Pet" + B + "Mascota", "i")).test(cleanScreenText);

        var categoriaViaje        = esComfort ? "COMFORT" : (esUberPet ? "UBER PET" : "UBERX");

        var umbralCategoria       = (esComfort ? TARIFA_REF_COMFORT : TARIFA_REF_UBERX) - TOLERANCIA_CATEGORIA;

        var bajoEstandarCategoria = bsKmBruto < umbralCategoria;



        var esDM1  = !esUrubo && (/\bDM[-\s]?1\b/.test(destinoUpper) || /\bUV[-\s]?54\b/.test(destinoUpper) || /EQUIPETROL/.test(destinoUpper) || /AV\.?\s*CRISTO\s*REDENTOR/.test(destinoUpper));

        var esDM2  = !esUrubo && /\bDM[-\s]?2\b/.test(destinoUpper);

        var esDM4  = !esUrubo && /\bDM[-\s]?4\b/.test(destinoUpper);

        var esDM5  = !esUrubo && /\bDM[-\s]?5\b/.test(destinoUpper);

        var esDM11 = !esUrubo && /\bDM[-\s]?11\b/.test(destinoUpper);



        // -- 8a. GEOCERCA EXACTA PARA RECOGER A MATI --

        var rxCallesMati = new RegExp("\\b(LOS\\s*CUSIS" + B + "RIBERA\\s*M[EÉ]NDEZ" + B + "COLEGIO\\s*BAUTISTA" + B + "BAUTISTA)\\b", "i");

        var rxUvMatiPta  = new RegExp("\\bUV[-\\s]?(15" + B + "16)\\b", "i");

        var enPuertaMati = !esUrubo && (rxCallesMati.test(destinoUpper) || (esDM2 && rxUvMatiPta.test(destinoUpper)));



        var rxUvMatiCercaDM2  = new RegExp("\\bUV[-\\s]?(17" + B + "37" + B + "ET2)\\b", "i");

        var rxUvMatiCercaDM11 = new RegExp("\\bUV[-\\s]?(13" + B + "14)\\b", "i");

        var cercaMati = !esUrubo && !enPuertaMati && (

            (esDM2 && rxUvMatiCercaDM2.test(destinoUpper)) ||

            (esDM11 && rxUvMatiCercaDM11.test(destinoUpper)) ||

            (esDM1 && /\bUV[-\s]?30\b/.test(destinoUpper))

        );



        var esHoraDeIrPorMati = !buscandoBono130 || (viajesRestantesBono !== null && viajesRestantesBono <= 2) || (horaActual >= 19);

        var radarMatiActivo   = recogerMatiActivo && esHoraDeIrPorMati;



        var tagHijoOverlay = "";

        var vozHijo        = "";

        if (radarMatiActivo) {

            if (enPuertaMati) {

                tagHijoOverlay = "👦Mati!";

                vozHijo = "te deja en la zona de Mati";

            } else if (cercaMati) {

                tagHijoOverlay = "👦~Mati";

                vozHijo = "cerca de la zona de Mati";

            }

        }



        // -- 8a-bis. CORREDOR SALIDA DE CASA (6to Anillo Santos Dumont -> 3er/4to Anillo -> Oeste) --

        var enHorarioSalidaCasa = (horaActual >= 14 && horaActual < 16) ||

                                  (horaActual === 16 && minActual <= 35 && viajesCompletadosBono <= 1);

        var rxRecogidaSurCasa   = new RegExp("\\b(DM[-\\s]?9" + B + "DM[-\\s]?10" + B + "SANTOS\\s*DUMONT" + B + "UV[-\\s]?(26" + B + "27" + B + "49" + B + "50" + B + "51" + B + "52" + B + "116" + B + "117" + B + "118))\\b", "i");

        var rxDestinoRumboOeste = new RegExp("\\bUV[-\\s]?(27" + B + "28" + B + "29" + B + "50" + B + "51" + B + "52" + B + "ET14)\\b", "i");

        var esRumboOesteDesdeCasa = !esUrubo && enHorarioSalidaCasa && rxRecogidaSurCasa.test(recogidaUpper) &&

                                    (esDM1 || (esDM4 && rxDestinoRumboOeste.test(destinoUpper))) &&

                                    tiempoTotal <= 20 && distRecogida <= 2.6;



        var compensaRecogidaCortaRentableNormal = (tiempoTotal <= 15 && distRecogida <= 4.0 && !recogidaLentaSinPago && bsKmNeto >= (pisoNetoPorHora - 0.15) && netoPorHora >= 42);

        var maxRecNormal = (enSequia || esViajeSobrepuesto || (radarMatiActivo && (enPuertaMati || cercaMati))) ? 3.5 : 3.0;

        var recogidaMalaNormal = recogidaLentaSinPago || (!compensaRecogidaCortaRentableNormal && (

            (distRecogida >= maxRecNormal && bsKmNeto < pisoNetoPorHora) ||

            (distRecogida >= ((enSequia || esViajeSobrepuesto) ? 2.6 : 2.0) && bajoEstandarCategoria && bsKmNeto < pisoNetoPorHora && !(radarMatiActivo && enPuertaMati))

        ));



        var extraVetFijas = ["MUTUALISTA", "PARAGUA", "PARAGUÁ", "COTOCA", "BRASIL", "BARRIO LINDO", "INTERMODAL"].join(B);

        var patronVetadas = zonasVetadasStr + B + extraVetFijas;

        if (uvVetadasExtraStr !== "") patronVetadas += B + uvVetadasExtraStr;

        var regexVetadas = new RegExp("\\b(" + patronVetadas + ")\\b", "i");

        var uvVetadas    = regexVetadas.test(destinoUpper);



        var esOroExtra   = uvOroExtraStr   !== "" && (new RegExp("\\b(" + uvOroExtraStr + ")\\b", "i")).test(destinoUpper);

        var esPlataExtra = uvPlataExtraStr !== "" && (new RegExp("\\b(" + uvPlataExtraStr + ")\\b", "i")).test(destinoUpper);



        var uvDM2Oro    = (new RegExp("\\bUV[-\\s]?(15" + B + "16)\\b", "i")).test(destinoUpper) || (radarMatiActivo && /\bUV[-\s]?ET2\b/.test(destinoUpper));

        var uvDM2Plata  = (new RegExp("\\bUV[-\\s]?(17" + B + "37" + B + "38)\\b", "i")).test(destinoUpper) || (radarMatiActivo && /\bUV[-\s]?ET1\b/.test(destinoUpper));

        var uvDM2Neut   = (new RegExp("\\bUV[-\\s]?(39" + B + "ET1" + B + "ET2)\\b", "i")).test(destinoUpper);

        var uvDM2Vetada = (new RegExp("\\bUV[-\\s]?(" + ["18","19","20","21","22","40","41","42","43","ET3","ET4","ET5"].join(B) + ")\\b", "i")).test(destinoUpper);



        var urgenciaBono = buscandoBono130 && (enPresionBono || enSequia || atrasoViajes > 0.25 || (wazeMinutos === 0 && ritmoDisponibleMinPorViaje !== null && ritmoDisponibleMinPorViaje <= 18.5));



        var uvDM5BordeNorte = (new RegExp("\\bUV[-\\s]?(71" + B + "71A" + B + "75" + B + "76" + B + "ET51)\\b", "i")).test(destinoUpper);

        var norteBordeSalvadoPorBono = esDM5 && uvDM5BordeNorte && (urgenciaBono || esUltimoViajeBono) &&

                                       tiempoEfectivoBono <= 16 && distRecogida <= 1.8 && velocidad >= 20 && bsKmNeto >= 1.35;



        var uvDM5Plata  = (new RegExp("\\bUV[-\\s]?(" + ["64","65","66","67","68","69","70","ET30"].join(B) + ")\\b", "i")).test(destinoUpper) || norteBordeSalvadoPorBono;

        var uvDM5Neut   = (new RegExp("\\bUV[-\\s]?(72" + B + "73" + B + "74)\\b", "i")).test(destinoUpper);

        var uvDM5Fondo  = !norteBordeSalvadoPorBono && (new RegExp("\\bUV[-\\s]?(" + ["71","71A","75","76","77","78","79","79A","193","194","195","2\\d\\d","3\\d\\d","332","333A","AR","ET26","ET27","ET28","ET51","ET56","ET67","ET96","ET1\\d\\d","S1"].join(B) + ")\\b", "i")).test(destinoUpper);



        var uvDM4Segura = (new RegExp("\\bUV[-\\s]?(28" + B + "29" + B + "52" + B + "ET14)\\b", "i")).test(destinoUpper);



        var uvDM11Norte = (new RegExp("\\bUV[-\\s]?(13" + B + "14)\\b", "i")).test(destinoUpper);

        var uvDM11Oeste = /\bUV[-\s]?12\b/.test(destinoUpper) || /\bCA[ÑN]OTO\b/.test(destinoUpper);



        var rxDMProhib  = new RegExp("\\bDM[-\\s]?(" + ["3","6","7","8","9","10","12"].join(B) + ")\\b", "i");

        var rxUVProhib  = new RegExp("\\bUV[-\\s]?(" + ["84","93","99","159","213","250","331","337","PI","ED"].join(B) + ")\\b", "i");

        var esZonaProhibida = !esRumboOesteDesdeCasa && (rxDMProhib.test(destinoUpper) || rxUVProhib.test(destinoUpper) || (esDM4 && !uvDM4Segura));



        var dm11SalvadaPorRescate = ((urgenciaBono || esUltimoViajeBono || esViajeSobrepuesto) && tiempoEfectivoBono <= 14 && velocidad >= 18 && velViaje >= 17 && distRecogida <= 1.6);

        var dm11EnHoraPicoLenta = esDM11 && !uvDM11Norte && !uvDM11Oeste && !dm11SalvadaPorRescate && (

            (horaActual >= 16 && horaActual < 20) || (velocidad > 0 && velocidad < 20)

        );



        var nivelPrioridad  = "RIESGO_RECHAZO";

        var calidadZona     = "RIESGO_RECHAZO";

        var zonaNuevaParaIA = "NINGUNA";



        if (esUrubo) {

            nivelPrioridad = "URUBO_SIN_RETORNO";

            calidadZona    = "VETADA_INTERNA";

        } else if (uvVetadas || (esDM2 && uvDM2Vetada) || (esDM5 && uvDM5Fondo)) {

            nivelPrioridad = "VETADA_INTERNA";

            calidadZona    = "VETADA_INTERNA";

        } else if (esZonaProhibida) {

            nivelPrioridad = "ZONA_PROHIBIDA";

            calidadZona    = "ZONA_PROHIBIDA";

        } else if (dm11EnHoraPicoLenta) {

            nivelPrioridad = "DM11_HORA_PICO_LENTA";

            calidadZona    = "DM11_HORA_PICO_LENTA";

        } else if (esOroExtra || esDM1 || (esDM2 && uvDM2Oro) || (radarMatiActivo && enPuertaMati)) {

            nivelPrioridad = "ORO";

            calidadZona    = "PREMIUM";

        } else if (esComercialPuenteUrubo || esRumboOesteDesdeCasa || esPlataExtra || (esDM2 && uvDM2Plata) || (esDM5 && uvDM5Plata) || (esDM11 && uvDM11Norte)) {

            nivelPrioridad = "PLATA";

            calidadZona    = (esDM2 || esComercialPuenteUrubo) ? "PREMIUM" : "NEUTRAL";

        } else if ((esDM2 && uvDM2Neut) || (esDM5 && uvDM5Neut) || (esDM4 && uvDM4Segura) || esDM11) {

            nivelPrioridad = "NEUTRAL";

            calidadZona    = "NEUTRAL";

        } else {

            if (lugarDestino !== "Sin dato") {

                var rxCleanIA = new RegExp("[," + "\\r\\n\\" + B + "]", "g");

                zonaNuevaParaIA = lugarDestino.replace(rxCleanIA, " ").replace(/\s+/g, " ").trim();

            }

        }



        var aporteBonoPorViaje  = (buscandoBono130 && metaViajesBono > 0 && montoBono > 0) ? (montoBono / metaViajesBono) : 0;

        var gananciaNetaConBono = gananciaNeta + aporteBonoPorViaje;

        var bsKmNetoConBono     = gananciaNetaConBono / distTotal;

        var netoPorHoraConBono  = (gananciaNetaConBono / tiempoCicloReal) * 60;



        // -- 8b. PROTECCIÓN DE MARGEN DE ERROR EN EL RELOJ (NO ACEPTAR VIAJES DE 22-23M DESPUÉS DE LAS 18:00 SI FALTAN >= 4 VIAJES) --

        var topeRelojFinal = 99;

        if (buscandoBono130 && !esUltimoViajeBono) {

            if (horaActual === 19 && minActual >= 30) {

                var minReservaSiguientes   = Math.max(0, (viajesRestantesBono - 2) * 12 + 3);

                var minDisponiblesParaEste = minutosRestantesVentana - wazeMinutos - minReservaSiguientes;

                topeRelojFinal = Math.max(15, Math.floor(minDisponiblesParaEste));

            } else if (horaActual === 19 && viajesRestantesBono >= 3) {

                // Entre 19:00 y 19:29 si aún faltan >=3 viajes: tope 17m (18m en sobrepuesto) para no llegar ahogado a 19:30

                topeRelojFinal = esViajeSobrepuesto ? 18 : 17;

            } else if (horaActual === 18 && viajesRestantesBono >= 5) {

                // Entre 18:00 y 18:59 si faltan >=5 viajes: tope 19m (evita viajes de 23m como el de las 18:26 del 27/10)

                topeRelojFinal = esViajeSobrepuesto ? 20 : 19;

            }

        }



        // -- 9. ÁRBOL DE DECISIÓN --

        var decision = "EVALUAR";

        var colorUI  = "#FF9800";

        var motivo   = "Análisis estándar";



        var retornoEstimadoKm   = esViruViru ? 10.5 : (esUrubo ? 9.0 : 8.0);

        var costoRetorno        = retornoEstimadoKm * costoKm;

        var distTotalConRetorno = distTotal + retornoEstimadoKm;

        var bsKmNetoConRetorno  = (gananciaNeta - costoRetorno) / distTotalConRetorno;

        var justificaRetorno    = bsKmNetoConRetorno >= 1.60;



        if (esViruViru) {

            if (!buscandoBono130 && justificaRetorno) {

                decision = "EVALUAR"; colorUI = "#FF9800";

                motivo = "VV cubre retorno (" + bsKmNetoConRetorno.toFixed(2) + " neto c/retorno)";

            } else {

                decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Aeropuerto VV — no cubre retorno";

            }

        } else if (nivelPrioridad === "URUBO_SIN_RETORNO") {

            if (!buscandoBono130 && justificaRetorno) {

                decision = "EVALUAR"; colorUI = "#FF9800";

                motivo = "Urubó cubre retorno (" + bsKmNetoConRetorno.toFixed(2) + " neto c/retorno)";

            } else {

                decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Urubó/Condominio — demora garita y sin retorno";

            }

        } else if (nivelPrioridad === "ZONA_PROHIBIDA") {

            if (!buscandoBono130 && justificaRetorno) {

                decision = "EVALUAR"; colorUI = "#FF9800";

                motivo = "Zona prohibida pero cubre retorno (" + bsKmNetoConRetorno.toFixed(2) + ")";

            } else {

                decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Destino Este/Sur — sin retorno";

            }

        } else if (nivelPrioridad === "DM11_HORA_PICO_LENTA") {

            decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "DM-11 hora pico lenta — retorno largo";

        } else if (nivelPrioridad === "RIESGO_RECHAZO" || nivelPrioridad === "VETADA_INTERNA") {

            decision = "RECHAZAR"; colorUI = "#F44336";

            motivo = (zonaNuevaParaIA !== "NINGUNA") ? "Zona desconocida (enviada a IA)" : "Zona vetada";

        } else if (buscandoBono130) {

            // -- RAMA MODO BONO 130 Bs --

            var traficoCriticoBono = ((velocidad > 0 && velocidad < 15) || (velViaje > 0 && velViaje < 13))

                                     && !(tiempoEfectivoBono <= 14 && (nivelPrioridad === "ORO" || nivelPrioridad === "PLATA" || nivelPrioridad === "NEUTRAL"));



            var cortoRentableOro   = (tiempoEfectivoBono <= 15 && distRecogida <= 4.2 && bsKmNeto >= 1.30 && netoPorHoraConBono >= 50);

            var cortoRentablePlata = (tiempoEfectivoBono <= 15 && distRecogida <= 4.0 && bsKmNeto >= 1.40 && netoPorHoraConBono >= 54);

            var cortoRentableNeut  = (tiempoEfectivoBono <= 13 && distRecogida <= 3.0 && bsKmNeto >= 1.40 && netoPorHoraConBono >= 52);



            if (esUltimoViajeBono) {

                var acercaMatiUltimo = radarMatiActivo && (enPuertaMati || cercaMati);

                var recMaxUltimo     = (minutosRestantesVentana <= 20 || acercaMatiUltimo || esViajeSobrepuesto) ? 4.2 : 3.2;

                var pisoUltimo       = (minutosRestantesVentana <= 20 || acercaMatiUltimo || esViajeSobrepuesto) ? 0.65 : 1.00;

                if (traficoCriticoBono && minutosRestantesVentana > 15 && !acercaMatiUltimo) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Tráfico crítico";

                } else if ((distRecogida <= recMaxUltimo || cortoRentableOro) && bsKmNeto >= pisoUltimo && precioBruto >= 9) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = "Bono: último viaje evaluado (sella 130 Bs)";

                } else if (distRecogida > recMaxUltimo) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: recogida muy lejos / tarifa baja";

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bajo piso neto";

                }

            } else if (tiempoEfectivoBono > topeRelojFinal) {

                decision = "RECHAZAR"; colorUI = "#F44336";

                motivo = "Bono: viaje largo (excede tope " + topeRelojFinal + "m para cuidar margen)";

            } else if (traficoCriticoBono) {

                decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Tráfico crítico";

            } else if (nivelPrioridad === "ORO") {

                var maxMinOro        = Math.min(topeRelojFinal, (bsKmNeto >= 1.45 || esViajeSobrepuesto || (radarMatiActivo && enPuertaMati)) ? 20 : 19);

                var recMaxOro        = (tiempoEfectivoBono <= 16 || esViajeSobrepuesto || (radarMatiActivo && enPuertaMati)) ? 3.2 : 2.8;

                // Solo permite 21m en Oro antes de las 18:00 o en sobrepuesto; después de las 18:00 cuida tu margen

                var maxMinOroRescate = Math.min(topeRelojFinal, (horaActual < 18 || esViajeSobrepuesto) ? 21 : 19);



                if ((distRecogida <= recMaxOro || cortoRentableOro) && tiempoEfectivoBono <= maxMinOro && bsKmNeto >= 1.00 && precioBruto >= 9 && netoPorHoraConBono >= 46) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esViajeSobrepuesto ? "Bono: sobrepuesto en cadena" : "Bono: micropulga";

                } else if ((urgenciaBono || esViajeSobrepuesto) && (distRecogida <= 3.5 || cortoRentableOro) && tiempoEfectivoBono <= maxMinOroRescate && bsKmNeto >= 0.85 && precioBruto >= 9 && netoPorHoraConBono >= 42) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esViajeSobrepuesto ? "Bono: sobrepuesto en cadena" : "Bono: rescate ritmo";

                } else if (distRecogida > ((urgenciaBono || esViajeSobrepuesto) ? 3.5 : recMaxOro)) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: recogida muy lejos / tarifa baja";

                } else if (tiempoEfectivoBono > ((urgenciaBono || esViajeSobrepuesto) ? maxMinOroRescate : maxMinOro)) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: viaje largo";

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bajo piso neto";

                }

            } else if (nivelPrioridad === "PLATA") {

                var maxMinPlata        = Math.min(topeRelojFinal, (bsKmNeto >= 1.65 || esViajeSobrepuesto || esRumboOesteDesdeCasa || (radarMatiActivo && cercaMati)) ? 19 : 18);

                var recMaxPlata        = (tiempoEfectivoBono <= 14 || esViajeSobrepuesto || esRumboOesteDesdeCasa) ? 2.8 : 2.5;

                var maxMinPlataRescate = Math.min(topeRelojFinal, (horaActual < 18 || esViajeSobrepuesto) ? 20 : 18);



                if (esRumboOesteDesdeCasa && bsKmNeto >= 1.20 && precioBruto >= 9) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = "Bono: salida de casa rumbo 4to Anillo/Oeste";

                } else if (esComercialPuenteUrubo && bsKmNeto >= 1.35 && precioBruto >= 12) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = "Bono: comercial Puente Urubó (retorno rápido a San Martín)";

                } else if (norteBordeSalvadoPorBono) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = "Bono: rescate norte rápido (<=16m)";

                } else if ((distRecogida <= recMaxPlata || cortoRentablePlata) && tiempoEfectivoBono <= maxMinPlata && bsKmNeto >= 1.20 && precioBruto >= 9 && netoPorHoraConBono >= 48) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esViajeSobrepuesto ? "Bono: sobrepuesto en cadena" : "Bono: micropulga";

                } else if ((urgenciaBono || esViajeSobrepuesto) && (distRecogida <= 3.1 || cortoRentablePlata) && tiempoEfectivoBono <= maxMinPlataRescate && bsKmNeto >= 0.95 && precioBruto >= 9 && netoPorHoraConBono >= 44) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esViajeSobrepuesto ? "Bono: sobrepuesto en cadena" : "Bono: rescate ritmo";

                } else if (distRecogida > ((urgenciaBono || esViajeSobrepuesto) ? 3.1 : recMaxPlata)) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: recogida muy lejos / tarifa baja";

                } else if (tiempoEfectivoBono > ((urgenciaBono || esViajeSobrepuesto) ? maxMinPlataRescate : maxMinPlata)) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: viaje largo";

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bajo piso neto";

                }

            } else {

                // ZONA NEUTRAL EN BONO (UV-52, UV-28, UV-29, UV-12, etc.):

                // Permite sumar los 3 viajes/hora cuando hay poca demanda (como los de las 16:05 y 17:06 del 27/10 en UV-52)

                var recMaxNeut = (urgenciaBono || esViajeSobrepuesto || horaActual < 18) ? 2.5 : 2.0;

                var tMaxNeut   = Math.min(topeRelojFinal, (urgenciaBono || esViajeSobrepuesto) ? 16 : 15);

                var pisoNeutB  = (urgenciaBono || esViajeSobrepuesto) ? 1.15 : 1.40;

                var velOkNeut  = (tiempoEfectivoBono <= 12) || (velocidad >= 17 && velViaje >= 15);



                if (distRecogida > recMaxNeut && !cortoRentableNeut) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: recogida muy lejos / tarifa baja";

                } else if (tiempoEfectivoBono > tMaxNeut) {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bono: viaje largo";

                } else if (bsKmNeto >= pisoNeutB && velOkNeut && netoPorHoraConBono >= 46) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esViajeSobrepuesto ? "Bono: sobrepuesto en cadena" : (urgenciaBono ? "Bono: rescate ritmo" : "Bono: micropulga");

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Neutral sin bono";

                }

            }

        } else {

            // -- RAMA RENTABILIDAD PURA (Fuera de bono) --

            var descuentoRumboMati = (radarMatiActivo && enPuertaMati) ? 0.35 : ((radarMatiActivo && cercaMati) ? 0.20 : 0.0);

            var descuentoCadena    = esViajeSobrepuesto ? 0.10 : 0.0;

            var descuentoSalida    = esRumboOesteDesdeCasa ? 0.25 : 0.0;



            var traficoCriticoNormal = ((velocidad > 0 && velocidad < 15) || (velViaje > 0 && velViaje < 13))

                                       && !(nivelPrioridad === "ORO" && tiempoTotal <= 10 && bsKmNeto >= 2.20);



            if (traficoCriticoNormal) {

                decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Tráfico crítico";

            } else if (recogidaLentaSinPago && !esRumboOesteDesdeCasa) {

                decision = "RECHAZAR"; colorUI = "#F44336";

                motivo = "Recogida lenta (" + velRecogida.toFixed(0) + " km/h — sin bono Uber no paga recogida)";

            } else if (recogidaMalaNormal && !esRumboOesteDesdeCasa) {

                decision = "RECHAZAR"; colorUI = "#F44336";

                motivo = bajoEstandarCategoria

                    ? "Tramo vacío largo (bajo estándar " + categoriaViaje + ", " + bsKmBruto.toFixed(2) + "<" + umbralCategoria.toFixed(2) + ")"

                    : "Tramo vacío largo";

            } else if (nivelPrioridad === "ORO") {

                var pisoOro = Math.max(1.30, pisoNetoPorHora - 0.15 - descuentoRumboMati - descuentoCadena - descuentoSalida);

                if (bsKmNeto >= pisoOro || netoPorHora >= (enSequia ? 33 : 37) - (descuentoRumboMati * 15)) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esRumboOesteDesdeCasa ? "Salida de casa rumbo Oeste" : (esViajeSobrepuesto ? "Premium en cadena" : "Premium rentable");

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bajo piso neto";

                }

            } else if (nivelPrioridad === "PLATA") {

                var pisoPlata = Math.max(1.30, pisoNetoPorHora - descuentoRumboMati - descuentoCadena - descuentoSalida);

                if (esRumboOesteDesdeCasa && bsKmNeto >= 1.20) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = "Salida de casa rumbo 4to Anillo/Oeste";

                } else if (esComercialPuenteUrubo && bsKmNeto >= 1.60) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = "Comercial Puente Urubó (retorno rápido)";

                } else if (bsKmNeto >= pisoPlata && netoPorHora >= (enSequia ? 33 : 36) - (descuentoRumboMati * 15)) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50";

                    motivo = esViajeSobrepuesto ? "Premium en cadena" : "Premium rentable";

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Bajo piso neto";

                }

            } else if (nivelPrioridad === "NEUTRAL") {

                if (netoPorHora >= (enSequia ? 38 : 45) && bsKmNeto >= pisoNetoPorHora + (enSequia ? 0.10 : 0.20) - descuentoCadena) {

                    decision = "ACEPTAR"; colorUI = "#4CAF50"; motivo = "Neutral rentable";

                } else {

                    decision = "RECHAZAR"; colorUI = "#F44336"; motivo = "Neutral sin bono";

                }

            }

        }



        if (errorContadorBono) {

            motivo += " (contador de bono ilegible: verificar MD_bono_viajes_completados)";

        }

        if (enSequia) {

            motivo += " (piso relajado por sequía " + pisoBase.toFixed(2) + "→" + pisoTrasSequia.toFixed(2) + ")";

        }

        if (enPresionBono) {

            motivo += " (piso relajado por meta bono " + pisoBase.toFixed(2) + "→" + pisoTrasBono.toFixed(2)

                    + ", faltan " + viajesRestantesBono + "/" + metaViajesBono + " viajes)";

        }



        // -- 9b. DETALLE PARA VOZ Y PANTALLA --

        var textoDetalle  = "";

        var colorDetalle  = colorUI;

        var textoPantalla = "";

        try {

            var rxZonaCorta = new RegExp("\\b(DM" + B + "UV)[-\\s]?[A-Z0-9]+", "i");

            var zonaMatch   = destinoUpper.match(rxZonaCorta);

            var zonaCorta   = esUrubo ? "URUBO" : (esComercialPuenteUrubo ? "PTE-URUBO" : (zonaMatch ? zonaMatch[0].replace(/\s+/,"-") : "S/Z"));

            var motivoCorto = motivo.split(" (")[0];

            var lineaZona   = zonaCorta + " [" + nivelPrioridad + "] · " + motivoCorto + (tagHijoOverlay !== "" ? " " + tagHijoOverlay : "");



            var etVel = function(km, min) {

                if (km < 1 || min < 3) return "S/D";

                var v = km / (min / 60);

                if (v < 15) return "Colapso";

                if (v < 25) return "Lento";

                if (v < 40) return "Normal";

                return "Fluido";

            };

            var lineaVel = "Rec:" + etVel(distRecogida, tiempoRecogida) + " · Viaje:" + etVel(distViaje, tiempoViaje);



            var lineaRecoge = "";

            var tRecoge = null;

            if (wazeMinutos > 0) {

                tRecoge = new Date(ahora.getTime() + (wazeMinutos + tiempoRecogida) * 60000);

                lineaRecoge = "Recoges ~" + tRecoge.getHours() + ":" + String(tRecoge.getMinutes()).padStart(2,'0');

            }



            var REF_VERDE_BS_H   = 70;

            var REF_NARANJA_BS_H = 50;



            var valorBonoViaje = 0;

            if (buscandoBono130 && montoBono > 0 && metaViajesBono > 0

                && (esUltimoViajeBono || (ritmoDisponibleMinPorViaje !== null && ritmoDisponibleMinPorViaje >= 10))) {

                valorBonoViaje = montoBono / metaViajesBono;

            }



            var lineaBono = "";

            var hNetoBono = 0;

            if (valorBonoViaje > 0) {

                var netoConBono = gananciaNeta + valorBonoViaje;

                var kmNetoBono  = netoConBono / distTotal;

                hNetoBono       = (netoConBono / tiempoCicloReal) * 60;

                lineaBono = "(+" + valorBonoViaje.toFixed(0) + ": " + kmNetoBono.toFixed(2) + " Bs/Km · " + Math.round(hNetoBono) + " Bs/h)";

                colorDetalle = hNetoBono >= REF_VERDE_BS_H ? "#4CAF50" : (hNetoBono >= REF_NARANJA_BS_H ? "#FF9800" : "#F44336");

            }



            textoPantalla = lineaZona + " // " + lineaVel + (lineaRecoge !== "" ? " · " + lineaRecoge : "")

                          + (lineaBono !== "" ? " // " + lineaBono : "");



            var rxSimbolosVoz = new RegExp("[—–\\-:\\/<>()+·~\"'\\=" + "\\[\\]!\\" + B + "]", "g");

            var paraVoz = function(t) {

                return String(t)

                    .replace(/DM-(\d+)/gi, "D M $1")

                    .replace(/UV-([A-Z0-9]+)/gi, "U V $1")

                    .replace(/\bVV\b/g, "Viru Viru")

                    .replace(/-(\d)/g, "menos $1")

                    .replace(/(\d+)\.(\d+)/g, "$1 coma $2")

                    .replace(rxSimbolosVoz, " ")

                    .replace(/\s+/g, " ").trim();

            };

            var partesVoz = [];

            partesVoz.push(decision === "ACEPTAR" ? "Aceptar" : (decision === "RECHAZAR" ? "Rechazar" : "Evaluar"));

            if (esUrubo) partesVoz.push("zona Urubó");

            else if (esComercialPuenteUrubo) partesVoz.push("comercial Puente Urubó");

            else if (zonaMatch) partesVoz.push("zona " + zonaCorta);

            if (nivelPrioridad === "ORO" || nivelPrioridad === "PLATA" || nivelPrioridad === "NEUTRAL") {

                partesVoz.push("prioridad " + nivelPrioridad.toLowerCase());

            }

            partesVoz.push(motivoCorto);

            if (vozHijo !== "") {

                partesVoz.push(vozHijo);

            }

            var velRec = etVel(distRecogida, tiempoRecogida);

            var velVia = etVel(distViaje, tiempoViaje);

            if (velRec === "Colapso") partesVoz.push("recogida en colapso");

            else if (velRec === "Lento") partesVoz.push("recogida lenta");

            if (velVia === "Colapso") partesVoz.push("viaje en colapso");

            else if (velVia === "Lento") partesVoz.push("viaje lento");

            if (wazeMinutos > 0 && tRecoge !== null) {

                var mR = tRecoge.getMinutes();

                partesVoz.push("recoges a las " + tRecoge.getHours() + (mR === 0 ? " en punto" : " y " + mR));

            }

            if (valorBonoViaje > 0) {

                partesVoz.push("con bono " + Math.round(hNetoBono) + " bolivianos por hora");

            }

            textoDetalle = paraVoz(partesVoz.join(". "));

        } catch (e2) {

            textoDetalle = "";

            colorDetalle = colorUI;

        }



        // -- 10. OVERLAY COMPACTO --

        var etiquetaVel;

        if      (velocidad === 0) etiquetaVel = "S/D";

        else if (velocidad < 15)  etiquetaVel = "Col";

        else if (velocidad < 25)  etiquetaVel = "Len";

        else if (velocidad < 40)  etiquetaVel = "Nor";

        else                      etiquetaVel = "Flu";



        var catLabel = esComfort ? "C" : (esUberPet ? "P" : "X");



        var margenBonoTexto = "";

        if (bonoActivoUI) {

            if (errorContadorBono) {

                margenBonoTexto = " " + B + " BONO:ERROR";

            } else if (viajesRestantesBono <= 0) {

                margenBonoTexto = " " + B + " ✅";

            } else if (esUltimoViajeBono) {

                margenBonoTexto = " " + B + " 1v·" + (minutosRestantesVentana < 1

                    ? Math.max(0, Math.ceil(minutosRestantesVentana * 60)) + "s"

                    : Math.ceil(minutosRestantesVentana) + "m") + "🎯";

            } else if (ritmoDisponibleMinPorViaje !== null) {

                var alertaRitmo = ritmoDisponibleMinPorViaje < 13 ? "⚠️" : "";

                margenBonoTexto = " " + B + " " + viajesRestantesBono + "v·" + Math.max(0, Math.ceil(ritmoDisponibleMinPorViaje)) + "m" + alertaRitmo;

            }

        }



        var uvMatch = destinoUpper.match(/\bUV[-\s]?[A-Z0-9]+/);

        var dmMatch = destinoUpper.match(/\bDM[-\s]?\d+/);

        var idZonaCorto = esUrubo ? "URUBO" : (esComercialPuenteUrubo ? "PTE-URU" : (uvMatch ? uvMatch[0].replace(/\s+/,"-") : (dmMatch ? dmMatch[0].replace(/\s+/,"-") : "S/Z")));



        var nivCorto = {

            "ORO": "ORO",

            "PLATA": "PLA",

            "NEUTRAL": "NEU",

            "URUBO_SIN_RETORNO": "VET",

            "VETADA_INTERNA": "VET",

            "ZONA_PROHIBIDA": "PRO",

            "DM11_HORA_PICO_LENTA": "DM11",

            "RIESGO_RECHAZO": "?"

        }[nivelPrioridad];

        if (!nivCorto) nivCorto = "?";



        var motCorto = "Eval";

        if      (/último viaje/i.test(motivo))                                motCorto = "🎯Ultimo!";

        else if (/salida de casa/i.test(motivo))                              motCorto = "🏠Salida";

        else if (/comercial Puente/i.test(motivo))                            motCorto = "🌉PteUrubo";

        else if (/norte rápido/i.test(motivo))                                motCorto = "⚡Norte15m";

        else if (/Recogida lenta/i.test(motivo))                              motCorto = "RecLenta";

        else if (/Urubó/i.test(motivo))                                       motCorto = "Urubo";

        else if (/en cadena/i.test(motivo))                                   motCorto = "🔗Cadena";

        else if (/excede tope/i.test(motivo))                                 motCorto = ">" + topeRelojFinal + "m";

        else if (/rescate/i.test(motivo))                                     motCorto = "⚡Rescate";

        else if (/micropulga/i.test(motivo))                                  motCorto = "Pulga";

        else if (/Premium rentable/i.test(motivo))                            motCorto = "Rent";

        else if (/Neutral rentable/i.test(motivo))                            motCorto = "Rent";

        else if (/recogida/i.test(motivo) || /Tramo vac/i.test(motivo))       motCorto = "RecLarga";

        else if (/viaje largo/i.test(motivo))                                 motCorto = "Largo";

        else if (/Tráfico/i.test(motivo))                                     motCorto = "Trafico";

        else if (/Bajo piso/i.test(motivo) || /sin bono/i.test(motivo))       motCorto = "TarBaja";

        else if (/DM-11/i.test(motivo))                                       motCorto = "Pico";

        else if (/Este\/Sur/i.test(motivo))                                   motCorto = "SinRet";

        else if (/desconocida/i.test(motivo))                                 motCorto = "Desconoc";

        else if (/vetada/i.test(motivo))                                      motCorto = uvVetadas ? "Mutua/Vet" : "UV-Vet";

        else if (/retorno/i.test(motivo))                                     motCorto = "Retorno";



        var tagAuditoria = " " + B + " " + idZonaCorto + "[" + nivCorto + ":" + motCorto + tagHijoOverlay + "]";



        var overlayText = catLabel + " " + B + " " + bsKmNeto.toFixed(2) + "Bs" + estadoMercado

                        + " " + B + " " + textoTiempo + " " + B + " " + etiquetaVel + margenBonoTexto + tagAuditoria;



        // -- 11. CSV CON 23 CAMPOS --

        var fechaStr = ahora.getFullYear() + "-"

            + String(ahora.getMonth()+1).padStart(2,'0') + "-"

            + String(ahora.getDate()).padStart(2,'0');



        var limpiar = function(s) {

            return String(s).replace(/[,\r\n]/g," ").replace(/\s+/g," ").trim();

        };



        var csvLine = [

            tripId, fechaStr, horaOferta,

            buscandoBono130 ? "BONO" : "NORMAL",

            limpiar(lugarRecogida), limpiar(lugarDestino), calidadZona,

            tiempoRecogida, distRecogida, tiempoViaje, distViaje,

            precioBruto.toFixed(2), costoOperativo.toFixed(2), gananciaNeta.toFixed(2),

            bsKmBruto.toFixed(3), bsKmNeto.toFixed(3), netoPorHora.toFixed(1),

            pisoNetoPorHora.toFixed(2), promedioMercado.toFixed(2),

            wazeMinutos, horaFinStr, limpiar(motivo), decision

        ].join(",");



        // -- 12. SALIDA FORMATEADA PARA ARREGLO GLOBAL MD_panel_viaje (POSICIÓN [10]) --

        // 6 elementos separados por "~": [0]Categoría ~ [1]Tarifa ~ [2]DistViaje ~ [3]TiempoViaje ~ [4]HoraLlegada ~ [5]Destino

        var catPanelStr = esComfort ? "Comfort" : (esUberPet ? "Uber Pet" : "UberX");

        var destPanelStr = limpiar(lugarDestino).replace(/~\s*/g, " ").replace(/\s*-\s*SANTA CRUZ DE LA SIERRA/i, "");

        var panelViajeStr = [

            catPanelStr,

            precioBruto.toFixed(0) + " Bs",

            distViaje.toFixed(1) + " km",

            tiempoViaje.toFixed(0) + " min",

            horaFinStr,

            destPanelStr

        ].join("~");



        return tripId + SEP + colorUI + SEP + overlayText + SEP + csvLine + SEP + emaNueva + SEP + ahora.getTime()

             + SEP + textoDetalle + SEP + colorDetalle + SEP + textoPantalla + SEP + zonaNuevaParaIA + SEP + panelViajeStr;



    } catch (error) {

        return "ERR_V8" + SEP + "#607D8B" + SEP + "⚠️ Error: " + error.message + SEP + "ERROR" + SEP + "0" + SEP + "{v=MD_hora_ultima_oferta}" + SEP + SEP + SEP + "NINGUNA" + SEP + "";

    }

})();

resultadoFinal;
