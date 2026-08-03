import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CicloEscolar } from '../types';
import * as XLSX from 'xlsx';

const DatabaseBackup: React.FC = () => {
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [loadingCycles, setLoadingCycles] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    const fetchCycles = async () => {
      setLoadingCycles(true);
      try {
        const { data, error } = await supabase
          .from('ciclos_escolares')
          .select('*')
          .order('fecha_inicio', { ascending: false });

        if (error) throw error;
        setCycles(data || []);
        
        // Predeterminar el ciclo activo
        const active = data?.find(c => c.es_activo);
        if (active) {
          setSelectedCycleId(active.id);
        } else if (data && data.length > 0) {
          setSelectedCycleId(data[0].id);
        }
      } catch (err) {
        console.error("Error al cargar ciclos escolares:", err);
      } finally {
        setLoadingCycles(false);
      }
    };

    fetchCycles();
  }, []);

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const handleDownload = async (format: 'xlsx' | 'json') => {
    if (!selectedCycleId) {
      alert("Por favor selecciona un ciclo escolar.");
      return;
    }

    const selectedCycle = cycles.find(c => c.id === selectedCycleId);
    if (!selectedCycle) {
      alert("Ciclo escolar no encontrado.");
      return;
    }

    setExporting(true);
    try {
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      // 1. Obtener Estudiantes del Ciclo
      setProgressMsg("Consultando Estudiantes...");
      let students: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data: chunk, error: studentErr } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('ciclo_id', selectedCycleId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (studentErr) throw studentErr;
        if (chunk && chunk.length > 0) {
          students = [...students, ...chunk];
          if (chunk.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 2. Obtener Asignaciones de Tutoría del Ciclo
      setProgressMsg("Consultando Tutorías...");
      let tutorias: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data: chunk, error: tutoriasErr } = await supabase
          .from('tutorias')
          .select(`
            id,
            tutor_id,
            estudiante_id,
            nombre_grupo,
            docentes (id, nombre, email, numero_empleado),
            estudiantes (id, nombre)
          `)
          .eq('ciclo_id', selectedCycleId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (tutoriasErr) throw tutoriasErr;
        if (chunk && chunk.length > 0) {
          tutorias = [...tutorias, ...chunk];
          if (chunk.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 3. Obtener Grupos Académicos del Ciclo
      setProgressMsg("Consultando Carga Docente (Grupos)...");
      let groups: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data: chunk, error: groupsErr } = await supabase
          .from('grupos')
          .select(`
            id,
            nombre_grupo,
            materia_id,
            docente_id,
            turno,
            materias (codigo, nombre, carrera, semestre, creditos),
            docentes (id, nombre, email, numero_empleado)
          `)
          .eq('ciclo_id', selectedCycleId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (groupsErr) throw groupsErr;
        if (chunk && chunk.length > 0) {
          groups = [...groups, ...chunk];
          if (chunk.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 4. Obtener Actividades del Ciclo
      setProgressMsg("Consultando Actividades...");
      const groupIds = groups.map(g => g.id) || [];
      let activities: any[] = [];
      if (groupIds.length > 0) {
        page = 0;
        hasMore = true;
        while (hasMore) {
          const { data: chunk, error: actsErr } = await supabase
            .from('actividades')
            .select('*')
            .in('grupo_id', groupIds)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (actsErr) throw actsErr;
          if (chunk && chunk.length > 0) {
            activities = [...activities, ...chunk];
            if (chunk.length < pageSize) hasMore = false;
            page++;
          } else {
            hasMore = false;
          }
        }
      }

      // 5. Obtener Calificaciones del Ciclo
      setProgressMsg("Consultando Calificaciones...");
      const activityIds = activities.map(a => a.id);
      let grades: any[] = [];
      if (activityIds.length > 0) {
        page = 0;
        hasMore = true;
        while (hasMore) {
          const { data: chunk, error: gradesErr } = await supabase
            .from('calificaciones')
            .select('*')
            .in('actividad_id', activityIds)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (gradesErr) throw gradesErr;
          if (chunk && chunk.length > 0) {
            grades = [...grades, ...chunk];
            if (chunk.length < pageSize) hasMore = false;
            page++;
          } else {
            hasMore = false;
          }
        }
      }

      // 6. Obtener Asistencias del Ciclo
      setProgressMsg("Consultando Registros de Asistencia...");
      let attendances: any[] = [];
      if (groupIds.length > 0) {
        page = 0;
        hasMore = true;
        while (hasMore) {
          const { data: chunk, error: attsErr } = await supabase
            .from('asistencias')
            .select('*')
            .in('grupo_id', groupIds)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (attsErr) throw attsErr;
          if (chunk && chunk.length > 0) {
            attendances = [...attendances, ...chunk];
            if (chunk.length < pageSize) hasMore = false;
            page++;
          } else {
            hasMore = false;
          }
        }
      }

      // 7. Obtener Intervenciones del Ciclo
      setProgressMsg("Consultando Historial de Intervenciones...");
      let interventions: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data: chunk, error: intsErr } = await supabase
          .from('intervenciones')
          .select('*')
          .eq('ciclo_id', selectedCycleId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (intsErr) throw intsErr;
        if (chunk && chunk.length > 0) {
          interventions = [...interventions, ...chunk];
          if (chunk.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 8. Obtener Acentuaciones (Subgrupos)
      setProgressMsg("Consultando Inscripciones a Acentuaciones...");
      let studentAccs: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data: chunk, error: accsErr } = await supabase
          .from('estudiantes_acentuacion')
          .select(`
            id,
            estudiante_id,
            acentuacion_id,
            acentuaciones (id, nombre, carrera, tipo_optativa, semestre)
          `)
          .eq('ciclo_id', selectedCycleId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (accsErr) throw accsErr;
        if (chunk && chunk.length > 0) {
          studentAccs = [...studentAccs, ...chunk];
          if (chunk.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 9. Obtener Docentes
      setProgressMsg("Procesando Datos de Personal...");
      let allDocentes: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data: chunk, error: docErr } = await supabase
          .from('docentes')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (docErr) throw docErr;
        if (chunk && chunk.length > 0) {
          allDocentes = [...allDocentes, ...chunk];
          if (chunk.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      // PROCESAMIENTO Y COMPILACIÓN
      setProgressMsg("Compilando información...");

      // Mapeos rápidos para cruces de datos
      const studentsMap = (students || []).reduce((acc: any, s: any) => {
        acc[s.id] = s;
        return acc;
      }, {});

      const teachersMap = (allDocentes || []).reduce((acc: any, t: any) => {
        acc[t.id] = t;
        return acc;
      }, {});

      const groupsMap = (groups || []).reduce((acc: any, g: any) => {
        const doc = getRelation(g.docentes);
        const mat = getRelation(g.materias);
        acc[g.id] = {
          ...g,
          docente: doc,
          materia: mat
        };
        return acc;
      }, {});

      const activitiesMap = activities.reduce((acc: any, act: any) => {
        const g = groupsMap[act.grupo_id] || {};
        acc[act.id] = {
          ...act,
          grupo: g
        };
        return acc;
      }, {});

      // Tutorías por estudiante
      const studentTutorMap = (tutorias || []).reduce((acc: any, t: any) => {
        const doc = getRelation(t.docentes);
        if (t.estudiante_id && doc) {
          acc[t.estudiante_id] = doc.nombre;
        }
        return acc;
      }, {});

      // Acentuaciones por estudiante
      const studentAccMap = (studentAccs || []).reduce((acc: any, sa: any) => {
        const accInfo = getRelation(sa.acentuaciones);
        if (sa.estudiante_id && accInfo) {
          acc[sa.estudiante_id] = accInfo.nombre;
        }
        return acc;
      }, {});

      // Calificaciones por estudiante
      const studentGradesMap = grades.reduce((acc: any, g: any) => {
        if (!acc[g.estudiante_id]) acc[g.estudiante_id] = [];
        acc[g.estudiante_id].push(g);
        return acc;
      }, {});

      // Asistencias por estudiante
      const studentAttsMap = attendances.reduce((acc: any, a: any) => {
        if (!acc[a.estudiante_id]) acc[a.estudiante_id] = [];
        acc[a.estudiante_id].push(a);
        return acc;
      }, {});

      // Intervenciones por estudiante
      const studentIntsMap = (interventions || []).reduce((acc: any, i: any) => {
        if (!acc[i.estudiante_id]) acc[i.estudiante_id] = [];
        acc[i.estudiante_id].push(i);
        return acc;
      }, {});

      if (format === 'json') {
        setProgressMsg("Generando archivo JSON...");
        const jsonBackup = {
          cicloEscolar: selectedCycle,
          fechaGeneracion: new Date().toISOString(),
          estudiantes: (students || []).map(s => ({
            ...s,
            tutor: studentTutorMap[s.id] || null,
            acentuacion: studentAccMap[s.id] || null,
            calificaciones: studentGradesMap[s.id] || [],
            asistencias: studentAttsMap[s.id] || [],
            intervenciones: studentIntsMap[s.id] || []
          })),
          grupos: (groups || []).map(g => {
            const groupActs = activities.filter(a => a.grupo_id === g.id);
            return {
              ...g,
              docente: getRelation(g.docentes),
              materia: getRelation(g.materias),
              actividades: groupActs.map(act => ({
                ...act,
                calificaciones: grades.filter(gr => gr.actividad_id === act.id)
              })),
              asistencias: attendances.filter(att => att.grupo_id === g.id)
            };
          }),
          tutorias: (tutorias || []).map(t => ({
            ...t,
            tutor: getRelation(t.docentes),
            estudiante: getRelation(t.estudiantes)
          }))
        };

        const jsonStr = JSON.stringify(jsonBackup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `respaldo_STA_${selectedCycle.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setProgressMsg("Dando formato a las hojas de Excel...");

        // HOJA 1: RESUMEN
        const resumenData = [
          { "Propiedad": "Sistema", "Valor": "STA-FCQB - Trayectoria Académica" },
          { "Propiedad": "Ciclo Escolar", "Valor": selectedCycle.nombre },
          { "Propiedad": "Fecha de Inicio", "Valor": selectedCycle.fecha_inicio },
          { "Propiedad": "Fecha de Fin", "Valor": selectedCycle.fecha_fin },
          { "Propiedad": "Estatus", "Valor": selectedCycle.es_activo ? "ACTIVO" : "INACTIVO" },
          { "Propiedad": "Fecha de Generación", "Valor": new Date().toLocaleString() },
          { "Propiedad": "Total de Estudiantes", "Valor": students?.length || 0 },
          { "Propiedad": "Total de Grupos Académicos", "Valor": groups?.length || 0 },
          { "Propiedad": "Total de Actividades", "Valor": activities.length },
          { "Propiedad": "Total de Calificaciones", "Valor": grades.length },
          { "Propiedad": "Total de Registros Asistencia", "Valor": attendances.length },
          { "Propiedad": "Total de Intervenciones", "Valor": interventions?.length || 0 }
        ];

        // HOJA 2: ESTUDIANTES
        const estudiantesSheet = (students || []).map(s => {
          const sGrades = studentGradesMap[s.id] || [];
          const sAtts = studentAttsMap[s.id] || [];
          const sInts = studentIntsMap[s.id] || [];

          // Calcular promedio ciclo
          let sumCycle = 0;
          let countCycle = 0;
          sGrades.forEach((g: any) => {
            const act = activitiesMap[g.actividad_id];
            if (act) {
              const maxPts = act.puntos_max || 10;
              const normGrade = (g.calificacion / maxPts) * 10;
              sumCycle += normGrade;
              countCycle++;
            }
          });
          const avgCycle = countCycle > 0 ? (sumCycle / countCycle).toFixed(2) : "N/A";

          // Calcular porcentaje asistencia
          const totalClases = sAtts.length;
          const asistenciasCount = sAtts.filter((a: any) => a.presente).length;
          const pctAtt = totalClases > 0 ? `${Math.round((asistenciasCount / totalClases) * 100)}%` : "100%";

          return {
            "Matrícula": s.id,
            "Nombre Completo": s.nombre,
            "Carrera": s.carrera,
            "Semestre": s.semestre,
            "Grupo": s.grupo,
            "Turno": s.turno,
            "Promedio Acumulado General": s.promedio_acumulado,
            "Promedio Calificaciones en Ciclo": avgCycle,
            "Total Calificaciones Evaluadas": countCycle,
            "Porcentaje Asistencia": pctAtt,
            "Asistencias Registradas": asistenciasCount,
            "Faltas Registradas": totalClases - asistenciasCount,
            "Nivel de Riesgo": s.nivel_riesgo === 'HIGH' ? 'ALTO' : s.nivel_riesgo === 'MEDIUM' ? 'MEDIO' : 'BAJO',
            "Tutor Asignado": studentTutorMap[s.id] || "Sin Asignar",
            "Materia Acentuación": studentAccMap[s.id] || "Ninguna",
            "Factores Personales": (s.factores_personales || []).join(", "),
            "Factores Académicos": (s.factores_academicos || []).join(", "),
            "Factores Institucionales": (s.factores_institucionales || []).join(", ")
          };
        });

        // HOJA 3: DOCENTES
        // Filtrar docentes que tienen al menos un grupo en este ciclo
        const teacherIdsInCycle = new Set(groups?.map(g => g.docente_id).filter(Boolean));
        const docentesSheet = (allDocentes || [])
          .filter(t => teacherIdsInCycle.has(t.id) || (Array.isArray(t.rol) ? t.rol.includes('DOCENTE') : t.rol === 'DOCENTE'))
          .map(t => {
            const tGroups = (groups || []).filter(g => g.docente_id === t.id);
            const gNames = tGroups.map(g => g.nombre_grupo).join(", ");
            const sNames = tGroups.map(g => getRelation(g.materias)?.nombre).filter(Boolean).join(", ");
            const tActsCount = activities.filter(a => a.docente_id === t.id || groupsMap[a.grupo_id]?.docente_id === t.id).length;

            return {
              "Número de Empleado": t.numero_empleado || "N/A",
              "Nombre Completo": t.nombre,
              "Email": t.email,
              "Cantidad Grupos Impartidos": tGroups.length,
              "Grupos Asignados": gNames || "Ninguno",
              "Materias Impartidas": sNames || "Ninguna",
              "Total Actividades Creadas": tActsCount
            };
          });

        // HOJA 4: TUTORES
        // Filtrar docentes que son tutores o tienen tutorados en este ciclo
        const tutorIdsInCycle = new Set(tutorias?.map(t => t.tutor_id).filter(Boolean));
        const tutoresSheet = (allDocentes || [])
          .filter(t => tutorIdsInCycle.has(t.id) || (Array.isArray(t.rol) ? t.rol.includes('TUTOR') : t.rol === 'TUTOR'))
          .map(t => {
            const tTutorias = (tutorias || []).filter(tut => tut.tutor_id === t.id);
            const studentList = tTutorias.map(tut => {
              const est = getRelation(tut.estudiantes);
              return est ? `${est.id} - ${est.nombre}` : tut.estudiante_id;
            }).join("; ");

            return {
              "Número de Empleado": t.numero_empleado || "N/A",
              "Nombre Completo": t.nombre,
              "Email": t.email,
              "Cantidad Estudiantes Tutorados": tTutorias.length,
              "Estudiantes Asignados": studentList || "Ninguno"
            };
          });

        // HOJA 5: MATERIAS Y GRUPOS
        const gruposSheet = (groups || []).map(g => {
          const mat = getRelation(g.materias);
          const doc = getRelation(g.docentes);
          const stCount = (students || []).filter(s => s.grupo === g.nombre_grupo).length;

          return {
            "ID Grupo": g.id,
            "Nombre Grupo": g.nombre_grupo,
            "Turno": g.turno,
            "Código Materia": mat?.codigo || "N/A",
            "Materia": mat?.nombre || "N/A",
            "Carrera": mat?.carrera || "N/A",
            "Semestre": mat?.semestre || "N/A",
            "Créditos": mat?.creditos || "N/A",
            "Docente Asignado": doc?.nombre || "Sin Asignar",
            "Estudiantes en Matrícula": stCount
          };
        });

        // HOJA 6: ACTIVIDADES
        const actividadesSheet = activities.map(act => {
          const g = groupsMap[act.grupo_id] || {};
          const doc = teachersMap[act.docente_id] || g.docente || {};

          return {
            "ID Actividad": act.id,
            "Título": act.titulo,
            "Descripción": act.descripcion || "",
            "Tipo": act.tipo,
            "Unidad": act.unidad,
            "Puntos Máximos": act.puntos_max,
            "Fecha de Entrega": act.fecha_entrega ? new Date(act.fecha_entrega).toLocaleDateString() : "",
            "Grupo": g.nombre_grupo || "N/A",
            "Materia": g.materia?.nombre || "N/A",
            "Docente": doc.nombre || "N/A"
          };
        });

        // HOJA 7: CALIFICACIONES
        const calificacionesSheet = grades.map(g => {
          const act = activitiesMap[g.actividad_id] || {};
          const est = studentsMap[g.estudiante_id] || {};
          const maxPts = act.puntos_max || 10;
          const normGrade = ((g.calificacion / maxPts) * 10).toFixed(1);

          return {
            "Matrícula Estudiante": g.estudiante_id,
            "Nombre Estudiante": est.nombre || "Desconocido",
            "Grupo": est.grupo || act.grupo?.nombre_grupo || "N/A",
            "Materia": act.grupo?.materia?.nombre || "N/A",
            "Actividad": act.titulo || "Desconocida",
            "Calificación Registrada": g.calificacion,
            "Puntos Máximos Actividad": maxPts,
            "Calificación Normalizada (0-10)": normGrade,
            "Entregado": g.entregado ? "SÍ" : "NO",
            "Fecha Evaluación": g.fecha_evaluacion ? new Date(g.fecha_evaluacion).toLocaleDateString() : "N/A",
            "Comentarios": g.comentarios || ""
          };
        });

        // HOJA 8: ASISTENCIAS
        const asistenciasSheet = attendances.map(a => {
          const est = studentsMap[a.estudiante_id] || {};
          const g = groupsMap[a.grupo_id] || {};

          return {
            "Matrícula Estudiante": a.estudiante_id,
            "Nombre Estudiante": est.nombre || "Desconocido",
            "Grupo": g.nombre_grupo || "N/A",
            "Materia": g.materia?.nombre || "N/A",
            "Fecha Asistencia": a.fecha,
            "Estado": a.presente ? "PRESENTE" : "FALTA"
          };
        });

        // HOJA 9: INTERVENCIONES
        const intervencionesSheet = (interventions || []).map(i => {
          const est = studentsMap[i.estudiante_id] || {};

          return {
            "Matrícula Estudiante": i.estudiante_id,
            "Nombre Estudiante": est.nombre || "Desconocido",
            "Tipo de Intervención": i.tipo_intervencion,
            "Descripción": i.descripcion,
            "Notas Adicionales": i.notas_adicionales || "",
            "Estatus": i.estatus === 'COMPLETED' ? 'COMPLETADA' : 'PENDIENTE',
            "Fecha Registro": i.fecha ? new Date(i.fecha).toLocaleDateString() : "N/A"
          };
        });

        // HOJA 10: ACENTUACIONES
        const acentuacionesSheet = (studentAccs || []).map(sa => {
          const est = studentsMap[sa.estudiante_id] || {};
          const accInfo = getRelation(sa.acentuaciones) || {};

          return {
            "Matrícula Estudiante": sa.estudiante_id,
            "Nombre Estudiante": est.nombre || "Desconocido",
            "Carrera": accInfo.carrera || "N/A",
            "Acentuación (Subgrupo)": accInfo.nombre || "N/A",
            "Tipo de Optativa": accInfo.tipo_optativa || "N/A",
            "Semestre Recomendado": accInfo.semestre || "N/A"
          };
        });

        setProgressMsg("Empaquetando libro de Excel...");
        const wb = XLSX.utils.book_new();

        // Agregar Hojas
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), "Resumen del Ciclo");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(estudiantesSheet), "Estudiantes");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docentesSheet), "Docentes");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tutoresSheet), "Tutores");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gruposSheet), "Materias y Grupos");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actividadesSheet), "Actividades");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(calificacionesSheet), "Calificaciones");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asistenciasSheet), "Asistencias");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(intervencionesSheet), "Intervenciones");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(acentuacionesSheet), "Acentuaciones (Subgrupos)");

        // Escribir archivo
        XLSX.writeFile(wb, `respaldo_STA_${selectedCycle.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      }

      alert(`✅ Respaldo generado con éxito para el ciclo escolar: ${selectedCycle.nombre}`);
    } catch (err: any) {
      console.error("Error al exportar respaldo:", err);
      alert("❌ Error al generar respaldo: " + err.message);
    } finally {
      setExporting(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 shadow-xl space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <span className="text-4xl">💾</span>
          <div>
            <h3 className="text-2xl font-black text-[#003B5C] tracking-tight">Respaldos de Ciclos Escolares</h3>
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">Exportación completa de datos académicos</p>
          </div>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
          <p className="text-xs text-blue-800 font-bold leading-relaxed">
            ℹ️ <strong>Nota del Sistema:</strong> El respaldo extraerá de forma recursiva toda la información del ciclo seleccionado: el perfil de los estudiantes, los tutores asignados, la carga docente, las actividades creadas, asistencias, calificaciones, intervenciones y subgrupos.
          </p>
        </div>

        {loadingCycles ? (
          <div className="py-12 text-center animate-pulse">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full mx-auto mb-2 animate-spin"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargando ciclos escolares...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seleccionar Ciclo Escolar</label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-blue-500/10 outline-none cursor-pointer appearance-none"
                disabled={exporting}
              >
                <option value="">-- Elige un ciclo escolar --</option>
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.es_activo ? '• (Ciclo Activo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedCycleId && (
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleDownload('xlsx')}
                  disabled={exporting}
                  className="flex items-center justify-center gap-3 bg-[#003B5C] text-white py-5 px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                >
                  <span className="text-lg">📊</span>
                  Generar Respaldo Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload('json')}
                  disabled={exporting}
                  className="flex items-center justify-center gap-3 bg-[#FFD100] text-[#003B5C] py-5 px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-yellow-500 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                >
                  <span className="text-lg">📁</span>
                  Generar Respaldo JSON
                </button>
              </div>
            )}

            {exporting && (
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl text-center space-y-4 animate-pulse">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-[#003B5C] rounded-full mx-auto animate-spin"></div>
                <div>
                  <p className="text-xs font-black text-[#003B5C] uppercase tracking-widest">IA Generando Respaldo...</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">{progressMsg}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseBackup;
