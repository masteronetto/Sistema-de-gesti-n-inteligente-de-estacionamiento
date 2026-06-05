export type TipoEspacio = 'simple' | 'doble_fondo' | 'doble_frente';
export type EstadoEspacio = 'disponible' | 'ocupado' | 'alerta' | 'mantenimiento' | 'reservado';

export interface Espacio {
  id: string;
  zona: string;
  tipo: TipoEspacio;
  estado: EstadoEspacio;
  parId: string | null;
  // Additional info for simulation/details
  patente?: string;
  conductor?: string;
  telefono?: string;
  horaEntrada?: string;
  mantenimientoRazon?: string;
}

export type EstadoAlerta = 'NUEVO' | 'ESCALADA';

export interface Alerta {
  id: number;
  patente: string;
  espacioBloqueado: string;
  espacioBloqueador: string;
  conductor: string;
  telefono: string;
  estado: EstadoAlerta;
  segundosRestantes: number;
}

export interface CheckIn {
  espacioId: string;
  tipo: TipoEspacio;
  zona: string;
  horaEntrada: string;
}
