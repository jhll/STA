# Manual de Operación de la Plataforma STA-FCQB
## Sistema de Seguimiento de Trayectoria Académica
### Facultad de Ciencias Químico Biológicas — Universidad Autónoma de Sinaloa (UAS)

---

## 1. Introducción y Propósito del Sistema

El **Sistema de Seguimiento de Trayectoria Académica (STA-FCQB)** es una plataforma web integral diseñada para la detección temprana de factores de riesgo, la prevención del rezago y la deserción escolar, y el acompañamiento académico personalizado de los estudiantes de las cuatro licenciaturas de la facultad:
- **IQ:** Ingeniería Química
- **IBQ:** Ingeniería Bioquímica
- **QFB:** Químico Farmacéutico Biólogo
- **BG:** Biotecnología Genómica

El sistema opera bajo un modelo de arquitectura basada en roles con tres perfiles principales:
1. **Docente:** Registro de asistencia, diseño y evaluación de actividades académicas, monitoreo grupal y acreditación de cumplimiento.
2. **Tutor:** Acompañamiento psicopedagógico, identificación de factores de vulnerabilidad, canalización a áreas especializadas y bitácora de seguimiento.
3. **Administrador:** Parametrización institucional, gestión de ciclos escolares, asignación de cargas académicas y tutorías, importación de matrícula, auditoría, estadísticas globales y respaldos.

---

## 2. Acceso y Autenticación General

### 2.1. Inicio de Sesión
1. Abra su navegador web e ingrese a la dirección URL de la plataforma STA.
2. En la pantalla principal de acceso:
   - **Seleccione su Rol:** Haga clic en la pestaña correspondiente a su función actual: `Docente`, `Tutor` o `Administrador`. *(Nota: si su usuario tiene múltiples roles asignados, elija el rol con el que desea operar en esa sesión).*
   - **Correo Electrónico:** Ingrese su correo institucional registrado.
   - **Contraseña:** Ingrese su clave de acceso.
3. Haga clic en **Iniciar Sesión**.

### 2.2. Cambio Autónomo de Contraseña
Cualquier usuario autenticado puede actualizar su contraseña en cualquier momento:
1. En la barra superior de navegación (o en el menú lateral en dispositivos móviles), haga clic en el botón con el icono de la llave (**🔑**).
2. Introduzca:
   - Su **Contraseña Actual**.
   - Su **Nueva Contraseña** (mínimo 4 caracteres).
   - La **Confirmación** de la nueva contraseña.
3. Presione **Actualizar Contraseña**.

### 2.3. Cierre de Sesión
Para resguardar la privacidad de los datos de los estudiantes, siempre cierre sesión al terminar de utilizar una computadora compartida presionando el botón rojo de desconexión ubicado en la esquina superior derecha.

---

## 3. Manual del Rol: Docente

El rol **Docente** está enfocado en la gestión cotidiana de las asignaturas a su cargo durante el **Ciclo Escolar Activo**.

### 3.1. Navegación y Vistas Disponibles
Al iniciar sesión como Docente, la barra de navegación muestra cuatro secciones principales:
- **🏠 Inicio (Dashboard Docente)**
- **👥 Asistencia (Control de Grupos)**
- **📝 Actividades (Tareas, Ejercicios y Exámenes)**
- **📋 Matrícula (Lista de Alumnos)**

---

### 3.2. Módulo de Inicio (Dashboard Docente)
- **Métricas del Periodo:** Muestra el número total de alumnos atendidos en sus grupos del ciclo escolar activo y su desglose por semáforo de riesgo:
  - 🟢 **Riesgo Bajo (Verde):** Promedio ≥ 8.0 y Asistencia ≥ 85%.
  - 🟡 **Riesgo Medio (Amarillo):** Promedio entre 6.0 y 7.9, o Asistencia entre 70% y 84%.
  - 🔴 **Riesgo Alto (Rojo):** Promedio < 6.0, Asistencia < 70%, o asignaturas reprobadas.
