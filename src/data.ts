import { Espacio, Alerta } from './types';

export const inicialAlertas: Alerta[] = [
  {
    id: 1,
    patente: 'BKRT-45',
    espacioBloqueado: 'A-01-FONDO',
    espacioBloqueador: 'A-01-FRENTE',
    conductor: 'Carlos Pérez',
    telefono: '+56912345678',
    estado: 'NUEVO',
    segundosRestantes: 300
  },
  {
    id: 2,
    patente: 'GHJK-32',
    espacioBloqueado: 'C-01-FONDO',
    espacioBloqueador: 'C-01-FRENTE',
    conductor: 'Ana Torres',
    telefono: '+56987654321',
    estado: 'ESCALADA',
    segundosRestantes: 0
  }
];

export const inicialEspacios: Espacio[] = [
  { 
    id: 'A-01-FONDO',  
    zona: 'A', 
    tipo: 'doble_fondo',  
    estado: 'ocupado',    
    parId: 'A-01-FRENTE',
    patente: 'FRTY-99',
    conductor: 'Ignacio Fuentes',
    telefono: '+56976543210',
    horaEntrada: '11:15'
  },
  { 
    id: 'A-01-FRENTE', 
    zona: 'A', 
    tipo: 'doble_frente', 
    estado: 'alerta',     
    parId: 'A-01-FONDO',
    patente: 'BKRT-45',
    conductor: 'Carlos Pérez',
    telefono: '+56912345678',
    horaEntrada: '12:30'
  },
  { 
    id: 'A-02-FONDO',  
    zona: 'A', 
    tipo: 'doble_fondo',  
    estado: 'disponible', 
    parId: 'A-02-FRENTE' 
  },
  { 
    id: 'A-02-FRENTE', 
    zona: 'A', 
    tipo: 'doble_frente', 
    estado: 'disponible', 
    parId: 'A-02-FONDO'  
  },
  { 
    id: 'A-03',        
    zona: 'A', 
    tipo: 'simple',        
    estado: 'disponible', 
    parId: null          
  },
  { 
    id: 'A-04',        
    zona: 'A', 
    tipo: 'simple',        
    estado: 'ocupado',    
    parId: null,
    patente: 'HXDP-41',
    conductor: 'Claudio Miranda',
    telefono: '+56944321155',
    horaEntrada: '13:00'
  },
  { 
    id: 'B-01-FONDO',  
    zona: 'B', 
    tipo: 'doble_fondo',  
    estado: 'disponible', 
    parId: 'B-01-FRENTE' 
  },
  { 
    id: 'B-01-FRENTE', 
    zona: 'B', 
    tipo: 'doble_frente', 
    estado: 'disponible', 
    parId: 'B-01-FONDO'  
  },
  { 
    id: 'B-02',        
    zona: 'B', 
    tipo: 'simple',        
    estado: 'reservado',  
    parId: null          
  },
  { 
    id: 'B-03',        
    zona: 'B', 
    tipo: 'simple',        
    estado: 'mantenimiento', 
    parId: null,
    mantenimientoRazon: 'Restauración de asfalto y pintura de línea'
  },
  { 
    id: 'C-01-FONDO',  
    zona: 'C', 
    tipo: 'doble_fondo',  
    estado: 'disponible', 
    parId: 'C-01-FRENTE' 
  },
  { 
    id: 'C-01-FRENTE', 
    zona: 'C', 
    tipo: 'doble_frente', 
    estado: 'disponible', 
    parId: 'C-01-FONDO'  
  },
];

