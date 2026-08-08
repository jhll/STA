import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CicloEscolar } from '../types';
import fcqbLogo from './images/fcqb_logo.png';
import uasEscudo from './images/uas_escudo.png';

interface TeacherCertificateModalProps {
  userId: string;
  onClose: () => void;
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
  studentCount: number;
  isCompliant: boolean;
}

const TeacherCertificateModal: React.FC<TeacherCertificateModalProps> = ({ userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState<string>('');
  const [employeeNumber, setEmployeeNumber] = useState<string>('');
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [selectedCycleName, setSelectedCycleName] = useState<string>('');
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

      // 2. Obtener Ciclos Escolares
      const { data: cycleData } = await supabase
        .from('ciclos_escolares')
        .select('*')
        .order('created_at', { ascending: false });

      if (cycleData && cycleData.length > 0) {
        setCycles(cycleData);
        const active = cycleData.find(c => c.es_activo) || cycleData[0];
        setSelectedCycleId(active.id);
        setSelectedCycleName(active.nombre);
      } else {
        setSelectedCycleName('2025-2026 / PERIODO ACTUAL');
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
    if (!userId) return;
    setLoading(true);
    try {
      // Obtener Grupos asignados al Docente con datos de Materias
      const { data: groups, error: groupsError } = await supabase
        .from('grupos')
        .select('id, nombre_grupo, materias(nombre, carrera, semestre)')
        .eq('docente_id', userId);

      if (groupsError) throw groupsError;

      if (!groups || groups.length === 0) {
        setGroupsData([]);
        setLoading(false);
        return;
      }

      const complianceList: GroupCompliance[] = [];

      for (const grp of groups) {
        const mat = getRelation(grp.materias);

        // A) Conteo de Sesiones Únicas de Asistencia Registradas por el Docente
        const { data: attendanceData } = await supabase
          .from('asistencias')
          .select('fecha')
          .eq('grupo_id', grp.id);

        const uniqueAttendanceDates = new Set((attendanceData || []).map(a => a.fecha)).size;

        // B) Conteo de Actividades creadas en este grupo por el Docente
        const { data: activitiesData } = await supabase
          .from('actividades')
          .select('id')
          .eq('grupo_id', grp.id)
          .eq('docente_id', userId);

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

        // D) Estudiantes del grupo
        const { count: studentCount } = await supabase
          .from('estudiantes')
          .select('*', { count: 'exact', head: true })
          .eq('grupo', grp.nombre_grupo);

        // Criterio de cumplimiento: Haber tomado al menos 1 pase de lista o registrado actividades en la app STA
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
          studentCount: studentCount || 0,
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
  }, [userId]);

  useEffect(() => {
    fetchComplianceMetrics();
  }, [userId, selectedCycleId]);

  const handleCycleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cycleId = e.target.value;
    setSelectedCycleId(cycleId);
    const found = cycles.find(c => c.id === cycleId);
    if (found) setSelectedCycleName(found.nombre);
  };

  const handlePrint = () => {
    window.print();
  };

  const totalAttendanceSessions = groupsData.reduce((acc, g) => acc + g.attendanceCount, 0);
  const totalActivitiesCount = groupsData.reduce((acc, g) => acc + g.activitiesCount, 0);
  const isFullyCompliant = groupsData.length > 0 && groupsData.some(g => g.isCompliant);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Estilos para impresión en papel / PDF sin elementos UI de modal */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-teacher-certificate,
          #printable-teacher-certificate * {
            visibility: visible !important;
          }
          #printable-teacher-certificate {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 1.5cm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: letter portrait;
            margin: 0;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 print-full-width">
        {/* BARRA SUPERIOR DE ACCIONES (SOLO EN PANTALLA) */}
        <div className="p-6 bg-[#003B5C] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 no-print border-b-4 border-[#FFD100]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h2 className="text-xl font-black tracking-tight">Constancia de Cumplimiento Docente STA</h2>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">Acredita tu registro de asistencias y actividades en la app STA-FCQB</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {cycles.length > 0 && (
              <select
                value={selectedCycleId}
                onChange={handleCycleChange}
                className="bg-white/10 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/20 outline-none cursor-pointer hover:bg-white/20 transition-all"
              >
                {cycles.map(c => (
                  <option key={c.id} value={c.id} className="text-gray-900 font-medium">
                    Periodo: {c.nombre} {c.es_activo ? '(Activo)' : ''}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handlePrint}
              disabled={loading}
              className="bg-[#FFD100] text-[#003B5C] hover:bg-white text-xs font-black px-5 py-2.5 rounded-xl uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <span>🖨️</span>
              <span>Imprimir / PDF</span>
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

        {/* CUERPO Y DOCUMENTO OFICIAL (IMPRIMIBLE) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-gray-50/50 print:bg-white print:p-0">
          {loading ? (
            <div className="py-20 text-center space-y-4 no-print">
              <div className="w-12 h-12 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Generando Métricas de Cumplimiento Docente...</p>
            </div>
          ) : (
            <div id="printable-teacher-certificate" className="bg-white p-8 sm:p-14 rounded-2xl shadow-xl border border-gray-200 print:shadow-none print:border-none space-y-8 max-w-3xl mx-auto print:max-w-none print:w-full">
              
              {/* ENCABEZADO INSTITUCIONAL DE LA CONSTANCIA */}
              <div className="flex justify-between items-center border-b-2 border-[#003B5C] pb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
                  <img src={uasEscudo} alt="UAS Escudo" className="max-w-full max-h-full object-contain" />
                </div>

                <div className="text-center px-4">
                  <h1 className="text-sm sm:text-base font-black text-[#003B5C] uppercase tracking-wider">
                    UNIVERSIDAD AUTÓNOMA DE SINALOA
                  </h1>
                  <h2 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide mt-0.5">
                    FACULTAD DE CIENCIAS QUÍMICO BIOLÓGICAS
                  </h2>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mt-1">
                    SISTEMA DE SEGUIMIENTO DE TRAYECTORIA ACADÉMICA (STA-FCQB)
                  </p>
                </div>

                <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
                  <img src={fcqbLogo} alt="FCQB Logo" className="max-w-full max-h-full object-contain" />
                </div>
              </div>

              {/* TÍTULO DEL DOCUMENTO */}
              <div className="text-center space-y-2 py-2">
                <h3 className="text-lg sm:text-xl font-black text-[#003B5C] uppercase tracking-tight">
                  CONSTANCIA DE CUMPLIMIENTO DOCENTE
                </h3>
                <p className="text-xs font-bold text-amber-600 bg-amber-50 print:bg-transparent print:text-gray-700 py-1 px-4 rounded-full inline-block uppercase tracking-wider border border-amber-200 print:border-none">
                  REGISTRO DE ASISTENCIAS Y ACTIVIDADES ACADÉMICAS EN LA APP STA
                </p>
              </div>

              {/* CUERPO DE LA CONSTANCIA */}
              <div className="text-sm text-gray-800 leading-relaxed text-justify space-y-4 font-medium">
                <p>
                  La Dirección de la <strong>Facultad de Ciencias Químico Biológicas</strong> de la <strong>Universidad Autónoma de Sinaloa</strong>, por medio del presente documento hace:
                </p>

                <div className="bg-[#003B5C]/5 p-6 rounded-2xl border-l-4 border-[#003B5C] my-6 space-y-2 text-center print:bg-gray-50">
                  <p className="text-xs font-black uppercase text-gray-500 tracking-widest">CONSTAR QUE EL/LA DOCENTE:</p>
                  <p className="text-lg sm:text-2xl font-black text-[#003B5C] uppercase tracking-tight">{teacherName}</p>
                  <p className="text-xs font-bold text-gray-600">Número de Empleado / Ficha: <span className="font-mono text-gray-900">{employeeNumber}</span></p>
                </div>

                <p>
                  Ha cumplido satisfactoriamente con el registro oportuno de <strong>toma de asistencias</strong> y la <strong>evaluación de actividades académicas</strong> a través de la plataforma institucional <strong>STA-FCQB</strong> durante el periodo correspondiente al <strong>Ciclo Escolar: {selectedCycleName}</strong>.
                </p>

                {/* TABLA DE RESUMEN DE GRUPOS Y REGISTROS */}
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-black text-[#003B5C] uppercase tracking-widest">
                    Desglose de Registro de Grupos y Asignaturas a Cargo:
                  </h4>

                  {groupsData.length === 0 ? (
                    <div className="p-4 bg-gray-100 rounded-xl text-center text-xs font-bold text-gray-500 uppercase">
                      Sin grupos o asignaturas asignadas registradas en el periodo.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 print:border-gray-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#003B5C] text-white print:bg-gray-200 print:text-black uppercase text-[9px] font-black tracking-widest">
                          <tr>
                            <th className="p-3">Grupo / Asignatura</th>
                            <th className="p-3 text-center">Matrícula Cargo</th>
                            <th className="p-3 text-center">Sesiones Lista</th>
                            <th className="p-3 text-center">Actividades Creadas</th>
                            <th className="p-3 text-center">Estado STA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 print:divide-gray-400 font-medium">
                          {groupsData.map((g, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-3">
                                <span className="font-bold text-gray-900 block">{g.groupName}</span>
                                <span className="text-[10px] text-gray-500">{g.subjectName} ({g.career})</span>
                              </td>
                              <td className="p-3 text-center font-bold">{g.studentCount} Alumnos</td>
                              <td className="p-3 text-center font-bold text-blue-700 print:text-black">{g.attendanceCount} Sesiones</td>
                              <td className="p-3 text-center font-bold text-emerald-700 print:text-black">{g.activitiesCount} Actividades</td>
                              <td className="p-3 text-center font-black text-[9px] uppercase">
                                <span className={`px-2.5 py-1 rounded-md border ${g.isCompliant ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                  {g.isCompliant ? 'CUMPLIDO' : 'EN PROCESO'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-black text-[10px] uppercase text-gray-800 border-t border-gray-300">
                          <tr>
                            <td className="p-3">TOTALES GLOBALES:</td>
                            <td className="p-3 text-center">{groupsData.reduce((a, b) => a + b.studentCount, 0)} Alumnos</td>
                            <td className="p-3 text-center">{totalAttendanceSessions} Sesiones</td>
                            <td className="p-3 text-center">{totalActivitiesCount} Actividades</td>
                            <td className="p-3 text-center text-emerald-700">
                              {isFullyCompliant ? 'SATISFACTORIO' : 'EN SEGUIMIENTO'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <p className="pt-2">
                  Se extiende la presente constancia a petición del interesado para los fines legales, administrativos y académicos que al docente convengan.
                </p>
              </div>

              {/* LUGAR Y FECHA DE EMISIÓN */}
              <div className="text-right text-xs font-bold text-gray-600 pt-4">
                <p>Culiacán Rosales, Sinaloa, México a <span className="text-gray-900 font-black">{issueDate}</span>.</p>
              </div>

              {/* FIRMAS INSTITUCIONALES */}
              <div className="pt-12 grid grid-cols-2 gap-12 text-center">
                <div className="space-y-1">
                  <div className="border-b-2 border-gray-400 w-4/5 mx-auto mb-2"></div>
                  <p className="text-xs font-black text-[#003B5C] uppercase">{teacherName}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Firma del Docente</p>
                </div>

                <div className="space-y-1">
                  <div className="border-b-2 border-gray-400 w-4/5 mx-auto mb-2"></div>
                  <p className="text-xs font-black text-[#003B5C] uppercase">DIRECCIÓN Y SECRETARÍA ACADÉMICA</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Facultad de Ciencias Químico Biológicas - UAS</p>
                </div>
              </div>

              {/* SELLO DIGITAL / QR VALIDACIÓN */}
              <div className="border-t border-gray-200 pt-6 flex justify-between items-center text-[9px] text-gray-400 font-mono">
                <div>
                  <p className="font-bold text-gray-600">VERIFICACIÓN DIGITAL STA-FCQB</p>
                  <p>ID DOCENTE: {userId}</p>
                  <p>CÓDIGO DE VALIDACIÓN: STA-CUMPLIMIENTO-{Date.now().toString(36).toUpperCase()}</p>
                </div>

                <div className="w-14 h-14 bg-gray-100 border border-gray-300 rounded p-1 flex items-center justify-center text-[7px] text-center font-black text-gray-700">
                  SELLO INSTITUCIONAL STA-FCQB
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