- **Constancia de Cumplimiento Docente:**
  - En la parte superior del Dashboard se encuentra el botón **"Generar Constancia de Cumplimiento"**.
  - Este documento certifica ante la Secretaría Académica y Coordinación el registro de asistencias y calificaciones efectuadas por el profesor en cada uno de sus grupos durante el semestre.
  - Al abrir la ventana modal, podrá revisar el número de sesiones registradas, actividades calificadas y pulsar **"Imprimir Constancia"** para obtener el documento oficial con código QR y folio de verificación.

---

### 3.3. Módulo de Asistencia (`Grupos`)
Este módulo sustituye la lista de asistencia en papel y alimenta los indicadores de riesgo en tiempo real.

#### Pasos para Registrar la Asistencia:
1. Ingrese a la pestaña **👥 Asistencia**.
2. **Seleccione el Grupo Asignado:** En la parte superior, haga clic en la tarjeta del grupo que desea pasar lista (se muestran nombre del grupo, materia, carrera y turno).
3. **Seleccione la Fecha:** El sistema selecciona por defecto la fecha de hoy, pero puede cambiarla si necesita registrar o corregir una sesión anterior.
4. **Marcar Asistencias:**
   - La lista de alumnos inscritos en ese grupo se despliega en pantalla.
   - Cada estudiante tiene botones interactivos para marcar su estado:
     - **Presente (Verde)**
     - **Ausente (Rojo)**
   - Puede usar el botón de acción rápida **"Marcar Todos Presentes"** para agilizar la captura en días con asistencia completa y desmarcar únicamente a los inasistentes.
5. **Guardar Registro:** Presione el botón **"Guardar Asistencia"**. El sistema actualizará el porcentaje de asistencia acumulado del alumno de manera inmediata.

---

### 3.4. Módulo de Actividades y Calificaciones
Permite registrar el trabajo académico continuo y calcular las calificaciones parciales y finales.

#### A. Crear una Nueva Actividad:
1. Diríjase a **📝 Actividades**.
2. Seleccione el grupo al que asignará la actividad.
3. Presione el botón **"+ Nueva Actividad"**.
4. Complete el formulario:
   - **Título de la Actividad:** Ej. *Práctica 3: Titulación Ácido-Base*.
   - **Tipo:** Seleccione entre `Tarea`, `Ejercicio` o `Examen`.
   - **Unidad Temática:** Número de la unidad (ej. Unidad 1).
   - **Puntos Máximos:** Valor total de la actividad (ej. 10 o 100 puntos).
   - **Fecha Límite de Entrega:** Fecha acordada con los alumnos.
   - **Descripción e Instrucciones:** Requisitos y criterios de entrega.
5. Presione **"Crear Actividad"**.

#### B. Asignar Calificaciones y Retroalimentación:
1. En la lista de actividades del grupo, haga clic sobre la actividad a evaluar.
2. Se desplegará la lista de estudiantes con campos editables:
   - Casilla de verificación **"Entregado"**.
   - Campo numérico de **Calificación**.
   - Campo de texto para **Comentarios / Retroalimentación**.
3. Haga clic en **"Guardar Calificaciones"**. Las notas se integrarán automáticamente al promedio del estudiante.

---

### 3.5. Módulo de Matrícula y Perfil del Alumno
1. Diríjase a **📋 Matrícula**.
2. Podrá filtrar la lista de estudiantes por nombre o número de cuenta.
3. Al hacer clic sobre el nombre de un alumno, se abrirá su **Perfil Académico Integral**:
   - Resumen de promedio y porcentaje de asistencia.
   - Historial de calificaciones por unidad.
   - Factores de riesgo detectados (académicos, personales o de salud).
   - Historial de canalizaciones o tutorías recibidas.

---

## 4. Manual del Rol: Tutor

El rol **Tutor** tiene como propósito el seguimiento cualitativo y preventivo de los alumnos asignados, interviniendo de manera oportuna ante señales de rezago o deserción.

### 4.1. Navegación y Vistas Disponibles
- **🏠 Inicio (Dashboard del Tutor)**
- **🛡️ Canalizaciones (Seguimiento y Tutorías)**
- **📋 Matrícula (Población Tutorada)**

---