// Additional spaces for the full grid mock of 110 spaces
export const generarEspaciosCompletos = (): Espacio[] => {
  const result = [...inicialEspacios];
  // We want to scale it to mock 110 spaces across zones A, B, C, D
  // Each zone will have some simple, double fondo, and double frente spots
  const totalSlotsNeeded = 110;
  let currentCount = result.length;

  const zones = ['A', 'B', 'C', 'D'];
  let idCounter = 5;

  while (currentCount < totalSlotsNeeded) {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const isDouble = Math.random() > 0.4 && currentCount < totalSlotsNeeded - 1;

    if (isDouble) {
      const numStr = idCounter.toString().padStart(2, '0');
      const fondoId = `${zone}-${numStr}-FONDO`;
      const frenteId = `${zone}-${numStr}-FRENTE`;

      // Check if duplicate
      if (!result.some(e => e.id === fondoId)) {
        const states: ('disponible' | 'ocupado' | 'reservado')[] = ['disponible', 'ocupado'];
        const randomState = states[Math.floor(Math.random() * states.length)];
        
        let fondoState = randomState;
        let frenteState = 'disponible';
        let pat1 = '', cond1 = '', tel1 = '', hr1 = '';
        let pat2 = '', cond2 = '', tel2 = '', hr2 = '';

        if (fondoState === 'ocupado') {
          pat1 = generarPatente();
          cond1 = generarNombre();
          tel1 = generarTelefono();
          hr1 = generarHora();
          // Decide if frente is also occupied (which is valid under rules since fondo is occupied first)
          if (Math.random() > 0.4) {
            frenteState = Math.random() > 0.2 ? 'ocupado' : 'alerta';
            pat2 = generarPatente();
            cond2 = generarNombre();
            tel2 = generarTelefono();
            hr2 = generarHora();
          }
        }

        result.push({
          id: fondoId,
          zona: zone,
          tipo: 'doble_fondo',
          estado: fondoState as any,
          parId: frenteId,
          patente: pat1 || undefined,
          conductor: cond1 || undefined,
          telefono: tel1 || undefined,
          horaEntrada: hr1 || undefined
        });

        result.push({
          id: frenteId,
          zona: zone,
          tipo: 'doble_frente',
          estado: frenteState as any,
          parId: fondoId,
          patente: pat2 || undefined,
          conductor: cond2 || undefined,
          telefono: tel2 || undefined,
          horaEntrada: hr2 || undefined
        });

        currentCount += 2;
      }
    } else {
      const numStr = idCounter.toString().padStart(2, '0');
      const simpleId = `${zone}-${numStr}`;

      if (!result.some(e => e.id === simpleId)) {
        const states = ['disponible', 'ocupado', 'reservado', 'mantenimiento'];
        const randomState = states[Math.floor(Math.random() * (states.length - 0.5))]; // weighted towards active
        
        let pat = '', cond = '', tel = '', hr = '', raz = '';
        if (randomState === 'ocupado') {
          pat = generarPatente();
          cond = generarNombre();
          tel = generarTelefono();
          hr = generarHora();
        } else if (randomState === 'mantenimiento') {
          raz = 'Mantención preventiva de demarcación de pintura lógica';
        }

        result.push({
          id: simpleId,
          zona: zone,
          tipo: 'simple',
          estado: randomState as any,
          parId: null,
          patente: pat || undefined,
          conductor: cond || undefined,
          telefono: tel || undefined,
          horaEntrada: hr || undefined,
          mantenimientoRazon: raz || undefined
        });

        currentCount += 1;
      }
    }
    idCounter++;
  }

  // Sort them so they display alphabetically by zone and then logically
  return result.slice(0, 110).sort((a, b) => a.id.localeCompare(b.id));
};

function generarPatente() {
  const letters = 'BCDFGHJKLPRSTVWXZ';
  const rLetter = () => letters[Math.floor(Math.random() * letters.length)];
  const rNum = () => Math.floor(Math.random() * 10);
  return `${rLetter()}${rLetter()}${rLetter()}${rLetter()}-${rNum()}${rNum()}`;
}

const nombres = ['Carlos Ruiz', 'Sofía Henríquez', 'Rodrigo Silva', 'Marta Lagos', 'Pedro Soto', 'Camila Valenzuela', 'Felipe Ortiz', 'Andrés Campusano', 'Valentina Cáceres', 'Gonzalo Vidal'];
function generarNombre() {
  return nombres[Math.floor(Math.random() * nombres.length)];
}

function generarTelefono() {
  return `+569${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function generarHora() {
  const hh = Math.floor(8 + Math.random() * 10).toString().padStart(2, '0');
  const mm = Math.floor(Math.random() * 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export const proyeccionesIA = [
  { hora: '13:00', ocupacion: 45, estado: 'Normal', color: 'green' },
  { hora: '14:00', ocupacion: 72, estado: 'Alta demanda', color: 'amber' },
  { hora: '15:00', ocupacion: 93, estado: 'Saturación', color: 'red' },
  { hora: '16:00', ocupacion: 81, estado: 'Alta demanda', color: 'amber' },
];

export const actividadReciente = [
  { conductor: 'Rodrigo Silva', rol: 'ALUMNO', patente: 'HZLW-89', espacio: 'A-05', hora: '15:10', estado: 'ESTACIONADO' },
  { conductor: 'Esteban Lagos', rol: 'DOCENTE', patente: 'JPRS-22', espacio: 'C-02-FRENTE', hora: '14:55', estado: 'ESTACIONADO' },
  { conductor: 'Patricia Sanhueza', rol: 'ALUMNO', patente: 'XCPV-67', espacio: 'B-04', hora: '14:40', estado: 'LIBERADO' },
  { conductor: 'Marcelo Díaz', rol: 'S. GENERALES', patente: 'KDFS-18', espacio: 'A-01-FONDO', hora: '14:15', estado: 'ALERTA_ACTIVA' },
  { conductor: 'Daniela Onetto', rol: 'DOCENTE', patente: 'BKRT-45', espacio: 'A-03', hora: '14:02', estado: 'ESTACIONADO' }
];
