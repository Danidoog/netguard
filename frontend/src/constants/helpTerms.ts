export interface HelpTerm {
  id: string;
  category: 'status' | 'trust' | 'identify' | 'security' | 'history';
  term: string;
  definition: string;
  icon: string;
  badge?: {
    text: string;
    color: 'success' | 'warning' | 'muted' | 'danger';
    icon?: string;
  };
}

export const HELP_TERMS: HelpTerm[] = [
  {
    id: 'presente',
    category: 'status',
    term: 'Presente',
    definition: 'El dispositivo respondió al escaneo más reciente; está conectado ahora.',
    icon: 'CircleCheck',
    badge: { text: 'Presente', color: 'success', icon: 'Circle' },
  },
  {
    id: 'ausente',
    category: 'status',
    term: 'Ausente',
    definition: 'Es un dispositivo conocido que no apareció en el último escaneo. Puede estar apagado o fuera de la red.',
    icon: 'CircleMinus',
    badge: { text: 'Ausente', color: 'muted', icon: 'Circle' },
  },
  {
    id: 'confiable',
    category: 'trust',
    term: 'Confiable',
    definition: 'Tú lo marcaste como reconocido y seguro para tu red.',
    icon: 'ShieldCheck',
    badge: { text: 'Confiable', color: 'success', icon: 'Check' },
  },
  {
    id: 'sin-verificar',
    category: 'trust',
    term: 'Sin verificar',
    definition: 'Aún no lo has revisado. Comprueba si lo reconoces y márcalo como confiable si es tuyo.',
    icon: 'ShieldQuestion',
    badge: { text: 'Sin verificar', color: 'warning', icon: 'TriangleAlert' },
  },
  {
    id: 'alias',
    category: 'identify',
    term: 'Alias',
    definition: 'Nombre que tú le pones, como «TV de la sala». Solo aparece si lo asignas.',
    icon: 'Tag',
  },
  {
    id: 'hostname',
    category: 'identify',
    term: 'Hostname',
    definition: 'Nombre que el propio dispositivo anuncia en la red, por ejemplo cable-gw000003. Si no tiene, verás «Sin nombre».',
    icon: 'Monitor',
  },
  {
    id: 'ip',
    category: 'identify',
    term: 'IP',
    definition: 'Dirección del dispositivo en tu red, como 192.168.0.5. Puede cambiar con el tiempo.',
    icon: 'Globe',
  },
  {
    id: 'mac',
    category: 'identify',
    term: 'MAC',
    definition: 'Identificador de su adaptador de red. NetGuard lo usa para reconocer el mismo dispositivo aunque cambie de IP.',
    icon: 'KeyRound',
  },
  {
    id: 'fabricante',
    category: 'identify',
    term: 'Fabricante',
    definition: 'Empresa asociada al hardware del dispositivo. Ejemplos: Intel o Samsung.',
    icon: 'Factory',
  },
  {
    id: 'tipo',
    category: 'identify',
    term: 'Tipo',
    definition: 'Categoría que NetGuard detecta para el dispositivo: Computador, Parlante, TV, etc.',
    icon: 'Smartphone',
  },
  {
    id: 'mac-privada',
    category: 'identify',
    term: 'MAC privada',
    definition: 'Muchos celulares y computadores inventan una MAC distinta en cada red para proteger tu privacidad. Por eso NetGuard no puede saber el fabricante.',
    icon: 'ShieldQuestion',
  },
  {
    id: 'inventario',
    category: 'identify',
    term: 'Inventario',
    definition: 'Lista de dispositivos conocidos por NetGuard, incluidos los que no aparecieron en el escaneo más reciente.',
    icon: 'List',
  },
  {
    id: 'red-escaneada',
    category: 'identify',
    term: 'Red escaneada',
    definition: 'Rango de direcciones IP que NetGuard revisó durante el escaneo.',
    icon: 'Network',
  },
  {
    id: 'puertos-abiertos',
    category: 'security',
    term: 'Puertos abiertos',
    definition: 'Puertos de red que respondieron durante el escaneo y podrían tener un servicio activo.',
    icon: 'Plug',
  },
  {
    id: 'servicios',
    category: 'security',
    term: 'Servicios',
    definition: 'Servicios que el dispositivo anuncia en la red, por ejemplo _googlecast o _spotify-connect.',
    icon: 'Radio',
  },
  {
    id: 'sensible',
    category: 'security',
    term: 'Sensible',
    definition: 'Puerto que conviene revisar (por ejemplo SMB, Telnet, RDP) porque puede exponer el dispositivo.',
    icon: 'TriangleAlert',
  },
  {
    id: 'cambios-de-puertos',
    category: 'security',
    term: 'Cambios de puertos',
    definition: 'Diferencia entre los puertos abiertos de un escaneo y el siguiente.',
    icon: 'RefreshCw',
  },
  {
    id: 'nuevo',
    category: 'history',
    term: 'Nuevo',
    definition: 'Dispositivo que apareció por primera vez en este escaneo.',
    icon: 'UserPlus',
  },
  {
    id: 'volvio',
    category: 'history',
    term: 'Volvió',
    definition: 'Dispositivo que había desaparecido y volvió a aparecer.',
    icon: 'RotateCcw',
  },
  {
    id: 'inestable',
    category: 'history',
    term: 'Inestable',
    definition: 'Dispositivo que aparece y desaparece de la red con frecuencia.',
    icon: 'Activity',
  },
  {
    id: 'salud-de-la-red',
    category: 'history',
    term: 'Salud de la red',
    definition: 'Indicador general de cuántos dispositivos conocidos están marcados como confiables.',
    icon: 'HeartPulse',
  },
  {
    id: 'ultimo-escaneo',
    category: 'history',
    term: 'Último escaneo',
    definition: 'Fecha y hora del escaneo más reciente de la red.',
    icon: 'Clock3',
  },
  {
    id: 'cambios-de-escaneo',
    category: 'history',
    term: 'Cambios del escaneo',
    definition: 'Resumen de los dispositivos nuevos, ausentes o que volvieron a aparecer desde el escaneo anterior.',
    icon: 'History',
  },
];

export const HELP_CATEGORIES: Record<HelpTerm['category'], string> = {
  status: 'Estado',
  trust: 'Confianza',
  identify: 'Identificar un dispositivo',
  security: 'Seguridad',
  history: 'Historial',
};