### 4.2. Módulo de Inicio (Dashboard del Tutor)
- Muestra el identificador del grupo tutorado (por ejemplo: *QFB 2-1 Matutino*) o la lista de estudiantes tutorados individuales asignados para el ciclo vigente.
- Presenta el semáforo de riesgo grupal e individual para priorizar a los alumnos que requieren atención inmediata (semáforo rojo).

---

### 4.3. Módulo de Canalizaciones y Seguimiento (`Canalizaciones`)
Es la herramienta central para documentar las intervenciones, canalizaciones a departamentos de la UAS y la evolución del estudiante.

#### A. Catálogo de Tipos de Intervención:
El sistema contempla 7 tipos de acción preventiva institucional:
1. **Asesoría Académica:** Para alumnos con dificultades en materias específicas (Química, Cálculo, Fisiología, etc.).
2. **Apoyo Psicológico:** Canalización a orientación educativa / psicología FCQB para atención emocional o manejo de estrés.
3. **Seguimiento de Beca:** Asesoría para estudiantes con riesgo de perder apoyos socioeconómicos o que requieran beca de manutención.
4. **Vinculación Padres/Tutores:** Citatorio o reunión informativa con padres de familia.
5. **Taller de Habilidades de Estudio:** Estrategias de aprendizaje, organización del tiempo y técnicas de examen.
6. **Canalización Médica/Nutricional:** Atención en servicios de salud universitarios.
7. **Orientación Vocacional:** Para alumnos con dudas sobre su perfil profesional o solicitud de cambio de carrera.

#### B. Registrar una Nueva Canalización:
1. En la vista **🛡️ Canalizaciones**, presione el botón **"+ Nueva Canalización"**.
2. Complete la información requerida:
   - **Estudiante:** Seleccione al alumno de su lista de tutorados.
   - **Tipo de Intervención:** Elija una de las 7 categorías preventivas.
   - **Área de Destino:** Especificar dependencia (ej. *Centro de Asesorías FCQB*, *Departamento de Tutorías*, *DVEU UAS*).
   - **Estatus Inicial:**
     - `Canalizado / Por Iniciar (PENDING)`
     - `En Seguimiento Activo (IN_PROGRESS)`
   - **Motivo / Descripción de la Situación:** Explique de manera clara y profesional la causa que motiva la canalización.
   - **Notas Adicionales / Compromisos:** Acuerdos pactados con el alumno.
3. Presione **"Registrar Canalización"**.

#### C. Actualizar la Bitácora de Seguimiento:
1. En la tabla de canalizaciones, localice el caso del alumno.
2. Haga clic en el botón **"Actualizar Estatus / Bitácora"**.
3. Seleccione el nuevo estado:
   - `En Seguimiento Activo` (si continúan las sesiones o asesorías).
   - `Atendida / Concluida` (cuando el alumno superó el riesgo o concluyó el proceso).
   - `Cancelada` (en caso de baja o resolución por otra vía).
4. Agregue la nueva **Nota de Evolución** con la fecha y resultados observados.
5. Guarde los cambios. El historial completo se mantendrá visible para auditorías de acreditación de tutorías.

---

### 4.4. Consulta de Matrícula Tutorada
- Permite acceder a los expedientes de todos los estudiantes bajo su tutela.
- Puede revisar si el alumno ha mejorado su asistencia o promedio tras la intervención del tutor.

---

## 5. Manual del Rol: Administrador

El rol **Administrador** tiene acceso irrestricto a todas las funcionalidades del sistema y es responsable de la configuración institucional a través del **Panel de Sistema (`AdminPanel`)**.

### 5.1. Estructura de Pestañas del Panel de Sistema

| Pestaña | Propósito Principal |
| :--- | :--- |
| **👥 Usuarios** | Control de profesores, tutores y administradores (altas, roles y contraseñas). |
| **📅 Ciclos Escolares** | Creación y activación de semestres (ej. 2025-2026-1, 2025-2026-2). |
| **📚 Materias** | Catálogo oficial de materias por carrera, semestre y créditos. |
| **👨‍🎓 Alumnos** | Registro de matrícula, importación masiva por CSV y detector de duplicados. |
| **📋 Asignaciones (Docentes)** | Creación de grupos y asignación de materias a profesores por ciclo. |
| **🛡️ Asignaciones (Tutorías)** | Asignación de grupos o estudiantes específicos a tutores por ciclo. |
| **🌟 Acentuaciones** | Generador de materias optativas para 7mo, 8vo y 9no semestre. |
| **💾 Respaldos** | Copias de seguridad de la base de datos en formato JSON/SQL. |
| **⚙️ Configuración** | Parámetros de conexión a Supabase y credenciales de Gemini AI. |

