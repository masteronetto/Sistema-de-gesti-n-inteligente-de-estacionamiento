import React, { useState, useEffect } from 'react';
import { 
  Car, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Lock, 
  Wrench, 
  Search, 
  Menu, 
  Plus, 
  X, 
  Eye, 
  EyeOff, 
  Bell, 
  Phone, 
  MapPin, 
  TrendingUp, 
  User, 
  Shield, 
  MoreVertical, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Send,
  LockKeyhole,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Espacio, Alerta, CheckIn, TipoEspacio, EstadoEspacio, EstadoAlerta } from './types';
import { generarEspaciosCompletos, inicialAlertas, proyeccionesIA, actividadReciente } from './data';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// Color Palette Guidelines applied in Tailwind:
// Primary Background/Sidebar: bg-[#002b49] (duoc-navy)
// Primary Accent Buttons/Labels: bg-[#fdb913] text-[#002b49] (duoc-yellow)
// Secondary Actions: bg-[#0076b6] (duoc-blue)
// Link/Info Highlights: text-[#00a4e4] / bg-[#00a4e4] (duoc-sky)

export default function App() {
  // Required states
  const [vista, setVista] = useState<'login' | 'guardia' | 'gestion'>('login');
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [modalBloqueo, setModalBloqueo] = useState(false);

  const dbEnabled = isSupabaseConfigured && supabase !== null;

  const [alertas, setAlertas] = useState<Alerta[]>(dbEnabled ? [] : inicialAlertas);
  const [espacios, setEspacios] = useState<Espacio[]>(dbEnabled ? [] : () => generarEspaciosCompletos());

  // Additional interface & simulation states
  const [sessionUser, setSessionUser] = useState<{ email: string; role: 'guardia' | 'jefe_seguridad' | 'servicios_generales' } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [supabaseError, setSupabaseError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'alert' | 'info' } | null>(null);
  const [isOnline, setIsOnline] = useState(true); // Connectivity simulator
  const [loadingCheckIn, setLoadingCheckIn] = useState<string | null>(null);
  const [selectedEspacioId, setSelectedEspacioId] = useState<string | null>(null);
  
  // Custom Role switcher (used by US-08 context menu check)
  const [currentRole, setCurrentRole] = useState<'guardia' | 'jefe_seguridad' | 'servicios_generales'>('guardia');

  // Block reporting bottom sheet interactive countdown
  const [blockCountdown, setBlockCountdown] = useState(300); // 5 minutes in seconds
  const [isBlockTimerRunning, setIsBlockTimerRunning] = useState(false);

  // Context Menu State for administrative space reservation (US-08)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; espacioId: string } | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState<string | null>(null);
  const [mantenimientoReason, setMantenimientoReason] = useState('');
  const [mantenimientoError, setMantenimientoError] = useState('');

  const simulatedUsers: Record<string, { password: string; role: 'guardia' | 'jefe_seguridad' | 'servicios_generales' }> = {
    'guardia@duocuc.cl': { password: 'duocguard1', role: 'guardia' },
    'jefe_seguridad@duocuc.cl': { password: 'duocadmin1', role: 'jefe_seguridad' },
    'servicios_generales@duocuc.cl': { password: 'duocadmin1', role: 'servicios_generales' },
  };

  const resolveVistaFromRole = (role: 'guardia' | 'jefe_seguridad' | 'servicios_generales') => (role === 'guardia' ? 'guardia' : 'gestion');

  const mapDbSpace = (space: any): Espacio => ({
    id: space.id,
    zona: space.zone,
    tipo: space.type as TipoEspacio,
    estado: space.status as EstadoEspacio,
    parId: space.pair_id ?? null,
    patente: space.plate ?? undefined,
    conductor: space.driver_name ?? undefined,
    telefono: space.phone ?? undefined,
    horaEntrada: typeof space.entry_time === 'string'
      ? space.entry_time.slice(0, 5)
      : space.entry_time ? new Date(space.entry_time).toTimeString().slice(0, 5) : undefined,
    mantenimientoRazon: space.maintenance_reason ?? undefined,
  });

  const mapDbAlert = (alert: any): Alerta => ({
    id: alert.id,
    patente: alert.plate ?? '',
    espacioBloqueado: alert.blocked_space_id,
    espacioBloqueador: alert.blocker_space_id,
    conductor: alert.driver_name ?? '',
    telefono: alert.phone ?? '',
    estado: alert.status as EstadoAlerta,
    segundosRestantes: alert.seconds_remaining ?? 0,
  });

  const loadParkingState = async () => {
    if (!supabase) return;
    setSupabaseError('');

    const { data: spaces, error: spacesError } = await supabase
      .from('parking_spaces')
      .select('id, zone, type, status, pair_id, plate, driver_name, phone, entry_time, maintenance_reason')
      .order('id', { ascending: true });

    const { data: activeAlerts, error: alertsError } = await supabase
      .from('parking_alerts')
      .select('id, plate, blocked_space_id, blocker_space_id, driver_name, phone, status, seconds_remaining')
      .is('resolved_at', null)
      .order('created_at', { ascending: false });

    if (spacesError) {
      console.error('Error cargando espacios desde Supabase:', spacesError.message);
      setSupabaseError(`Error cargando espacios: ${spacesError.message}`);
    } else if (spaces) {
      setEspacios(spaces.map(mapDbSpace));
    }

    if (alertsError) {
      console.error('Error cargando alertas desde Supabase:', alertsError.message);
      setSupabaseError(prev => prev ? prev : `Error cargando alertas: ${alertsError.message}`);
    } else if (activeAlerts) {
      setAlertas(activeAlerts.map(mapDbAlert));
    }
  };

  // Active check-in time duration calculator
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Toast helper
  const triggerToast = (text: string, type: 'success' | 'alert' | 'info' = 'success') => {
    setToastMessage({ text, type });
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (dbEnabled) {
      loadParkingState();
    } else {
      setSupabaseError('Supabase no está configurado o no está disponible. Usa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
    }
  }, [dbEnabled]);

  // Duration counter for check-in
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (checkIn) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [checkIn]);

  // Alert countdown ticking and fast-forward mechanics
  useEffect(() => {
    const interval = setInterval(() => {
      setAlertas(prevAlerts => {
        return prevAlerts.map(alert => {
          if (alert.segundosRestantes > 0) {
            const nextSecs = alert.segundosRestantes - 1;
            return {
              ...alert,
              segundosRestantes: nextSecs,
              estado: nextSecs === 0 ? 'ESCALADA' as const : alert.estado
            };
          }
          return alert;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Block Report Countdown ticking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (modalBloqueo && isBlockTimerRunning) {
      interval = setInterval(() => {
        setBlockCountdown(prev => {
          if (prev <= 1) {
            setIsBlockTimerRunning(false);
            const blockerSpaceId = checkIn ? (espacios.find(e => e.id === checkIn.espacioId)?.parId || 'A-01-FRENTE') : 'A-01-FRENTE';
            const blockerObj = espacios.find(e => e.id === blockerSpaceId);
            const newAlert: Alerta = {
              id: Date.now(),
              patente: blockerObj?.patente || 'BKRT-45',
              espacioBloqueado: checkIn?.espacioId || 'A-01-FONDO',
              espacioBloqueador: blockerSpaceId,
              conductor: blockerObj?.conductor || 'Carlos Pérez',
              telefono: blockerObj?.telefono || '+56912345678',
              estado: 'ESCALADA',
              segundosRestantes: 0
            };

            if (dbEnabled && supabase) {
              (async () => {
                const { error: alertError } = await supabase.from('parking_alerts').insert([
                  {
                    plate: newAlert.patente,
                    blocked_space_id: newAlert.espacioBloqueado,
                    blocker_space_id: newAlert.espacioBloqueador,
                    driver_name: newAlert.conductor,
                    phone: newAlert.telefono,
                    status: 'ESCALADA',
                    seconds_remaining: 0,
                    resolved_at: null
                  }
                ]);

                const { error: spaceError } = await supabase
                  .from('parking_spaces')
                  .update({ status: 'alerta' })
                  .eq('id', blockerSpaceId);

                if (alertError || spaceError) {
                  console.error(alertError ?? spaceError);
                  triggerToast('Error sincronizando la alerta en Supabase.', 'alert');
                } else {
                  await loadParkingState();
                  triggerToast('Alerta escalada automáticamente al Panel de Guardia', 'alert');
                }
              })();
            } else {
              setAlertas(prev => [newAlert, ...prev]);
              triggerToast('Alerta escalada automáticamente al Panel de Guardia', 'alert');
            }

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [modalBloqueo, isBlockTimerRunning, checkIn, espacios, dbEnabled]);

  // US-04 rule checker helper function
  function puedeSeleccionar(espacio: Espacio, todosLosEspacios: Espacio[]): boolean {
    if (espacio.estado !== 'disponible') return false;
    if (espacio.tipo === 'doble_frente') {
      const fondo = todosLosEspacios.find(e => e.id === espacio.parId);
      if (fondo && fondo.estado === 'disponible') return false; // must occupy FONDO first
    }
    return true;
  }

  // Format second counters helper
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const email = loginEmail.trim().toLowerCase();
    if (!email.endsWith('@duocuc.cl')) {
      setLoginError('Solo usuarios institucionales @duocuc.cl');
      return;
    }

    const account = simulatedUsers[email];
    if (!account || account.password !== loginPassword) {
      setLoginError('Credenciales incorrectas. Usa el usuario y contraseña de prueba.');
      return;
    }

    setIsLoggingIn(true);
    try {
      setSessionUser({ email, role: account.role });
      setCurrentRole(account.role);
      setVista(resolveVistaFromRole(account.role));
      triggerToast('Sesión iniciada en modo simulado', 'success');
      await loadParkingState();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSessionUser(null);
    setCurrentRole('guardia');
    setVista('login');
    setLoginEmail('');
    setLoginPassword('');
    triggerToast('Sesión cerrada.', 'info');
  };

  // Check-In space logic
  const handleSpaceCheckIn = async (espacioId: string) => {
    if (!isOnline) {
      triggerToast('Error de conexión. Intente nuevamente.', 'alert');
      return;
    }

    const spaceObj = espacios.find(e => e.id === espacioId);
    if (!spaceObj) return;

    if (!puedeSeleccionar(spaceObj, espacios)) {
      if (spaceObj.tipo === 'doble_frente') {
        triggerToast(`Ocupa primero el Fondo [${spaceObj.parId}]`, 'alert');
      } else {
        triggerToast('Este espacio no está disponible', 'alert');
      }
      return;
    }

    setLoadingCheckIn(espacioId);

    const horaEntrada = new Date();
    const horaStr = `${horaEntrada.getHours().toString().padStart(2, '0')}:${horaEntrada.getMinutes().toString().padStart(2, '0')}`;

    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_spaces')
        .update({
          status: 'ocupado',
          plate: sessionUser?.email ? sessionUser.email.toUpperCase().slice(0, 7) : 'GZBY-88',
          driver_name: sessionUser?.email || 'conductor@duocuc.cl',
          phone: '+56977884455',
          entry_time: horaStr
        })
        .eq('id', espacioId);

      setLoadingCheckIn(null);

      if (error) {
        triggerToast('No se pudo registrar el ingreso en Supabase.', 'alert');
        console.error(error);
        return;
      }

      await loadParkingState();
      setCheckIn({ espacioId, tipo: spaceObj.tipo, zona: spaceObj.zona, horaEntrada: horaStr });
      triggerToast(`Registro exitoso en espacio ${espacioId}`, 'success');
      return;
    }

    setTimeout(() => {
      setLoadingCheckIn(null);
      setEspacios(prevEspacios =>
        prevEspacios.map(e => {
          if (e.id === espacioId) {
            return {
              ...e,
              estado: 'ocupado',
              conductor: sessionUser?.email || 'conductor@duocuc.cl',
              patente: 'GZBY-88',
              telefono: '+56977884455',
              horaEntrada: horaStr
            };
          }
          return e;
        })
      );

      setCheckIn({ espacioId, tipo: spaceObj.tipo, zona: spaceObj.zona, horaEntrada: horaStr });
      triggerToast(`Registro exitoso en espacio ${espacioId}`, 'success');
    }, 1000);
  };

  // Checkout space logic
  const handleSpaceCheckout = async () => {
    if (!checkIn) return;

    const targetId = checkIn.espacioId;

    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_spaces')
        .update({
          status: 'disponible',
          plate: null,
          driver_name: null,
          phone: null,
          entry_time: null
        })
        .eq('id', targetId);

      if (error) {
        triggerToast('No se pudo registrar la salida en Supabase.', 'alert');
        console.error(error);
        return;
      }

      await loadParkingState();
    } else {
      setEspacios(prevEspacios =>
        prevEspacios.map(e => {
          if (e.id === targetId) {
            return {
              ...e,
              estado: 'disponible',
              conductor: undefined,
              patente: undefined,
              telefono: undefined,
              horaEntrada: undefined
            };
          }
          return e;
        })
      );
    }

    triggerToast(`Salida registrada del espacio ${targetId}`, 'success');
    setCheckIn(null);
    setModalBloqueo(false);
    setIsBlockTimerRunning(false);
  };

  // Checkout any space (Guard panel action)
  const handleGuardCheckout = async (espacioId: string) => {
    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_spaces')
        .update({
          status: 'disponible',
          plate: null,
          driver_name: null,
          phone: null,
          entry_time: null,
          maintenance_reason: null
        })
        .eq('id', espacioId);

      if (error) {
        triggerToast('No se pudo liberar el espacio en Supabase.', 'alert');
        console.error(error);
        return;
      }

      await loadParkingState();
    } else {
      setEspacios(prevEspacios =>
        prevEspacios.map(e => {
          if (e.id === espacioId) {
            return {
              ...e,
              estado: 'disponible',
              conductor: undefined,
              patente: undefined,
              telefono: undefined,
              horaEntrada: undefined,
              mantenimientoRazon: undefined
            };
          }
          return e;
        })
      );
    }

    triggerToast(`Espacio ${espacioId} liberado administrativamente`, 'info');
    if (selectedEspacioId === espacioId) {
      setSelectedEspacioId(null);
    }
  };

  // Report blocking trigger
  const handleReportBlocking = () => {
    setModalBloqueo(true);
    setBlockCountdown(300); // 5 minutes
    setIsBlockTimerRunning(true);
  };

  const handleConfirmBlockingNotification = async () => {
    setIsBlockTimerRunning(false);

    const blockedId = checkIn?.espacioId || 'A-01-FONDO';
    const spaceFondo = espacios.find(e => e.id === blockedId);
    if (!spaceFondo || !supabase) {
      setModalBloqueo(false);
      triggerToast('No se pudo generar la notificación de bloqueo.', 'alert');
      return;
    }

    const frenteId = spaceFondo.parId || 'A-01-FRENTE';
    const spaceFrente = espacios.find(e => e.id === frenteId);
    const plate = spaceFrente?.patente || 'BKRT-45';
    const driverName = spaceFrente?.conductor || 'Carlos Pérez';
    const phone = spaceFrente?.telefono || '+56912345678';

    if (dbEnabled) {
      const { error: alertError } = await supabase.from('parking_alerts').insert([
        {
          plate,
          blocked_space_id: blockedId,
          blocker_space_id: frenteId,
          driver_name: driverName,
          phone,
          status: 'NUEVO',
          seconds_remaining: 300
        }
      ]);

      const { error: spaceError } = await supabase
        .from('parking_spaces')
        .update({ status: 'alerta' })
        .eq('id', frenteId);

      if (alertError || spaceError) {
        console.error(alertError ?? spaceError);
        triggerToast('No se pudo enviar la notificación al conductor bloqueador.', 'alert');
      } else {
        await loadParkingState();
        triggerToast('Notificación enviada al conductor bloqueador', 'success');
      }
    } else {
      const newAlertId = Date.now();
      const newAlertObj: Alerta = {
        id: newAlertId,
        patente: plate,
        espacioBloqueado: blockedId,
        espacioBloqueador: frenteId,
        conductor: driverName,
        telefono: phone,
        estado: 'NUEVO',
        segundosRestantes: 300
      };

      setAlertas(prev => [newAlertObj, ...prev]);
      setEspacios(prev => prev.map(e => (e.id === frenteId ? { ...e, estado: 'alerta' } : e)));
      triggerToast('Notificación enviada al conductor bloqueador', 'success');
    }

    setModalBloqueo(false);
  };

  const handleFastForwardCounter = () => {
    setBlockCountdown(1);
  };

  const handleEscalateDriverImmediately = async () => {
    setIsBlockTimerRunning(false);

    const blockedId = checkIn?.espacioId || 'A-01-FONDO';
    const spaceFondo = espacios.find(e => e.id === blockedId);
    if (!spaceFondo || !supabase) {
      setModalBloqueo(false);
      triggerToast('No se pudo escalar la alerta.', 'alert');
      return;
    }

    const frenteId = spaceFondo.parId || 'A-01-FRENTE';
    const spaceFrente = espacios.find(e => e.id === frenteId);
    const plate = spaceFrente?.patente || 'BKRT-45';
    const driverName = spaceFrente?.conductor || 'Carlos Pérez';
    const phone = spaceFrente?.telefono || '+56912345678';

    if (dbEnabled) {
      const { error: alertError } = await supabase.from('parking_alerts').insert([
        {
          plate,
          blocked_space_id: blockedId,
          blocker_space_id: frenteId,
          driver_name: driverName,
          phone,
          status: 'ESCALADA',
          seconds_remaining: 0,
          resolved_at: null
        }
      ]);

      const { error: spaceError } = await supabase
        .from('parking_spaces')
        .update({ status: 'alerta' })
        .eq('id', frenteId);

      if (alertError || spaceError) {
        console.error(alertError ?? spaceError);
        triggerToast('No se pudo escalar la alerta.', 'alert');
      } else {
        await loadParkingState();
        triggerToast('Alerta escalada de inmediato al guardia de turno', 'alert');
      }
    } else {
      const newAlertId = Date.now();
      const newAlertObj: Alerta = {
        id: newAlertId,
        patente: plate,
        espacioBloqueado: blockedId,
        espacioBloqueador: frenteId,
        conductor: driverName,
        telefono: phone,
        estado: 'ESCALADA',
        segundosRestantes: 0
      };

      setAlertas(prev => [newAlertObj, ...prev]);
      setEspacios(prev => prev.map(e => (e.id === frenteId ? { ...e, estado: 'alerta' } : e)));
      triggerToast('Alerta escalada de inmediato al guardia de turno', 'alert');
    }

    setModalBloqueo(false);
  };

  // Guard Actions
  const handleResolveAlert = async (alertId: number, blockFrenteId: string) => {
    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_alerts')
        .update({ status: 'ESCALADA', resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) {
        triggerToast('No se pudo actualizar la alerta en Supabase.', 'alert');
        console.error(error);
        return;
      }

      const { error: spaceError } = await supabase
        .from('parking_spaces')
        .update({ status: 'ocupado' })
        .eq('id', blockFrenteId);

      if (spaceError) {
        triggerToast('No se pudo restaurar el estado del espacio en Supabase.', 'alert');
        console.error(spaceError);
        return;
      }

      await loadParkingState();
    } else {
      setAlertas(prev => prev.filter(a => a.id !== alertId));
      setEspacios(prev => prev.map(e => {
        if (e.id === blockFrenteId && e.estado === 'alerta') {
          return { ...e, estado: 'ocupado' };
        }
        return e;
      }));
    }

    triggerToast('Resolución escalada procesada limpia', 'success');
  };

  const handleContactDriver = (phone: string, driver: string) => {
    triggerToast(`Llamando a ${driver} (${phone}) desde tablet...`, "info");
  };

  // Click handler to close context menu
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Context Menu administrative actions
  const handleGridRightClick = (e: React.MouseEvent, espacioId: string) => {
    // Only display context menu for relevant administrative roles
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      espacioId
    });
  };

  const handleAdminReserve = async (espacioId: string) => {
    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_spaces')
        .update({ status: 'reservado', maintenance_reason: null })
        .eq('id', espacioId);

      if (error) {
        triggerToast('No se pudo reservar el espacio en Supabase.', 'alert');
        console.error(error);
        return;
      }
      await loadParkingState();
    } else {
      setEspacios(prev => prev.map(e => {
        if (e.id === espacioId) {
          return {
            ...e,
            estado: 'reservado',
            mantenimientoRazon: undefined
          };
        }
        return e;
      }));
    }
    triggerToast(`Espacio ${espacioId} reservado de forma administrativa`, 'success');
  };

  const handleAdminMaintenanceStart = (espacioId: string) => {
    setShowMaintenanceForm(espacioId);
    setMantenimientoReason('');
    setMantenimientoError('');
  };

  const handleConfirmMaintenance = async (e: React.FormEvent, espacioId: string) => {
    e.preventDefault();
    if (mantenimientoReason.trim().length < 10) {
      setMantenimientoError('Debe ingresar un motivo de al menos 10 caracteres');
      return;
    }

    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_spaces')
        .update({ status: 'mantenimiento', maintenance_reason: mantenimientoReason })
        .eq('id', espacioId);

      if (error) {
        triggerToast('No se pudo actualizar el estado de mantenimiento en Supabase.', 'alert');
        console.error(error);
        return;
      }
      await loadParkingState();
    } else {
      setEspacios(prev => prev.map(e => {
        if (e.id === espacioId) {
          return {
            ...e,
            estado: 'mantenimiento',
            mantenimientoRazon: mantenimientoReason
          };
        }
        return e;
      }));
    }

    triggerToast(`Espacio ${espacioId} puesto en mantenimiento`, 'info');
    setShowMaintenanceForm(null);
  };

  const handleAdminClearToAvailable = async (espacioId: string) => {
    if (dbEnabled && supabase) {
      const { error } = await supabase
        .from('parking_spaces')
        .update({
          status: 'disponible',
          plate: null,
          driver_name: null,
          phone: null,
          entry_time: null,
          maintenance_reason: null
        })
        .eq('id', espacioId);

      if (error) {
        triggerToast('No se pudo limpiar el espacio en Supabase.', 'alert');
        console.error(error);
        return;
      }
      await loadParkingState();
    } else {
      setEspacios(prev => prev.map(e => {
        if (e.id === espacioId) {
          return {
            ...e,
            estado: 'disponible',
            conductor: undefined,
            patente: undefined,
            telefono: undefined,
            horaEntrada: undefined,
            mantenimientoRazon: undefined
          };
        }
        return e;
      }));
    }

    triggerToast(`Espacio ${espacioId} ahora disponible`, 'success');
  };

  // Derived state calculations
  const totalEspacios = espacios.length;
  const espaciosDisponibles = espacios.filter(e => e.estado === 'disponible').length;
  const espaciosOcupados = espacios.filter(e => e.estado === 'ocupado').length;
  const espaciosAlertas = espacios.filter(e => e.estado === 'alerta').length;
  const espaciosReservados = espacios.filter(e => e.estado === 'reservado').length;
  const espaciosMantenimiento = espacios.filter(e => e.estado === 'mantenimiento').length;
  const occupancyPercentage = Math.round(((totalEspacios - espaciosDisponibles) / totalEspacios) * 100);

  // Check if double paired FRENTE is occupied (for block report rule check)
  const isPairedFrenteOccupiedForCheckIn = checkIn && checkIn.tipo === 'doble_fondo' && (() => {
    const spaceFondo = espacios.find(e => e.id === checkIn.espacioId);
    if (spaceFondo && spaceFondo.parId) {
      const spaceFrente = espacios.find(e => e.id === spaceFondo.parId);
      return spaceFrente && (spaceFrente.estado === 'ocupado' || spaceFrente.estado === 'alerta');
    }
    return false;
  })();

  // Filter spots by Zone
  const filterByZone = (zoneName: string) => {
    return espacios.filter(e => e.zona === zoneName);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col font-sans select-none pb-16">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {supabaseError && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed top-24 right-6 z-[1000] p-4 rounded-xl shadow-lg border bg-yellow-500 text-white max-w-sm flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{supabaseError}</span>
            <button onClick={() => setSupabaseError('')} className="ml-auto text-white hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            id="toast-notification"
            className={`fixed bottom-20 right-6 z-[1000] p-4 rounded-xl shadow-lg border text-white max-w-sm flex items-center gap-3 ${
              toastMessage.type === 'alert' 
                ? 'bg-red-600 border-red-500' 
                : toastMessage.type === 'info'
                ? 'bg-[#0076b6] border-[#00a4e4]'
                : 'bg-green-600 border-green-500'
            }`}
          >
            {toastMessage.type === 'alert' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            <span className="font-medium text-sm text-white">{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="ml-auto text-white hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Workspace View Area */}
      <div className="flex-1 flex flex-col">
        {vista === 'login' && (
          <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-[#002b49] via-[#001d34] to-[#001525] min-h-[calc(100vh-4rem)]">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              id="login-card"
              className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl overflow-hidden border-t-8 border-[#fdb913] p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#002b49] text-[#fdb913] rounded-2xl flex items-center justify-center mx-auto mb-4 hover:scale-105 transition-transform duration-300 shadow-md">
                  <Car className="w-9 h-9" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#002b49]">SGE-Duoc</h1>
                <p className="text-xs font-semibold text-[#0076b6] tracking-wider uppercase mt-1">Duoc UC Maipú</p>
                <p className="text-xs text-gray-500 mt-2">Sistema de Gestión Inteligente de Estacionamientos</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 tracking-wider mb-2">Correo institucional</label>
                  <div className="relative">
                    <input 
                      type="email"
                      id="login-email-input"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="guardia@duocuc.cl o jefe_seguridad@duocuc.cl"
                      className={`w-full min-h-[44px] px-4 rounded-xl border bg-gray-50 text-base outline-none transition-colors duration-200 ${
                        loginError ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-200 focus:border-[#0076b6]'
                      }`}
                      required
                    />
                  </div>
                  {loginError && (
                    <p className="text-red-600 text-xs font-semibold mt-2 flex items-center gap-1.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {loginError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 tracking-wider mb-2">Contraseña</label>
                  <div className="relative flex items-center">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[44px] pl-4 pr-12 rounded-xl border border-gray-200 bg-gray-50 text-base outline-none focus:border-[#0076b6] transition-colors duration-200"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 w-[44px] h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600"
                      title={showPassword ? 'Ocultar Contraseña' : 'Mostrar Contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full min-h-[44px] bg-[#fdb913] hover:bg-[#e2a40a] disabled:bg-gray-300 text-[#002b49] font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-98"
                >
                  {isLoggingIn ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-[#002b49]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Validando credenciales...</span>
                    </>
                  ) : (
                    <span>INGRESAR</span>
                  )}
                </button>
              </form>

              <div className="mt-4 text-xs text-gray-500">
                <p>Este login es simulado para pruebas de la interfaz. Los datos de estacionamiento se sincronizan con Supabase cuando está configurado.</p>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-500">
                <p>Uso institucional exclusivo para guardias y administración de Duoc UC Sede Maipú.</p>
                <p className="mt-3 text-[10px] text-gray-400">Acceso simulado en el cliente.</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* VIEW 3 — PANEL GUARDIA (Responsive design - mobile to desktop) */}
        {vista === 'guardia' && (
          <div className="flex-1 flex flex-col lg:flex-row bg-gray-50 min-h-0" id="guard-tablet-view">
            
            {/* Sidebar navigation - responsive (hidden on mobile, visible on lg) */}
            <aside className="hidden lg:flex w-full lg:w-64 bg-[#002b49] text-white flex-col p-6 shrink-0 shadow-lg relative">
              <div className="flex items-center gap-2 mb-10">
                <div className="w-10 h-10 bg-[#fdb913] text-[#002b49] rounded-xl flex items-center justify-center shadow-md">
                  <Shield className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h1 className="font-extrabold text-white text-lg tracking-tight">SGE-Duoc</h1>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#00a4e4]">Panel Guardia</span>
                </div>
              </div>

              {/* Sidebar Menu Items */}
              <nav className="flex-1 space-y-1.5 text-sm">
                <button 
                  onClick={() => setVista('guardia')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#fdb913] text-[#002b49] rounded-xl font-bold transition-all shadow-md border-r-4 border-white/40"
                >
                  <Car className="w-5 h-5 shrink-0" />
                  <span>Mapa Central</span>
                </button>

                <button 
                  onClick={() => setVista('gestion')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[#00a4e4] hover:bg-white/5 rounded-xl font-semibold transition-all"
                >
                  <TrendingUp className="w-5 h-5 shrink-0" />
                  <span>Estadísticas & IA</span>
                </button>
              </nav>

              {/* Mini user profile badge */}
              <div className="border-t border-[#001d34] pt-4 mt-auto">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#0076b6] flex items-center justify-center font-bold text-white uppercase border text-xs">
                    G
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-extrabold text-xs text-white leading-tight">Guardia de Turno</p>
                    <p className="text-[10px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap">guardia@duocuc.cl</p>
                  </div>
                </div>

                <button 
                  onClick={handleLogout} 
                  className="w-full mt-4 min-h-[44px] border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold rounded-xl text-xs transition-colors py-2 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </aside>

            {/* Main Area: Responsive width */}
            <main className="flex-1 flex flex-col min-w-0 w-full lg:w-auto" style={{ minHeight: '0' }}>
              
              {/* Header inside Panel - responsive */}
              <header className="bg-white border-b h-auto lg:h-16 shrink-0 px-4 lg:px-8 py-4 lg:py-0 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-[#002b49] text-sm lg:text-base">Sede Maipú</span>
                  <span className="text-gray-300 hidden lg:inline">|</span>
                  <div className="flex items-center gap-1.5">
                    {/* Active Connection state indicator (CA-05.5) */}
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-100 animate-pulse"></span>
                    <span className="text-xs lg:text-sm font-bold text-[#002b49]">Realtime activo</span>
                  </div>
                </div>

                {/* Clock indicator */}
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 border px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4 text-[#0076b6]" />
                  <span>UTC 15:22:33</span>
                </div>
              </header>

              {/* KPI metrics bar - responsive grid */}
              <div className="bg-[#002b49] text-white p-3 lg:p-4 px-4 lg:px-8 grid grid-cols-2 lg:flex lg:flex-wrap gap-3 lg:gap-4 items-center justify-between shadow-inner shrink-0">
                <div className="flex items-center gap-2 min-w-[100px] lg:min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15 shrink-0">
                    <Car className="w-4 lg:w-5 h-4 lg:h-5 text-gray-300" />
                  </div>
                  <div>
                    <span className="text-[9px] lg:text-[10px] text-gray-400 leading-none block">Total Espacios</span>
                    <p className="font-black text-xs lg:text-sm">{totalEspacios}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-[100px] lg:min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15 shrink-0">
                    <CheckCircle className="w-4 lg:w-5 h-4 lg:h-5 text-green-400" />
                  </div>
                  <div>
                    <span className="text-[9px] lg:text-[10px] text-gray-400 leading-none block">Ocupados</span>
                    <p className="font-black text-xs lg:text-sm text-red-400">{totalEspacios - espaciosDisponibles}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-[100px] lg:min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15 shrink-0">
                    <Wrench className="w-4 lg:w-5 h-4 lg:h-5 text-gray-400" />
                  </div>
                  <div>
                    <span className="text-[9px] lg:text-[10px] text-gray-400 leading-none block">Disponibles</span>
                    <p className="font-black text-xs lg:text-sm text-green-400">{espaciosDisponibles}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-[100px] lg:min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15 shrink-0">
                    <AlertTriangle className="w-4 lg:w-5 h-4 lg:h-5 text-[#fdb913]" />
                  </div>
                  <div className="bg-[#fdb913] text-[#002b49] px-2.5 py-1 rounded-lg">
                    <span className="text-[8px] lg:text-[9px] font-extrabold leading-none uppercase block">Alertas</span>
                    <p className="font-black text-sm lg:text-base text-center leading-none mt-0.5">{alertas.length}</p>
                  </div>
                </div>
              </div>

              {/* Interactive Map Layout area - responsive */}
              <div className="flex-1 p-4 lg:p-8 overflow-y-auto min-h-0 space-y-4 lg:space-y-6">

                {/* Sub-system warning info tool details - responsive */}
                <div className="bg-white rounded-xl lg:rounded-2xl p-3 lg:p-4 border shadow-sm flex flex-col sm:flex-row items-start gap-3">
                  <div className="w-9 lg:w-10 h-9 lg:h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <Info className="w-4 lg:w-5 h-4 lg:h-5 shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#002b49] text-xs lg:text-sm">Instrucciones Rápidas</h4>
                    <p className="text-[9px] lg:text-[10px] text-gray-500 leading-relaxed mt-1">
                      <b className="text-[#002b49]">Clic izq:</b> Ver detalles. 
                      <b className="text-[#0076b6] ml-1">Clic derecho:</b> Reserva/Mantención.
                    </p>
                  </div>
                </div>

                {/* Left-click details Drawer Panel & Right-Click Context Form */}
                {showMaintenanceForm && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-white border-2 border-slate-300 rounded-2xl shadow-md space-y-4"
                  >
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-extrabold text-sm text-[#002b49] flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-gray-500" />
                        Bloquear Casilla {showMaintenanceForm} para Mantenimiento
                      </span>
                      <button onClick={() => setShowMaintenanceForm(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={(e) => handleConfirmMaintenance(e, showMaintenanceForm)} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Por favor ingrese el motivo del mantenimiento</label>
                        <input 
                          type="text" 
                          value={mantenimientoReason} 
                          onChange={(e) => {
                            setMantenimientoReason(e.target.value);
                            if (mantenimientoError) setMantenimientoError('');
                          }}
                          placeholder="Mantenimiento preventivo de pintura de líneas divisorias lógico..." 
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-gray-200 text-sm focus:border-[#0076b6] outline-none"
                          required
                        />
                        {mantenimientoError && <p className="text-red-600 text-xs font-semibold mt-1">{mantenimientoError}</p>}
                      </div>

                      <div className="flex justify-end gap-2.5">
                        <button 
                          type="button" 
                          onClick={() => setShowMaintenanceForm(null)}
                          className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="px-4 py-2 bg-[#002b49] text-white rounded-xl text-xs font-bold hover:bg-[#001c30]"
                        >
                          Confirmar Bloqueo
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* CSS Grid Map organizes Zones A, B, C, D - responsive */}
                <div className="space-y-4 lg:space-y-6">
                  {['A', 'B', 'C', 'D'].map(zonaName => (
                    <div key={zonaName} className="bg-white rounded-2xl p-4 lg:p-6 border shadow-sm space-y-3 lg:space-y-4">
                      <div className="flex items-center justify-between pb-2 lg:pb-3 border-b border-gray-100">
                        <h3 className="font-black text-sm lg:text-base text-[#002b49] tracking-tight flex items-center gap-2">
                          <span className="w-2 h-4 lg:h-5 bg-[#0076b6] rounded-sm"></span>
                          Zona Estacionamiento {zonaName}
                        </h3>
                        <span className="text-[8px] lg:text-xs text-gray-400 font-bold bg-gray-50 border px-2.5 lg:px-3 py-1 rounded-full uppercase">
                          SECTOR
                        </span>
                      </div>

                      {/* Map Grid Container - more responsive breakpoints */}
                      <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-8 gap-1.5 lg:gap-3" id={`map-grid-${zonaName}`}>
                        {filterByZone(zonaName).map(esp => {
                          const isSelected = selectedEspacioId === esp.id;
                          const hasAlert = esp.estado === 'alerta';
                          const isMaint = esp.estado === 'mantenimiento';
                          const isRes = esp.estado === 'reservado';
                          const isOcup = esp.estado === 'ocupado';
                          const isFree = esp.estado === 'disponible';
                          
                          return (
                            <div 
                              key={esp.id}
                              onClick={() => setSelectedEspacioId(esp.id)}
                              onContextMenu={(e) => handleGridRightClick(e, esp.id)}
                              className={`aspect-square rounded-lg lg:rounded-xl p-1.5 lg:p-2.5 border-2 flex flex-col justify-between cursor-pointer relative transition-all duration-200 select-none text-[9px] lg:text-xs ${
                                isSelected ? 'ring-4 ring-[#00a4e4] ring-offset-2' : ''
                              } ${
                                hasAlert 
                                  ? 'border-yellow-500 bg-amber-50 text-amber-950 animate-pulse'
                                  : isMaint
                                  ? 'border-gray-300 bg-gray-100 text-gray-400'
                                  : isRes
                                  ? 'border-blue-400 bg-blue-50 text-blue-950'
                                  : isOcup
                                  ? 'border-[#002b49] bg-red-50 text-red-950'
                                  : 'border-green-400 bg-green-50 text-green-950 hover:bg-green-100'
                              }`}
                              style={{ minHeight: '44px' }}
                              title={`${esp.id} - Haga clic derecho para Menu Administrativo`}
                            >
                              <div className="flex items-center justify-between gap-0.5">
                                <span className="font-extrabold text-[8px] lg:text-xs">{esp.id}</span>
                                {esp.tipo === 'doble_fondo' && <span className="text-[6px] lg:text-[7px] bg-slate-200 text-slate-700 px-0.5 py-0.2 rounded font-black uppercase">DF</span>}
                                {esp.tipo === 'doble_frente' && <span className="text-[6px] lg:text-[7px] bg-amber-200 text-amber-700 px-0.5 py-0.2 rounded font-black uppercase">F</span>}
                              </div>

                              {/* Central visual indicator icon based on status - responsive */}
                              <div className="flex justify-center my-0.5 lg:my-1">
                                {hasAlert ? (
                                  <AlertTriangle className="w-3 lg:w-5 h-3 lg:h-5 text-amber-600 animate-bounce" />
                                ) : isMaint ? (
                                  <Wrench className="w-3 lg:w-5 h-3 lg:h-5 text-gray-400" />
                                ) : isRes ? (
                                  <Lock className="w-3 lg:w-5 h-3 lg:h-5 text-blue-500" />
                                ) : isOcup ? (
                                  <Car className="w-3 lg:w-5 h-3 lg:h-5 text-[#002b49] shrink-0" />
                                ) : (
                                  <CheckCircle className="w-3 lg:w-5 h-3 lg:h-5 text-green-600" />
                                )}
                              </div>

                              <span className="text-[6px] lg:text-[8px] font-black uppercase text-center tracking-wider block mt-auto leading-none">
                                {hasAlert ? 'ALERTA' : isMaint ? 'MANT' : isRes ? 'RES' : isOcup ? 'OCP' : 'LIBRE'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Context Menu administrative menu absolute layer (US-08) */}
                {contextMenu && (
                  <div 
                    className="fixed bg-white border shadow-xl rounded-xl py-2 w-56 z-[1000] border-slate-200 text-xs animate-fadeIn"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                  >
                    <div className="px-4 py-2 border-b font-extrabold text-slate-400 uppercase tracking-widest text-[9px]">
                      ADMINISTRAR: {contextMenu.espacioId}
                    </div>

                    <button 
                      onClick={() => handleAdminReserve(contextMenu.espacioId)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 font-bold flex items-center gap-2 text-slate-700 hover:text-blue-600"
                    >
                      <Lock className="w-4 h-4 text-blue-500" />
                      <span>Reservar espacio</span>
                    </button>

                    <button 
                      onClick={() => handleAdminMaintenanceStart(contextMenu.espacioId)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 font-bold flex items-center gap-2 text-slate-700 hover:text-amber-600"
                    >
                      <Wrench className="w-4 h-4 text-amber-500" />
                      <span>Bloquear mantenimiento</span>
                    </button>

                    <button 
                      onClick={() => handleAdminClearToAvailable(contextMenu.espacioId)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 font-bold flex items-center gap-2 text-green-600"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Liberar / Marcar Libre</span>
                    </button>

                    <div className="border-t my-1"></div>

                    <div className="px-4 py-1 text-[9px] text-gray-400">
                      Visualización por perfil: <b className="text-gray-600 uppercase">{currentRole}</b>
                    </div>
                  </div>
                )}

                {/* Inline Drawer/Panel details for single click selected space - responsive */}
                {selectedEspacioId && (() => {
                  const s = espacios.find(e => e.id === selectedEspacioId);
                  if (!s) return null;
                  
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#002b49] text-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-xl border-l-8 border-[#fdb913] relative overflow-hidden"
                    >
                      <button 
                        onClick={() => setSelectedEspacioId(null)}
                        className="absolute top-3 lg:top-4 right-3 lg:right-4 text-white/60 hover:text-white"
                      >
                        <X className="w-4 lg:w-5 h-4 lg:h-5" />
                      </button>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-center">
                        <div>
                          <span className="text-[8px] lg:text-[10px] text-gray-300 uppercase font-bold tracking-widest">Info Casilla</span>
                          <h4 className="text-2xl lg:text-3xl font-black text-[#fdb913] mt-1">{s.id}</h4>
                          <p className="text-[9px] lg:text-xs text-slate-300 font-semibold mt-1">
                            Tipo: <b className="text-[#00a4e4] uppercase">{s.tipo.replace('_', ' ')}</b>
                          </p>
                          {s.mantenimientoRazon && (
                            <p className="mt-2 text-[8px] lg:text-xs bg-black/20 p-2 lg:p-2.5 rounded-lg border border-white/5 text-slate-200">
                              <b>Motivo:</b> {s.mantenimientoRazon}
                            </p>
                          )}
                        </div>

                        {s.estado === 'ocupado' || s.estado === 'alerta' ? (
                          <>
                            <div className="space-y-1.5 lg:space-y-1 text-sm bg-black/20 p-3 lg:p-4 rounded-lg lg:rounded-xl border border-white/5">
                              <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Conductor Titular</span>
                              <p className="font-extrabold text-white text-sm lg:text-base flex items-center gap-1.5">
                                <User className="w-3 lg:w-4 h-3 lg:h-4 text-[#fdb913] shrink-0" />
                                <span className="truncate">{s.conductor || 'Rodrigo Silva'}</span>
                              </p>
                              <p className="font-mono text-[7px] lg:text-xs text-red-400 font-bold">Patente: {s.patente || 'HZLW-89'}</p>
                              <p className="text-[8px] lg:text-xs text-slate-200">Ingreso: {s.horaEntrada || '14:50'} Hrs</p>
                            </div>

                            <div className="space-y-2 lg:space-y-3.5">
                              {s.telefono && (
                                <a 
                                  href={`tel:${s.telefono}`}
                                  className="w-full min-h-[40px] lg:min-h-[44px] bg-[#0076b6] hover:bg-[#005c8f] text-white font-bold rounded-lg lg:rounded-xl text-[8px] lg:text-xs transition-colors flex items-center justify-center gap-2"
                                >
                                  <Phone className="w-3 lg:w-4 h-3 lg:h-4" />
                                  <span className="hidden sm:inline">Llamar ({s.telefono})</span>
                                  <span className="sm:hidden">Llamar</span>
                                </a>
                              )}
                              <button 
                                onClick={() => handleGuardCheckout(s.id)}
                                className="w-full min-h-[40px] lg:min-h-[44px] bg-[#fdb913] hover:bg-[#e2a40a] text-[#002b49] font-bold rounded-lg lg:rounded-xl text-[8px] lg:text-xs transition-all flex items-center justify-center gap-2"
                              >
                                <CheckCircle className="w-3 lg:w-4 h-3 lg:h-4" />
                                <span className="hidden sm:inline">Registrar Salida</span>
                                <span className="sm:hidden">Salida</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-1 lg:col-span-2 text-center py-4 lg:py-6 border border-dashed border-white/10 rounded-lg lg:rounded-xl">
                            <CheckCircle className="w-6 lg:w-8 h-6 lg:h-8 text-green-400 mx-auto mb-2" />
                            <p className="font-bold text-xs lg:text-sm text-[#fdb913]">Disponible</p>
                            <p className="text-[8px] lg:text-xs text-slate-300 mt-1">Sin conductores registrados en este momento.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}

              </div>
            </main>

            {/* Right sidebar: Alerts - responsive (hidden on mobile) */}
            <aside className="hidden lg:flex w-80 bg-white border-l shrink-0 p-4 lg:p-6 flex-col gap-4 lg:gap-5 overflow-y-auto">
              <div className="flex justify-between items-center pb-2 lg:pb-3 border-b border-gray-100">
                <span className="font-extrabold text-[#002b49] text-xs lg:text-sm tracking-wide">ALERTAS OPERATIVAS</span>
                <span className="text-xs bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-200">
                  {alertas.length} Activas
                </span>
              </div>

              {alertas.length === 0 ? (
                /* Empty state when no alerts (CA-07.4) */
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 p-4 border border-dashed border-gray-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-3 shadow-inner">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-[#002b49] text-xs">Sin alertas activas</h4>
                  <p className="text-[10px] text-gray-400 leading-normal mt-1 max-w-[180px]">Todo el estacionamiento Maipú está operando de forma fluida.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertas.map(a => {
                    const isEscalated = a.estado === 'ESCALADA';
                    const isUrgent = a.segundosRestantes < 60;
                    
                    return (
                      <motion.div 
                        key={a.id}
                        initial={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`p-4 rounded-xl shadow-md border-l-4 transition-all relative overflow-hidden bg-white ${
                          isEscalated 
                            ? 'border-red-500 ring-2 ring-red-100 animate-pulse' 
                            : 'border-orange-500'
                        }`}
                      >
                        {/* Upper line metadata */}
                        <div className="flex justify-between items-center mb-2.5">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                            isEscalated 
                              ? 'bg-red-100 text-red-700 animate-bounce' 
                              : 'bg-orange-50 text-orange-700'
                          }`}>
                            {isEscalated ? 'ESCALADA ALERTA' : 'BLOQUEO ACTIVO'}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 font-bold">
                            Restante: <b className={isUrgent ? 'text-red-600 font-black' : 'text-gray-700'}>{formatTime(a.segundosRestantes)}</b>
                          </span>
                        </div>

                        {/* Blocker description details */}
                        <div className="space-y-1.5 mb-4">
                          <h4 className="font-extrabold text-xs text-[#002b49] leading-tight">
                            Casilla Bloqueada: <b className="text-red-600 underline">{a.espacioBloqueado}</b>
                          </h4>
                          <p className="text-[10px] text-gray-500 font-semibold leading-normal">
                            Bloqueador registrado en el frente: <b>{a.espacioBloqueador}</b>
                          </p>
                          <div className="p-2 bg-slate-50 rounded-lg border text-[10px] space-y-0.5 leading-normal">
                            <p className="font-bold text-[#002b49]">Conductor: {a.conductor}</p>
                            <p className="text-slate-500">Tel: {a.telefono}</p>
                            <p className="text-red-500 font-mono font-bold">Patente: {a.patente}</p>
                          </div>
                        </div>

                        {/* Action Buttons (CA-07.2) */}
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => handleContactDriver(a.telefono, a.conductor)}
                            className="px-2 py-2 border border-[#0076b6] text-[#0076b6] hover:bg-slate-50 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                          >
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>Contactar</span>
                          </button>

                          <button 
                            onClick={() => handleResolveAlert(a.id, a.espacioBloqueador)}
                            className="px-2 py-2 bg-[#fdb913] text-[#002b49] hover:bg-[#e2a40a] text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3 h-3 shrink-0" />
                            <span>Resolver</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </aside>

          </div>
        )}

        {/* VIEW 4 — VISTA GESTIÓN (Desktop Dashboard, statistics and projections) */}
        {vista === 'gestion' && (
          <div className="flex-1 bg-[#f7f9fb]" id="admin-management-panel">
            {/* Header top section */}
            <header className="bg-white border-b h-16 px-8 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#002b49] rounded-lg flex items-center justify-center text-[#fdb913] font-bold">
                  S
                </div>
                <h1 className="font-black text-lg text-[#002b49]">SGE-Duoc <span className="font-semibold text-xs text-[#0076b6] tracking-widest uppercase ml-1">ADMIN GESTIÓN</span></h1>
              </div>

              {/* View navigators top */}
              <div className="flex bg-gray-100 p-1.5 rounded-xl border text-xs font-bold gap-1">
                <button 
                  onClick={() => setVista('guardia')}
                  className="px-4 py-2 hover:bg-white rounded-lg transition-colors text-gray-500 hover:text-[#002b49]"
                >
                  Vista Central Guardia
                </button>
                <button 
                  onClick={() => setVista('gestion')}
                  className="px-4 py-2 bg-white text-[#002b49] rounded-lg transition-colors shadow-sm"
                >
                  Proyecciones IA
                </button>
              </div>
            </header>

            <main className="max-w-7xl mx-auto p-8 space-y-8">
              
              {/* Row KPI Cards (CA-11.4 metadata) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                <div className="bg-white rounded-2xl p-5 border shadow-sm relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[#0076b6]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Ocupación Actual</span>
                  <p className="text-3xl font-black text-[#002b49] mt-2 font-mono">{occupancyPercentage}%</p>
                  <div className="flex items-center mt-3 text-xs font-semibold text-green-600 gap-1">
                    <span>↑ 4.5% vs semana pasada</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border shadow-sm relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[#fdb913]">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Alertas Activas</span>
                  <p className="text-3xl font-black text-[#fdb913] mt-2 font-mono">{alertas.length}</p>
                  <p className="text-xs text-gray-400 mt-3 font-semibold">2 escalados pendientes</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border shadow-sm relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-[#00a4e4]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Promedio Estadía</span>
                  <p className="text-3xl font-black text-[#002b49] mt-2 font-mono">2h 45m</p>
                  <p className="text-xs text-gray-400 mt-3 font-semibold">Normal para segmento Alumnos</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border shadow-sm relative overflow-hidden">
                  <div className="absolute top-4 right-4 text-red-500">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Infracciones Hoy</span>
                  <p className="text-3xl font-black text-[#002b49] mt-2 font-mono">03</p>
                  <p className="text-xs text-red-600 mt-3 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Bloqueo no reportado libre
                  </p>
                </div>

              </div>

              {/* AI occupancy projections (CA-11.1 to CA-11.4) */}
              <div className="p-6 bg-white rounded-2xl border shadow-sm space-y-6">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#002b49] text-base">Proyección IA — próximas 4 horas</h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">Algoritmo predictivo entrenado con historial de flujos de Sede Maipú</p>
                  </div>

                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" /> Modelo Estaciones Activo
                  </span>
                </div>

                {/* Saturation warning banners if saturación is true (CA-11.3) */}
                {proyeccionesIA.some(p => p.estado === 'Saturación') && (() => {
                  const satSlot = proyeccionesIA.find(p => p.estado === 'Saturación');
                  return (
                    <div className="bg-[#fdb913] text-[#002b49] p-4 rounded-xl border border-[#e2a40a] flex items-start gap-3 shadow-sm animate-fadeIn">
                      <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-extrabold text-sm">Se anticipa saturación a las {satSlot?.hora}. Considere habilitar espacios adicionales.</p>
                        <p className="text-xs leading-normal mt-0.5 text-[#002b49]/90 font-medium">Saturación crítica pronosticada debido al solapamiento de cambios del bloque académico diurno-vespertino.</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Subgrid cards representing time-slot projections */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {proyeccionesIA.map(p => {
                    const isSat = p.estado === 'Saturación';
                    const isHigh = p.estado === 'Alta demanda';
                    
                    return (
                      <div key={p.hora} className={`p-4 rounded-xl border shadow-sm bg-white space-y-3 ${
                        isSat ? 'border-red-400 ring-4 ring-red-50' : isHigh ? 'border-amber-400' : 'border-gray-200'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-sm text-[#002b49] font-mono">{p.hora} Hrs</span>
                          
                          {/* Alert level badge (CA-11.2) */}
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                            isSat 
                              ? 'bg-red-100 text-red-700' 
                              : isHigh 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {isSat && <AlertCircle className="w-3 h-3 shrink-0" />}
                            {p.estado}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">Ocupación estimada</span>
                          <p className="text-2xl font-black text-[#002b49] mt-1 font-mono">{p.ocupacion}%</p>
                        </div>

                        {/* Progress visual bar gauge */}
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              isSat ? 'bg-red-500' : isHigh ? 'bg-[#fdb913]' : 'bg-green-500'
                            }`}
                            style={{ width: `${p.ocupacion}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated line chart using CSS (CA-11.4) */}
                <div className="border rounded-2xl p-6 bg-slate-50 relative mt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-extrabold text-xs text-[#002b49] uppercase tracking-wider">Curva de Carga Inteligente</h4>
                      <p className="text-[10px] text-gray-400 font-medium leading-none mt-0.5">Operación de hoy vs Promedio Histórico 7 Días</p>
                    </div>

                    {/* Legend */}
                    <div className="flex gap-4 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1 bg-[#0076b6] rounded-full inline-block"></span>
                        <span className="text-[#0076b6]">Hoy</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-1 border-b border-dashed border-gray-400 inline-block"></span>
                        <span className="text-gray-400">Promedio general</span>
                      </div>
                    </div>
                  </div>

                  {/* Flexible visual column alignment resembling dynamic metrics */}
                  <div className="h-44 flex items-end pt-8 pb-4 relative px-4 text-[10px] font-bold font-mono">
                    {/* Background Grid Lines */}
                    <div className="absolute inset-x-0 top-1/4 border-b border-gray-150 border-dashed"></div>
                    <div className="absolute inset-x-0 top-2/4 border-b border-gray-150 border-dashed"></div>
                    <div className="absolute inset-x-0 top-3/4 border-b border-gray-150 border-dashed"></div>

                    {/* Simulated curve columns */}
                    <div className="flex-1 flex flex-col justify-end items-center h-full group relative">
                      <div className="w-5 bg-gray-200 border-l border-dashed border-gray-300 h-[25%] rounded-t-sm"></div>
                      <div className="w-3 bg-[#0076b6] hover:bg-[#005c8f] h-[30%] rounded-t-sm absolute bottom-4 transition-all z-10"></div>
                      <span className="mt-1 text-[9px] text-gray-500">08:00</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-end items-center h-full group relative">
                      <div className="w-5 bg-gray-200 border-l border-dashed border-gray-300 h-[45%] rounded-t-sm"></div>
                      <div className="w-3 bg-[#0076b6] hover:bg-[#005c8f] h-[60%] rounded-t-sm absolute bottom-4 transition-all z-10"></div>
                      <span className="mt-1 text-[9px] text-gray-500">10:00</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-end items-center h-full group relative">
                      <div className="w-5 bg-gray-200 border-l border-dashed border-gray-300 h-[70%] rounded-t-sm"></div>
                      <div className="w-3 bg-[#0076b6] hover:bg-[#005c8f] h-[85%] rounded-t-sm absolute bottom-4 transition-all z-10"></div>
                      <span className="mt-1 text-[9px] text-gray-500">12:00</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-end items-center h-full group relative col-span-2">
                      <div className="w-5 bg-red-200 border-l border-dashed border-red-300 h-[80%] rounded-t-sm"></div>
                      <div className="w-3 bg-red-500 h-[95%] rounded-t-sm absolute bottom-4 transition-all z-10"></div>
                      <span className="mt-1 text-[9px] text-gray-500">14:00</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-end items-center h-full group relative">
                      <div className="w-5 bg-gray-200 border-l border-dashed border-gray-300 h-[50%] rounded-t-sm"></div>
                      <div className="w-3 bg-[#0076b6] hover:bg-[#005c8f] h-[65%] rounded-t-sm absolute bottom-4 transition-all z-10"></div>
                      <span className="mt-1 text-[9px] text-gray-500">16:00</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-end items-center h-full group relative">
                      <div className="w-5 bg-gray-200 border-l border-dashed border-gray-300 h-[30%] rounded-t-sm"></div>
                      <div className="w-3 bg-[#0076b6] hover:bg-[#005c8f] h-[40%] rounded-t-sm absolute bottom-4 transition-all z-10"></div>
                      <span className="mt-1 text-[9px] text-gray-500">18:00</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Recent activity list table */}
              <div className="p-6 bg-white rounded-2xl border shadow-sm">
                <div className="flex justify-between items-center pb-4 border-b border-gray-150 mb-4 font-extrabold text-sm text-[#002b49]">
                  <span>ACTIVIDAD DEL CAMPUS RECIENTE</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b uppercase text-[10px] text-gray-400 font-bold tracking-widest pb-3">
                        <th className="py-3 px-4 font-black">Conductor / Estamento</th>
                        <th className="py-3 px-4 font-black">Vehículo / Patente</th>
                        <th className="py-3 px-4 font-black">Ubicación Casilla</th>
                        <th className="py-3 px-4 font-black">Ingreso</th>
                        <th className="py-3 px-4 font-black">Estado Operación</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y">
                      {actividadReciente.map((act, index) => (
                        <tr 
                          key={index} 
                          className={`transition-colors duration-150 hover:bg-slate-50 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-800">{act.conductor}</span>
                              <span className="text-[9px] font-black text-[#00a4e4] tracking-wider mt-0.5">{act.rol}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{act.patente}</td>
                          <td className="py-3.5 px-4">
                            <span className="bg-gray-100 border px-2.5 py-1 rounded-full font-bold text-slate-600">{act.espacio}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-medium font-mono">{act.hora} Hrs</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold tracking-wider ${
                              act.estado === 'ESTACIONADO' 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : act.estado === 'ALERTA_ACTIVA'
                                ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                                : 'bg-gray-100 text-gray-500 border'
                            }`}>
                              {act.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </main>
          </div>
        )}

      </div>

    </div>
  );
}
