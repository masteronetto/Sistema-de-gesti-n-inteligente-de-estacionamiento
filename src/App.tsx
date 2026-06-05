import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// Color Palette Guidelines applied in Tailwind:
// Primary Background/Sidebar: bg-[#002b49] (duoc-navy)
// Primary Accent Buttons/Labels: bg-[#fdb913] text-[#002b49] (duoc-yellow)
// Secondary Actions: bg-[#0076b6] (duoc-blue)
// Link/Info Highlights: text-[#00a4e4] / bg-[#00a4e4] (duoc-sky)

export default function App() {
  // Required states
  const [vista, setVista] = useState<'login' | 'conductor' | 'guardia' | 'gestion'>('login');
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>(inicialAlertas);
  const [espacios, setEspacios] = useState<Espacio[]>(() => generarEspaciosCompletos());

  // Additional interface & simulation states
  const [sessionUser, setSessionUser] = useState<{ email: string; role: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'alert' | 'info' } | null>(null);
  const [isOnline, setIsOnline] = useState(true); // Connectivity simulator
  const [loadingCheckIn, setLoadingCheckIn] = useState<string | null>(null);
  const [selectedEspacioId, setSelectedEspacioId] = useState<string | null>(null);
  
  // Custom Role switcher (used by US-08 context menu check)
  const [currentRole, setCurrentRole] = useState<'conductor' | 'guardia' | 'jefe_seguridad' | 'servicios_generales'>('conductor');

  // Block reporting bottom sheet interactive countdown
  const [blockCountdown, setBlockCountdown] = useState(300); // 5 minutes in seconds
  const [isBlockTimerRunning, setIsBlockTimerRunning] = useState(false);

  // Context Menu State for administrative space reservation (US-08)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; espacioId: string } | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState<string | null>(null);
  const [mantenimientoReason, setMantenimientoReason] = useState('');
  const [mantenimientoError, setMantenimientoError] = useState('');

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
            // Escalate immediately
            setIsBlockTimerRunning(false);
            // Simulate escalation to guard panel
            const blockerSpaceId = checkIn ? (espacios.find(e => e.id === checkIn.espacioId)?.parId || 'A-01-FRENTE') : 'A-01-FRENTE';
            const blockerObj = espacios.find(e => e.id === blockerSpaceId);
            const newId = Date.now();
            const newAlert: Alerta = {
              id: newId,
              patente: blockerObj?.patente || 'BKRT-45',
              espacioBloqueado: checkIn?.espacioId || 'A-01-FONDO',
              espacioBloqueador: blockerSpaceId,
              conductor: blockerObj?.conductor || 'Carlos Pérez',
              telefono: blockerObj?.telefono || '+56912345678',
              estado: 'ESCALADA',
              segundosRestantes: 0
            };
            setAlertas(prev => [newAlert, ...prev]);
            triggerToast("Alerta escalada automáticamente al Panel de Guardia", "alert");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [modalBloqueo, isBlockTimerRunning, checkIn, espacios]);

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
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.endsWith('@duocuc.cl')) {
      setLoginError('Solo usuarios institucionales @duocuc.cl');
      return;
    }

    setIsLoggingIn(true);

    // Simulate 1s authentication database delay
    setTimeout(() => {
      setIsLoggingIn(false);
      let targetRole = 'conductor';
      let targetVista: 'login' | 'conductor' | 'guardia' | 'gestion' = 'conductor';

      if (loginEmail === 'guardia@duocuc.cl') {
        targetRole = 'guardia';
        setCurrentRole('guardia');
        targetVista = 'guardia';
      } else if (loginEmail === 'jefe@duocuc.cl' || loginEmail === 'jefe_seguridad@duocuc.cl') {
        targetRole = 'jefe_seguridad';
        setCurrentRole('jefe_seguridad');
        targetVista = 'gestion';
      } else {
        targetRole = 'conductor';
        setCurrentRole('conductor');
        targetVista = 'conductor';
      }

      setSessionUser({ email: loginEmail, role: targetRole });
      setVista(targetVista);
      triggerToast(`Sesión iniciada con éxito como ${loginEmail}`, 'success');
    }, 1200);
  };

  // Check-In space logic
  const handleSpaceCheckIn = (espacioId: string) => {
    if (!isOnline) {
      triggerToast("Error de conexión. Intente nuevamente.", "alert");
      return;
    }

    const spaceObj = espacios.find(e => e.id === espacioId);
    if (!spaceObj) return;

    if (!puedeSeleccionar(spaceObj, espacios)) {
      if (spaceObj.tipo === 'doble_frente') {
        triggerToast(`Ocupa primero el Fondo [${spaceObj.parId}]`, 'alert');
      } else {
        triggerToast("Este espacio no está disponible", 'alert');
      }
      return;
    }

    setLoadingCheckIn(espacioId);

    // Simulate 1-second cloud function check response delay
    setTimeout(() => {
      setLoadingCheckIn(null);
      
      const now = new Date();
      const horaStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Update local space status
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

      setCheckIn({
        espacioId: espacioId,
        tipo: spaceObj.tipo,
        zona: spaceObj.zona,
        horaEntrada: horaStr
      });

      triggerToast(`Registro exitoso en espacio ${espacioId}`, 'success');
    }, 1000);
  };

  // Checkout space logic
  const handleSpaceCheckout = () => {
    if (!checkIn) return;
    
    const targetId = checkIn.espacioId;

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

    triggerToast(`Salida registrada del espacio ${targetId}`, 'success');
    setCheckIn(null);
    setModalBloqueo(false);
    setIsBlockTimerRunning(false);
  };

  // Checkout any space (Guard panel action)
  const handleGuardCheckout = (espacioId: string) => {
    setEspacios(prevEspacios => 
      prevEspacios.map(e => {
        if (e.id === espacioId) {
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

  const handleConfirmBlockingNotification = () => {
    setIsBlockTimerRunning(false);
    
    // Add active alert on behalf of the blocked driver (FONDO is blocked by FRENTE)
    const blockedId = checkIn?.espacioId || 'A-01-FONDO';
    const spaceFondo = espacios.find(e => e.id === blockedId);
    if (spaceFondo) {
      const frenteId = spaceFondo.parId || 'A-01-FRENTE';
      const spaceFrente = espacios.find(e => e.id === frenteId);
      
      const newAlertId = Date.now();
      const newAlertObj: Alerta = {
        id: newAlertId,
        patente: spaceFrente?.patente || 'BKRT-45',
        espacioBloqueado: blockedId,
        espacioBloqueador: frenteId,
        conductor: spaceFrente?.conductor || 'Carlos Pérez',
        telefono: spaceFrente?.telefono || '+56912345678',
        estado: 'NUEVO',
        segundosRestantes: 300
      };

      setAlertas(prev => [newAlertObj, ...prev]);

      // Set FRENTE space status to alert
      setEspacios(prev => prev.map(e => {
        if (e.id === frenteId) {
          return { ...e, estado: 'alerta' };
        }
        return e;
      }));
    }

    setModalBloqueo(false);
    triggerToast("Notificación enviada al conductor bloqueador", "success");
  };

  const handleFastForwardCounter = () => {
    // Simulated fast forward to escalation status (force 1 second)
    setBlockCountdown(1);
  };

  const handleEscalateDriverImmediately = () => {
    setIsBlockTimerRunning(false);
    
    const blockedId = checkIn?.espacioId || 'A-01-FONDO';
    const spaceFondo = espacios.find(e => e.id === blockedId);
    if (spaceFondo) {
      const frenteId = spaceFondo.parId || 'A-01-FRENTE';
      const spaceFrente = espacios.find(e => e.id === frenteId);
      const newAlertId = Date.now();
      
      const newAlertObj: Alerta = {
        id: newAlertId,
        patente: spaceFrente?.patente || 'BKRT-45',
        espacioBloqueado: blockedId,
        espacioBloqueador: frenteId,
        conductor: spaceFrente?.conductor || 'Carlos Pérez',
        telefono: spaceFrente?.telefono || '+56912345678',
        estado: 'ESCALADA',
        segundosRestantes: 0
      };

      setAlertas(prev => [newAlertObj, ...prev]);

      setEspacios(prev => prev.map(e => {
        if (e.id === frenteId) {
          return { ...e, estado: 'alerta' };
        }
        return e;
      }));
    }

    setModalBloqueo(false);
    triggerToast("Alerta escalada de inmediato al guardia de turno", "alert");
  };

  // Guard Actions
  const handleResolveAlert = (alertId: number, blockFrenteId: string) => {
    setAlertas(prev => prev.filter(a => a.id !== alertId));
    
    // Switch FRENTE space state back to simple occupied or previous status
    setEspacios(prev => prev.map(e => {
      if (e.id === blockFrenteId && e.estado === 'alerta') {
        return { ...e, estado: 'ocupado' };
      }
      return e;
    }));

    triggerToast("Resolución escalada procesada limpia", "success");
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
    if (currentRole === 'conductor') return;

    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      espacioId
    });
  };

  const handleAdminReserve = (espacioId: string) => {
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
    triggerToast(`Espacio ${espacioId} reservado de forma administrativa`, "success");
  };

  const handleAdminMaintenanceStart = (espacioId: string) => {
    setShowMaintenanceForm(espacioId);
    setMantenimientoReason('');
    setMantenimientoError('');
  };

  const handleConfirmMaintenance = (e: React.FormEvent, espacioId: string) => {
    e.preventDefault();
    if (mantenimientoReason.trim().length < 10) {
      setMantenimientoError('Debe ingresar un motivo de al menos 10 caracteres');
      return;
    }

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

    triggerToast(`Espacio ${espacioId} puesto en mantenimiento`, "info");
    setShowMaintenanceForm(null);
  };

  const handleAdminClearToAvailable = (espacioId: string) => {
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
    triggerToast(`Espacio ${espacioId} ahora disponible`, "success");
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
                  <label className="block text-xs font-semibold uppercase text-gray-600 tracking-wider mb-2">Correo Duoc UC</label>
                  <div className="relative">
                    <input 
                      type="text"
                      id="login-email-input"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="conductor@duocuc.cl o guardia@duocuc.cl"
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
                      type={showPassword ? "text" : "password"}
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
                      title={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
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

              <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-500">
                <p>Uso institucional exclusivo para Duoc UC Sede Maipú.</p>
                <div className="mt-3 flex justify-center gap-3">
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => { setLoginEmail('conductor@duocuc.cl'); setLoginPassword('duocsec123'); }} className="text-[#0076b6] font-semibold hover:underline">Demo Conductor</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => { setLoginEmail('guardia@duocuc.cl'); setLoginPassword('duocguard1'); }} className="text-[#00a4e4] font-semibold hover:underline">Demo Guardia</button>
                  <span className="text-gray-300">|</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* VIEW 2 — VISTA CONDUCTOR (Mobile Screen Simulator) */}
        {vista === 'conductor' && (
          <div className="flex-1 py-8 px-4 flex items-center justify-center bg-gray-100">
            <div className="w-full max-w-[390px] min-h-[680px] bg-[#f7f9fb] rounded-[40px] shadow-2xl border-[12px] border-gray-900 relative overflow-hidden flex flex-col select-none">
              
              {/* Phone Camera Notch & Clock Bar */}
              <div className="bg-[#002b49] text-white pt-3 pb-2 px-6 flex justify-between items-center text-xs font-bold shrink-0 z-40">
                <span>15:22</span>
                <div className="w-[110px] h-[18px] bg-black rounded-full absolute left-1/2 -translate-x-1/2"></div>
                <div className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Maipú_5G</span>
                </div>
              </div>

              {/* Institutional Header */}
              <header className="bg-[#002b49] text-white p-4 flex items-center justify-between border-b border-[#001d34] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="bg-[#fdb913] text-[#002b49] p-1 rounded-lg">
                    <Car className="w-5 h-5 shrink-0" />
                  </span>
                  <div>
                    <h2 className="font-bold text-sm leading-none tracking-tight text-white">SGE-Duoc</h2>
                    <span className="text-[10px] font-semibold tracking-wide text-[#00a4e4] uppercase">DUOC UC MAIPÚ</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Network error stimulator */}
                  <button 
                    onClick={() => {
                      setIsOnline(!isOnline);
                      triggerToast(isOnline ? "Simulando desconexión de red" : "Señal restablecida", isOnline ? "alert" : "success");
                    }} 
                    className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${isOnline ? 'text-green-400 hover:bg-white/10' : 'text-amber-400 bg-amber-500/10 animate-pulse'}`}
                    title={isOnline ? "Fuerza Desconexión Red" : "Forzar Conexión Online"}
                  >
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </button>
                  
                  <div className="w-[32px] h-[32px] bg-[#0076b6] rounded-full flex items-center justify-center text-xs text-white font-bold uppercase border border-white/20">
                    {sessionUser?.email.charAt(0) || 'C'}
                  </div>
                </div>
              </header>

              {/* Offline Banner alert (CA-04.6) */}
              {!isOnline && (
                <div className="bg-[#f59e0b] text-[#002b49] px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-bold shrink-0 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                  <span>Sin conexión. Reintentando...</span>
                </div>
              )}

              {/* Conductor Body Content Scroll Region */}
              <div className="flex-1 overflow-y-auto pb-20 p-4">
                
                {/* Sub-screen A: Availability Map (checkIn === null) */}
                {checkIn === null ? (
                  <div className="space-y-4">
                    {/* Top Summary Card (CA-03.1) */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-150 relative">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-3xl font-extrabold text-[#002b49]">{espaciosDisponibles}</p>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest leading-none mt-1">espacios disponibles de {totalEspacios}</p>
                        </div>
                        <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">ESTADO FLUIDO</span>
                      </div>

                      {/* Multi-colored occupancy progress bar */}
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-3 mb-1">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            occupancyPercentage < 50 ? 'bg-green-500' : occupancyPercentage < 85 ? 'bg-[#fdb913]' : 'bg-red-500'
                          }`}
                          style={{ width: `${occupancyPercentage}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2 font-medium">
                        <span>Ocupado: {occupancyPercentage}%</span>
                        <span>Actualizado hace 5s</span>
                      </div>
                    </div>

                    {/* Zone Info Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-[#002b49] flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#0076b6] shrink-0 mt-0.5" />
                      <p className="font-medium">
                        Plan Maipú: Para evitar quedar atrapado, complete primero los casilleros de atrás (<b className="text-indigo-700 font-bold">FONDO</b>) antes de tapar con un auto (<b className="text-orange-700 font-semibold">FRENTE</b>).
                      </p>
                    </div>

                    {/* Zone Grid Section A, B, C */}
                    {['A', 'B', 'C'].map(zonaName => (
                      <div key={zonaName} className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                          <h4 className="font-extrabold text-[#002b49] text-sm">Zona {zonaName} — Maipú Centro</h4>
                          <span className="text-xs text-gray-400 font-semibold">
                            {filterByZone(zonaName).filter(e => e.estado === 'disponible').length} Libres
                          </span>
                        </div>

                        {/* Cells organize double spaces coupled */}
                        <div className="grid grid-cols-2 gap-3" id={`zone-grid-${zonaName}`}>
                          {/* We pair double elements side-by-side inside blocks, and simple ones solitary */}
                          {/* To render pairs elegantly, we iterate and group double spaces */}
                          {(() => {
                            const zoneElements = filterByZone(zonaName);
                            const renderedPairs: string[] = [];
                            const elementsToRender: React.ReactNode[] = [];

                            zoneElements.forEach((esp) => {
                              if (renderedPairs.includes(esp.id)) return;

                              if (esp.tipo === 'simple') {
                                // Single column item
                                const selectionValid = puedeSeleccionar(esp, espacios);
                                const isSelected = loadingCheckIn === esp.id;

                                elementsToRender.push(
                                  <div key={esp.id} className="col-span-2 p-1.5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <div className="flex justify-between items-center gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                        <span className="font-extrabold text-sm text-[#002b49]">{esp.id}</span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Simple</span>
                                      </div>

                                      <button
                                        onClick={() => handleSpaceCheckIn(esp.id)}
                                        disabled={esp.estado !== 'disponible' || isSelected}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all h-[36px] min-w-[75px] flex items-center justify-center ${
                                          esp.estado === 'disponible' 
                                            ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border'
                                        }`}
                                      >
                                        {isSelected ? (
                                          <svg className="animate-spin h-3.5 w-3.5 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        ) : esp.estado === 'disponible' ? (
                                          "Ocupar"
                                        ) : esp.estado === 'ocupado' ? (
                                          "Ocupado"
                                        ) : esp.estado === 'reservado' ? (
                                          "Reservado"
                                        ) : "Bloqueado"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              } else {
                                // Double spaces. Find partner
                                const parSpot = zoneElements.find(e => e.id === esp.parId);
                                if (parSpot) {
                                  renderedPairs.push(esp.id);
                                  renderedPairs.push(parSpot.id);

                                  // Decide which is FONDO vs FRENTE
                                  const fondoSpot = esp.tipo === 'doble_fondo' ? esp : parSpot;
                                  const frenteSpot = esp.tipo === 'doble_frente' ? esp : parSpot;

                                  const canSelectFrente = puedeSeleccionar(frenteSpot, espacios);
                                  const canSelectFondo = puedeSeleccionar(fondoSpot, espacios);

                                  const isFondoSelected = loadingCheckIn === fondoSpot.id;
                                  const isFrenteSelected = loadingCheckIn === frenteSpot.id;

                                  elementsToRender.push(
                                    <div key={`${fondoSpot.id}-pair`} className="col-span-2 border border-gray-200 bg-slate-50/50 rounded-xl p-3 relative shadow-inner">
                                      <div className="absolute top-2.5 right-3 text-[9px] uppercase font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <LockKeyhole className="w-2.5 h-2.5 shrink-0" /> Casilla Doble
                                      </div>

                                      {/* Visual bracket connectors to satisfy CA-03.3 */}
                                      <div className="flex items-center gap-1.5 mb-2.5">
                                        <div className="w-1.5 h-4 border-l-2 border-y-2 border-[#0076b6] rounded-l-md"></div>
                                        <span className="text-[10px] text-[#0076b6] font-bold uppercase tracking-wider">PAR COMPARTIDO</span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        {/* FONDO slot box */}
                                        <div className={`p-2 rounded-lg border flex flex-col justify-between min-h-[105px] transition-all bg-white shadow-sm ${
                                          fondoSpot.estado === 'disponible' 
                                            ? 'border-green-300' 
                                            : 'border-red-200 bg-red-50/20'
                                        }`}>
                                          <div>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="font-extrabold text-xs text-[#002b49]">{fondoSpot.id}</span>
                                              <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-black uppercase">FONDO</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-semibold leading-tight">Ubicación atrás</p>
                                          </div>

                                          <button
                                            onClick={() => handleSpaceCheckIn(fondoSpot.id)}
                                            disabled={!canSelectFondo || isFondoSelected}
                                            className={`w-full min-h-[36px] py-1 text-xs font-bold rounded-md transition-all flex items-center justify-center ${
                                              canSelectFondo
                                                ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95 shadow-sm'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border'
                                            }`}
                                          >
                                            {isFondoSelected ? (
                                              <svg className="animate-spin h-3.5 w-3.5 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                            ) : fondoSpot.estado === 'disponible' ? (
                                              "Ocupar"
                                            ) : "Lleno"}
                                          </button>
                                        </div>

                                        {/* FRENTE slot box (Visual disabled rule checking CA-04.2) */}
                                        <div className={`p-2 rounded-lg border flex flex-col justify-between min-h-[105px] transition-all bg-white shadow-sm relative group ${
                                          frenteSpot.estado === 'disponible' 
                                            ? canSelectFrente 
                                              ? 'border-green-300' 
                                              : 'border-gray-200 bg-gray-50/70' 
                                            : frenteSpot.estado === 'alerta'
                                            ? 'border-yellow-400 bg-yellow-50/20'
                                            : 'border-red-200'
                                        }`}>
                                          <div>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="font-extrabold text-xs text-[#002b49]">{frenteSpot.id}</span>
                                              <span className="text-[8px] bg-orange-50 text-orange-700 px-1 py-0.2 rounded font-black uppercase">FRENTE</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-semibold leading-tight">Ubicación delante</p>
                                          </div>

                                          {/* Rule warning info indicator if FRENTE is blocked because FONDO is available */}
                                          {frenteSpot.estado === 'disponible' && !canSelectFrente && (
                                            <div className="p-1 text-[8px] leading-tight text-amber-700 bg-amber-50 rounded-md border border-amber-200 my-0.5 flex gap-1 items-start">
                                              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                              <span>Ocupa primero el Fondo [{frenteSpot.parId}]</span>
                                            </div>
                                          )}

                                          <button
                                            onClick={() => handleSpaceCheckIn(frenteSpot.id)}
                                            disabled={!canSelectFrente || isFrenteSelected}
                                            className={`w-full min-h-[36px] py-1 text-xs font-bold rounded-md transition-all flex items-center justify-center ${
                                              canSelectFrente
                                                ? 'bg-green-600 hover:bg-green-700 text-white active:scale-95 shadow-sm'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border'
                                            }`}
                                            title={!canSelectFrente && frenteSpot.estado === 'disponible' ? `Ocupa primero el Fondo [${frenteSpot.parId}]` : ''}
                                          >
                                            {isFrenteSelected ? (
                                              <svg className="animate-spin h-3.5 w-3.5 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                            ) : frenteSpot.estado === 'disponible' ? (
                                              "Ocupar"
                                            ) : frenteSpot.estado === 'alerta' ? (
                                              "Bloqueo"
                                            ) : "Lleno"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              }
                            });

                            return <>{elementsToRender}</>;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  
                  /* Sub-screen B: Active Parking Space Screen (checkIn !== null) */
                  <div className="space-y-5 animate-slideUp">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150 text-center relative overflow-hidden">
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-green-50 rounded-full flex items-center justify-center z-0">
                        <CheckCircle className="w-16 h-16 text-green-200 translate-x-5 -translate-y-5" />
                      </div>

                      <div className="relative z-10">
                        <span className="bg-green-50 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-green-200">
                          Estacionado
                        </span>
                        
                        <h3 className="text-5xl font-black text-[#002b49] my-6 tracking-tight">
                          {checkIn.espacioId}
                        </h3>

                        <div className="inline-flex items-center gap-1.5 bg-gray-50 border px-3 py-1.5 rounded-full text-xs font-semibold text-gray-500 mb-6">
                          <MapPin className="w-4 h-4 text-[#0076b6]" />
                          <span>Zona {checkIn.zona} • Sgto Maipú</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 divide-x divide-gray-100 bg-gray-50 p-4 rounded-2xl border">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Entrada</p>
                            <p className="text-base font-extrabold text-[#002b49] mt-0.5">{checkIn.horaEntrada} Hrs</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Duración</p>
                            <p className="text-base font-extrabold text-[#0076b6] mt-0.5 flex justify-center items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{formatTime(elapsedSeconds)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CA-06.1 Block trigger logic */}
                    {isPairedFrenteOccupiedForCheckIn ? (
                      <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 relative overflow-hidden animate-fadeIn">
                        <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-100/50 rounded-full z-0"></div>
                        
                        <div className="relative z-10 space-y-4">
                          <div className="flex gap-2.5 items-start">
                            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <h4 className="font-extrabold text-sm text-[#002b49]">¿Estás bloqueado por el auto de adelante?</h4>
                              <p className="text-xs text-gray-600 leading-normal mt-1">
                                El espacio de enfrente <b>{espacios.find(e => e.id === checkIn.espacioId)?.parId}</b> está ocupado. Puedes enviarle una solicitud silenciosa para que retire el vehículo.
                              </p>
                            </div>
                          </div>

                          <button 
                            type="button" 
                            id="report-blocking-btn"
                            onClick={handleReportBlocking}
                            className="w-full min-h-[44px] bg-[#fdb913] hover:bg-[#e2a40a] text-[#002b49] font-extrabold rounded-xl transition-transform duration-150 active:scale-95 shadow-md flex items-center justify-center gap-2"
                          >
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>REPORTAR BLOQUEO</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      checkIn.tipo === 'doble_fondo' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-5 h-5 shrink-0" />
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-[#002b49]">Salida despejada</p>
                            <p className="text-[10px] text-gray-500 leading-normal font-medium">El espacio de adelante está disponible. No hay vehículos obstruyendo tu salida.</p>
                          </div>
                        </div>
                      )
                    )}

                    <div className="space-y-3">
                      <button 
                        onClick={handleSpaceCheckout}
                        className="w-full min-h-[44px] bg-[#002b49] hover:bg-[#001c30] text-white font-extrabold rounded-xl transition-all shadow-md active:scale-95"
                      >
                        REGISTRAR SALIDA
                      </button>
                      <p className="text-center text-[10px] font-semibold text-gray-400">Por favor, libere el espacio al retirarse para mantener el campus en orden.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom sheet report blocking modal (US-06) */}
              <AnimatePresence>
                {modalBloqueo && (
                  <>
                    {/* Dark backdrop */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      onClick={() => { setModalBloqueo(false); setIsBlockTimerRunning(false); }}
                      className="absolute inset-0 bg-black z-50 rounded-[40px]"
                    />
                    
                    {/* Bottom Drawer */}
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                      id="blocker-bottom-sheet"
                      className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 p-6 flex flex-col gap-4 border-t border-gray-100 max-h-[85%]"
                    >
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto cursor-pointer" onClick={() => { setModalBloqueo(false); setIsBlockTimerRunning(false); }}></div>
                      
                      <div className="text-center space-y-2 mt-2">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <AlertTriangle className="w-6 h-6 animate-pulse" />
                        </div>
                        <h3 className="font-extrabold text-lg text-[#002b49]">Tu vehículo está bloqueado</h3>
                        <p className="text-xs text-gray-400 font-medium">Hemos identificado al conductor de la casilla de adelante</p>
                      </div>

                      {/* Blocker driver card */}
                      <div className="bg-gray-50 rounded-2xl p-4 border space-y-3 text-xs">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Casilla Obstructora</span>
                            <p className="font-extrabold text-[#002b49] text-sm mt-0.5">
                              {checkIn ? (espacios.find(e => e.id === checkIn.espacioId)?.parId || 'A-01-FRENTE') : 'A-01-FRENTE'}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Patente Blocker</span>
                            <p className="font-mono font-bold text-red-600 text-sm mt-0.5">BKRT-45</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center bg-white border p-3 rounded-xl gap-2 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-[#0076b6]/10 text-[#0076b6] rounded-full flex items-center justify-center text-xs font-bold font-mono">
                              CP
                            </div>
                            <div>
                              <p className="font-bold text-[#002b49]">Carlos Pérez</p>
                              <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider leading-none">Alumno Maipú</span>
                            </div>
                          </div>
                          <a href="tel:+56912345678" className="h-[36px] px-3 bg-blue-50 text-[#0076b6] rounded-lg font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Llamar</span>
                          </a>
                        </div>

                        {/* Interactive Countdown Timer */}
                        <div className="text-center p-3.5 bg-red-50/50 border border-red-100 rounded-xl">
                          <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest leading-none">Tiempo de espera estimado</span>
                          <p className="text-3xl font-black text-red-600 mt-1 font-mono tracking-tighter">
                            {formatTime(blockCountdown)}
                          </p>
                          <p className="text-[9px] text-gray-400 font-medium leading-normal mt-1">Si el conductor no arriba en 5 minutos, el caso pasará automáticamente a escalada con guardias.</p>
                          
                          {/* Fast forward mechanic for demonstration */}
                          <div className="mt-2 text-right">
                            <button 
                              type="button" 
                              onClick={handleFastForwardCounter} 
                              className="text-[9px] bg-[#fdb913]/20 hover:bg-[#fdb913]/30 text-[#002b49] font-bold px-2 py-0.5 rounded border border-[#fdb913]"
                            >
                              Simular 5m
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bottom action elements (CA-06.2) */}
                      <div className="space-y-2 mt-auto">
                        <button
                          type="button"
                          onClick={handleConfirmBlockingNotification}
                          className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>El conductor está respondiendo</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleEscalateDriverImmediately}
                          className="w-full min-h-[44px] border border-red-500 text-red-600 hover:bg-red-50 font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Escalar al guardia ahora</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Smartphone simulated bottom navbar */}
              <nav className="absolute bottom-0 left-0 w-full h-[56px] bg-white border-t border-gray-100 flex items-center justify-around text-center z-40 shrink-0">
                <button className="flex flex-col items-center justify-center text-[#0076b6] focus:outline-none">
                  <Car className="w-5 h-5" />
                  <span className="text-[10px] font-bold mt-0.5">Estacionar</span>
                </button>
                <div className="w-12 h-12 bg-white rounded-full -translate-y-4 border border-gray-150 flex items-center justify-center shadow-lg hover:scale-105 duration-200 cursor-pointer">
                  <div className="w-10 h-10 bg-[#002b49] rounded-full flex items-center justify-center text-white">
                    <Plus className="w-5 h-5 text-[#fdb913]" />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setVista('login');
                    setSessionUser(null);
                    triggerToast("Sesión de conductor finalizada");
                  }} 
                  className="flex flex-col items-center justify-center text-gray-400 hover:text-red-500 focus:outline-none"
                >
                  <X className="w-5 h-5" />
                  <span className="text-[10px] font-bold mt-0.5">Salir</span>
                </button>
              </nav>

            </div>
          </div>
        )}

        {/* VIEW 3 — PANEL GUARDIA (Tablet View, landscape 1024px compliant) */}
        {vista === 'guardia' && (
          <div className="flex-1 flex bg-gray-50" id="guard-tablet-view">
            
            {/* Sidebar navigation (CA-05.1) */}
            <aside className="w-64 bg-[#002b49] text-white flex flex-col p-6 shrink-0 shadow-lg relative">
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
                  onClick={() => { setVista('login'); setSessionUser(null); triggerToast("Sesión cerrada."); }} 
                  className="w-full mt-4 min-h-[44px] border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold rounded-xl text-xs transition-colors py-2 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </aside>

            {/* Main Area: 70% width */}
            <main className="flex-1 flex flex-col min-w-0" style={{ width: '70%' }}>
              
              {/* Header inside Panel */}
              <header className="bg-white border-b h-16 shrink-0 px-8 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-[#002b49] text-base">Sede Maipú</span>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1.5">
                    {/* Active Connection state indicator (CA-05.5) */}
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-100 animate-pulse"></span>
                    <span className="text-xs font-bold text-[#002b49]">Realtime activo</span>
                  </div>
                </div>

                {/* Clock indicator */}
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 border px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4 text-[#0076b6]" />
                  <span>UTC 15:22:33</span>
                </div>
              </header>

              {/* KPI metrics bar (CA-05.2) */}
              <div className="bg-[#002b49] text-white p-4 px-8 flex flex-wrap gap-4 items-center justify-between shadow-inner shrink-0">
                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15">
                    <Car className="w-5 h-5 text-gray-300" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 leading-none">Total Espacios</span>
                    <p className="font-black text-sm">{totalEspacios}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 leading-none">Ocupados</span>
                    <p className="font-black text-sm text-red-400">{totalEspacios - espaciosDisponibles}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15">
                    <Wrench className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 leading-none">Disponibles</span>
                    <p className="font-black text-sm text-green-400">{espaciosDisponibles}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="p-1.5 bg-[#001d34] rounded-lg border border-white/15">
                    <AlertTriangle className="w-5 h-5 text-[#fdb913]" />
                  </div>
                  <div className="bg-[#fdb913] text-[#002b49] px-2.5 py-1 rounded-lg">
                    <span className="text-[9px] font-extrabold leading-none uppercase block">Alertas activas</span>
                    <p className="font-black text-base text-center leading-none mt-0.5">{alertas.length}</p>
                  </div>
                </div>
              </div>

              {/* Interactive Map Layout area (70%) */}
              <div className="flex-1 p-8 overflow-y-auto min-h-0 space-y-6">

                {/* Sub-system warning info tool details */}
                <div className="bg-white rounded-2xl p-4 border shadow-sm flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#002b49] text-xs">Instrucciones de Administración de Casillas</h4>
                    <p className="text-[10px] text-gray-500 leading-normal mt-1">
                      Haga clic en cualquier casilla ocupada para inspeccionar al conductor titular y su patente. 
                      <b className="text-[#0076b6] ml-1">Para tareas de reservas o mantenciones directas:</b> Haga clic derecho (o mantenga presionado) sobre la casilla para abrir el menú contextual administrativo.
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

                {/* CSS Grid Map organizes Zones A, B, C, D (CA-05.3) */}
                <div className="space-y-6">
                  {['A', 'B', 'C', 'D'].map(zonaName => (
                    <div key={zonaName} className="bg-white rounded-2xl p-6 border shadow-sm space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <h3 className="font-black text-base text-[#002b49] tracking-tight flex items-center gap-2">
                          <span className="w-2 h-5 bg-[#0076b6] rounded-sm"></span>
                          Zona Estacionamiento {zonaName}
                        </h3>
                        <span className="text-xs text-gray-400 font-bold bg-gray-50 border px-3 py-1 rounded-full uppercase">
                          SECTOR COMPLETO
                        </span>
                      </div>

                      {/* Map Grid Container layout (CA-05.3) */}
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3" id={`map-grid-${zonaName}`}>
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
                              className={`aspect-square rounded-xl p-2.5 border-2 flex flex-col justify-between cursor-pointer relative transition-all duration-200 select-none ${
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
                              style={{ minHeight: '64px' }}
                              title={`${esp.id} - Haga clic derecho para Menu Administrativo`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-xs">{esp.id}</span>
                                {esp.tipo === 'doble_fondo' && <span className="text-[7px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-black uppercase">FONDO</span>}
                                {esp.tipo === 'doble_frente' && <span className="text-[7px] bg-amber-200 text-amber-700 px-1 py-0.2 rounded font-black uppercase">FRENTE</span>}
                              </div>

                              {/* Central visual indicator icon based on status */}
                              <div className="flex justify-center my-1">
                                {hasAlert ? (
                                  <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />
                                ) : isMaint ? (
                                  <Wrench className="w-5 h-5 text-gray-400" />
                                ) : isRes ? (
                                  <Lock className="w-5 h-5 text-blue-500" />
                                ) : isOcup ? (
                                  <Car className="w-5 h-5 text-[#002b49] shrink-0" />
                                ) : (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                )}
                              </div>

                              <span className="text-[8px] font-black uppercase text-center tracking-wider block mt-auto leading-none">
                                {hasAlert ? 'ALERTA' : isMaint ? 'MANUTENCION' : isRes ? 'RESERVADO' : isOcup ? 'OCUPADO' : 'LIBRE'}
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

                {/* Inline Drawer/Panel details for single click selected space (CA-05.4) */}
                {selectedEspacioId && (() => {
                  const s = espacios.find(e => e.id === selectedEspacioId);
                  if (!s) return null;
                  
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#002b49] text-white rounded-2xl p-6 shadow-xl border-l-8 border-[#fdb913] relative overflow-hidden"
                    >
                      <button 
                        onClick={() => setSelectedEspacioId(null)}
                        className="absolute top-4 right-4 text-white/60 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div>
                          <span className="text-[10px] text-gray-300 uppercase font-bold tracking-widest">Información Casilla</span>
                          <h4 className="text-3xl font-black text-[#fdb913] mt-1">{s.id}</h4>
                          <p className="text-xs text-slate-300 font-semibold mt-1">
                            Tipo de espacio: <b className="text-[#00a4e4] uppercase">{s.tipo.replace('_', ' ')}</b>
                          </p>
                          {s.mantenimientoRazon && (
                            <p className="mt-2 text-xs bg-black/20 p-2.5 rounded-lg border border-white/5 text-slate-200">
                              <b>Motivo:</b> {s.mantenimientoRazon}
                            </p>
                          )}
                        </div>

                        {s.estado === 'ocupado' || s.estado === 'alerta' ? (
                          <>
                            <div className="space-y-1 text-sm bg-black/20 p-4 rounded-xl border border-white/5">
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Conductor Titular</span>
                              <p className="font-extrabold text-white text-base flex items-center gap-1.5">
                                <User className="w-4 h-4 text-[#fdb913]" />
                                {s.conductor || 'Rodrigo Silva'}
                              </p>
                              <p className="font-mono text-xs text-red-400 font-bold">Patente: {s.patente || 'HZLW-89'}</p>
                              <p className="text-xs text-slate-200">Hora Ingreso: {s.horaEntrada || '14:50'} Hrs</p>
                            </div>

                            <div className="space-y-3.5">
                              {s.telefono && (
                                <a 
                                  href={`tel:${s.telefono}`}
                                  className="w-full min-h-[44px] bg-[#0076b6] hover:bg-[#005c8f] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                                >
                                  <Phone className="w-4 h-4" />
                                  <span>Llamar al Conductor ({s.telefono})</span>
                                </a>
                              )}
                              <button 
                                onClick={() => handleGuardCheckout(s.id)}
                                className="w-full min-h-[44px] bg-[#fdb913] hover:bg-[#e2a40a] text-[#002b49] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Registrar Salida (Forzar Salida)</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 text-center py-6 border border-dashed border-white/10 rounded-xl">
                            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <p className="font-bold text-sm text-[#fdb913]">El casillero está disponible</p>
                            <p className="text-xs text-slate-300 mt-1">No hay conductores registrados ocupando el estacionamiento en este momento.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}

              </div>
            </main>

            {/* Right sidebar: Alerts 30% width (CA-05.1, CA-07.1) */}
            <aside className="w-80 bg-white border-l shrink-0 p-6 flex flex-col gap-5 overflow-y-auto" style={{ width: '30%' }}>
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="font-extrabold text-[#002b49] text-sm tracking-wide">ALERTAS OPERATIVAS</span>
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

      {/* STICKY RELEVANT DEVELOPER TOOLBAR (z-50) */}
      <footer className="fixed bottom-0 left-0 right-0 z-[1100] bg-[#002b49] text-white p-3 border-t-2 border-[#fdb913] flex flex-wrap gap-4 items-center justify-between select-none px-6">
        <div className="flex items-center gap-2">
          <span className="bg-[#fdb913] text-[#002b49] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
            DEV TOOLBAR
          </span>
          <p className="text-xs text-slate-300 font-semibold">
            Prueba de perfiles y vistas SGE-Duoc:
          </p>
        </div>

        {/* View togglers */}
        <div className="flex gap-1.5 bg-[#001d34] p-1 rounded-lg border border-white/5">
          <button 
            type="button"
            onClick={() => setVista('login')}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              vista === 'login' ? 'bg-[#fdb913] text-[#002b49]' : 'text-slate-300 hover:text-white'
            }`}
          >
            1. Login
          </button>
          
          <button 
            type="button"
            onClick={() => {
              setVista('conductor');
              // Automatically sign in mock conductor if not signed in
              if (!sessionUser) setSessionUser({ email: 'conductor@duocuc.cl', role: 'conductor' });
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              vista === 'conductor' ? 'bg-[#fdb913] text-[#002b49]' : 'text-slate-300 hover:text-white'
            }`}
          >
            2. Conductor
          </button>

          <button 
            type="button"
            onClick={() => {
              setVista('guardia');
              setCurrentRole('guardia');
              if (!sessionUser) setSessionUser({ email: 'guardia@duocuc.cl', role: 'guardia' });
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              vista === 'guardia' ? 'bg-[#fdb913] text-[#002b49]' : 'text-slate-300 hover:text-white'
            }`}
          >
            3. Guardia
          </button>

          <button 
            type="button"
            onClick={() => {
              setVista('gestion');
              setCurrentRole('jefe_seguridad');
              if (!sessionUser) setSessionUser({ email: 'jefe_seguridad@duocuc.cl', role: 'jefe_seguridad' });
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              vista === 'gestion' ? 'bg-[#fdb913] text-[#002b49]' : 'text-slate-300 hover:text-white'
            }`}
          >
            4. Gestión
          </button>
        </div>

        {/* Role emulator for US-08 context menu visibility */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rol Activo:</span>
          <select 
            value={currentRole} 
            onChange={(e) => {
              const r = e.target.value as any;
              setCurrentRole(r);
              triggerToast(`Rol simulado cambiado a ${r.toUpperCase()}`, 'info');
            }}
            className="bg-[#001d34] text-xs font-bold text-white border-none py-1 pl-2 pr-8 rounded focus:ring-1 focus:ring-[#fdb913] outline-none"
          >
            <option value="conductor">Conductor (Sin Admin)</option>
            <option value="guardia">Guardia (Con Admin)</option>
            <option value="jefe_seguridad">Jefe Seguridad (Con Admin)</option>
            <option value="servicios_generales">Sev. Generales (Con Admin)</option>
          </select>
        </div>
      </footer>

    </div>
  );
}