---

### 5.2. Procedimientos Paso a Paso del Administrador

#### A. Iniciar un Nuevo Ciclo Escolar:
1. Vaya a **Sistema ⚙️** > pestaña **📅 Ciclos Escolares**.
2. Presione **"+ Nuevo Ciclo Escolar"**.
3. Capture el nombre oficial (ej. `2026-2027-1`), la fecha de inicio y la fecha de término.
4. Presione **"Crear Ciclo"**.
5. Para que todos los docentes y tutores vean este nuevo ciclo como vigente, haga clic en el botón **"Activar Ciclo"** junto al nombre del ciclo correspondiente. *(Al activarlo, el ciclo anterior pasa automáticamente a estatus inactivo).*

#### B. Gestión de Usuarios y Roles:
1. Diríjase a la pestaña **👥 Usuarios**.
2. Para crear un usuario, presione **"+ Nuevo Usuario"**:
   - Capture **Número de Empleado**, **Nombre Completo**, **Correo Institucional** y **Contraseña Temporal**.
   - **Asignación de Roles:** Marque las casillas correspondientes: un mismo profesor puede ser simultáneamente `DOCENTE` y `TUTOR`.
3. Para restablecer la contraseña de un docente o tutor que la haya extraviado, localice al usuario en la tabla, presione **"Editar"**, capture la nueva clave y guarde los cambios.

#### C. Catálogo de Materias:
1. Pestaña **📚 Materias**.
2. Filtre por Carrera (IQ, IBQ, QFB, BG) o Semestre (1 al 9).
3. Puede registrar asignaturas individuales con su código oficial, número de créditos y naturaleza obligatoria u optativa.

#### D. Carga e Importación de Matrícula de Alumnos:
El sistema soporta dos vías de registro:
1. **Registro Individual:** Presione **"+ Nuevo Alumno"**, capture matrícula, nombre, carrera, semestre, grupo y turno.
2. **Carga Masiva vía CSV / Excel:**
   - Presione el botón **"📥 Importar desde CSV"**.
   - Descargue la plantilla de ejemplo o asegúrese de que el archivo CSV contenga las columnas: `matricula`, `nombre`, `carrera`, `semestre`, `grupo`, `turno`.
   - Seleccione el archivo y presione **"Cargar y Procesar"**. El sistema validará los registros y los inscribirá en el ciclo activo.
3. **Depuración de Alumnos Duplicados:**
   - En la pestaña de Alumnos, presione **"🔍 Analizar y Corregir Duplicados"**.
   - El sistema escaneará la base de datos en busca de matrículas repetidas o inconsistencias de historial y ofrecerá la unificación automática conservando las calificaciones y asistencias registradas.

#### E. Asignación de Cargas Docentes (Grupos):
1. Pestaña **📋 Asignaciones**.
2. Presione **"+ Crear Asignación de Grupo"**.
3. Seleccione:
   - **Ciclo Escolar:** (por defecto el ciclo activo).
   - **Materia:** Seleccione del catálogo de la carrera correspondiente.
   - **Docente:** Elija al profesor responsable.
   - **Nombre del Grupo:** (ej. *1-1*, *3-2*, etc.).
   - **Turno:** Matutino o Vespertino.
4. Guarde la asignación. El grupo aparecerá inmediatamente en el panel del docente seleccionado.

#### F. Asignación de Tutorías:
1. Pestaña **🛡️ Asignaciones (Tutorías)**.
2. Presione **"+ Asignar Tutoría"**.
3. Puede asignar una tutoría bajo dos modalidades:
   - **Por Grupo Completo:** Seleccione el grupo (ej. *QFB 1-1*) y el tutor asignado. Todos los alumnos inscritos en ese grupo serán canalizados a ese tutor.
   - **Individual:** Seleccione alumnos específicos en situación de vulnerabilidad para asignarlos a un tutor en particular.

