import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CicloEscolar } from '../types';
import fcqbLogo from './images/fcqb_logo.png';
import uasEscudo from './images/uas_escudo.png';

interface TeacherCertificateModalProps {
  userId: string;
  onClose: () => void;
  cycleId?: string;
}

interface GroupCompliance {
  groupId: string;
  groupName: string;
  subjectName: string;
  career: string;
  semester: number;
  attendanceCount: number;
  activitiesCount: number;
  gradedCount: number;
  isCompliant: boolean;
}

const TeacherCertificateModal: React.FC<TeacherCertificateModalProps> = ({ userId, onClose, cycleId }) => {
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState<string>('');
  const [employeeNumber, setEmployeeNumber] = useState<string>('');
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [selectedCycleName, setSelectedCycleName] = useState<string>('2025-2026-2');
  const [selectedCycle, setSelectedCycle] = useState<CicloEscolar | null>(null);
  const [groupsData, setGroupsData] = useState<GroupCompliance[]>([]);
  const [issueDate, setIssueDate] = useState<string>('');

  const getRelation = (data: any) => (Array.isArray(data) ? data[0] : data);

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      // 1. Obtener datos del Docente
      const { data: teacher, error: teacherError } = await supabase
        .from('docentes')
        .select('nombre, numero_empleado')
        .eq('id', userId)
        .single();

      if (teacherError && teacherError.code !== 'PGRST116') {
        console.error("Error docentes:", teacherError);
      }
      setTeacherName(teacher?.nombre || 'DOCENTE REGISTRADO');
      setEmployeeNumber(teacher?.numero_empleado || 'D-FCQB');

      // 2. Obtener Ciclos Escolares (Priorizando estrictamente el periodo señalado correspondiente a 2025-2026-2)
      const { data: cycleData } = await supabase
        .from('ciclos_escolares')
        .select('*')
        .order('created_at', { ascending: false });

      if (cycleData && cycleData.length > 0) {
        setCycles(cycleData);
        const targetCycle = (cycleId && cycleData.find(c => c.id === cycleId))
          || cycleData.find(c => c.nombre.includes('2025-2026-2')) 
          || cycleData.find(c => c.es_activo) 
          || cycleData[0];

        setSelectedCycleId(targetCycle.id);
        setSelectedCycleName(targetCycle.nombre);
        setSelectedCycle(targetCycle);
      } else {
        setSelectedCycleName('2025-2026-2');
      }

      // Definir fecha actual formateada
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      setIssueDate(new Date().toLocaleDateString('es-MX', options));
    } catch (err) {
      console.error("Error al cargar información del docente:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceMetrics = async () => {
    if (!userId || !selectedCycleId) return;
    setLoading(true);
    try {
      const currentCycle = selectedCycle || cycles.find(c => c.id === selectedCycleId);

      // Obtener EXCLUSIVAMENTE los Grupos asignados al Docente correspondientes al periodo señalado
      const { data: groups, error: groupsError } = await supabase
        .from('grupos')
        .select('id, nombre_grupo, ciclo_id, materias(nombre, carrera, semestre)')
        .eq('docente_id', userId)
        .eq('ciclo_id', selectedCycleId);

      if (groupsError) throw groupsError;

      if (!groups || groups.length === 0) {
        setGroupsData([]);
        setLoading(false);
        return;
      }

      const complianceList: GroupCompliance[] = [];

      for (const grp of groups) {
        const mat = getRelation(grp.materias);

        // A) Conteo de Sesiones Únicas de Asistencia del Docente estrictamente dentro de las fechas del periodo señalado
        let attQuery = supabase
          .from('asistencias')
          .select('fecha')
          .eq('grupo_id', grp.id);

        if (currentCycle?.fecha_inicio && currentCycle?.fecha_fin) {
          attQuery = attQuery
            .gte('fecha', currentCycle.fecha_inicio)
            .lte('fecha', currentCycle.fecha_fin);
        }

        const { data: attendanceData } = await attQuery;
        const uniqueAttendanceDates = new Set((attendanceData || []).map(a => a.fecha)).size;

        // B) Conteo de Actividades creadas en este grupo por el Docente correspondientes al periodo señalado
        const { data: activitiesData } = await supabase
          .from('actividades')
          .select('id')
          .eq('grupo_id', grp.id)
          .eq('docente_id', userId)
          .eq('ciclo_id', selectedCycleId);

        const actIds = (activitiesData || []).map(a => a.id);
        const activitiesCount = actIds.length;

        // C) Conteo de Calificaciones Registradas en esas actividades
        let gradedCount = 0;
        if (actIds.length > 0) {
          const { count } = await supabase
            .from('calificaciones')
            .select('*', { count: 'exact', head: true })
            .in('actividad_id', actIds);
          gradedCount = count || 0;
        }

        // Criterio de cumplimiento docente en el periodo: Al menos 1 pase de lista O al menos 1 actividad registrada
        const isCompliant = uniqueAttendanceDates > 0 || activitiesCount > 0;

        complianceList.push({
          groupId: grp.id,
          groupName: grp.nombre_grupo,
          subjectName: mat?.nombre || 'Asignatura Institucional',
          career: mat?.carrera || 'Facultad de Ciencias Químico Biológicas',
          semester: mat?.semestre || 1,
          attendanceCount: uniqueAttendanceDates,
          activitiesCount,
          gradedCount,
          isCompliant
        });
      }

      setGroupsData(complianceList);
    } catch (err) {
      console.error("Error al calcular cumplimiento del docente:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, [userId, cycleId]);

  useEffect(() => {
    if (selectedCycleId) {
      fetchComplianceMetrics();
    }
  }, [userId, selectedCycleId, selectedCycle]);

  const handleCycleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cycleIdVal = e.target.value;
    setSelectedCycleId(cycleIdVal);
    const found = cycles.find(c => c.id === cycleIdVal);
    if (found) {
      setSelectedCycleName(found.nombre);
      setSelectedCycle(found);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalAttendanceSessions = groupsData.reduce((acc, g) => acc + g.attendanceCount, 0);
  const totalActivitiesCount = groupsData.reduce((acc, g) => acc + g.activitiesCount, 0);

  // Regla de acreditación: Docente activo si tiene al menos 1 pase de lista O al menos 1 actividad en el periodo señalado
  const isTeacherActive = totalAttendanceSessions > 0 || totalActivitiesCount > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
      {/* Estilos estrictos para imprimir ÚNICAMENTE el cuerpo de la constancia en 1 hoja PDF */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 8mm 10mm;
          }
          
          /* Ocultar absolutamente todo por defecto */
          body * {
            visibility: hidden !important;
          }

          /* Permitir que los contenedores padre desplieguen el documento sin recortar */
          html, body, #root, #root > *, .fixed, [class*="fixed"], .print-full-width {
            visibility: visible !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            inset: auto !important;
          }

          /* Ocultar botones, modales UI, encabezados y alertas de pantalla */
          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }

          /* Hacer visible ÚNICAMENTE el cuerpo de la constancia oficial */
          #printable-teacher-certificate,
          #printable-teacher-certificate * {
            visibility: visible !important;
          }

          #printable-teacher-certificate {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0.1cm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 print-full-width">
        {/* BARRA SUPERIOR DE ACCIONES (SOLO EN PANTALLA) */}
        <div className="p-4 sm:p-5 bg-[#003B5C] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 no-print border-b-4 border-[#FFD100]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">Constancia de Cumplimiento Docente STA</h2>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">Periodo Lectivo {selectedCycleName} | Descarga Oficial en PDF</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
            {cycles.length > 0 && (
              <select
                value={selectedCycleId}
                onChange={handleCycleChange}
                className="bg-white/10 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all"
              >
                {cycles.map(c => (
                  <option key={c.id} value={c.id} className="text-gray-900 font-medium">
                    Periodo: {c.nombre} {c.nombre.includes('2025-2026-2') ? '(Señalado)' : ''}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handlePrint}
              disabled={loading || !isTeacherActive}
              title={
                !isTeacherActive
                  ? `Para descargar la constancia en PDF debes haber registrado al menos 1 pase de lista o 1 actividad en el periodo ${selectedCycleName}`
                  : 'Descargar o guardar constancia en formato PDF'
              }
              className={`text-xs font-black px-5 py-2.5 rounded-xl uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 active:scale-95 ${
                isTeacherActive
                  ? 'bg-[#FFD100] text-[#003B5C] hover:bg-white hover:shadow-2xl cursor-pointer'
                  : 'bg-gray-400 text-gray-700 cursor-not-allowed opacity-60'
              }`}
            >
              <span>📄</span>
              <span>Descargar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ALERTA DE ESTATUS DE ACTIVIDAD (SOLO PANTALLA) */}
        {!loading && (
          <div className="no-print px-6 pt-4">
            {isTeacherActive ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm">
                <span className="text-lg">✅</span>
                <div>
                  <p className="font-black">DOCENTE ACTIVO EN EL PERIODO {selectedCycleName}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Se han verificado {totalAttendanceSessions} {totalAttendanceSessions === 1 ? 'pase de lista' : 'pases de lista'} y {totalActivitiesCount} {totalActivitiesCount === 1 ? 'actividad registrada' : 'actividades registradas'} dentro del periodo señalado. Puedes descargar tu constancia en PDF.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-4 rounded-2xl flex items-start sm:items-center gap-3 text-xs shadow-sm">
                <span className="text-2xl shrink-0">⚠️</span>
                <div>
                  <p className="font-black text-amber-900 text-sm">DESCARGA DE CONSTANCIA DESHABILITADA (PERIODO {selectedCycleName})</p>
                  <p className="text-amber-800 font-medium mt-0.5">
                    Solamente los docentes que hayan realizado <strong>cuando menos una actividad</strong> o <strong>tomado asistencias</strong> durante el periodo {selectedCycleName} están habilitados para descargar su constancia en PDF.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CUERPO Y DOCUMENTO OFICIAL (IMPRIMIBLE A PDF) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-gray-50/50 print:bg-white print:p-0 print:overflow-visible">
          {loading ? (
            <div className="py-20 text-center space-y-4 no-print">
              <div className="w-12 h-12 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Verificando asistencias y actividades en el periodo {selectedCycleName}...</p>
            </div>
          ) : (
            <div id="printable-teacher-certificate" className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl border border-gray-200 print:shadow-none print:border-none print:p-0 space-y-4 print:space-y-3 max-w-3xl mx-auto print:max-w-none print:w-full">
              
              {/* ENCABEZADO INSTITUCIONAL DE LA CONSTANCIA */}
              <div className="flex justify-between items-center border-b-2 border-[#003B5C] pb-3 print:pb-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 print:w-16 print:h-16 flex items-center justify-center shrink-0">
                  <img src={uasEscudo} alt="UAS Escudo" className="max-w-full max-h-full object-contain" />
                </div>

                <div className="text-center px-2">
                  <h1 className="text-xs sm:text-base font-black text-[#003B5C] uppercase tracking-wider">
                    UNIVERSIDAD AUTÓNOMA DE SINALOA
                  </h1>
                  <h2 className="text-[11px] sm:text-xs font-bold text-gray-800 uppercase tracking-wide mt-0.5">
                    FACULTAD DE CIENCIAS QUÍMICO BIOLÓGICAS
                  </h2>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mt-0.5">
                    SISTEMA DE SEGUIMIENTO DE TRAYECTORIA ACADÉMICA (STA-FCQB)
                  </p>
                </div>

                <div className="w-16 h-16 sm:w-20 sm:h-20 print:w-16 print:h-16 flex items-center justify-center shrink-0">
                  <img src={fcqbLogo} alt="FCQB Logo" className="max-w-full max-h-full object-contain" />
                </div>
              </div>

              {/* TÍTULO DEL DOCUMENTO */}
              <div className="text-center space-y-1 py-1">
                <h3 className="text-base sm:text-lg font-black text-[#003B5C] uppercase tracking-tight">
                  CONSTANCIA DE CUMPLIMIENTO DOCENTE
                </h3>
                <p className="text-[11px] font-bold text-[#003B5C] bg-blue-50 print:bg-transparent print:text-gray-800 py-0.5 px-3 rounded-full inline-block uppercase tracking-wider border border-blue-200 print:border-none">
                  PERIODO ESCOLAR LECTIVO: {selectedCycleName}
                </p>
              </div>

              {/* CUERPO DE LA CONSTANCIA */}
              <div className="text-xs sm:text-sm text-gray-800 leading-relaxed text-justify space-y-3 font-medium">
                <p>
                  La Dirección de la <strong>Facultad de Ciencias Químico Biológicas</strong> de la <strong>Universidad Autónoma de Sinaloa</strong>, por medio del presente documento hace:
                </p>

                <div className="bg-[#003B5C]/5 p-3.5 sm:p-4 rounded-xl border-l-4 border-[#003B5C] my-3 space-y-1 text-center print:bg-gray-50 print:py-2">
                  <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">CONSTAR QUE EL/LA DOCENTE:</p>
                  <p className="text-base sm:text-xl font-black text-[#003B5C] uppercase tracking-tight">{teacherName}</p>
                  <p className="text-[11px] font-bold text-gray-600">Número de Empleado / Ficha: <span className="font-mono text-gray-900">{employeeNumber}</span></p>
                </div>

                <p>
                  Ha participado activamente en el registro oportuno de <strong>toma de asistencias</strong> y/o la <strong>creación y evaluación de actividades académicas</strong> a través del sistema <strong>STA-FCQB</strong> durante el periodo académico correspondiente al <strong>Ciclo Escolar: {selectedCycleName}</strong>.
                </p>

                {/* TABLA DE RESUMEN DE ASISTENCIAS Y ACTIVIDADES DEL PERIODO */}
                <div className="mt-3 space-y-2">
                  <h4 className="text-[11px] font-black text-[#003B5C] uppercase tracking-widest">
                    Desglose de Asistencias y Actividades en el Periodo ({selectedCycleName}):
                  </h4>

                  {groupsData.length === 0 ? (
                    <div className="p-3 bg-gray-100 rounded-xl text-center text-xs font-bold text-gray-500 uppercase">
                      Sin grupos o asignaturas asignadas registradas en el periodo {selectedCycleName}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 print:border-gray-800">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#003B5C] text-white print:bg-gray-200 print:text-black uppercase text-[8px] sm:text-[9px] font-black tracking-widest">
                          <tr>
                            <th className="p-2.5">Grupo / Asignatura</th>
                            <th className="p-2.5 text-center">Sesiones de Asistencia</th>
                            <th className="p-2.5 text-center">Actividades Registradas</th>
                            <th className="p-2.5 text-center">Estatus Cumplimiento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 print:divide-gray-400 font-medium">
                          {groupsData.map((g, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-2.5">
                                <span className="font-bold text-gray-900 block">{g.groupName}</span>
                                <span className="text-[9px] text-gray-500">{g.subjectName} ({g.career})</span>
                              </td>
                              <td className="p-2.5 text-center font-bold text-blue-700 print:text-black">
                                {g.attendanceCount} {g.attendanceCount === 1 ? 'Sesión' : 'Sesiones'}
                              </td>
                              <td className="p-2.5 text-center font-bold text-emerald-700 print:text-black">
                                {g.activitiesCount} {g.activitiesCount === 1 ? 'Actividad' : 'Actividades'}
                              </td>
                              <td className="p-2.5 text-center font-black text-[8px] uppercase">
                                <span className={`px-2.5 py-1 rounded-md border ${g.isCompliant ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                  {g.isCompliant ? 'CUMPLE' : 'SIN REGISTRO'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-black text-[9px] uppercase text-gray-800 border-t border-gray-300">
                          <tr>
                            <td className="p-2.5">TOTALES PERIODO {selectedCycleName}:</td>
                            <td className="p-2.5 text-center text-blue-800 print:text-black">{totalAttendanceSessions} Sesiones</td>
                            <td className="p-2.5 text-center text-emerald-800 print:text-black">{totalActivitiesCount} Actividades</td>
                            <td className="p-2.5 text-center text-emerald-700">
                              {isTeacherActive ? 'CUMPLE EN PERIODO' : 'SIN ACTIVIDAD'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <p className="pt-1">
                  Se extiende la presente constancia oficial a petición del interesado para los fines legales, administrativos y de acreditación docente que convengan.
                </p>
              </div>

              {/* LUGAR Y FECHA DE EMISIÓN */}
              <div className="text-right text-[11px] font-bold text-gray-600 pt-2">
                <p>Culiacán Rosales, Sinaloa, México a <span className="text-gray-900 font-black">{issueDate}</span>.</p>
              </div>

              {/* FIRMAS INSTITUCIONALES */}
              <div className="pt-6 sm:pt-8 print:pt-6 grid grid-cols-2 gap-8 text-center">
                <div className="space-y-0.5">
                  <div className="border-b-2 border-gray-400 w-4/5 mx-auto mb-1.5"></div>
                  <p className="text-xs font-black text-[#003B5C] uppercase">DR. EUSIEL RUBIO CASTRO</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Director</p>
                </div>

                <div className="space-y-0.5">
                  <div className="border-b-2 border-gray-400 w-4/5 mx-auto mb-1.5"></div>
                  <p className="text-xs font-black text-[#003B5C] uppercase">DR. JOSÉ GEOVANNI ROMERO QUINTANA</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Secretaría Académica</p>
                </div>
              </div>

              {/* SELLO DIGITAL / QR VALIDACIÓN */}
              <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-[8px] text-gray-400 font-mono">
                <div>
                  <p className="font-bold text-gray-600">VERIFICACIÓN DIGITAL STA-FCQB ({selectedCycleName})</p>
                  <p>ID DOCENTE: {userId}</p>
                  <p>CÓDIGO DE VALIDACIÓN: STA-PDF-{selectedCycleName.replace(/[^a-zA-Z0-9]/g, '-')}-{Date.now().toString(36).toUpperCase()}</p>
                </div>

                <div className="w-12 h-12 bg-gray-50 border border-gray-300 rounded p-1 flex items-center justify-center text-[6px] text-center font-black text-gray-700">
                  SELLO DIGITAL OFICIAL FCQB
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherCertificateModal;