#### G. Módulo de Acentuaciones y Optativas (Semestres 7, 8 y 9):
1. Pestaña **🌟 Acentuaciones**.
2. Permite gestionar las líneas terminales y materias optativas de especialidad:
   - QFB: Laboratorio Clínico (LC), Bioquímica (BQ), Farmacia (FA).
   - IQ / IBQ / BG: Líneas optativas y de especialización.
3. Utilice el **"Generador de Catálogo de Optativas"** para sincronizar automáticamente las claves de materias optativas con el mapa curricular institucional.

#### H. Respaldos y Copias de Seguridad:
1. Pestaña **💾 Respaldos**.
2. Permite descargar un archivo comprimido JSON con la totalidad de los datos:
   - Docentes y usuarios
   - Estudiantes y matrículas
   - Registros de asistencia histórica
   - Actividades y calificaciones
   - Canalizaciones de tutorías
3. Se recomienda descargar un respaldo al cierre de cada semestre escolar antes de archivar las calificaciones.

---

## 6. Matriz de Permisos y Accesos por Rol

| Módulo / Funcionalidad | Docente | Tutor | Administrador |
| :--- | :---: | :---: | :---: |
| **Inicio / Dashboard** | Sí (sus grupos) | Sí (sus tutorados) | Sí (global) |
| **Descarga de Constancia Docente** | Sí | No | Sí |
| **Pase de Lista de Asistencia** | Sí (sus grupos) | No | Sí |
| **Crear y Calificar Actividades** | Sí (sus grupos) | No | Sí |
| **Ver Perfil Completo del Alumno** | Sí (sus grupos) | Sí (sus tutorados) | Sí (todos) |
| **Registrar Canalización Preventiva** | No | Sí | Sí |
| **Actualizar Bitácora de Tutoría** | No | Sí | Sí |
| **Crear / Activar Ciclos Escolares** | No | No | Sí |
| **Alta y Edición de Profesores/Tutores** | No | No | Sí |
| **Importación Masiva de Alumnos (CSV)** | No | No | Sí |
| **Asignar Materias y Grupos a Docentes** | No | No | Sí |
| **Asignar Grupos de Tutoría** | No | No | Sí |
| **Gestión de Optativas y Acentuaciones** | No | No | Sí |
| **Estadísticas Institucionales Globales** | No | No | Sí |
| **Copias de Seguridad (Respaldos)** | No | No | Sí |
| **Cambio de Contraseña Propia** | Sí | Sí | Sí |

---

## 7. Preguntas Frecuentes y Soporte Técnico

### ¿Qué hacer si un alumno no aparece en mi lista de asistencia o actividades?
- Verifique con el Administrador del Sistema que el alumno esté registrado en el grupo correspondiente dentro del **Ciclo Escolar Activo**. Si el alumno fue inscrito en un ciclo previo, el administrador debe migrar su matrícula al periodo en curso.

### ¿Un profesor puede ser Tutor al mismo tiempo?
- **Sí.** El administrador asigna ambos roles (`DOCENTE` y `TUTOR`) a la misma cuenta de usuario. Al iniciar sesión en la pantalla principal de bienvenida, el profesor selecciona el rol con el que desea operar.

### ¿Cómo se calculan los semáforos de riesgo?
- El sistema evalúa de forma algorítmica tres componentes:
  1. **Asistencia Acumulada:** Inasistencias superiores al 15% activan alerta amarilla; superiores al 30% activan alerta roja.
  2. **Promedio de Calificaciones:** Evaluaciones parciales reprobadas (< 6.0) detonan semáforo rojo.
  3. **Factores Socioacadémicos:** Condiciones personales, laborales o de salud reportadas en el expediente del alumno.

### Soporte y Contacto Institucional:
- **Facultad de Ciencias Químico Biológicas — UAS**
- **Coordinación de Tutorías y Acompañamiento Estudiantil**
- Para soporte técnico sobre claves o inconsistencias de matrícula, contactar a la Administración del Sistema STA-FCQB.
